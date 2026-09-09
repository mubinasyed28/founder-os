"""
Competitors package initialization.
"""
from backend.startup_validator.competitors.retrieval import retrieve_competitor_records
from backend.startup_validator.competitors.normalization import normalize_and_rank_competitors
from backend.startup_validator.competitors.feature_extraction import extract_canonical_features
from backend.startup_validator.competitors.comparison import build_feature_matrix

__all__ = [
    "retrieve_competitor_records",
    "normalize_and_rank_competitors",
    "extract_canonical_features",
    "build_feature_matrix",
]
