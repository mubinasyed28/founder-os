"""
Semantic vector embedding generator.
Supports Mistral Embed API (via existing backend environment) with
a fast deterministic TF-IDF / term projection fallback vectorizer.
"""
import os
import math
import logging
import hashlib
from typing import List
import httpx

logger = logging.getLogger(__name__)

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "")

def _deterministic_dense_vector(text: str, dim: int = 128) -> List[float]:
    """
    High-speed deterministic semantic projection vectorizer.
    Maps words and character n-grams through signed hash projections into a unit-normalized vector.
    Similar texts produce high cosine similarities; dissimilar texts produce low cosine similarities.
    """
    words = text.lower().split()
    vec = [0.0] * dim
    
    if not words:
        return [1.0 / math.sqrt(dim)] * dim

    for i, w in enumerate(words):
        # Word-level features
        h = int(hashlib.md5(w.encode("utf-8")).hexdigest(), 16)
        idx = h % dim
        sign = 1.0 if ((h >> 4) & 1) else -1.0
        weight = 1.0 + (0.5 if len(w) > 5 else 0.0)
        vec[idx] += sign * weight

        # Sub-word char 3-grams for semantic root matching
        if len(w) >= 3:
            for j in range(len(w) - 2):
                tri = w[j:j+3]
                ht = int(hashlib.md5(tri.encode("utf-8")).hexdigest(), 16)
                idx_t = ht % dim
                sign_t = 1.0 if ((ht >> 3) & 1) else -1.0
                vec[idx_t] += sign_t * 0.35

    # L2 Normalization
    norm = math.sqrt(sum(x * x for x in vec))
    if norm > 0:
        vec = [x / norm for x in vec]
    else:
        vec = [1.0 / math.sqrt(dim)] * dim
    return vec

def get_text_embedding(text: str) -> List[float]:
    """
    Generate an embedding vector for a given text string.
    Tries Mistral Embed API if key is present; falls back to deterministic dense vector.
    """
    api_key = os.getenv("MISTRAL_API_KEY", MISTRAL_API_KEY)
    if api_key:
        try:
            with httpx.Client(timeout=4.0) as client:
                res = client.post(
                    "https://api.mistral.ai/v1/embeddings",
                    headers={"Authorization": f"Bearer {api_key}"},
                    json={"model": "mistral-embed", "input": [text[:1000]]}
                )
                if res.status_code == 200:
                    data = res.json()
                    embedding = data["data"][0]["embedding"]
                    # Normalize embedding
                    norm = math.sqrt(sum(x * x for x in embedding))
                    if norm > 0:
                        return [x / norm for x in embedding]
        except Exception as e:
            logger.debug(f"Mistral embed call skipped or failed, using dense fallback: {e}")

    return _deterministic_dense_vector(text)
