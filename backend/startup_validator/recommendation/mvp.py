"""
Dynamic MVP recommendation engine.
Determines what to build first (critical path) and what to postpone (premature optimization).
"""
from typing import List, Tuple
from backend.startup_validator.schemas import Recommendation

def generate_mvp_recommendation(domain: str, raw_idea: str) -> Recommendation:
    """
    Generates dynamic 'Build this first' and 'Don't build yet' lists tailored to the startup idea.
    """
    raw_lower = raw_idea.lower()

    if "travel" in domain.lower() or "trip" in raw_lower:
        build_first = [
            "Destination input & trip duration selector",
            "Budget constraint & accommodation tier selector",
            "Travel pace & interests picker (food, culture, nature)",
            "AI-powered multi-day day-by-day itinerary generator",
            "Basic estimated budget breakdown",
        ]
        dont_build_yet = [
            "Direct airline booking API integration",
            "Hotel marketplace & live inventory negotiation",
            "In-app payments & multi-currency escrow",
            "Social group chat & feed network",
            "Native iOS and Android mobile applications",
        ]
    elif "legal" in domain.lower() or "rent" in raw_lower or "agreement" in raw_lower:
        build_first = [
            "PDF lease & rental agreement upload parser",
            "Automated clause classification & extraction",
            "Red-flag detector for predatory terms & hidden fees",
            "Plain-English summary of tenant obligations",
            "Pre-formatted negotiation questions for the landlord",
        ]
        dont_build_yet = [
            "Direct e-signature & legal filing integration",
            "Live attorney marketplace & billing system",
            "Tenant rent payment & deposit escrow processing",
            "Property management landlord portal",
            "Multi-jurisdiction commercial lease indexing",
        ]
    elif "food" in domain.lower() or "cook" in raw_lower or "lunch" in raw_lower:
        build_first = [
            "Curated menu browser with daily rotating dishes",
            "Office building cluster selection & scheduled delivery slots",
            "Simple chef profile showcasing kitchen sanitation & specialties",
            "Dietary allergen & preference filters (vegetarian, halal, gluten-free)",
            "Recurring weekly lunch subscription selector",
        ]
        dont_build_yet = [
            "Custom automated dispatch and routing logistics software",
            "Automated commercial kitchen leasing & equipment financing",
            "Real-time GPS delivery driver mobile tracking app",
            "Nationwide postal shipping infrastructure",
            "Wholesale ingredient inventory procurement system",
        ]
    else:
        build_first = [
            "Core interactive user input & parameter intake form",
            "Primary AI generation or transformation workflow",
            "Output preview with clear structured value summary",
            "Manual feedback & adjustment interface",
            "Basic email capture for saved results",
        ]
        dont_build_yet = [
            "Complex enterprise team role management & SSO",
            "Automated third-party webhook API ecosystem",
            "Custom native mobile companion applications",
            "Multi-tier usage metering & recurring billing",
            "Complex real-time messaging or social features",
        ]

    return Recommendation(
        buildFirst=build_first,
        dontBuildYet=dont_build_yet
    )
