"""
Mathematical Cosine Similarity calculation between embedding vectors.
"""
import math
from typing import List

def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """
    Computes exact cosine similarity between two numeric vectors.
    Returns a normalized value between 0.0 and 1.0.
    """
    if not vec_a or not vec_b:
        return 0.0

    # Ensure vectors match in length
    min_len = min(len(vec_a), len(vec_b))
    dot = 0.0
    norm_a = 0.0
    norm_b = 0.0

    for i in range(min_len):
        dot += vec_a[i] * vec_b[i]
        norm_a += vec_a[i] * vec_a[i]
        norm_b += vec_b[i] * vec_b[i]

    if norm_a <= 0.0 or norm_b <= 0.0:
        return 0.0

    sim = dot / (math.sqrt(norm_a) * math.sqrt(norm_b))
    
    # Bound between 0.0 and 1.0
    # For dense projections, map [-1, 1] linearly into positive similarity [0, 1]
    norm_sim = (sim + 1.0) / 2.0 if sim < 0 else sim
    return round(float(min(1.0, max(0.0, norm_sim))), 2)
