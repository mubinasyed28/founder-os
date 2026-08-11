import logging
import math
from typing import Dict, Any, List
from backend.database import get_db
from backend.services.document_processor import generate_embedding

logger = logging.getLogger(__name__)

def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    """Computes the cosine similarity between two numeric vectors."""
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    norm1 = sum(a * a for a in v1)
    norm2 = sum(a * a for a in v2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot / (math.sqrt(norm1) * math.sqrt(norm2))

async def retrieve_context_chunks(user_id: str, query_text: str, top_k: int = 6) -> List[Dict[str, Any]]:
    """Generates query embedding and performs manual cosine similarity retrieval over company chunks."""
    db = await get_db()
    
    # 1. Embed query
    query_vector = generate_embedding(query_text)
    if not any(query_vector):
        logger.warning("Generated query embedding is empty/zeros.")
        return []
        
    # 2. Retrieve all chunks for this user
    cursor = db.chunks.find({"user_id": user_id})
    all_chunks = await cursor.to_list(length=2000)
    
    if not all_chunks:
        return []
        
    # 3. Calculate cosine similarity in memory
    scored_chunks = []
    for chunk in all_chunks:
        embedding = chunk.get("embedding")
        if not embedding or not isinstance(embedding, list):
            continue
            
        score = cosine_similarity(query_vector, embedding)
        scored_chunks.append({
            "text": chunk.get("text", ""),
            "filename": chunk.get("metadata", {}).get("filename", "Uploaded Document"),
            "category": chunk.get("metadata", {}).get("category", "other"),
            "score": score
        })
        
    # 4. Sort and return top K
    scored_chunks.sort(key=lambda x: x["score"], reverse=True)
    return scored_chunks[:top_k]

async def build_rag_context(user_id: str, query_text: str) -> tuple[str, List[str], List[str]]:
    """Builds a formatted context string for RAG, returning context, steps, and sources."""
    steps = ["RAG pipeline triggered"]
    sources = []
    
    db = await get_db()
    
    # 1. Load Company Profile
    steps.append("Retrieving company profile")
    profile = await db.profiles.find_one({"user_id": user_id})
    
    profile_summary = ""
    if profile:
        profile_fields = [
            f"Company Name: {profile.get('company_name', '')}",
            f"One Line Pitch: {profile.get('one_line_pitch', '')}",
            f"Description: {profile.get('description', '')}",
            f"Industry: {profile.get('industry', '')}",
            f"Problem: {profile.get('problem_statement', '')}",
            f"Solution: {profile.get('solution', '')}",
            f"Product: {profile.get('product', '')}",
            f"Target Customer: {profile.get('target_customer', '')}",
            f"Business Model: {profile.get('business_model', '')}",
            f"Revenue Model: {profile.get('revenue_model', '')}",
            f"Current Stage: {profile.get('current_stage', '')}",
            f"Location: {profile.get('location', '')}",
            f"Website: {profile.get('website', '')}",
            f"Traction: {profile.get('traction', '')}",
        ]
        profile_summary = "### Company Profile Details\n" + "\n".join(profile_fields)
    else:
        profile_summary = "### Company Profile Details\nNo company profile details registered yet."
        
    # 1.5. Retrieve list of uploaded documents
    steps.append("Retrieving list of uploaded documents")
    docs_cursor = db.documents.find({"user_id": user_id})
    docs_list = await docs_cursor.to_list(length=100)
    
    docs_summary = ""
    if docs_list:
        doc_entries = []
        for d in docs_list:
            doc_entries.append(
                f"- Name: {d['filename']}, Category: {d.get('category', 'other')}, "
                f"Status: {d.get('status', 'unknown')}, Size: {d.get('fileSizeBytes', 0)} bytes"
            )
        docs_summary = "### Uploaded Documents in Library\n" + "\n".join(doc_entries)
    else:
        docs_summary = "### Uploaded Documents in Library\nNo documents uploaded yet."
        
    # 2. Retrieve vector search chunks
    steps.append("Querying vector similarity search")
    chunks = await retrieve_context_chunks(user_id, query_text, top_k=5)
    
    chunks_summary = ""
    if chunks:
        steps.append(f"Retrieved {len(chunks)} relevant document chunks")
        seen_sources = set()
        chunk_lines = []
        for idx, chunk in enumerate(chunks):
            filename = chunk["filename"]
            seen_sources.add(filename)
            chunk_lines.append(
                f"[Source Document {idx+1}: {filename} (Category: {chunk['category']})]\n"
                f"{chunk['text']}"
            )
        chunks_summary = "### Relevant Company Documents Context\n" + "\n\n---\n\n".join(chunk_lines)
        sources = list(seen_sources)
    else:
        steps.append("No relevant document chunks found")
        chunks_summary = "### Relevant Company Documents Context\nNo matching documents found in startup memory."
        
    full_context = f"{profile_summary}\n\n{docs_summary}\n\n{chunks_summary}"
    return full_context, steps, sources
