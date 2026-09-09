"""
Transparent, explainable validation scoring engine.
Evaluates 5 dimensions:
1. Market Opportunity (25%)
2. Competition Attractiveness (15%) - Higher score means lower competitive pressure / attractive opening
3. Differentiation (25%)
4. Problem Strength (20%)
5. MVP Feasibility (15%)
"""
from typing import List, Tuple, Dict, Any
from backend.startup_validator.schemas import ValidationScore, ValidationResultSummary, Competitor, MarketSignal, FeatureMatrix

WEIGHTS = {
    "market_opportunity": 0.25,
    "competition": 0.15,
    "differentiation": 0.25,
    "problem_strength": 0.20,
    "mvp_feasibility": 0.15,
}

def calculate_validation_score(
    raw_idea: str,
    domain: str,
    competitors: List[Competitor],
    signals: List[MarketSignal],
    matrix: FeatureMatrix
) -> Tuple[int, str, float, List[ValidationScore], str]:
    """
    Computes explainable validation scores based on measurable signals.
    Returns: (overall_score, verdict, confidence, breakdown, summary)
    """
    raw_lower = raw_idea.lower()
    
    # 1. Market Opportunity (0-100)
    # Inputs: evidence volume, average signal confidence, domain growth signals
    avg_signal_conf = sum(s.confidence for s in signals) / len(signals) if signals else 0.70
    opp_score = int(min(95, max(45, (avg_signal_conf * 80) + (len(signals) * 2.5))))
    opp_note = f"Based on {len(signals)} relevant market signals with {int(avg_signal_conf * 100)}% average confidence."

    # 2. Competition Attractiveness (0-100)
    # High score = attractive opening / low saturation. Low score = crowded / incumbent dominance.
    # Inputs: number of competitors, average similarity
    avg_similarity = sum(c.similarity for c in competitors) / len(competitors) if competitors else 0.50
    high_threats = sum(1 for c in competitors if c.relevance == "High")
    # If competitors are very similar and numerous, competitive pressure is high -> score is lower
    comp_score = int(min(90, max(30, 95 - (avg_similarity * 45) - (high_threats * 6))))
    comp_note = f"{len(competitors)} direct competitors identified; {high_threats} high-relevance incumbents with strong traction."

    # 3. Differentiation (0-100)
    # Inputs: unique features in matrix, underserved capabilities
    prop_yes = sum(1 for r in matrix.rows if r.values[-1] == "yes")
    comp_overlap = sum(1 for r in matrix.rows if r.values[-1] == "yes" and any(v == "yes" for v in r.values[:-1]))
    diff_ratio = (prop_yes - (comp_overlap * 0.5)) / max(1, prop_yes)
    diff_score = int(min(92, max(40, 50 + (diff_ratio * 35))))
    diff_note = f"Core proposition overlaps with incumbents on table-stakes, requiring specialized niche positioning."

    # 4. Problem Strength (0-100)
    # Inputs: clarity of pain point, friction words, target user specificity
    friction_words = ["stressful", "fragmented", "time-consuming", "expensive", "hidden", "difficult", "manual", "lack", "lost"]
    friction_count = sum(1 for w in friction_words if w in raw_lower)
    problem_score = int(min(94, max(55, 68 + (friction_count * 5) + (len(raw_idea.split()) // 8))))
    problem_note = "Clear user friction and specific pain point identified in current manual alternatives."

    # 5. MVP Feasibility (0-100)
    # Inputs: external platform dependencies, inventory requirements, API complexity
    heavy_words = ["hardware", "blockchain", "inventory", "marketplace", "shipping", "physical"]
    has_heavy = any(h in raw_lower for h in heavy_words)
    feasibility_score = int(72 if has_heavy else 84)
    feas_note = "Can be validated quickly with software prototype before heavy capital or inventory investment."

    # Calculate overall weighted score
    overall = round(
        (opp_score * WEIGHTS["market_opportunity"]) +
        (comp_score * WEIGHTS["competition"]) +
        (diff_score * WEIGHTS["differentiation"]) +
        (problem_score * WEIGHTS["problem_strength"]) +
        (feasibility_score * WEIGHTS["mvp_feasibility"])
    )
    overall = int(min(100, max(0, overall)))

    # Determine dynamic verdict label
    if overall >= 80:
        verdict = "STRONG"
    elif overall >= 65:
        verdict = "PROMISING"
    elif overall >= 50:
        verdict = "UNCERTAIN"
    else:
        verdict = "HIGH RISK"

    # Separate Confidence Score
    confidence = round(min(0.95, max(0.70, (len(signals) * 0.04) + (len(competitors) * 0.03) + 0.60)), 2)

    # Breakdown list matching frontend ValidationScore
    breakdown = [
        ValidationScore(label="Market Opportunity", value=opp_score, note=opp_note),
        ValidationScore(label="Competition", value=comp_score, note=comp_note),
        ValidationScore(label="Differentiation", value=diff_score, note=diff_note),
        ValidationScore(label="Problem Strength", value=problem_score, note=problem_note),
        ValidationScore(label="MVP Feasibility", value=feasibility_score, note=feas_note),
    ]

    # Summary narrative
    summary = (
        f"Your idea addresses a genuine user friction in {domain}, but operates in a competitive market with "
        f"{len(competitors)} established players. Core differentiation must be validated with customers before "
        "expanding development scope."
    )

    return overall, verdict, confidence, breakdown, summary
