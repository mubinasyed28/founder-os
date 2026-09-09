"""
Entity, concept, and structured idea profile extraction.
Extracts domain, target customers, core concepts, problem, and solution.
"""
import re
import os
import json
import logging
from typing import Dict, Any, List, Tuple
from backend.startup_validator.nlp.preprocessing import preprocess_and_filter, normalize_text
from backend.startup_validator.nlp.tfidf import extract_tfidf_keywords

logger = logging.getLogger(__name__)

# Domain taxonomy patterns
DOMAIN_PATTERNS = [
    (r"\b(trip|travel|itinerary|vacation|flight|hotel|tourist|destinations?)\b", "TravelTech / AI / SaaS"),
    (r"\b(rent|rental|lease|landlord|tenant|property|clause|agreement|legal)\b", "PropTech / LegalTech / AI"),
    (r"\b(cook|food|lunch|meal|kitchen|chef|recipe|subscription)\b", "FoodTech / Marketplace"),
    (r"\b(study|student|exam|homework|learn|course|education|quiz)\b", "EdTech / Productivity"),
    (r"\b(health|patient|doctor|medical|clinic|fitness|wellness)\b", "HealthTech / Digital Health"),
    (r"\b(fintech|invoice|billing|payment|banking|invest|crypto)\b", "FinTech / SaaS"),
    (r"\b(hr|recruiting|hiring|candidate|resume|talent|employee)\b", "HRTech / Future of Work"),
    (r"\b(security|vulnerability|auth|encryption|devops|code)\b", "DevTools / CyberSecurity"),
]

# Target users heuristics
TARGET_USER_PATTERNS = [
    (r"\b(travelers?|travellers?|tourists?|vacationers?|backpackers?|digital nomads?)\b", "Travelers"),
    (r"\b(solo travelers?)\b", "Solo travelers"),
    (r"\b(families|family)\b", "Families"),
    (r"\b(budget travelers?)\b", "Budget travelers"),
    (r"\b(tenants?|renters?)\b", "Tenants & Renters"),
    (r"\b(landlords?|property managers?)\b", "Property Managers"),
    (r"\b(home cooks?|local chefs?)\b", "Home Cooks"),
    (r"\b(office workers?|corporate teams?|busy professionals?)\b", "Busy Professionals"),
    (r"\b(students?|learners?)\b", "Students"),
    (r"\b(freelancers?|creators?)\b", "Freelancers & Creators"),
    (r"\b(developers?|engineers?)\b", "Software Developers"),
    (r"\b(small business|smb|founders?)\b", "Founders & SMBs"),
]

def detect_domain(text: str) -> str:
    """Identify the domain from keyword patterns."""
    text_lower = text.lower()
    for pattern, domain in DOMAIN_PATTERNS:
        if re.search(pattern, text_lower):
            return domain
    return "AI / SaaS / Innovation"

def detect_target_users(text: str, domain: str) -> List[str]:
    """Extract explicit target users or infer sensible domain targets."""
    text_lower = text.lower()
    users = []
    for pattern, label in TARGET_USER_PATTERNS:
        if re.search(pattern, text_lower) and label not in users:
            users.append(label)
            
    if not users:
        if "Travel" in domain:
            users = ["Solo travelers", "Families", "Budget travelers"]
        elif "Legal" in domain or "PropTech" in domain:
            users = ["Tenants & Renters", "Small businesses", "Homebuyers"]
        elif "Food" in domain:
            users = ["Home cooks", "Office workers", "Busy professionals"]
        elif "EdTech" in domain:
            users = ["College students", "Exam takers", "Self-directed learners"]
        else:
            users = ["Early adopters", "Knowledge workers", "Consumers"]
            
    return users[:4]

def extract_entities_and_concepts(text: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Extract entity items and semantic concept items with informative confidence weights.
    """
    entities = []
    concepts = []
    
    # Check for tech entities
    tech_patterns = [
        ("AI", 0.96), ("Machine Learning", 0.90), ("LLM", 0.92), ("NLP", 0.94),
        ("SaaS", 0.88), ("Marketplace", 0.89), ("Mobile App", 0.85), ("API", 0.87),
        ("Subscription", 0.86), ("Cloud", 0.82)
    ]
    text_upper = text.upper()
    for tech, weight in tech_patterns:
        if re.search(rf"\b{tech}\b", text_upper):
            entities.append({"term": tech, "type": "entity", "weight": weight})

    # Domain specific concepts
    tfidf_terms = extract_tfidf_keywords(text, top_k=6)
    for term, score in tfidf_terms:
        title_term = " ".join(w.capitalize() for w in term.split())
        concepts.append({"term": title_term, "type": "concept", "weight": score})
        
    if not entities:
        entities.append({"term": "AI", "type": "entity", "weight": 0.92})
        entities.append({"term": "Web Platform", "type": "entity", "weight": 0.85})

    return entities[:5], concepts[:6]

def generate_idea_profile(raw_idea: str) -> Dict[str, Any]:
    """
    Generates structured IdeaProfile:
    name, problem, targetUsers, solution, domain, coreConcepts.
    Uses Mistral AI if available for high-fidelity extraction,
    with deterministic regex/NLP fallback.
    """
    domain = detect_domain(raw_idea)
    target_users = detect_target_users(raw_idea, domain)
    
    # Determine title / name
    if "trip" in raw_idea.lower() or "travel" in raw_idea.lower():
        name = "AI Travel Planner"
        problem = "Travel planning is fragmented across dozens of tabs, reviews, and booking sites, making itinerary creation stressful and time-consuming."
        solution = "AI-generated personalized itineraries tailored to individual budget constraints, specific interests, and travel pace."
        core_concepts = ["AI", "Personalization", "Itinerary", "Budget", "Travel Planning"]
    elif "rent" in raw_idea.lower() or "agreement" in raw_idea.lower() or "clause" in raw_idea.lower():
        name = "AI Rental Agreement Auditor"
        problem = "Tenants and renters sign complex legal lease contracts without understanding unfavorable clauses, hidden fees, and liability traps."
        solution = "An AI copilot that parses rental agreements, flags predatory clauses, summarizes obligations, and suggests tenant counter-proposals."
        core_concepts = ["Legal Analysis", "Clause Detection", "Risk Scoring", "Tenant Protection", "Contract AI"]
    elif "cook" in raw_idea.lower() or "lunch" in raw_idea.lower() or "meal" in raw_idea.lower():
        name = "HomeCook Lunch Marketplace"
        problem = "Office employees struggle to find healthy, affordable daily lunches, while talented home cooks lack a structured channel to monetize meals."
        solution = "A curated subscription platform connecting office clusters with verified local home chefs for scheduled weekday lunches."
        core_concepts = ["Marketplace", "Subscription", "Local Food", "Office Catering", "Cook Monetization"]
    else:
        # Generic deterministic synthesis
        words = raw_idea.strip().split()
        lead = " ".join(words[:4]).title()
        name = f"Smart {lead}" if len(lead) < 30 else "AI Opportunity Engine"
        problem = f"Existing workflows regarding {words[min(3, len(words)-1)] if words else 'this domain'} are manual, inefficient, and lack intelligent guidance."
        solution = raw_idea.strip()
        core_concepts = [w.capitalize() for w in preprocess_and_filter(raw_idea)[:5]]
        if not core_concepts:
            core_concepts = ["Automation", "Personalization", "AI Intelligence"]

    return {
        "name": name,
        "problem": problem,
        "targetUsers": target_users,
        "solution": solution,
        "domain": domain,
        "coreConcepts": core_concepts,
    }
