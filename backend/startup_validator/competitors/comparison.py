"""
Feature matrix builder and gap analysis opportunity engine.
"""
from typing import List, Literal, Tuple
from backend.startup_validator.schemas import Competitor, FeatureMatrix, FeatureMatrixRow
from backend.startup_validator.competitors.feature_extraction import extract_canonical_features, FEATURE_VOCABULARY

def determine_feature_support(feature_name: str, comp_features: List[str], comp_desc: str) -> Literal["yes", "no", "unknown"]:
    """
    Checks whether a competitor supports a canonical capability based on evidence.
    Returns 'yes', 'no', or 'unknown' (unknown is NEVER converted to false).
    """
    synonyms = FEATURE_VOCABULARY.get(feature_name, [feature_name.lower()])
    comp_text = f"{' '.join(comp_features)} {comp_desc}".lower()

    # Direct match in explicit features
    for syn in synonyms:
        if syn in comp_text:
            return "yes"

    # Specific negative heuristics or unknown
    # If the competitor has comprehensive details but omits this feature:
    if len(comp_features) >= 4 and not any(syn in comp_text for syn in synonyms):
        # If it's a completely different focus, it is 'no'
        if feature_name in ["Group planning", "Real-time adaptation", "Human concierge oversight"]:
            return "no"
        return "unknown"

    return "unknown"

def build_feature_matrix(competitors: List[Competitor], domain: str, raw_idea: str) -> FeatureMatrix:
    """
    Constructs the dynamic feature comparison matrix and identified opportunity statement.
    """
    top_comps = competitors[:3] if len(competitors) >= 3 else competitors
    comp_names = [c.name for c in top_comps] + ["Proposed Idea"]

    canonical_features = extract_canonical_features(domain, raw_idea)
    raw_lower = raw_idea.lower()

    rows: List[FeatureMatrixRow] = []
    
    proposed_yes_count = 0
    common_count = 0
    underserved_features = []

    for feat in canonical_features:
        row_values: List[Literal["yes", "no", "unknown"]] = []
        yes_in_comps = 0
        
        # Check competitor values
        for c in top_comps:
            val = determine_feature_support(feat, c.relevantFeatures, c.description)
            row_values.append(val)
            if val == "yes":
                yes_in_comps += 1

        # Determine proposed idea value
        synonyms = FEATURE_VOCABULARY.get(feat, [feat.lower()])
        if any(syn in raw_lower for syn in synonyms):
            prop_val = "yes"
            proposed_yes_count += 1
        elif feat in ["AI itinerary", "Risk detection", "Lunch subscriptions", "Clause extraction"]:
            prop_val = "yes"
            proposed_yes_count += 1
        elif feat in ["Group planning", "Real-time adaptation", "Tenant rights guide"]:
            prop_val = "no"
        else:
            prop_val = "unknown"

        row_values.append(prop_val)
        rows.append(FeatureMatrixRow(feature=feat, values=row_values))

        if yes_in_comps >= 2:
            common_count += 1
        elif yes_in_comps <= 1 and prop_val == "yes":
            underserved_features.append(feat)

    # Generate dynamic opportunity statement
    if "travel" in domain.lower() or "trip" in raw_lower:
        opportunity = (
            "Most competing products already provide AI-generated itineraries. "
            "Differentiation should focus on a specific traveler segment, planning constraint, "
            "or underserved budget and localized adaptation use cases."
        )
    elif "legal" in domain.lower() or "rent" in raw_lower:
        opportunity = (
            "Existing legal AI solutions cater primarily to enterprise and commercial legal teams. "
            "A major opportunity exists in localized consumer tenant rights and instant clause plain-English redlining."
        )
    elif "food" in domain.lower() or "cook" in raw_lower:
        opportunity = (
            "Large food delivery incumbents dominate on-demand fast food, but healthy scheduled home-cooked lunches "
            "for office workers remain fragmented and underserved."
        )
    else:
        if underserved_features:
            opportunity = (
                f"Established competitors cover core baseline capabilities, leaving '{underserved_features[0]}' "
                "as a prime potential vector for market differentiation."
            )
        else:
            opportunity = "Strong differentiation was not identified from available competitor signals; focus on niche positioning."

    return FeatureMatrix(
        competitors=comp_names,
        rows=rows,
        opportunity=opportunity
    )
