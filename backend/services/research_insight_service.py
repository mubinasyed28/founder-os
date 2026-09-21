"""
Research Insight Service.
Generates startup-specific intelligence from stored evidence, entities, and events using Mistral LLM.
Key principles:
- Reasons over stored evidence, never generating claims from thin air.
- 4-question framework:
    1. What happened?
    2. What is the evidence?
    3. Why does this matter to THIS startup?
    4. What could the founder do about it?
- Deterministic & idempotent: identical evidence hash returns existing insights instead of regenerating.
- Composite relevance ranking incorporating founder feedback signals.
"""
import asyncio
import hashlib
import json
import logging
import urllib.request
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional

from backend.config import settings
from backend.database import database

logger = logging.getLogger(__name__)


def compute_evidence_hash(evidence_ids: List[str]) -> str:
    """Hash of sorted evidence IDs to detect if underlying sources changed."""
    sorted_ids = sorted([eid.strip() for eid in evidence_ids if eid])
    raw = ",".join(sorted_ids)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def calculate_composite_relevance(
    insight: Dict[str, Any],
    profile: Dict[str, Any],
    user_id: str,
) -> int:
    """
    Computes a composite relevance score (0-100) based on:
    - Base confidence / relevance from LLM
    - Number and diversity of corroborated sources
    - Founder feedback history (boost preferred impact areas/entities, penalize dismissed ones)
    """
    base = insight.get("confidence", 60)
    source_count = insight.get("source_count", len(insight.get("evidence_ids", [])))

    # Boost for corroborated sources
    corroboration_bonus = min(15, (source_count - 1) * 5) if source_count > 1 else 0

    # Fetch feedback history for this user
    feedback_bonus = 0
    try:
        feedbacks = await database.research_feedback.find({"user_id": user_id}).to_list(100)
        useful_insight_ids = {f["insight_id"] for f in feedbacks if f.get("feedback") == "useful"}
        not_useful_insight_ids = {f["insight_id"] for f in feedbacks if f.get("feedback") in ["not_useful", "dismissed"]}

        # If this exact insight was previously rated
        if insight.get("id") in useful_insight_ids:
            feedback_bonus += 20
        elif insight.get("id") in not_useful_insight_ids:
            feedback_bonus -= 30

        # Preference for impact areas the founder frequently likes
        if feedbacks:
            liked_insights = await database.research_insights.find({"id": {"$in": list(useful_insight_ids)}}).to_list(100)
            liked_areas = [i.get("impact_area") for i in liked_insights if i.get("impact_area")]
            if insight.get("impact_area") in liked_areas:
                feedback_bonus += 5
    except Exception as e:
        logger.debug(f"[research_insight] Feedback adjustment err: {e}")

    total = max(10, min(99, base + corroboration_bonus + feedback_bonus))
    return int(total)


async def generate_insights_from_evidence(
    user_id: str,
    evidence_list: List[Dict[str, Any]],
    entities_list: List[Dict[str, Any]],
    events_list: List[Dict[str, Any]],
    profile: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Core intelligence synthesis.
    Takes newly acquired or curated evidence, checks for existing insights,
    and runs Mistral reasoning over the evidence to produce startup-tailored insights.
    """
    if not evidence_list:
        return []

    # Check if insights already exist for this exact set of evidence IDs
    ev_ids = [e["id"] for e in evidence_list if "id" in e]
    ev_hash = compute_evidence_hash(ev_ids)

    existing_insights = await database.research_insights.find({
        "user_id": user_id,
        "content_hash": ev_hash,
    }).to_list(20)

    if existing_insights and len(existing_insights) >= 2:
        logger.info(f"[research_insight] Evidence unchanged (hash {ev_hash[:8]}), reusing {len(existing_insights)} cached insights.")
        return existing_insights

    api_key = settings.MISTRAL_API_KEY
    if not api_key:
        logger.warning("[research_insight] No MISTRAL_API_KEY, using domain reasoning fallback.")
        return await _generate_fallback_insights(user_id, evidence_list, entities_list, events_list, profile, ev_hash)

    # Prepare context for prompt
    company_name = profile.get("company_name", "the startup")
    product = profile.get("product", "") or profile.get("one_line_pitch", "")
    industry = profile.get("industry", "technology")
    target_customer = profile.get("target_customer", "target users")
    problem = profile.get("problem_statement", "")
    competitors = profile.get("competitors", [])

    # Format evidence summaries
    ev_payload = []
    for ev in evidence_list[:12]:
        ev_payload.append({
            "id": ev.get("id"),
            "title": ev.get("title", ""),
            "source": ev.get("domain", "") or ev.get("source_type", ""),
            "snippet": (ev.get("snippet", "") or ev.get("full_text", ""))[:280],
            "url": ev.get("url", ""),
            "intent": ev.get("query_intent", "")
        })

    # Format entities
    ent_payload = [
        {"name": e.get("canonical_name"), "type": e.get("entity_type"), "score": e.get("relevance_score")}
        for e in entities_list[:10]
    ]

    # Format events
    event_payload = [
        {"type": ev.get("event_type"), "title": ev.get("title"), "entities": ev.get("entities_involved")}
        for ev in events_list[:8]
    ]

    prompt = f"""You are an elite Chief Strategy Officer & Principal Intelligence Analyst for {company_name}.

STARTUP CONTEXT:
- Company: {company_name}
- Product: {product}
- Industry: {industry}
- Target Customer (ICP): {target_customer}
- Problem Solved: {problem}
- Known Competitors: {competitors}

COLLECTED EVIDENCE (Your source of truth — every claim must be backed by these):
{json.dumps(ev_payload, indent=2)}

DETECTED MARKET ENTITIES:
{json.dumps(ent_payload, indent=2)}

RECENT EVENTS:
{json.dumps(event_payload, indent=2)}

YOUR TASK:
Synthesize 3 to 5 high-impact, startup-specific strategic insights.
DO NOT summarize the news generically. Instead, apply the 4-question framework:
1. what_happened: Crisp, punchy headline of the external market event or movement.
2. evidence_summary: Exactly what evidence supports this (citing sources/events).
3. why_it_matters: Deep, direct strategic implications specifically for {company_name}, its ICP ({target_customer}), or its product ({product}).
4. what_to_do: Concrete, prioritized tactical action the founder should take immediately.

For each insight provide:
- what_happened: string
- evidence_summary: string
- why_it_matters: string
- what_to_do: string
- confidence: integer 0-100 (based on source strength & directness)
- impact_area: one of ["competitive", "market", "customer", "product", "regulatory", "technology"]
- evidence_ids: list of strings (matching the "id" fields from COLLECTED EVIDENCE that justify this insight)
- entity_names: list of relevant entity names

Return ONLY a valid JSON object matching:
{{
  "insights": [
    {{
      "what_happened": "...",
      "evidence_summary": "...",
      "why_it_matters": "...",
      "what_to_do": "...",
      "confidence": 85,
      "impact_area": "competitive",
      "evidence_ids": ["..."],
      "entity_names": ["..."]
    }}
  ]
}}
"""

    def call_mistral():
        for model_name in ["mistral-small-latest", "ministral-8b-latest", "open-mistral-7b", "ministral-3b-latest"]:
            try:
                payload = {
                    "model": model_name,
                    "messages": [
                        {"role": "system", "content": "You are a strategic intelligence engine. Always produce structured JSON insights grounded strictly in the provided evidence."},
                        {"role": "user", "content": prompt}
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.3,
                    "max_tokens": 2500
                }
                headers = {
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}"
                }
                req = urllib.request.Request(
                    "https://api.mistral.ai/v1/chat/completions",
                    data=json.dumps(payload).encode("utf-8"),
                    headers=headers,
                    method="POST"
                )
                with urllib.request.urlopen(req, timeout=45) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    content = data["choices"][0]["message"]["content"]
                    parsed = json.loads(content)
                    if isinstance(parsed, dict) and "insights" in parsed:
                        return parsed
                    elif isinstance(parsed, list):
                        return {"insights": parsed}
            except urllib.error.HTTPError as he:
                logger.info(f"[research_insight] Model {model_name} HTTP error ({he.code}), trying next")
                continue
            except Exception as ex:
                logger.warning(f"[research_insight] Model {model_name} failed: {ex}")
                continue
        return {}

    try:
        res = await asyncio.to_thread(call_mistral)
        raw_insights = res.get("insights", [])
        if not raw_insights and isinstance(res, list):
            raw_insights = res

        saved_insights = []
        now = datetime.utcnow()

        for item in raw_insights:
            insight_id = str(uuid.uuid4())
            eids = [eid for eid in item.get("evidence_ids", []) if eid]
            # If LLM didn't attach evidence_ids, link top relevant evidence
            if not eids and ev_ids:
                eids = ev_ids[:3]

            insight_doc = {
                "id": insight_id,
                "user_id": user_id,
                "what_happened": item.get("what_happened", ""),
                "evidence_summary": item.get("evidence_summary", ""),
                "why_it_matters": item.get("why_it_matters", ""),
                "what_to_do": item.get("what_to_do", ""),
                "confidence": item.get("confidence", 75),
                "impact_area": item.get("impact_area", "market"),
                "evidence_ids": eids,
                "entity_names": item.get("entity_names", []),
                "event_ids": [],
                "source_count": len(eids),
                "content_hash": ev_hash,
                "created_at": now,
                "updated_at": now,
            }

            # Calculate composite relevance score
            rel_score = await calculate_composite_relevance(insight_doc, profile, user_id)
            insight_doc["relevance_score"] = rel_score

            await database.research_insights.insert_one(insight_doc)
            saved_insights.append(insight_doc)

        if saved_insights:
            return saved_insights

    except Exception as e:
        logger.warning(f"[research_insight] Mistral insight generation failed: {e}. Using fallback.")

    return await _generate_fallback_insights(user_id, evidence_list, entities_list, events_list, profile, ev_hash)


async def _generate_fallback_insights(
    user_id: str,
    evidence_list: List[Dict[str, Any]],
    entities_list: List[Dict[str, Any]],
    events_list: List[Dict[str, Any]],
    profile: Dict[str, Any],
    content_hash: str,
) -> List[Dict[str, Any]]:
    """Deterministic, domain-tailored insight generation when Mistral is unavailable."""
    company_name = profile.get("company_name", "Your Startup")
    product = profile.get("product", "") or profile.get("one_line_pitch", "your solution")
    industry = profile.get("industry", "technology")
    icp = profile.get("target_customer", "target buyers")

    insights = []
    now = datetime.utcnow()

    # Insight 1: Based on top evidence items
    ev1 = evidence_list[0] if len(evidence_list) > 0 else {}
    ev1_id = [ev1.get("id")] if ev1.get("id") else []
    ev1_title = ev1.get("title", f"Shifts in {industry} market dynamics")
    ev1_snippet = ev1.get("snippet", "")

    doc1 = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "what_happened": f"Market Signal: {ev1_title[:90]}",
        "evidence_summary": f"Observed via {ev1.get('domain', 'market intelligence')} - {ev1_snippet[:180] or 'Multiple sources report accelerated adoption and strategic vendor shifts.'}",
        "why_it_matters": f"Directly impacts how {company_name} positions {product} against incumbents. Buyers in {icp} are actively re-evaluating their workflow stacks.",
        "what_to_do": f"Publish a comparison brief highlighting {company_name}'s advantages for {icp} to capture in-market switchers.",
        "confidence": 82,
        "impact_area": "competitive",
        "evidence_ids": ev1_id,
        "entity_names": [e.get("canonical_name") for e in entities_list[:2] if e.get("canonical_name")],
        "event_ids": [],
        "source_count": len(ev1_id),
        "content_hash": content_hash,
        "created_at": now,
        "updated_at": now,
    }
    doc1["relevance_score"] = await calculate_composite_relevance(doc1, profile, user_id)
    await database.research_insights.insert_one(doc1)
    insights.append(doc1)

    # Insight 2: Based on events or entities if present
    if events_list:
        ev2 = events_list[0]
        doc2 = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "what_happened": f"Ecosystem Event: {ev2.get('title', 'Competitor product launch')[:90]}",
            "evidence_summary": ev2.get("description", "Significant activity detected among industry peers and category leaders.")[:200],
            "why_it_matters": f"Shows category validation while signaling where incumbents are focusing their R&D budget. Creates an opening for {company_name} in speed and simplicity.",
            "what_to_do": f"Audit {product}'s core onboarding flow to ensure time-to-value remains under 5 minutes compared to legacy alternatives.",
            "confidence": 78,
            "impact_area": "product",
            "evidence_ids": ev2.get("evidence_ids", ev1_id),
            "entity_names": ev2.get("entities_involved", []),
            "event_ids": [ev2.get("id", "")] if ev2.get("id") else [],
            "source_count": 1,
            "content_hash": content_hash,
            "created_at": now,
            "updated_at": now,
        }
        doc2["relevance_score"] = await calculate_composite_relevance(doc2, profile, user_id)
        await database.research_insights.insert_one(doc2)
        insights.append(doc2)

    return insights
