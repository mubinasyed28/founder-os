"""
Dynamic risks generator based on competition, feature saturation, and feasibility constraints.
"""
from typing import List
from backend.startup_validator.schemas import Competitor, MarketSignal, ValidationScore

def generate_dynamic_risks(
    domain: str,
    competitors: List[Competitor],
    signals: List[MarketSignal],
    breakdown: List[ValidationScore]
) -> List[str]:
    """Generates evidence-backed risks."""
    risks = []

    scores_by_label = {b.label: b.value for b in breakdown}

    # Competition risk
    if scores_by_label.get("Competition", 0) <= 60:
        high_threats = [c.name for c in competitors if c.relevance == "High"]
        if high_threats:
            risks.append(f"Crowded competitive space dominated by established incumbents ({', '.join(high_threats[:2])}).")
        else:
            risks.append("Highly competitive landscape with low barrier to basic software replication.")

    # Market risk from cautionary signals
    caution_sigs = [s for s in signals if s.impact in ["Cautionary", "Competitive"]]
    if caution_sigs:
        risks.append(f"Major platform pressure: {caution_sigs[0].headline.lower()}.")
    else:
        risks.append("Generic capability layer risks commoditization by large ecosystem platforms.")

    # Differentiation risk
    if scores_by_label.get("Differentiation", 0) <= 75:
        risks.append("Core feature set matches baseline table-stakes; high risk of being treated as an interchangeable tool.")

    return risks[:3]
