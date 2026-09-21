import json
import logging
import urllib.request
import urllib.error
import asyncio
import os
import uuid
import base64
import shutil
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile
from bson import ObjectId
from backend.models import RagChatRequest, RagChatResponse, RagMessage, ChatAttachment
from backend.auth import get_optional_current_user
from backend.database import get_db
from backend.services.rag_service import build_rag_context
from backend.config import settings
from backend.services.document_processor import extract_text_from_bytes, process_and_index_document

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["Co-Founder Chat"])

@router.get("/history")
async def get_rag_chat_history(
    conversationId: Optional[str] = Query(None),
    current_user: dict = Depends(get_optional_current_user)
):
    user_id = current_user["id"]
    db = await get_db()
    
    conv = None
    if conversationId and ObjectId.is_valid(conversationId):
        conv = await db.chat_conversations.find_one({"_id": ObjectId(conversationId), "user_id": user_id})
    else:
        # If no conversationId specified, load the most recent conversation
        cursor = db.chat_conversations.find({"user_id": user_id}).sort("updatedAt", -1).limit(1)
        latest = await cursor.to_list(1)
        if latest:
            conv = latest[0]
            
    if not conv:
        return {"messages": [], "conversationId": ""}
        
    messages = conv.get("messages", [])
    # Format messages for frontend
    formatted = []
    for m in messages:
        formatted_m = {
            "role": m["role"],
            "text": m["text"],
            "steps": m.get("steps", []),
            "sources": m.get("sources", [])
        }
        if m.get("attachment"):
            formatted_m["attachment"] = m["attachment"]
        formatted.append(formatted_m)
        
    return {"messages": formatted, "conversationId": str(conv["_id"])}

@router.post("/message", response_model=RagChatResponse)
async def send_rag_chat_message(
    payload: RagChatRequest,
    current_user: dict = Depends(get_optional_current_user)
):
    user_id = current_user["id"]
    db = await get_db()
    
    # 1. Get user question
    user_msgs = [m for m in payload.messages if m.role == "user"]
    if not user_msgs:
        raise HTTPException(status_code=400, detail="No user message found in request.")
    last_user_message = user_msgs[-1].text
    
    # 2. Build context via RAG service
    context_text, steps, sources = await build_rag_context(user_id, last_user_message)
    
    # 3. System prompt grounding
    rag_system_prompt = (
        "You are the AI Co-Founder in Cofoundr OS — an expert multi-agent decision engine for early-stage founders.\n\n"
        "You have FULL ACCESS to the founder's persistent company memory. The system has already retrieved relevant document chunks and placed them in the context below. You CAN and DO have access to the founder's uploaded documents.\n\n"
        "## CRITICAL RULES (OVERRIDE EVERYTHING ELSE):\n"
        "- NEVER say you cannot access, find, or read the founder's documents.\n"
        "- NEVER say there is a 'configuration issue', 'backend error', or 'memory system issue'.\n"
        "- NEVER ask the founder to paste, re-upload, or share the document content.\n"
        "- The document chunks below ARE the contents of the uploaded documents. Analyze them directly.\n"
        "- If previous messages in the conversation say you could not access documents, IGNORE those old messages — the issue has been fixed and the documents are now available below.\n\n"
        "## Grounded Knowledge & Context:\n"
        f"{context_text}\n\n"
        "## Instructions:\n"
        "1. Ground your answers directly in the founder's company profile and retrieved document chunks above.\n"
        "2. Be direct, strategic, practical, and founder-focused. Provide concrete next steps and actionable advice.\n"
        "3. If citing data from the retrieved documents, refer to the document filenames naturally (e.g. 'According to your Business Plan...').\n"
        "4. If the retrieved documents do not contain enough info to answer fully, answer using your expert startup knowledge and explicitly note what documents/information might be missing.\n"
        "5. If the user asks to analyze, summarize, or reference 'the document I just uploaded' or similar, you MUST analyze and summarize the retrieved document chunks provided in the context above. They ARE the uploaded document contents.\n"
        "6. Keep your tone encouraging, sharp, and concise. Maintain a top-tier startup advisor personality."
    )
    
    # 4. Prepare message list for Mistral API call
    # Convert role mapping: 'assistant' -> 'assistant', 'user' -> 'user'
    formatted_messages = []
    # We include system prompt first
    formatted_messages.append({"role": "system", "content": rag_system_prompt})
    
    # Limit message history to last 8 messages to keep prompt size clean & safe
    history_messages = payload.messages[-8:]
    
    # Filter out poisoned assistant messages that claim configuration errors
    POISON_PHRASES = ["configuration issue", "configuration error", "unable to access", "inaccessible", "cannot access your", "can't access your"]
    
    for m in history_messages:
        content = m.text
        role = "user" if m.role == "user" else "assistant"
        
        # If an old assistant message claims it can't access docs, replace it
        if role == "assistant" and any(phrase in content.lower() for phrase in POISON_PHRASES):
            content = "I have access to your documents. Let me analyze them for you."
            
        # Append attachment text content to user messages for RAG context
        if m.attachment:
            content += f"\n\n[Attached File: {m.attachment.filename}]\n{m.attachment.text}"
        
        formatted_messages.append({
            "role": role,
            "content": content
        })
        
    # 5. Call Mistral API
    apiKey = settings.MISTRAL_API_KEY
    steps.append("Calling Mistral AI LLM engine")
    
    assistant_reply = ""
    if apiKey:
        try:
            def call_mistral():
                candidate_models = ["mistral-small-latest", "ministral-8b-latest", "open-mistral-7b", "ministral-3b-latest"]
                last_err = None
                for model_name in candidate_models:
                    req_payload = {
                        "model": model_name,
                        "messages": formatted_messages,
                        "max_tokens": 2048
                    }
                    headers = {
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {apiKey}"
                    }
                    req = urllib.request.Request(
                        "https://api.mistral.ai/v1/chat/completions",
                        data=json.dumps(req_payload).encode("utf-8"),
                        headers=headers,
                        method="POST"
                    )
                    try:
                        with urllib.request.urlopen(req, timeout=45) as response:
                            resp_json = json.loads(response.read().decode("utf-8"))
                            return resp_json["choices"][0]["message"]["content"]
                    except urllib.error.HTTPError as he:
                        logger.warning(f"[chat] Model {model_name} HTTP {he.code}: {he.read().decode('utf-8', errors='ignore')[:120]}")
                        last_err = he
                        continue
                    except Exception as e:
                        logger.warning(f"[chat] Model {model_name} failed: {e}")
                        last_err = e
                        continue
                if last_err:
                    raise last_err
                raise RuntimeError("All Mistral chat candidate models failed")
                    
            assistant_reply = await asyncio.to_thread(call_mistral)
        except Exception as e:
            logger.error(f"Mistral chat completion failed: {e}")
            assistant_reply = (
                "I searched your company memory, but encountered an error processing the request. "
                "Make sure your MISTRAL_API_KEY is configured in your backend .env."
            )
            steps.append(f"LLM call failed: {str(e)}")
    else:
        # Fallback local reply if API key is not present
        assistant_reply = (
            "I'm running in demo mode without a Mistral API key. "
            "Please configure your MISTRAL_API_KEY in the backend to enable full conversational intelligence."
        )
        steps.append("Demo mode fallback response")
        
    # 6. Save or update conversation in DB
    conv_id = payload.conversationId
    conv_messages = [m.model_dump() for m in payload.messages]
    conv_messages.append({
        "role": "assistant",
        "text": assistant_reply,
        "steps": steps,
        "sources": sources
    })
    
    if conv_id and ObjectId.is_valid(conv_id):
        await db.chat_conversations.update_one(
            {"_id": ObjectId(conv_id), "user_id": user_id},
            {"$set": {
                "messages": conv_messages,
                "updatedAt": datetime.utcnow()
            }}
        )
    else:
        # Find first user message for title
        first_user_msg = ""
        for m in payload.messages:
            if m.role == "user":
                first_user_msg = m.text
                break
        if not first_user_msg:
            first_user_msg = last_user_message
            
        title = first_user_msg[:40] + "..." if len(first_user_msg) > 40 else (first_user_msg or "New Chat")
        
        res = await db.chat_conversations.insert_one({
            "user_id": user_id,
            "title": title,
            "messages": conv_messages,
            "createdAt": datetime.utcnow(),
            "updatedAt": datetime.utcnow()
        })
        conv_id = str(res.inserted_id)
        
    return RagChatResponse(
        text=assistant_reply,
        steps=steps,
        sources=sources,
        conversationId=conv_id
    )

@router.post("/reset")
async def reset_rag_chat(
    conversationId: Optional[str] = Query(None),
    current_user: dict = Depends(get_optional_current_user)
):
    user_id = current_user["id"]
    db = await get_db()
    
    query = {"user_id": user_id}
    if conversationId and ObjectId.is_valid(conversationId):
        query["_id"] = ObjectId(conversationId)
        
    await db.chat_conversations.delete_many(query)
    return {"success": True, "message": "Conversation history cleared successfully."}

@router.get("/conversations")
async def list_conversations(
    current_user: dict = Depends(get_optional_current_user)
):
    user_id = current_user["id"]
    db = await get_db()
    
    cursor = db.chat_conversations.find({"user_id": user_id}, {"messages": 0}).sort("updatedAt", -1)
    conversations = []
    async for conv in cursor:
        conversations.append({
            "id": str(conv["_id"]),
            "title": conv.get("title", "Untitled Chat"),
            "updatedAt": conv.get("updatedAt", conv.get("createdAt", datetime.utcnow())).isoformat()
        })
    return conversations

@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    current_user: dict = Depends(get_optional_current_user)
):
    user_id = current_user["id"]
    db = await get_db()
    
    if not ObjectId.is_valid(conversation_id):
        raise HTTPException(status_code=400, detail="Invalid conversation ID")
        
    res = await db.chat_conversations.delete_one({"_id": ObjectId(conversation_id), "user_id": user_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    return {"success": True, "message": "Conversation deleted successfully."}

@router.post("/upload-attachment", response_model=ChatAttachment)
async def upload_chat_attachment(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_optional_current_user)
):
    # Ensure temporary upload directory exists
    temp_dir = os.path.join(settings.UPLOAD_DIR, "chat_attachments")
    os.makedirs(temp_dir, exist_ok=True)
    
    file_bytes = await file.read()
    filename = file.filename or "uploaded_file"
    mime_type = file.content_type or "application/octet-stream"
    file_size = len(file_bytes)
    
    # Save file to temp path with UUID prefix to avoid conflicts
    unique_filename = f"{uuid.uuid4()}_{filename}"
    temp_path = os.path.join(temp_dir, unique_filename)
    with open(temp_path, "wb") as f:
        f.write(file_bytes)
        
    # Extract text content (e.g. PDF parser, text parser, or Pixtral for images)
    try:
        extracted_text = extract_text_from_bytes(file_bytes, filename, mime_type)
    except Exception as e:
        logger.error(f"Failed to extract attachment text: {e}")
        extracted_text = f"[Failed to extract content from {filename}: {str(e)}]"
        
    # Generate base64 thumbnail if it's an image
    base64_str = None
    if mime_type.startswith("image/"):
        base64_str = base64.b64encode(file_bytes).decode("utf-8")
        
    return ChatAttachment(
        filename=filename,
        text=extracted_text,
        mimeType=mime_type,
        fileSizeBytes=file_size,
        tempPath=temp_path,
        base64=base64_str,
        isSaved=False,
        savedDocId=None
    )

@router.post("/conversations/{conversation_id}/messages/{message_index}/save-attachment")
async def save_chat_attachment(
    conversation_id: str,
    message_index: int,
    current_user: dict = Depends(get_optional_current_user)
):
    user_id = current_user["id"]
    db = await get_db()
    
    if not ObjectId.is_valid(conversation_id):
        raise HTTPException(status_code=400, detail="Invalid conversation ID")
        
    conv = await db.chat_conversations.find_one({"_id": ObjectId(conversation_id), "user_id": user_id})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    messages = conv.get("messages", [])
    if message_index < 0 or message_index >= len(messages):
        raise HTTPException(status_code=404, detail="Message index out of range")
        
    msg = messages[message_index]
    attachment_dict = msg.get("attachment")
    if not attachment_dict:
        raise HTTPException(status_code=400, detail="No attachment found in message")
        
    if attachment_dict.get("isSaved"):
        return {"success": True, "message": "Attachment already saved", "attachment": attachment_dict}
        
    temp_path = attachment_dict.get("tempPath")
    if not temp_path or not os.path.exists(temp_path):
        raise HTTPException(status_code=400, detail="Temporary file not found on server")
        
    # Read the file bytes
    with open(temp_path, "rb") as f:
        file_bytes = f.read()
        
    # Save the file permanently in the workspace document library
    try:
        result = await process_and_index_document(
            user_id=user_id,
            file_bytes=file_bytes,
            filename=attachment_dict["filename"],
            mime_type=attachment_dict["mimeType"],
            category=None
        )
    except Exception as e:
        logger.error(f"Failed to process and index chat attachment: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to index file: {str(e)}")
        
    # Update the attachment metadata in the message
    attachment_dict["isSaved"] = True
    attachment_dict["savedDocId"] = result["id"]
    
    # Save updated conversation back to database
    await db.chat_conversations.update_one(
        {"_id": ObjectId(conversation_id)},
        {"$set": {f"messages.{message_index}.attachment": attachment_dict}}
    )
    
    return {
        "success": True, 
        "message": "Attachment saved to workspace memory successfully.",
        "attachment": attachment_dict
    }
