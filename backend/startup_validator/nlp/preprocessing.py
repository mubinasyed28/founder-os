"""
Deterministic text preprocessing, tokenization, stopword removal, and rule-based lemmatization.
"""
import re
from typing import List, Set

# Comprehensive English stop words list
STOPWORDS: Set[str] = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are",
    "aren't", "as", "at", "be", "because", "been", "before", "being", "below", "between", "both",
    "but", "by", "can", "can't", "cannot", "could", "couldn't", "did", "didn't", "do", "does",
    "doesn't", "doing", "don't", "down", "during", "each", "few", "for", "from", "further",
    "had", "hadn't", "has", "hasn't", "have", "haven't", "having", "he", "he'd", "he'll",
    "he's", "her", "here", "here's", "hers", "herself", "him", "himself", "his", "how", "how's",
    "i", "i'd", "i'll", "i'm", "i've", "if", "in", "into", "is", "isn't", "it", "it's", "its",
    "itself", "let's", "me", "more", "most", "mustn't", "my", "myself", "no", "nor", "not",
    "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out",
    "over", "own", "same", "shan't", "she", "she'd", "she'll", "she's", "should", "shouldn't",
    "so", "some", "such", "than", "that", "that's", "the", "their", "theirs", "them", "themselves",
    "then", "there", "there's", "these", "they", "they'd", "they'll", "they're", "they've",
    "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasn't",
    "we", "we'd", "we'll", "we're", "we've", "were", "weren't", "what", "what's", "when",
    "when's", "where", "where's", "which", "while", "who", "who's", "whom", "why", "why's",
    "with", "won't", "would", "wouldn't", "you", "you'd", "you'll", "you're", "you've", "your",
    "yours", "yourself", "yourselves", "want", "build", "like", "need", "create", "makes", "tool"
}

def normalize_text(text: str) -> str:
    """Lowercase and normalize whitespace."""
    if not text:
        return ""
    text = text.lower().strip()
    text = re.sub(r"\s+", " ", text)
    return text

def tokenize(text: str) -> List[str]:
    """Tokenize text into alphanumeric word tokens while handling punctuation."""
    normalized = normalize_text(text)
    # Extract alphanumeric words and hyphens inside words
    tokens = re.findall(r"\b[a-z0-9]+(?:-[a-z0-9]+)*\b", normalized)
    return tokens

def lemmatize_token(token: str) -> str:
    """
    Lightweight, deterministic rule-based lemmatizer/stemmer.
    Reduces inflected words to base forms (e.g. itineraries -> itinerary, planning -> plan).
    """
    if len(token) <= 3:
        return token

    # Common irregular words in startup contexts
    irregulars = {
        "itineraries": "itinerary",
        "agreements": "agreement",
        "subscriptions": "subscription",
        "interviews": "interview",
        "categories": "category",
        "deliveries": "delivery",
        "pricing": "price",
        "traveling": "travel",
        "travellers": "traveler",
        "travelers": "traveler",
        "planning": "plan",
        "plans": "plan",
        "booking": "book",
        "bookings": "book",
        "recommendations": "recommendation",
        "automated": "automate",
        "optimizing": "optimize",
        "optimized": "optimize",
        "personalized": "personalize",
        "personalizing": "personalize",
    }
    if token in irregulars:
        return irregulars[token]

    # Rule-based suffix transformations
    if token.endswith("ies") and len(token) > 4:
        return token[:-3] + "y"
    if token.endswith("es") and len(token) > 3 and token[-3] in "shxz":
        return token[:-2]
    if token.endswith("ing") and len(token) > 5:
        # e.g., tracking -> track, providing -> provide
        base = token[:-3]
        if base.endswith("t") and len(base) > 3 and base[-2] == base[-1]:
            return base[:-1] # e.g. fitting -> fit
        return base
    if token.endswith("ed") and len(token) > 4:
        return token[:-2]
    if token.endswith("s") and not token.endswith("ss") and len(token) > 3:
        return token[:-1]

    return token

def preprocess_and_filter(text: str, remove_stopwords: bool = True) -> List[str]:
    """Tokenize, optionally remove stopwords, and lemmatize."""
    raw_tokens = tokenize(text)
    result = []
    for t in raw_tokens:
        if remove_stopwords and t in STOPWORDS:
            continue
        lemma = lemmatize_token(t)
        if remove_stopwords and lemma in STOPWORDS:
            continue
        result.append(lemma)
    return result
