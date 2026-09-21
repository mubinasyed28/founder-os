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

def compute_text_similarity(query: str, doc_text: str) -> float:
    """Computes token-based cosine similarity between query and document text."""
    try:
        from backend.startup_validator.nlp.preprocessing import preprocess_and_filter
        q_tokens = preprocess_and_filter(query)
        d_tokens = preprocess_and_filter(doc_text)
    except Exception:
        import re
        q_tokens = [w.lower() for w in re.findall(r'\b[a-zA-Z0-9_]+\b', query) if len(w) > 2]
        d_tokens = [w.lower() for w in re.findall(r'\b[a-zA-Z0-9_]+\b', doc_text) if len(w) > 2]

    if not q_tokens or not d_tokens:
        return 0.0
        
    from collections import Counter
    q_counts = Counter(q_tokens)
    d_counts = Counter(d_tokens)
    
    overlap = set(q_counts.keys()).intersection(d_counts.keys())
    if not overlap:
        return 0.0
        
    dot = sum(q_counts[t] * d_counts[t] for t in overlap)
    norm_q = math.sqrt(sum(v * v for v in q_counts.values()))
    norm_d = math.sqrt(sum(v * v for v in d_counts.values()))
    if norm_q == 0 or norm_d == 0:
        return 0.0
    return dot / (norm_q * norm_d)

async def retrieve_context_chunks(user_id: str, query_text: str, top_k: int = 15) -> List[Dict[str, Any]]:
    """
    Retrieves candidate chunks strictly scoped to the authenticated company,
    calculating cosine similarity over dense embeddings, or falling back to
    token-based semantic cosine similarity.
    """
    db = await get_db()
    
    # 1. Embed query
    query_vector = generate_embedding(query_text)
    has_dense_embedding = any(query_vector)
    
    # 2. Retrieve all chunks strictly for this company/user
    cursor = db.chunks.find({"$or": [{"company_id": user_id}, {"user_id": user_id}]})
    all_chunks = await cursor.to_list(length=3000)
    
    if not all_chunks:
        return []
        
    # 3. Calculate similarity scores
    scored_chunks = []
    for chunk in all_chunks:
        embedding = chunk.get("embedding")
        text = chunk.get("text", "")
        method = "dense_embedding"
        
        if has_dense_embedding and embedding and isinstance(embedding, list) and any(embedding):
            score = cosine_similarity(query_vector, embedding)
        else:
            # Semantic token-based cosine similarity fallback
            score = compute_text_similarity(query_text, text)
            method = "semantic_tfidf"

        scored_chunks.append({
            "document_id": str(chunk.get("document_id") or ""),
            "text": text,
            "filename": chunk.get("metadata", {}).get("filename") or chunk.get("filename", "Uploaded Document"),
            "category": chunk.get("metadata", {}).get("category") or chunk.get("metadata", {}).get("document_type", "other"),
            "score": score,
            "scoring_method": method,
            "chunkIndex": chunk.get("chunkIndex", 0)
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
