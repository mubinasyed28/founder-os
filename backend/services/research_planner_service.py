"""
Research Planner Service.
Uses Mistral LLM to analyze the company profile and generate highly targeted,
startup-specific search queries for the intelligence pipeline.
"""
import asyncio
import json
import logging
import urllib.request
from typing import Dict, Any, List

from backend.config import settings

logger = logging.getLogger(__name__)


async def generate_research_queries(
    profile: Dict[str, Any],
    existing_competitors: List[str] = None,
    past_feedback: List[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Use Mistral to generate targeted research queries based on the full company profile.
    
    Returns list of: { "text": str, "intent": str, "priority": int }
    Intent types: competitor_activity, market_trend, customer_signal, regulatory, technology
    """
    if existing_competitors is None:
        existing_competitors = []
    if past_feedback is None:
        past_feedback = []

    api_key = settings.MISTRAL_API_KEY
    if not api_key:
        logger.warning("[planner] No MISTRAL_API_KEY, using fallback query generation")
        return _fallback_queries(profile, existing_competitors)

    # Build context from profile
    company_name = profile.get("company_name", "")
    industry = profile.get("industry", "")
    product = profile.get("product", "")
    problem = profile.get("problem_statement", "")
    solution = profile.get("solution", "")
    target_customer = profile.get("target_customer", "")
    business_model = profile.get("business_model", "")
    current_stage = profile.get("current_stage", "")
    location = profile.get("location", "")
    traction = profile.get("traction", "")
    challenges = profile.get("current_challenges", [])
    if isinstance(challenges, str):
        challenges = [challenges]

    # Build feedback context
    feedback_context = ""
    if past_feedback:
        useful = [f for f in past_feedback if f.get("feedback") == "useful"]
        not_useful = [f for f in past_feedback if f.get("feedback") == "not_useful"]
        if useful:
            feedback_context += f"\nThe founder found these types of insights USEFUL in the past: topics related to previous high-rated insights."
        if not_useful:
            feedback_context += f"\nThe founder found these types of insights NOT USEFUL: avoid generic industry news without specific actionability."

    competitors_str = ", ".join(existing_competitors[:10]) if existing_competitors else "none identified yet"

    prompt = f"""You are a startup research strategist generating targeted search queries for a specific startup.

STARTUP PROFILE:
- Company: {company_name}
- Industry: {industry}
- Product: {product}
- Problem being solved: {problem}
- Solution: {solution}
- Target customer (ICP): {target_customer}
- Business model: {business_model}
- Stage: {current_stage}
- Location: {location}
- Traction: {traction}
- Current challenges: {json.dumps(challenges)}
- Known competitors: {competitors_str}
{feedback_context}

TASK:
Generate 8-12 highly targeted, startup-specific search queries. These must NOT be generic industry searches.
Each query should help the founder understand something directly actionable for THEIR specific startup.

Query categories (distribute across all relevant ones):
1. competitor_activity — What are named competitors doing? New features, funding, pivots?
2. market_trend — What market shifts affect this specific product/ICP segment?
3. customer_signal — What are target customers complaining about, asking for, or switching to?
4. regulatory — Any policy/regulation changes affecting this industry or business model?
5. technology — Tech shifts that create opportunities or threats for this product?

Rules:
- Include company/competitor names in queries where relevant
- Include specific product categories, not just industry names
- Target the ICP segment specifically, not broad demographics
- Prioritize recency — use "2025" or "2026" in queries where helpful
- Do NOT generate queries about the startup itself (no vanity searches)

Return ONLY valid JSON:
{{
  "queries": [
    {{
      "text": "search query text",
      "intent": "competitor_activity|market_trend|customer_signal|regulatory|technology",
      "priority": 1
    }}
  ]
}}

Priority: 1 = highest, 5 = lowest."""

    try:
        def call_mistral():
            for model_name in ["open-mistral-7b", "mistral-small-latest", "mistral-large-latest"]:
                try:
                    payload = {
                        "model": model_name,
                        "messages": [
                            {"role": "system", "content": "You are a startup competitive intelligence researcher. Generate targeted, specific search queries. Return ONLY valid JSON."},
                            {"role": "user", "content": prompt}
                        ],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.3,
                    }
                    headers = {
                        "Content-Type": "application/json",
                        "Authorization": f"Bearer {api_key}",
                    }
                    req = urllib.request.Request(
                        "https://api.mistral.ai/v1/chat/completions",
                        data=json.dumps(payload).encode("utf-8"),
                        headers=headers,
                        method="POST",
                    )
                    with urllib.request.urlopen(req, timeout=30) as response:
                        resp_data = response.read().decode("utf-8")
                        resp_json = json.loads(resp_data)
                        content = resp_json["choices"][0]["message"]["content"]
                        parsed = json.loads(content.strip())
                        if isinstance(parsed, dict) and "queries" in parsed:
                            return parsed
                except urllib.error.HTTPError as he:
                    if he.code in [403, 404, 422]:
                        logger.info(f"[planner] Model {model_name} unavailable ({he.code}), trying next model")
                        continue
                    raise he
            return None

        result = await asyncio.to_thread(call_mistral)
        queries = result.get("queries", [])

        # Validate structure
        valid = []
        for q in queries:
            if isinstance(q, dict) and q.get("text"):
                valid.append({
                    "text": q["text"],
                    "intent": q.get("intent", "market_trend"),
                    "priority": int(q.get("priority", 3)),
                })
        
        # Sort by priority
        valid.sort(key=lambda x: x["priority"])
        logger.info(f"[planner] Generated {len(valid)} research queries via Mistral")
        return valid[:12]

    except Exception as e:
        logger.error(f"[planner] Mistral query planning failed: {e}")
        return _fallback_queries(profile, existing_competitors)


def _fallback_queries(profile: Dict[str, Any], competitors: List[str]) -> List[Dict[str, Any]]:
    """Deterministic fallback when Mistral is unavailable."""
    queries = []
    industry = profile.get("industry", "")
    product = profile.get("product", "")
    target_customer = profile.get("target_customer", "")
    problem = profile.get("problem_statement", "")

    if industry:
        queries.append({"text": f"{industry} market trends 2026", "intent": "market_trend", "priority": 2})
        queries.append({"text": f"{industry} startup news latest", "intent": "market_trend", "priority": 3})
    
    if product:
        queries.append({"text": f"{product} alternatives competitors 2026", "intent": "competitor_activity", "priority": 1})
    
    if target_customer:
        queries.append({"text": f"{target_customer} pain points tools 2026", "intent": "customer_signal", "priority": 2})

    if problem:
        short_problem = problem[:80]
        queries.append({"text": f"companies solving {short_problem}", "intent": "competitor_activity", "priority": 2})

    for comp in competitors[:5]:
        if comp and comp.strip():
            queries.append({"text": f"{comp.strip()} news funding 2026", "intent": "competitor_activity", "priority": 1})

    if industry:
        queries.append({"text": f"{industry} regulation policy changes 2026", "intent": "regulatory", "priority": 4})
        queries.append({"text": f"{industry} AI technology trends", "intent": "technology", "priority": 3})

    # Deduplicate
    seen = set()
    unique = []
    for q in queries:
        key = q["text"].lower().strip()
        if key not in seen:
            seen.add(key)
            unique.append(q)

    return unique[:10]
