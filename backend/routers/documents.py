from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, Query, Body
from typing import Dict, Any, List, Optional
from datetime import datetime
from bson import ObjectId
from backend.models import DocumentMeta, DocumentRenameRequest, DocumentReclassifyRequest
from backend.auth import get_optional_current_user
from backend.database import get_db
from backend.services.document_processor import process_and_index_document, delete_document_and_chunks

router = APIRouter(prefix="/api/documents", tags=["Documents"])

@router.post("/upload", response_model=DocumentMeta)
async def upload_document_endpoint(
    file: UploadFile = File(...),
    category: Optional[str] = Query(None),
    current_user: dict = Depends(get_optional_current_user)
):
    user_id = current_user["id"]
    file_bytes = await file.read()
    filename = file.filename
    mime_type = file.content_type or ""
    
    try:
        result = await process_and_index_document(
            user_id=user_id,
            file_bytes=file_bytes,
            filename=filename,
            mime_type=mime_type,
            category=category
        )
        
        db = await get_db()
        doc = await db.documents.find_one({"_id": ObjectId(result["id"])})
        if not doc:
            raise HTTPException(status_code=500, detail="Document failed to save after processing.")
            
        return DocumentMeta(
            id=str(doc["_id"]),
            filename=doc["filename"],
            category=doc.get("category", "other"),
            mimeType=doc.get("mimeType"),
            fileSizeBytes=doc["fileSizeBytes"],
            chunkCount=doc["chunkCount"],
            status=doc["status"],
            uploadedAt=doc["uploadedAt"],
            error=doc.get("error")
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process and index document: {str(e)}"
        )

@router.get("", response_model=List[DocumentMeta])
async def list_documents_endpoint(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: dict = Depends(get_optional_current_user)
):
    user_id = current_user["id"]
    db = await get_db()
    
    query: Dict[str, Any] = {"user_id": user_id}
    if category:
        query["category"] = category
    if search:
        query["filename"] = {"$regex": search, "$options": "i"}
        
    cursor = db.documents.find(query).sort("uploadedAt", -1)
    docs = await cursor.to_list(length=100)
    
    result = []
    for doc in docs:
        result.append(DocumentMeta(
            id=str(doc["_id"]),
            filename=doc["filename"],
            category=doc.get("category", "other"),
            mimeType=doc.get("mimeType"),
            fileSizeBytes=doc["fileSizeBytes"],
            chunkCount=doc["chunkCount"],
            status=doc["status"],
            uploadedAt=doc["uploadedAt"],
            error=doc.get("error")
        ))
    return result

@router.get("/stats")
async def get_document_stats_endpoint(current_user: dict = Depends(get_optional_current_user)):
    user_id = current_user["id"]
    db = await get_db()
    
    total_docs = await db.documents.count_documents({"user_id": user_id})
    indexed_docs = await db.documents.count_documents({"user_id": user_id, "status": "indexed"})
    
    # Calculate sum of chunks
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {"_id": None, "totalChunks": {"$sum": "$chunkCount"}}}
    ]
    cursor = db.documents.aggregate(pipeline)
    agg_result = await cursor.to_list(length=1)
    total_chunks = agg_result[0]["totalChunks"] if agg_result else 0
    
    return {
        "totalDocuments": total_docs,
        "indexedDocuments": indexed_docs,
        "totalChunks": total_chunks
    }

@router.put("/{doc_id}/rename", response_model=DocumentMeta)
async def rename_document_endpoint(
    doc_id: str,
    payload: DocumentRenameRequest,
    current_user: dict = Depends(get_optional_current_user)
):
    user_id = current_user["id"]
    db = await get_db()
    
    if not ObjectId.is_valid(doc_id):
        raise HTTPException(status_code=400, detail="Invalid document ID.")
        
    doc = await db.documents.find_one({"_id": ObjectId(doc_id), "user_id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
        
    old_filename = doc["filename"]
    new_filename = payload.filename
    
    # Update document record
    await db.documents.update_one(
        {"_id": ObjectId(doc_id)},
        {"$set": {"filename": new_filename, "updatedAt": datetime.utcnow()}}
    )
    
    # Update filename inside all chunks' metadata
    await db.chunks.update_many(
        {"document_id": doc_id, "user_id": user_id},
        {"$set": {"metadata.filename": new_filename}}
    )
    
    # Update company profile's uploaded_documents list
    profile = await db.profiles.find_one({"user_id": user_id})
    if profile:
        uploaded_docs = profile.get("uploaded_documents", [])
        if old_filename in uploaded_docs:
            idx = uploaded_docs.index(old_filename)
            uploaded_docs[idx] = new_filename
        elif new_filename not in uploaded_docs:
            uploaded_docs.append(new_filename)
        await db.profiles.update_one(
            {"user_id": user_id},
            {"$set": {"uploaded_documents": uploaded_docs}}
        )
        
    updated_doc = await db.documents.find_one({"_id": ObjectId(doc_id)})
    return DocumentMeta(
        id=str(updated_doc["_id"]),
        filename=updated_doc["filename"],
        category=updated_doc.get("category", "other"),
        mimeType=updated_doc.get("mimeType"),
        fileSizeBytes=updated_doc["fileSizeBytes"],
        chunkCount=updated_doc["chunkCount"],
        status=updated_doc["status"],
        uploadedAt=updated_doc["uploadedAt"],
        error=updated_doc.get("error")
    )

@router.put("/{doc_id}/reclassify", response_model=DocumentMeta)
async def reclassify_document_endpoint(
    doc_id: str,
    payload: DocumentReclassifyRequest,
    current_user: dict = Depends(get_optional_current_user)
):
    user_id = current_user["id"]
    db = await get_db()
    
    if not ObjectId.is_valid(doc_id):
        raise HTTPException(status_code=400, detail="Invalid document ID.")
        
    doc = await db.documents.find_one({"_id": ObjectId(doc_id), "user_id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
        
    new_category = payload.category
    
    # Update document record
    await db.documents.update_one(
        {"_id": ObjectId(doc_id)},
        {"$set": {"category": new_category, "updatedAt": datetime.utcnow()}}
    )
    
    # Update category inside all chunks' metadata
    await db.chunks.update_many(
        {"document_id": doc_id, "user_id": user_id},
        {"$set": {"metadata.category": new_category}}
    )
    
    updated_doc = await db.documents.find_one({"_id": ObjectId(doc_id)})
    return DocumentMeta(
        id=str(updated_doc["_id"]),
        filename=updated_doc["filename"],
        category=updated_doc.get("category", "other"),
        mimeType=updated_doc.get("mimeType"),
        fileSizeBytes=updated_doc["fileSizeBytes"],
        chunkCount=updated_doc["chunkCount"],
        status=updated_doc["status"],
        uploadedAt=updated_doc["uploadedAt"],
        error=updated_doc.get("error")
    )

@router.post("/{doc_id}/replace", response_model=DocumentMeta)
async def replace_document_endpoint(
    doc_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_optional_current_user)
):
    user_id = current_user["id"]
    db = await get_db()
    
    if not ObjectId.is_valid(doc_id):
        raise HTTPException(status_code=400, detail="Invalid document ID.")
        
    doc = await db.documents.find_one({"_id": ObjectId(doc_id), "user_id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
        
    # Get current category
    current_category = doc.get("category", "other")
    
    # 1. Delete all previous chunks for this document
    await db.chunks.delete_many({"document_id": doc_id, "user_id": user_id})
    
    # 2. Update status of the document to "processing"
    await db.documents.update_one(
        {"_id": ObjectId(doc_id)},
        {"$set": {
            "filename": file.filename,
            "mimeType": file.content_type or "",
            "fileSizeBytes": 0,  # Will update post-processing
            "chunkCount": 0,
            "status": "processing",
            "updatedAt": datetime.utcnow()
        }}
    )
    
    file_bytes = await file.read()
    
    try:
        from backend.services.document_processor import extract_text_from_bytes, chunk_text, generate_embedding
        
        # Extract new text
        text = extract_text_from_bytes(file_bytes, file.filename, file.content_type or "")
        
        # Chunk text
        chunks = chunk_text(text, settings.CHUNK_SIZE, settings.CHUNK_OVERLAP)
        
        # Embed chunks and save under the existing document ID
        stored_chunks = 0
        for idx, chunk in enumerate(chunks):
            embedding = generate_embedding(chunk)
            
            await db.chunks.insert_one({
                "document_id": doc_id,
                "user_id": user_id,
                "text": chunk,
                "embedding": embedding,
                "chunkIndex": idx,
                "metadata": {
                    "filename": file.filename,
                    "category": current_category
                },
                "createdAt": datetime.utcnow()
            })
            stored_chunks += 1
            
        # Update document record to "indexed"
        await db.documents.update_one(
            {"_id": ObjectId(doc_id)},
            {"$set": {
                "status": "indexed",
                "chunkCount": stored_chunks,
                "fileSizeBytes": len(file_bytes),
                "processedAt": datetime.utcnow()
            }}
        )
        
        updated_doc = await db.documents.find_one({"_id": ObjectId(doc_id)})
        return DocumentMeta(
            id=str(updated_doc["_id"]),
            filename=updated_doc["filename"],
            category=updated_doc.get("category", "other"),
            mimeType=updated_doc.get("mimeType"),
            fileSizeBytes=updated_doc["fileSizeBytes"],
            chunkCount=updated_doc["chunkCount"],
            status=updated_doc["status"],
            uploadedAt=updated_doc["uploadedAt"],
            error=updated_doc.get("error")
        )
    except Exception as e:
        await db.documents.update_one(
            {"_id": ObjectId(doc_id)},
            {"$set": {
                "status": "failed",
                "error": str(e)
            }}
        )
        raise HTTPException(status_code=500, detail=f"Failed to replace document: {str(e)}")

@router.delete("/{doc_id}")
async def delete_document_endpoint(
    doc_id: str,
    current_user: dict = Depends(get_optional_current_user)
):
    user_id = current_user["id"]
    success = await delete_document_and_chunks(user_id, doc_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found or delete failed.")
    return {"success": True, "message": "Document and associated memories deleted successfully."}
