"""
NLP package initialization.
"""
from backend.startup_validator.nlp.preprocessing import normalize_text, tokenize, lemmatize_token, preprocess_and_filter
from backend.startup_validator.nlp.ngrams import extract_meaningful_ngrams
from backend.startup_validator.nlp.tfidf import extract_tfidf_keywords
from backend.startup_validator.nlp.entities import generate_idea_profile, extract_entities_and_concepts, detect_domain
from backend.startup_validator.nlp.embeddings import get_text_embedding
from backend.startup_validator.nlp.similarity import cosine_similarity

__all__ = [
    "normalize_text",
    "tokenize",
    "lemmatize_token",
    "preprocess_and_filter",
    "extract_meaningful_ngrams",
    "extract_tfidf_keywords",
    "generate_idea_profile",
    "extract_entities_and_concepts",
    "detect_domain",
    "get_text_embedding",
    "cosine_similarity",
]
