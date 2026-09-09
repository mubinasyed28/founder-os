"""
Dynamic validation experiment generator.
Recommends lean startup validation experiments and idea-specific customer interview questions.
"""
from typing import List
from backend.startup_validator.schemas import ValidationExperiment

def generate_validation_experiment(domain: str, raw_idea: str) -> ValidationExperiment:
    """
    Generates targeted validation experiment recommendations and customer interview questions.
    """
    raw_lower = raw_idea.lower()

    if "travel" in domain.lower() or "trip" in raw_lower:
        title = "Customer discovery interviews"
        recommendation = "Interview 20 frequent travelers before writing code for booking integrations."
        questions = [
            "How do you currently plan multi-day trips and itineraries?",
            "What is the single most frustrating or time-consuming part of planning?",
            "Which existing tools or spreadsheets do you use today?",
            "Under what conditions would you trust an AI-generated itinerary over a friend's recommendation?",
            "What specific feature would make you choose this tool over Google Maps or TripAdvisor?",
            "Would you be willing to pay $10/month or $5/trip for instant optimized travel schedules?",
        ]
    elif "legal" in domain.lower() or "rent" in raw_lower or "agreement" in raw_lower:
        title = "Pre-lease tenant problem interviews"
        recommendation = "Interview 20 prospective tenants currently actively searching or signing leases."
        questions = [
            "When you signed your last rental lease, did you read all terms and clauses thoroughly?",
            "Did you ever encounter unexpected fees, penalties, or deposit disputes after signing?",
            "How do you currently check if a landlord's clause is standard or unreasonable?",
            "Would you upload a sensitive lease document to an AI tool if confidentiality was guaranteed?",
            "What would make you confident enough in an AI review to negotiate lease terms?",
            "Would you pay a one-time $15 fee for a comprehensive clause-by-clause audit report?",
        ]
    elif "food" in domain.lower() or "cook" in raw_lower or "lunch" in raw_lower:
        title = "Concierge MVP pilot with 2 office clusters"
        recommendation = "Run a 2-week manual lunch test with 15 office employees and 2 verified home cooks."
        questions = [
            "What do you typically eat for lunch on weekdays, and what is your average spend?",
            "What is the biggest drawback of standard restaurant takeout or meal delivery apps?",
            "How important is knowing who cooked your meal and having home-style nutritional quality?",
            "Would you commit to a 3-day or 5-day weekly recurring lunch schedule if delivery was reliable?",
            "What dietary preferences or hygiene certifications are non-negotiable for you?",
            "What price point per meal feels fair for a fresh, authentic home-cooked lunch ($12-$16)?",
        ]
    else:
        title = "Early adopter problem interviews"
        recommendation = "Conduct 15 in-depth customer interviews to validate acute willingness to pay."
        questions = [
            "How do you currently solve this problem in your day-to-day workflow?",
            "How much time or money do you lose each month due to this inefficiency?",
            "What workarounds or alternatives have you attempted so far?",
            "What is the biggest barrier preventing you from adopting existing commercial tools?",
            "What is the single 'must-have' capability needed for this to become an indispensable tool?",
            "If this product existed today with that capability, would you purchase it immediately?",
        ]

    return ValidationExperiment(
        title=title,
        recommendation=recommendation,
        questions=questions
    )
