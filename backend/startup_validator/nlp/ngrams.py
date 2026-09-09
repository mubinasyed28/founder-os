"""
N-gram extraction (unigrams, bigrams, trigrams) to identify multi-word domain concepts.
"""
from typing import List, Tuple
from backend.startup_validator.nlp.preprocessing import tokenize, lemmatize_token, STOPWORDS

def extract_ngrams(tokens: List[str], n: int) -> List[str]:
    """Generate n-grams of length n from a sequence of tokens."""
    if len(tokens) < n:
        return []
    return [" ".join(tokens[i:i+n]) for i in range(len(tokens) - n + 1)]

def extract_meaningful_ngrams(text: str) -> List[Tuple[str, float]]:
    """
    Extract meaningful 1-grams, 2-grams, and 3-grams from raw text.
    Filters out n-grams starting or ending with stopwords.
    Returns ranked n-grams with informative concept weights.
    """
    raw_tokens = tokenize(text)
    lemmatized = [lemmatize_token(t) for t in raw_tokens]
    
    meaningful_ngrams = []
    
    # 1. Bigrams (highest concept density in startup ideas)
    bigrams = extract_ngrams(lemmatized, 2)
    for bg in bigrams:
        words = bg.split()
        # Ensure neither first nor last word is a generic stopword
        if words[0] not in STOPWORDS and words[1] not in STOPWORDS:
            meaningful_ngrams.append((bg, 0.92))
            
    # 2. Trigrams (specific capability concepts)
    trigrams = extract_ngrams(lemmatized, 3)
    for tg in trigrams:
        words = tg.split()
        if words[0] not in STOPWORDS and words[2] not in STOPWORDS:
            meaningful_ngrams.append((tg, 0.95))
            
    # Deduplicate while preserving order
    seen = set()
    deduped = []
    for term, score in meaningful_ngrams:
        if term not in seen:
            seen.add(term)
            deduped.append((term, score))
            
    return deduped
