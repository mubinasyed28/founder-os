"""
Dynamic feature extraction and synonym normalization across startup idea and competitors.
"""
import re
from typing import List, Dict, Set

# Normalized capability dictionaries mapping synonyms to standardized canonical feature names
FEATURE_VOCABULARY: Dict[str, List[str]] = {
    # Travel capabilities
    "AI itinerary": ["ai itinerary", "itinerary generation", "generate itinerary", "travel plan", "day-by-day plan", "smart trip plan"],
    "Budget optimization": ["budget", "budget optimization", "price comparison", "cost estimate", "affordable", "cheap"],
    "Travel style": ["travel style", "travel pace", "adventure style", "luxury style", "preferences", "custom taste"],
    "Group planning": ["group planning", "group travel", "friends travel", "collaborative planning", "split bill"],
    "Local recommendations": ["local recommendations", "hidden gems", "places to visit", "food spots", "local guide"],
    "Conversational planning": ["conversational", "chat", "chatbot", "ask layla", "dialogue", "ai assistant"],
    "Real-time adaptation": ["real-time adaptation", "live updates", "delay rerouting", "dynamic adjustment", "flight change"],

    # Legal / Contract capabilities
    "Clause extraction": ["clause extraction", "clause detection", "extract clauses", "find clauses"],
    "Risk detection": ["risk detection", "risk scoring", "red flags", "liability risk", "hidden risks"],
    "Legal summarization": ["legal summarization", "plain english summary", "summarize contract", "lease overview"],
    "Counter-proposal draft": ["counter-proposal", "redline", "negotiation terms", "suggest changes", "amend lease"],
    "Tenant rights guide": ["tenant rights", "local laws", "renter protections", "statutory rights"],

    # Food / Lunch capabilities
    "Chef marketplace": ["chef marketplace", "home cook onboarding", "local cook directory", "verified kitchens"],
    "Lunch subscriptions": ["lunch subscription", "weekly plan", "scheduled meals", "recurring delivery"],
    "Dietary filters": ["dietary filters", "vegan", "halal", "keto", "gluten-free", "allergies"],
    "Office delivery": ["office delivery", "corporate lunch", "cluster delivery", "batch dropoff"],
    "Nutritional transparency": ["nutritional facts", "macro tracking", "calories", "fresh ingredients"]
}

def extract_canonical_features(domain: str, raw_idea: str) -> List[str]:
    """
    Returns relevant canonical features based on idea domain and description keywords.
    """
    raw_lower = raw_idea.lower()
    domain_lower = domain.lower()
    
    selected_features = []
    
    if "travel" in raw_lower or "trip" in raw_lower or "travel" in domain_lower:
        base = [
            "AI itinerary",
            "Budget optimization",
            "Travel style",
            "Group planning",
            "Local recommendations",
            "Conversational planning",
            "Real-time adaptation",
        ]
        selected_features.extend(base)
    elif "rent" in raw_lower or "lease" in raw_lower or "agreement" in raw_lower or "legal" in domain_lower:
        base = [
            "Clause extraction",
            "Risk detection",
            "Legal summarization",
            "Counter-proposal draft",
            "Tenant rights guide",
        ]
        selected_features.extend(base)
    elif "cook" in raw_lower or "lunch" in raw_lower or "food" in raw_lower:
        base = [
            "Chef marketplace",
            "Lunch subscriptions",
            "Dietary filters",
            "Office delivery",
            "Nutritional transparency",
        ]
        selected_features.extend(base)
    else:
        # Generic capability taxonomy
        base = [
            "AI Automated Workflow",
            "Custom User Profiling",
            "Real-time Collaboration",
            "Analytics & Reporting",
            "Integrations & Export",
        ]
        selected_features.extend(base)

    return selected_features
