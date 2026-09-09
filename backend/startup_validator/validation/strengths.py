"""
Dynamic strengths generator based on validation scores and evidence.
"""
from typing import List
from backend.startup_validator.schemas import Competitor, MarketSignal, ValidationScore

def generate_dynamic_strengths(
    domain: str,
    competitors: List[Competitor],
    signals: List[MarketSignal],
    breakdown: List[ValidationScore]
) -> List[str]:
    """Generates evidence-backed strengths."""
    strengths = []

    # Score-driven strengths
    scores_by_label = {b.label: b.value for b in breakdown}

    if scores_by_label.get("Problem Strength", 0) >= 70:
        strengths.append("Clear user pain point with acute friction in existing manual workflows.")

    if scores_by_label.get("MVP Feasibility", 0) >= 75:
        strengths.append("Technically feasible MVP scope achievable without upfront physical infrastructure.")

    if scores_by_label.get("Market Opportunity", 0) >= 70:
        positive_sigs = [s for s in signals if s.impact == "Positive"]
        if positive_sigs:
            strengths.append(f"Strong market tailwind: {positive_sigs[0].headline.lower()}.")
        else:
            strengths.append("Positive market sentiment and rapid user adoption of AI workflow automation.")

    if len(competitors) >= 3:
        strengths.append(f"Validated customer demand evidenced by {len(competitors)} funded and growing competitors.")

    return strengths[:3]
