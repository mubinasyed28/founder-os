import os
import re
import json
import logging
from typing import Dict, Any, List, Optional
import urllib.request
from backend.config import settings

logger = logging.getLogger(__name__)

DECISION_PARSER_SYSTEM_PROMPT = """You are the Decision Parser for FounderOS Decision Simulator.
Your role is to analyze a founder's natural language scenario decision and convert it into a strictly structured JSON decision object.

Classify the decision into one of the following decision types:
- "fundraising": Founder wants to raise capital (e.g. "$500k seed", "raise 1M")
- "burn_adjustment": Founder wants to cut or adjust monthly burn rate (e.g. "reduce burn by 20%", "cut expenses")
- "validation_action": Founder conducts customer interviews, validation, or willingness-to-pay tests
- "pricing_change": Founder changes pricing or plan tiers (e.g. "raise Pro price from $99 to $129")
- "hiring": Founder plans to hire staff/engineers (e.g. "hire 2 senior engineers")
- "feature_launch": Founder plans to build, add, or release a product feature, tool, functionality, or beta (e.g. "launch a maps feature where users can connect", "add social discovery", "build marketplace", "introduce team collaboration")
- "market_expansion": Founder expands to a new country or region
- "marketing_spend": Founder increases ad or marketing spend

Model Coverage Classifications:
- SUPPORTED: fundraising, burn_adjustment, validation_action (Directly mapped to trained Model 2 features: runway_months, monthly_burn_rate, funding_path, did_customer_validation)
- PARTIALLY_SUPPORTED: pricing_change, hiring, feature_launch (Mapped with proxy parameters: plan tier, seat count, burn adjustment, beta feature flag, unique feature count)
- UNSUPPORTED: market_expansion (cross-border portfolio), marketing_spend (continuous ad spend not in trained schema)

Return JSON ONLY matching this schema:
{
  "decision_type": "fundraising" | "burn_adjustment" | "validation_action" | "pricing_change" | "hiring" | "feature_launch" | "market_expansion" | "marketing_spend" | "other",
  "coverage_status": "SUPPORTED" | "PARTIALLY_SUPPORTED" | "UNSUPPORTED",
  "simulation_engine": "MODEL_POWERED" | "RULE_BASED",
  "action": string,
  "description": string,
  "feature_name": null or string,
  "goal": null or string,
  "confidence": number,
  "parameters": {
    "raise_amount": null or number,
    "funding_path": null or "bootstrapped" | "angel" | "vc_seed" | "vc_series_a_plus",
    "target_burn": null or number,
    "delta_burn": null or number,
    "did_customer_validation": null or boolean,
    "old_price": null or number,
    "new_price": null or number,
    "plan_tier": null or "Basic" | "Pro" | "Enterprise",
    "hire_count": null or number,
    "hire_role": null or string,
    "estimated_cost_per_hire": null or number,
    "feature_name": null or string,
    "is_beta": null or boolean,
    "action": null or string,
    "goal": null or string,
    "country": null or string,
    "marketing_budget": null or number
  },
  "raw_text": "original user input",
  "explanation": "Brief explanation of how this decision was parsed"
}
"""


def _rule_based_fallback_parse(text: str) -> Dict[str, Any]:
    """
    Robust rule-based parser that extracts numbers and intents deterministically
    when no LLM API key is present or network call is unavailable.
    """
    text_lower = text.lower().strip()
    
    # 1. Fundraising
    if any(w in text_lower for w in ["raise", "funding", "seed round", "angel", "series a", "invest"]):
        amount = None
        # look for $500k, 500k, $1m, etc.
        m = re.search(r"\$?(\d+(?:\.\d+)?)\s*(k|m|million|thousand|l|lakh)?", text_lower)
        if m:
            val = float(m.group(1))
            unit = (m.group(2) or "").lower()
            if unit in ["k", "thousand"]:
                amount = val * 1000
            elif unit in ["m", "million"]:
                amount = val * 1000000
            elif unit in ["l", "lakh"]:
                amount = val * 100000
            else:
                amount = val if val > 1000 else val * 1000

        funding_path = "vc_seed"
        if "angel" in text_lower:
            funding_path = "angel"
        elif "series a" in text_lower:
            funding_path = "vc_series_a_plus"
        elif "bootstrap" in text_lower:
            funding_path = "bootstrapped"

        return {
            "decision_type": "fundraising",
            "coverage_status": "SUPPORTED",
            "simulation_engine": "MODEL_POWERED",
            "parameters": {
                "raise_amount": amount or 500000.0,
                "funding_path": funding_path
            },
            "raw_text": text,
            "explanation": "Parsed as capital raise impacting cash runway and funding path."
        }

    # 2. Burn Reduction / Adjustment
    is_burn = (
        any(w in text_lower for w in ["cut burn", "lower burn", "burn rate", "cut expenses"]) or
        re.search(r"reduce\b.*\bburn", text_lower) or
        re.search(r"burn\s+from\s+\$", text_lower)
    )
    if is_burn:
        pct = None
        m_pct = re.search(r"(\d+)%", text_lower)
        if m_pct:
            pct = float(m_pct.group(1))
        
        amount = None
        # First, try "from $Xk to $Yk" pattern — target is the second amount
        m_from_to = re.search(r"from\s*\$?(\d+(?:\.\d+)?)\s*(k|m)?\s*to\s*\$?(\d+(?:\.\d+)?)\s*(k|m)?", text_lower)
        if m_from_to:
            val = float(m_from_to.group(3))
            unit = (m_from_to.group(4) or "").lower()
            if unit == "k":
                amount = val * 1000
            elif unit == "m":
                amount = val * 1000000
            else:
                amount = val if val > 1000 else val * 1000
        else:
            m_amt = re.search(r"\$?(\d+(?:\.\d+)?)\s*(k|m)?", text_lower)
            if m_amt:
                val = float(m_amt.group(1))
                unit = (m_amt.group(2) or "").lower()
                amount = val * 1000 if unit == "k" else val

        return {
            "decision_type": "burn_adjustment",
            "coverage_status": "SUPPORTED",
            "simulation_engine": "MODEL_POWERED",
            "parameters": {
                "burn_reduction_pct": pct,
                "target_burn": amount,
                "delta_burn": -amount if amount else None
            },
            "raw_text": text,
            "explanation": "Parsed as operational burn modification directly influencing Model 2 monthly_burn_rate."
        }

    # 3. Customer Validation
    if any(w in text_lower for w in ["validate", "validation", "customer interview", "talk to users", "pmf"]):
        return {
            "decision_type": "validation_action",
            "coverage_status": "SUPPORTED",
            "simulation_engine": "MODEL_POWERED",
            "parameters": {
                "did_customer_validation": True
            },
            "raw_text": text,
            "explanation": "Parsed as customer validation milestone directly activating did_customer_validation in Model 2."
        }

    # 4. Pricing Change
    if any(w in text_lower for w in ["price", "pricing", "tier", "subscription", "$/mo"]):
        # Look for "from $X to $Y"
        m_from_to = re.search(r"from\s*\$?(\d+)\s*to\s*\$?(\d+)", text_lower)
        old_p, new_p = None, None
        if m_from_to:
            old_p = float(m_from_to.group(1))
            new_p = float(m_from_to.group(2))
        else:
            numbers = [float(n) for n in re.findall(r"\$?(\d+)", text_lower)]
            if len(numbers) >= 2:
                old_p, new_p = numbers[0], numbers[1]
            elif len(numbers) == 1:
                new_p = numbers[0]

        tier = "Pro"
        if "basic" in text_lower:
            tier = "Basic"
        elif "enterprise" in text_lower:
            tier = "Enterprise"

        return {
            "decision_type": "pricing_change",
            "coverage_status": "PARTIALLY_SUPPORTED",
            "simulation_engine": "MODEL_POWERED",
            "parameters": {
                "old_price": old_p,
                "new_price": new_p or (old_p * 1.3 if old_p else 129.0),
                "plan_tier": tier
            },
            "raw_text": text,
            "explanation": "Parsed as pricing change. Partially supported via Model 1 account_plan_tier and MRR recalibration."
        }

    # 5. Hiring
    if any(w in text_lower for w in ["hire", "hiring", "engineer", "recruiting", "headcount"]):
        word_numbers = {
            "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
            "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10
        }
        count = 1
        m_count = re.search(r"(\d+)\s*(engineer|dev|sales|people|member)?", text_lower)
        if m_count:
            count = int(m_count.group(1))
        else:
            for w, num in word_numbers.items():
                if re.search(rf"\b{w}\b", text_lower):
                    count = num
                    break
        role = "engineer" if "engineer" in text_lower or "dev" in text_lower else "general"

        return {
            "decision_type": "hiring",
            "coverage_status": "PARTIALLY_SUPPORTED",
            "simulation_engine": "MODEL_POWERED",
            "parameters": {
                "hire_count": count,
                "hire_role": role,
                "estimated_cost_per_hire": 8000.0  # standard monthly burn addition
            },
            "raw_text": text,
            "explanation": "Parsed as team expansion. Partially supported via monthly burn increase and team completeness."
        }

    # 6. Feature Launch / Product Functionality
    is_feature_launch = False
    action_verb = "launch"
    feature_name = None
    goal_desc = None

    # Pattern A: Action verb + optional qualifiers + feature/functionality/tool/module
    m_feat_word = re.search(
        r"\b(launch|build|ship|release|roll out|add|introduce|create|implement|develop)\s+(?:a\s+|an\s+|the\s+)?(?:([a-z0-9_\-\s]{1,40}?)\s+)?(feature|functionality|capability|capabilities|tool|integration|module|workflow|plugin)\b",
        text_lower
    )

    # Pattern B: Direct domain capability keywords following a creation verb
    feat_domain_keywords = [
        "maps", "marketplace", "social discovery", "location-based discovery",
        "location discovery", "team collaboration", "collaboration", "community",
        "messaging", "chat", "hangout", "social network", "recommendation engine",
        "dashboard", "notifications", "analytics", "integrations", "ai assistant",
        "search", "social"
    ]
    domain_kw_pattern = r"\b(" + "|".join(re.escape(k) for k in feat_domain_keywords) + r")\b"
    m_verb_domain = re.search(
        rf"\b(launch|build|ship|release|roll out|add|introduce|create|implement|develop)\s+(?:a\s+|an\s+|the\s+)?{domain_kw_pattern}",
        text_lower
    )

    # Pattern C: User action capabilities ("allow users to", "users can connect", "users to invite")
    m_user_action = re.search(
        r"\b(?:allow|enable)\s+users\s+to\b|\busers\s+(?:can|to\s+be\s+able\s+to)\s+([a-z0-9_\-\s]+)",
        text_lower
    )

    # Pattern D: Beta releases
    m_beta = re.search(r"\b(beta|mvp)\b", text_lower)

    if m_feat_word:
        is_feature_launch = True
        action_verb = m_feat_word.group(1)
        qualifier = (m_feat_word.group(2) or "").strip()
        feat_type = m_feat_word.group(3).strip()
        feature_name = f"{qualifier} {feat_type}".strip() if qualifier else feat_type
    elif m_verb_domain:
        is_feature_launch = True
        action_verb = m_verb_domain.group(1)
        feature_name = m_verb_domain.group(2).strip()
    elif m_user_action and any(v in text_lower for v in ["launch", "build", "add", "introduce", "want", "allow", "enable"]):
        is_feature_launch = True
        action_verb = "build"
        feature_name = "user functionality"
    elif m_beta and any(v in text_lower for v in ["launch", "release", "ship", "roll out", "build", "deploy", "open"]):
        is_feature_launch = True
        action_verb = "launch"
        feature_name = "beta release"

    if is_feature_launch:
        m_goal = re.search(r"\b(?:where|so that|for|to allow|to enable)\s+([a-z0-9_\-\s]+)", text_lower)
        if m_goal:
            goal_desc = m_goal.group(1).strip()
        else:
            goal_desc = text

        return {
            "decision_type": "feature_launch",
            "coverage_status": "PARTIALLY_SUPPORTED",
            "simulation_engine": "MODEL_POWERED",
            "action": action_verb,
            "description": text,
            "feature_name": feature_name or "new feature",
            "goal": goal_desc,
            "confidence": 0.85,
            "parameters": {
                "is_beta": True if "beta" in text_lower else False,
                "feature_name": feature_name or "new feature",
                "action": action_verb,
                "goal": goal_desc
            },
            "raw_text": text,
            "explanation": f"Parsed as feature launch ('{feature_name or 'new feature'}'). Partially supported via Model 1 has_beta_feature and n_unique_features."
        }

    # 7. Country / Expansion
    is_expansion = (
        any(w in text_lower for w in ["expand country", "expand to", "new market", "international"]) or
        re.search(r"expand\b.*\b(operations|business|into|market)", text_lower)
    )
    if is_expansion:
        # Try to extract country name from common patterns
        country = None
        m_country = re.search(r"(?:into|to|in)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)", text)
        if m_country:
            country = m_country.group(1)
        return {
            "decision_type": "market_expansion",
            "coverage_status": "UNSUPPORTED",
            "simulation_engine": "RULE_BASED",
            "parameters": {
                "country": country,
                "raw_target": text
            },
            "raw_text": text,
            "explanation": "Geographic portfolio expansion is unsupported by single-account panel ML models. Routed to rule-based simulator."
        }

    # 8. Marketing Spend
    if any(w in text_lower for w in ["marketing", "ads", "advertising", "ad spend"]):
        return {
            "decision_type": "marketing_spend",
            "coverage_status": "UNSUPPORTED",
            "simulation_engine": "RULE_BASED",
            "parameters": {
                "raw_target": text
            },
            "raw_text": text,
            "explanation": "Continuous ad spend is not a trained ML feature in the current schema. Routed to rule-based simulator."
        }

    # Generic Fallback
    return {
        "decision_type": "other",
        "coverage_status": "UNSUPPORTED",
        "simulation_engine": "RULE_BASED",
        "parameters": {},
        "raw_text": text,
        "explanation": "Insufficient model coverage for this unmapped decision."
    }


async def parse_founder_decision(text: str) -> Dict[str, Any]:
    """
    Parses natural language decision text into a structured decision dictionary.
    Attempts LLM extraction if an API key is configured, else falls back to deterministic NLP.
    """
    if not text or not text.strip():
        return {
            "decision_type": "none",
            "coverage_status": "UNSUPPORTED",
            "simulation_engine": "RULE_BASED",
            "parameters": {},
            "raw_text": "",
            "explanation": "Empty decision text provided."
        }

    api_key = settings.MISTRAL_API_KEY
    if api_key:
        try:
            candidate_models = ["mistral-small-latest", "ministral-8b-latest", "open-mistral-7b", "ministral-3b-latest"]
            for model_name in candidate_models:
                payload = {
                    "model": model_name,
                    "messages": [
                        {"role": "system", "content": DECISION_PARSER_SYSTEM_PROMPT},
                        {"role": "user", "content": f"Parse this founder decision:\n\"{text}\""}
                    ],
                    "response_format": {"type": "json_object"},
                    "max_tokens": 1200
                }
                req = urllib.request.Request(
                    "https://api.mistral.ai/v1/chat/completions",
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
                    method="POST"
                )
                try:
                    with urllib.request.urlopen(req, timeout=30) as resp:
                        resp_json = json.loads(resp.read().decode("utf-8"))
                        parsed = json.loads(resp_json["choices"][0]["message"]["content"].strip())
                        parsed["raw_text"] = text
                        return parsed
                except Exception as ex:
                    logger.debug(f"[decision_parser] Model {model_name} failed: {ex}")
                    continue
        except Exception as e:
            logger.warning(f"[decision_parser] LLM parsing failed ({e}). Falling back to deterministic parser.")

    return _rule_based_fallback_parse(text)
