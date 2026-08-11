from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, Body
from typing import Dict, Any, List
from datetime import datetime
from backend.models import ChatRequest, ChatResponse, CompanyProfile
from backend.auth import get_optional_current_user
from backend.database import get_db
from backend.services.gemini_service import process_conversational_turn, calculate_completeness
from backend.services.doc_service import process_document_and_extract

router = APIRouter(prefix="/api/onboarding", tags=["Onboarding"])

@router.get("/profile", response_model=CompanyProfile)
async def get_user_profile(current_user: dict = Depends(get_optional_current_user)):
    db = await get_db()
    profile_doc = await db.profiles.find_one({"user_id": current_user["id"]})
    if not profile_doc:
        new_profile = CompanyProfile()
        profile_dict = new_profile.model_dump()
        profile_dict["user_id"] = current_user["id"]
        profile_dict["created_at"] = datetime.utcnow()
        await db.profiles.insert_one(profile_dict)
        return new_profile
    
    profile_doc.pop("_id", None)
    profile_doc.pop("user_id", None)
    profile_doc.pop("created_at", None)
    profile_doc.pop("updated_at", None)
    
    # Recalculate completeness
    score = calculate_completeness(profile_doc)
    profile_doc["profile_completeness"] = score
    return CompanyProfile(**profile_doc)

@router.put("/profile", response_model=CompanyProfile)
async def update_user_profile(
    updates: Dict[str, Any] = Body(...),
    current_user: dict = Depends(get_optional_current_user)
):
    user_id = current_user["id"]
    db = await get_db()

    profile_doc = await db.profiles.find_one({"user_id": user_id}) or {}
    profile_doc.pop("_id", None)
    profile_doc.pop("user_id", None)

    # Merge explicit manual edits
    for k, v in updates.items():
        if k not in ["_id", "user_id", "created_at"]:
            profile_doc[k] = v

    score = calculate_completeness(profile_doc)
    profile_doc["profile_completeness"] = score

    save_doc = {**profile_doc, "user_id": user_id, "updated_at": datetime.utcnow()}
    await db.profiles.update_one(
        {"user_id": user_id},
        {"$set": save_doc},
        upsert=True
    )

    # Recalculate health report if health engine exists
    try:
        from backend.services.health_engine import calculate_health
        await calculate_health(user_id)
    except Exception as e:
        print(f"[onboarding] Error calculating health on profile update: {e}")

    profile_doc.pop("updated_at", None)
    return CompanyProfile(**profile_doc)


@router.get("/history")
async def get_chat_history(current_user: dict = Depends(get_optional_current_user)):
    db = await get_db()
    conv = await db.conversations.find_one({"user_id": current_user["id"]})
    if not conv:
        return {"messages": []}
    return {"messages": conv.get("messages", [])}

@router.post("/chat", response_model=ChatResponse)
async def onboarding_chat(payload: ChatRequest, current_user: dict = Depends(get_optional_current_user)):
    user_id = current_user["id"]
    db = await get_db()

    # 1. Fetch current profile & history
    profile_doc = await db.profiles.find_one({"user_id": user_id})
    if not profile_doc:
        profile_obj = CompanyProfile()
        profile_dict = profile_obj.model_dump()
    else:
        profile_doc.pop("_id", None)
        profile_doc.pop("user_id", None)
        profile_doc.pop("created_at", None)
        profile_doc.pop("updated_at", None)
        profile_dict = profile_doc

    conv_doc = await db.conversations.find_one({"user_id": user_id})
    messages = conv_doc.get("messages", []) if conv_doc else []

    # Append user message
    user_msg = {"role": "user", "content": payload.message, "timestamp": datetime.utcnow().isoformat()}
    messages.append(user_msg)

    # 2. Process via Gemini Service
    ai_result = await process_conversational_turn(messages, profile_dict)

    assistant_reply = ai_result.get("assistant_reply", "I understood that. Tell me more about your startup vision!")
    updates = ai_result.get("profile_updates", {})
    missing = ai_result.get("missing_information", [])
    next_focus = ai_result.get("next_focus", "")

    # Append assistant reply
    assistant_msg = {"role": "assistant", "content": assistant_reply, "timestamp": datetime.utcnow().isoformat()}
    messages.append(assistant_msg)

    # 3. Merge profile updates (replace old values cleanly without duplicates)
    for k, v in updates.items():
        if v is not None and (isinstance(v, bool) or str(v).strip()):
            profile_dict[k] = v

    completeness_score = calculate_completeness(profile_dict)
    profile_dict["profile_completeness"] = completeness_score
    profile_dict["missing_information"] = missing

    # 4. Save to MongoDB
    await db.conversations.update_one(
        {"user_id": user_id},
        {"$set": {"messages": messages, "updated_at": datetime.utcnow()}},
        upsert=True
    )

    save_profile = {**profile_dict, "user_id": user_id, "updated_at": datetime.utcnow()}
    await db.profiles.update_one(
        {"user_id": user_id},
        {"$set": save_profile},
        upsert=True
    )

    # Recalculate health report if health engine exists
    try:
        from backend.services.health_engine import calculate_health
        await calculate_health(user_id)
    except Exception as e:
        print(f"[onboarding] Error calculating health on chat update: {e}")

    return ChatResponse(
        assistant_reply=assistant_reply,
        profile_updates=updates,
        profile=CompanyProfile(**profile_dict),
        completeness_score=completeness_score,
        missing_information=missing,
        next_focus=next_focus
    )


@router.post("/upload-doc")
async def upload_document(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_optional_current_user)
):
    user_id = current_user["id"]
    db = await get_db()

    profile_doc = await db.profiles.find_one({"user_id": user_id}) or {}
    profile_doc.pop("_id", None)
    profile_doc.pop("user_id", None)

    file_bytes = await file.read()
    filename = file.filename

    # 1. Process and index document into the persistent memory / vector system
    from backend.services.document_processor import process_and_index_document
    try:
        await process_and_index_document(
            user_id=user_id,
            file_bytes=file_bytes,
            filename=filename,
            mime_type=file.content_type or ""
        )
    except Exception as e:
        print(f"[onboarding] Error indexing document: {e}")

    # 2. Extract profile updates
    ack_text, updates = await process_document_and_extract(file_bytes, filename, profile_doc)

    for k, v in updates.items():
        if v is not None and (isinstance(v, bool) or str(v).strip()):
            profile_doc[k] = v

    uploaded_docs = profile_doc.get("uploaded_documents", [])
    if filename not in uploaded_docs:
        uploaded_docs.append(filename)
    profile_doc["uploaded_documents"] = uploaded_docs

    score = calculate_completeness(profile_doc)
    profile_doc["profile_completeness"] = score

    await db.profiles.update_one(
        {"user_id": user_id},
        {"$set": {**profile_doc, "user_id": user_id, "updated_at": datetime.utcnow()}},
        upsert=True
    )

    # 3. Recalculate health report if health engine exists
    try:
        from backend.services.health_engine import calculate_health
        await calculate_health(user_id)
    except Exception as e:
        print(f"[onboarding] Error calculating health: {e}")

    conv_doc = await db.conversations.find_one({"user_id": user_id})
    messages = conv_doc.get("messages", []) if conv_doc else []
    messages.append({
        "role": "user",
        "content": f"[Uploaded Document: {filename}]",
        "timestamp": datetime.utcnow().isoformat()
    })
    messages.append({
        "role": "assistant",
        "content": ack_text,
        "timestamp": datetime.utcnow().isoformat()
    })
    await db.conversations.update_one(
        {"user_id": user_id},
        {"$set": {"messages": messages, "updated_at": datetime.utcnow()}},
        upsert=True
    )

    return {
        "assistant_reply": ack_text,
        "profile_updates": updates,
        "profile": CompanyProfile(**profile_doc),
        "completeness_score": score
    }

@router.post("/reset")
async def reset_onboarding(current_user: dict = Depends(get_optional_current_user)):
    user_id = current_user["id"]
    db = await get_db()
    await db.conversations.delete_one({"user_id": user_id})
    await db.profiles.delete_one({"user_id": user_id})
    return {"message": "Onboarding reset successfully."}

