"""
Deterministic Term Frequency-Inverse Document Frequency (TF-IDF) extraction.
Computes mathematical term weights using a curated reference background corpus
of startup concepts, product capabilities, and tech business models.
"""
import math
from collections import Counter
from typing import List, Tuple, Dict
from backend.startup_validator.nlp.preprocessing import preprocess_and_filter, lemmatize_token
from backend.startup_validator.nlp.ngrams import extract_meaningful_ngrams

# Reference background corpus of various startup categories to establish realistic document frequency
BACKGROUND_CORPUS: List[str] = [
    "ai trip planner personalized travel itineraries based on budget interests style hotel flight booking",
    "marketplace connecting home cooks with office lunch subscriptions healthy meals delivery foodtech",
    "ai legal assistant reviewing rental agreements commercial contracts identifying hidden risks and liability",
    "productivity calendar and study schedule planner adapting to exam dates and student workload",
    "b2b saas billing platform managing usage-based pricing invoices subscription retention metrics",
    "telehealth remote patient monitoring wearable sensor data integration cardiology preventive care",
    "ecommerce inventory optimization predictive stock forecasting supply chain warehouse management",
    "developer api security scanner automated vulnerability detection code dependency review",
    "creator economy monetization membership platform exclusive content tipping community engagement",
    "real estate property valuation investment calculator automated market rent analysis proptech",
    "virtual event hosting interactive networking breakout rooms webinar live polling video stream",
    "recruiting applicant tracking resume parsing candidate skills matching automated interview screening",
    "customer support conversational ai agent ticket resolution sentiment analysis crm integration",
    "sustainable carbon footprint accounting supply chain esg compliance reporting dashboard",
    "fitness coaching workout generator personalized nutrition macro tracking wearable sync"
]

class TFIDFExtractor:
    def __init__(self, corpus: List[str] = None):
        self.corpus = corpus or BACKGROUND_CORPUS
        self.num_docs = len(self.corpus)
        self.df: Dict[str, int] = Counter()
        self._build_vocabulary()

    def _build_vocabulary(self):
        """Compute document frequencies for all terms in reference corpus."""
        for doc in self.corpus:
            tokens = set(preprocess_and_filter(doc))
            for t in tokens:
                self.df[t] += 1
            # Also register bigrams in df
            words = doc.split()
            for i in range(len(words) - 1):
                bg = f"{lemmatize_token(words[i])} {lemmatize_token(words[i+1])}"
                self.df[bg] += 1

    def compute_tfidf(self, text: str, top_k: int = 8) -> List[Tuple[str, float]]:
        """
        Calculates mathematical TF-IDF score for unigrams and meaningful multi-word phrases.
        Returns terms sorted by TF-IDF weight descending.
        """
        tokens = preprocess_and_filter(text)
        if not tokens:
            return []

        doc_len = len(tokens)
        tf_counts = Counter(tokens)
        
        scores: Dict[str, float] = {}

        # 1. Unigram TF-IDF
        for term, count in tf_counts.items():
            tf = count / doc_len
            # Standard smoothed IDF formula: log((1 + N) / (1 + df)) + 1
            doc_freq = self.df.get(term, 1)
            idf = math.log((1 + self.num_docs) / (1 + doc_freq)) + 1.0
            scores[term] = tf * idf

        # 2. Multi-word phrase TF-IDF from n-grams
        phrases = extract_meaningful_ngrams(text)
        for phrase, concept_weight in phrases:
            # Multi-word terms are highly informative in startup pitches
            words = phrase.split()
            avg_idf = sum(math.log((1 + self.num_docs) / (1 + self.df.get(w, 1))) + 1.0 for w in words) / len(words)
            tf = (text.lower().count(phrase)) / max(1, doc_len // 2)
            if tf > 0:
                scores[phrase] = (tf * avg_idf * concept_weight) + 0.35

        # Normalize max score to range ~0.70 - 0.98 for intuitive UI display
        if not scores:
            return []
            
        max_val = max(scores.values())
        ranked = []
        for term, raw_score in sorted(scores.items(), key=lambda x: x[1], reverse=True):
            # Scale to 0.50 - 0.96
            normalized_score = round(min(0.96, max(0.50, (raw_score / max_val) * 0.94 + 0.05)), 2)
            ranked.append((term, normalized_score))

        return ranked[:top_k]

_extractor = TFIDFExtractor()

def extract_tfidf_keywords(text: str, top_k: int = 8) -> List[Tuple[str, float]]:
    """Convenience helper to extract top-k TF-IDF weighted terms."""
    return _extractor.compute_tfidf(text, top_k=top_k)
