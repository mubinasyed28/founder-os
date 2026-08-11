import os
import io
import json
import logging
import traceback
import urllib.request
import urllib.error
import base64
from typing import Dict, Any, List, Tuple
from datetime import datetime
from backend.config import settings
from backend.database import get_db

logger = logging.getLogger(__name__)

def extract_text_from_bytes(file_bytes: bytes, filename: str, mime_type: str = "") -> str:
    """Extracts text content from a file's byte array."""
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    
    if ext == "pdf" or "pdf" in mime_type:
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(file_bytes))
            pages_text = []
            for i, page in enumerate(reader.pages):
                try:
                    pages_text.append(page.extract_text() or "")
                except Exception as page_err:
                    logger.warning(f"Skipping page {i} due to parse error: {page_err}")
                    pages_text.append("")
            text = "\n".join(pages_text).strip()
            if not text:
                logger.warning(f"PDF '{filename}' yielded no extractable text (may be scanned/image-only). Storing with placeholder.")
                text = f"[Document: {filename} — PDF uploaded but no extractable text found. May be a scanned or image-based PDF.]"
            return text
        except Exception as e:
            logger.error(f"Failed to extract PDF text: {e!r}\n{traceback.format_exc()}")
            raise ValueError(f"Could not parse PDF file: {e!r}")
            
    elif ext in ["docx", "doc"] or "document" in mime_type:
        try:
            import docx
            doc = docx.Document(io.BytesIO(file_bytes))
            text = "\n".join([p.text for p in doc.paragraphs])
            return text
        except Exception as e:
            logger.error(f"Failed to extract DOCX text: {e}")
            raise ValueError(f"Could not parse Word document: {e}")
            
    elif ext in ["pptx", "ppt"] or "presentation" in mime_type:
        try:
            import pptx
            prs = pptx.Presentation(io.BytesIO(file_bytes))
            text_runs = []
            for slide in prs.slides:
                for shape in slide.shapes:
                    if hasattr(shape, "text"):
                        text_runs.append(shape.text)
            return "\n".join(text_runs)
        except Exception as e:
            logger.error(f"Failed to extract PPTX text: {e}")
            raise ValueError(f"Could not parse PowerPoint: {e}")
            
    elif ext in ["txt", "md", "markdown", "csv", "json"] or "text" in mime_type or "csv" in mime_type or "json" in mime_type:
        try:
            return file_bytes.decode("utf-8", errors="ignore")
        except Exception as e:
            logger.error(f"Failed to extract plain text: {e}")
            raise ValueError(f"Could not decode text file: {e}")
            
    elif ext in ["png", "jpg", "jpeg", "webp"] or "image" in mime_type:
        # Use Pixtral fallback for image analysis if API key is configured
        img_b64 = base64.b64encode(file_bytes).decode("utf-8")
        actual_mime = mime_type if mime_type else f"image/{ext if ext != 'jpg' else 'jpeg'}"
        return analyze_image_pixtral(img_b64, actual_mime)
        
    else:
        # Fallback to string decoding to see if it's text
        try:
            return file_bytes.decode("utf-8")
        except Exception:
            raise ValueError(f"Unsupported file format: .{ext}. Supported formats: PDF, DOCX, PPTX, MD, TXT, PNG, JPEG.")

def analyze_image_pixtral(img_base64: str, mime_type: str) -> str:
    """Uses Mistral's pixtral-12b-latest to generate a detailed description of an image."""
    apiKey = settings.MISTRAL_API_KEY
    if not apiKey:
        return "[Image uploaded, but Mistral API key is not configured for description generation.]"
        
    prompt = (
        "You are a document analysis assistant for a startup. Describe this image in detail, "
        "extracting all visible text, data, charts, diagrams, and key business insights. "
        "Be extremely thorough, capturing all numbers and relationships."
    )
    
    payload = {
        "model": "pixtral-12b-latest",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{img_base64}"
                        }
                    }
                ]
            }
        ]
    }
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {apiKey}"
    }
    
    try:
        req = urllib.request.Request(
            "https://api.mistral.ai/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=40) as response:
            resp_json = json.loads(response.read().decode("utf-8"))
            return resp_json["choices"][0]["message"]["content"]
    except Exception as e:
        logger.error(f"Pixtral analysis failed: {e}")
        return f"[Image uploaded. Mistral Pixtral analysis failed: {e}]"

def classify_document(filename: str, text: str) -> str:
    """Automatically classifies a document into standard startup categories."""
    fn_lower = filename.lower()
    text_lower = text.lower()[:3000]
    
    if "plan" in fn_lower or "business_plan" in fn_lower or "executive summary" in text_lower or "business model" in text_lower:
        return "business_plan"
    elif any(x in fn_lower for x in ["model", "forecast", "financial", "burn", "budget", "revenue", "mrr", "sheet"]):
        return "financial_report"
    elif any(x in fn_lower for x in ["deck", "pitch", "presentation", "slide"]):
        return "pitch_deck"
    elif any(x in fn_lower for x in ["blueprint", "architecture", "spec", "prd", "technical"]):
        return "blueprint"
    elif any(x in fn_lower for x in ["research", "market", "competit", "analysis", "interview", "survey"]):
        return "research"
    else:
        return "other"

def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    """Splits text into overlapping chunks of character length chunk_size."""
    if not text or not text.strip():
        return []
        
    cleaned = text.replace("\r\n", "\n").replace("\n\n\n+", "\n\n").strip()
    if len(cleaned) <= chunk_size:
        return [cleaned]
        
    chunks = []
    start = 0
    while start < len(cleaned):
        end = min(start + chunk_size, len(cleaned))
        
        # Try to break at a paragraph or sentence boundary
        if end < len(cleaned):
            # Look for paragraph break
            para_break = cleaned.rfind("\n\n", start + int(chunk_size * 0.5), end)
            if para_break != -1:
                end = para_break + 2
            else:
                # Look for sentence break
                sentence_break = cleaned.rfind(". ", start + int(chunk_size * 0.5), end)
                if sentence_break != -1:
                    end = sentence_break + 2
                    
        chunk = cleaned[start:end].strip()
        if chunk:
            chunks.append(chunk)
            
        if end >= len(cleaned):
            break
            
        next_start = end - overlap
        if next_start <= start:
            # Force advance if the step is not advancing start
            start = end
        else:
            start = next_start
            
    return chunks

def generate_embedding(text: str) -> List[float]:
    """Generates 1024-dimensional embedding for a text chunk using Mistral Embed API."""
    apiKey = settings.MISTRAL_API_KEY
    if not apiKey:
        # Return a zero vector for demo fallback if API key is missing
        return [0.0] * 1024
        
    payload = {
        "model": "mistral-embed",
        "input": [text]
    }
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {apiKey}"
    }
    
    try:
        req = urllib.request.Request(
            "https://api.mistral.ai/v1/embeddings",
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=20) as response:
            resp_json = json.loads(response.read().decode("utf-8"))
            return resp_json["data"][0]["embedding"]
    except Exception as e:
        logger.error(f"Mistral embedding generation failed: {e}")
        # Return a zero vector fallback
        return [0.0] * 1024

async def process_and_index_document(
    user_id: str,
    file_bytes: bytes,
    filename: str,
    mime_type: str = "",
    category: str = None
) -> Dict[str, Any]:
    """Processes document bytes: extracts text, chunks, embeds, and saves to MongoDB."""
    db = await get_db()
    
    # 1. Create document record with "processing" status
    from bson import ObjectId
    doc_id = str(ObjectId())
    
    doc_record = {
        "_id": ObjectId(doc_id),
        "user_id": user_id,
        "filename": filename,
        "mimeType": mime_type,
        "fileSizeBytes": len(file_bytes),
        "chunkCount": 0,
        "status": "processing",
        "uploadedAt": datetime.utcnow()
    }
    await db.documents.insert_one(doc_record)
    
    try:
        # 2. Extract text
        text = extract_text_from_bytes(file_bytes, filename, mime_type)
        
        # 3. Classify if category not explicitly provided
        doc_category = category if category else classify_document(filename, text)
        
        # 4. Chunk text
        chunks = chunk_text(text, settings.CHUNK_SIZE, settings.CHUNK_OVERLAP)
        
        # 5. Embed chunks and save
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
                    "filename": filename,
                    "category": doc_category
                },
                "createdAt": datetime.utcnow()
            })
            stored_chunks += 1
            
        # 6. Update document record to "indexed"
        await db.documents.update_one(
            {"_id": ObjectId(doc_id)},
            {"$set": {
                "status": "indexed",
                "chunkCount": stored_chunks,
                "category": doc_category,
                "processedAt": datetime.utcnow()
            }}
        )
        
        # 7. Add document name to profile uploaded_documents array
        profile = await db.profiles.find_one({"user_id": user_id})
        if profile:
            uploaded_docs = profile.get("uploaded_documents", [])
            if filename not in uploaded_docs:
                uploaded_docs.append(filename)
                await db.profiles.update_one(
                    {"user_id": user_id},
                    {"$set": {"uploaded_documents": uploaded_docs}}
                )
                
        return {
            "id": doc_id,
            "filename": filename,
            "category": doc_category,
            "chunkCount": stored_chunks,
            "status": "indexed"
        }
        
    except Exception as e:
        err_detail = repr(e) or traceback.format_exc()
        logger.error(f"Document processing failed for {filename}: {err_detail}\n{traceback.format_exc()}")
        await db.documents.update_one(
            {"_id": ObjectId(doc_id)},
            {"$set": {
                "status": "failed",
                "error": err_detail
            }}
        )
        raise ValueError(f"Document processing failed: {err_detail}")

async def delete_document_and_chunks(user_id: str, doc_id: str) -> bool:
    """Deletes a document record, all its chunks, and updates the profile's uploaded doc list."""
    db = await get_db()
    from bson import ObjectId
    
    if not ObjectId.is_valid(doc_id):
        return False
        
    doc = await db.documents.find_one({"_id": ObjectId(doc_id), "user_id": user_id})
    if not doc:
        return False
        
    filename = doc.get("filename")
    
    # 1. Delete all vector chunks
    await db.chunks.delete_many({"document_id": doc_id, "user_id": user_id})
    
    # 2. Delete document record
    await db.documents.delete_one({"_id": ObjectId(doc_id), "user_id": user_id})
    
    # 3. Remove from profile's uploaded_documents list
    profile = await db.profiles.find_one({"user_id": user_id})
    if profile:
        uploaded_docs = profile.get("uploaded_documents", [])
        if filename in uploaded_docs:
            uploaded_docs.remove(filename)
            await db.profiles.update_one(
                {"user_id": user_id},
                {"$set": {"uploaded_documents": uploaded_docs}}
            )
            
    return True
