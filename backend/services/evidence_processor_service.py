"""
Evidence Processor Service.
Handles:
1. Deduplication of evidence records via SHA-256 content hashing.
2. Entity extraction (companies, people, products, technologies) using Mistral LLM.
3. Persistent entity merging in MongoDB (updating mention counts, attributes, and evidence links).
4. Event extraction (funding, product launches, partnerships, regulatory changes) and dedup.
"""
import asyncio
import hashlib
import json
import logging
import urllib.request
import uuid
from datetime import datetime
from typing import Dict, Any, List, Tuple, Optional

from backend.config import settings
from backend.database import database

logger = logging.getLogger(__name__)


def compute_content_hash(url: str, title: str) -> str:
    """Deterministic hash for deduplication based on normalized URL and title."""
    clean_url = (url or "").strip().lower().rstrip("/")
    clean_title = (title or "").strip().lower()
    raw = f"{clean_url}:{clean_title}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def compute_event_signature(event_type: str, entities: List[str], title: str) -> str:
    """Deterministic signature to deduplicate identical events."""
    ent_str = ",".join(sorted([e.strip().lower() for e in entities if e]))
    clean_title = (title or "").strip().lower()[:60]
    raw = f"{event_type.lower()}:{ent_str}:{clean_title}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


async def process_and_deduplicate_evidence(
    user_id: str,
    raw_results: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], int]:
    """
    Takes raw search/news items, computes hashes, dedups against research_evidence collection.
    Updates last_seen_at for existing items, stores new items.
    
    Returns:
        (new_evidence_records, existing_count)
    """
    new_records: List[Dict[str, Any]] = []
    existing_count = 0
    now = datetime.utcnow()

    for item in raw_results:
        url = item.get("url", "")
        title = item.get("title", "")
        if not url and not title:
            continue

        c_hash = compute_content_hash(url, title)

        # Check if already present in database for this user
        existing = await database.research_evidence.find_one({
            "user_id": user_id,
            "content_hash": c_hash,
        })

        if existing:
            existing_count += 1
            # Update last_seen_at
            await database.research_evidence.update_one(
                {"_id": existing["_id"]},
                {"$set": {"last_seen_at": now}}
            )
        else:
            evidence_id = str(uuid.uuid4())
            record = {
                "id": evidence_id,
                "user_id": user_id,
                "url": url,
                "title": title,
                "snippet": item.get("snippet", "") or item.get("description", ""),
                "full_text": item.get("full_text", "") or item.get("snippet", ""),
                "source_type": item.get("source_type", "web_search"),
                "source_query": item.get("source_query", ""),
                "query_intent": item.get("query_intent", ""),
                "domain": item.get("domain", ""),
                "content_hash": c_hash,
                "retrieved_at": now,
                "last_seen_at": now,
                "metadata": item.get("metadata", {}),
            }
            try:
                await database.research_evidence.insert_one(record)
                new_records.append(record)
            except Exception as e:
                # Handle race condition or duplicate key
                logger.debug(f"[evidence_processor] Insert conflict for {c_hash}: {e}")
                existing_count += 1

    return new_records, existing_count


async def extract_entities_and_events(
    user_id: str,
    evidence_list: List[Dict[str, Any]],
    startup_context: Dict[str, Any],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Uses Mistral to extract entities and events from a batch of newly collected evidence.
    Falls back to heuristic extraction if LLM is unavailable.
    """
    if not evidence_list:
        return [], []

    api_key = settings.MISTRAL_API_KEY
    if not api_key:
        return _fallback_extract(user_id, evidence_list, startup_context)

    # Prepare evidence summaries for the prompt (cap to top 15 to stay within prompt limits)
    evidence_payload = []
    for ev in evidence_list[:15]:
        evidence_payload.append({
            "id": ev["id"],
            "title": ev.get("title", ""),
            "snippet": (ev.get("snippet", "") or ev.get("full_text", ""))[:300],
            "url": ev.get("url", ""),
            "source_type": ev.get("source_type", "")
        })

    company_name = startup_context.get("company_name", "the startup")
    industry = startup_context.get("industry", "technology")

    prompt = f"""You are an intelligence analyst extracting entities and strategic market events for {company_name} (Industry: {industry}).

Analyze the following search/news evidence items:
{json.dumps(evidence_payload, indent=2)}

Extract:
1. ENTITIES: Real-world companies, products, key people, or specific technologies mentioned.
   - For each entity: canonical_name, entity_type ("company", "person", "product", "technology", "organization"), attributes (e.g. industry, funding, role), relevance_score (0-100 to {company_name}), and linked_evidence_ids (list of evidence IDs where it appears).
2. EVENTS: Specific discrete market events (funding rounds, product launches, partnerships, acquisitions, regulatory updates, notable pivots).
   - For each event: event_type ("funding_round", "product_launch", "partnership", "acquisition", "regulatory", "market_shift"), title, description, event_date (ISO or approximate string, e.g. "2026-08"), entities_involved (names), evidence_ids (which evidence supported this), relevance_score (0-100 to {company_name}).

Return ONLY valid JSON matching this schema:
{{
  "entities": [
    {{
      "canonical_name": "Acme Corp",
      "entity_type": "company",
      "attributes": {{"focus": "AI infrastructure", "stage": "Series A"}},
      "relevance_score": 75,
      "linked_evidence_ids": ["..."]
    }}
  ],
  "events": [
    {{
      "event_type": "product_launch",
      "title": "Acme launches real-time streaming API",
      "description": "...",
      "event_date": "2026",
      "entities_involved": ["Acme Corp"],
      "evidence_ids": ["..."],
      "relevance_score": 80
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
                        {"role": "system", "content": "You are a precise data extraction specialist. Always output valid JSON."},
                        {"role": "user", "content": prompt}
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.2,
                    "max_tokens": 2000
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
                with urllib.request.urlopen(req, timeout=40) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    content = data["choices"][0]["message"]["content"]
                    parsed = json.loads(content)
                    if isinstance(parsed, dict) and ("entities" in parsed or "events" in parsed):
                        return parsed
            except urllib.error.HTTPError as he:
                logger.info(f"[evidence_processor] Model {model_name} HTTP error ({he.code}), trying next")
                continue
            except Exception as ex:
                logger.warning(f"[evidence_processor] Model {model_name} failed: {ex}")
                continue
        return {}

    try:
        result = await asyncio.to_thread(call_mistral)
        extracted_entities = result.get("entities", [])
        extracted_events = result.get("events", [])
        return extracted_entities, extracted_events
    except Exception as e:
        logger.warning(f"[evidence_processor] Mistral extraction failed: {e}. Falling back to heuristics.")
        return _fallback_extract(user_id, evidence_list, startup_context)


def _fallback_extract(
    user_id: str,
    evidence_list: List[Dict[str, Any]],
    startup_context: Dict[str, Any],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Heuristic extraction when LLM is unavailable."""
    entities: List[Dict[str, Any]] = []
    events: List[Dict[str, Any]] = []
    seen_entity_names = set()

    # Common competitor names or terms from context
    known_comps = startup_context.get("competitors", [])
    if isinstance(known_comps, str):
        known_comps = [c.strip() for c in known_comps.split(",") if c.strip()]

    for ev in evidence_list:
        ev_id = ev.get("id", "")
        title = ev.get("title", "")
        snippet = ev.get("snippet", "")
        combined = f"{title} {snippet}"

        # Look for known competitors
        for comp in known_comps:
            if comp.lower() in combined.lower() and comp.lower() not in seen_entity_names:
                seen_entity_names.add(comp.lower())
                entities.append({
                    "canonical_name": comp,
                    "entity_type": "company",
                    "attributes": {"source": "known_competitor"},
                    "relevance_score": 85,
                    "linked_evidence_ids": [ev_id]
                })

        # Event heuristics based on keywords
        lower = combined.lower()
        event_type = None
        if any(w in lower for w in ["raised", "funding", "seed", "series a", "series b", "valuation"]):
            event_type = "funding_round"
        elif any(w in lower for w in ["launch", "released", "announced", "introduces", "unveils"]):
            event_type = "product_launch"
        elif any(w in lower for w in ["partner", "collaboration", "integrates with", "teams up"]):
            event_type = "partnership"
        elif any(w in lower for w in ["acquire", "bought", "merger"]):
            event_type = "acquisition"
        elif any(w in lower for w in ["regulation", "compliance", "sec", "ftc", "gdpr", "policy"]):
            event_type = "regulatory"

        if event_type:
            events.append({
                "event_type": event_type,
                "title": title[:100],
                "description": snippet[:250],
                "event_date": datetime.utcnow().strftime("%Y-%m-%d"),
                "entities_involved": [ev.get("domain", "")],
                "evidence_ids": [ev_id],
                "relevance_score": 70
            })

    return entities, events


async def merge_entities_into_db(
    user_id: str,
    extracted_entities: List[Dict[str, Any]]
) -> int:
    """
    Merges extracted entities into the persistent research_entities collection.
    If entity exists (user_id + canonical_name + entity_type), update mention count,
    merge attributes, and union linked evidence IDs.
    If new, inserts new ResearchEntity.
    
    Returns count of updated/inserted entities.
    """
    count = 0
    now = datetime.utcnow()

    for ent in extracted_entities:
        raw_name = ent.get("canonical_name", "").strip()
        if not raw_name or len(raw_name) < 2:
            continue

        e_type = ent.get("entity_type", "company").strip().lower()
        if e_type not in ["company", "person", "product", "technology", "organization"]:
            e_type = "company"

        # Canonicalize name
        canonical_name = raw_name.title() if e_type in ["company", "person"] else raw_name

        existing = await database.research_entities.find_one({
            "user_id": user_id,
            "canonical_name": canonical_name,
            "entity_type": e_type,
        })

        if existing:
            # Merge
            existing_attrs = existing.get("attributes", {})
            new_attrs = ent.get("attributes", {})
            merged_attrs = {**existing_attrs, **new_attrs}

            existing_ev_ids = set(existing.get("linked_evidence_ids", []))
            for eid in ent.get("linked_evidence_ids", []):
                if eid:
                    existing_ev_ids.add(eid)

            new_score = max(existing.get("relevance_score", 50), ent.get("relevance_score", 50))

            await database.research_entities.update_one(
                {"_id": existing["_id"]},
                {
                    "$inc": {"mention_count": 1},
                    "$set": {
                        "last_seen_at": now,
                        "attributes": merged_attrs,
                        "linked_evidence_ids": list(existing_ev_ids),
                        "relevance_score": new_score,
                    }
                }
            )
            count += 1
        else:
            new_id = str(uuid.uuid4())
            doc = {
                "id": new_id,
                "user_id": user_id,
                "canonical_name": canonical_name,
                "entity_type": e_type,
                "attributes": ent.get("attributes", {}),
                "first_seen_at": now,
                "last_seen_at": now,
                "mention_count": 1,
                "linked_evidence_ids": [eid for eid in ent.get("linked_evidence_ids", []) if eid],
                "relevance_score": ent.get("relevance_score", 60),
            }
            try:
                await database.research_entities.insert_one(doc)
                count += 1
            except Exception as e:
                logger.debug(f"[evidence_processor] Entity insert race: {e}")

    return count


async def merge_events_into_db(
    user_id: str,
    extracted_events: List[Dict[str, Any]]
) -> int:
    """
    Saves extracted events into research_events, deduplicating by event_signature.
    Returns count of saved events.
    """
    count = 0
    now = datetime.utcnow()

    for ev in extracted_events:
        e_type = ev.get("event_type", "market_shift")
        title = ev.get("title", "")
        entities = ev.get("entities_involved", [])

        if not title:
            continue

        sig = compute_event_signature(e_type, entities, title)

        existing = await database.research_events.find_one({
            "user_id": user_id,
            "event_signature": sig,
        })

        if existing:
            # Append evidence IDs if new
            existing_ev_ids = set(existing.get("evidence_ids", []))
            for eid in ev.get("evidence_ids", []):
                if eid:
                    existing_ev_ids.add(eid)
            await database.research_events.update_one(
                {"_id": existing["_id"]},
                {"$set": {"evidence_ids": list(existing_ev_ids)}}
            )
        else:
            new_id = str(uuid.uuid4())
            doc = {
                "id": new_id,
                "user_id": user_id,
                "event_type": e_type,
                "title": title,
                "description": ev.get("description", ""),
                "event_date": ev.get("event_date", now.strftime("%Y-%m-%d")),
                "entities_involved": entities,
                "evidence_ids": [eid for eid in ev.get("evidence_ids", []) if eid],
                "relevance_score": ev.get("relevance_score", 60),
                "event_signature": sig,
                "created_at": now,
            }
            try:
                await database.research_events.insert_one(doc)
                count += 1
            except Exception as e:
                logger.debug(f"[evidence_processor] Event insert race: {e}")

    return count
