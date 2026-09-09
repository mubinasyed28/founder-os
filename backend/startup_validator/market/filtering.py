"""
Market evidence filtering.
Filters out noise, unrelated geographic funding rounds, and off-topic news.
"""
from typing import List, Dict, Any

UNRELATED_KEYWORDS = [
    "diversity report", "hiring announcement", "indian seed round", "crypto token",
    "blockchain gaming", "solar panel", "mining equipment", "ev battery"
]

def filter_market_evidence(records: List[Dict[str, Any]], domain: str, raw_idea: str) -> List[Dict[str, Any]]:
    """
    Filters market evidence to only include signals relevant to the domain and startup idea.
    """
    raw_lower = raw_idea.lower()
    domain_lower = domain.lower()
    
    filtered = []
    for r in records:
        text = f"{r.get('headline', '')} {r.get('whatHappened', '')} {r.get('what_happened', '')} {r.get('whyItMatters', '')}".lower()
        
        # Eliminate off-topic noise
        if any(bad in text for bad in UNRELATED_KEYWORDS):
            continue
            
        # Check domain relevance
        if "travel" in domain_lower or "trip" in raw_lower:
            if any(k in text for k in ["travel", "trip", "itinerary", "expedia", "layla", "phocuswright", "booking", "tourism", "hotel", "flight", "tech"]):
                filtered.append(r)
        elif "legal" in domain_lower or "rent" in raw_lower or "agreement" in raw_lower:
            if any(k in text for k in ["legal", "contract", "lease", "rent", "tenant", "compliance", "law", "ftc", "tech"]):
                filtered.append(r)
        elif "food" in domain_lower or "cook" in raw_lower:
            if any(k in text for k in ["food", "meal", "cook", "kitchen", "lunch", "subscription", "restaurant", "delivery"]):
                filtered.append(r)
        else:
            filtered.append(r)
            
    return filtered if filtered else records
