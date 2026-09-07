"""
Research Intelligence API Router.
Provides endpoints for triggering research, polling status, fetching evidence/entities/events/insights,
and providing founder feedback.
"""
import asyncio
import logging
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from backend.auth import get_optional_current_user
from backend.database import database
from backend.services.research_pipeline_service import run_research_pipeline

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/research", tags=["Research Intelligence"])


class FeedbackPayload(BaseModel):
    feedback: str  # "useful", "not_useful", "dismissed"


def _clean_doc(doc: Dict[str, Any]) -> Dict[str, Any]:
    """Helper to convert MongoDB _id to str and clean doc."""
    if not doc:
        return {}
    doc["id"] = str(doc.get("id") or doc.get("_id", ""))
    doc.pop("_id", None)
    return doc


@router.post("/run")
async def trigger_research_run(
    current_user: dict = Depends(get_optional_current_user),
):
    """
    Trigger the persistent research pipeline as an async background task.
    Returns immediately with run_id and status.
    """
    user_id = current_user["id"]

    # Check if there is an active run in progress
    active_run = await database.research_runs.find_one({
        "user_id": user_id,
        "status": {"$in": ["planning", "searching", "processing", "analyzing"]}
    })
    if active_run:
        return {
            "success": True,
            "run_id": active_run["id"],
            "status": active_run["status"],
            "message": "Research pipeline is already running."
        }

    run_id = str(uuid.uuid4())[:8]
    
    # Spawn background task
    asyncio.create_task(run_research_pipeline(user_id=user_id, run_id=run_id))

    return {
        "success": True,
        "run_id": run_id,
        "status": "planning",
        "message": "Research pipeline started."
    }


@router.get("/status")
async def get_latest_status(
    run_id: Optional[str] = None,
    current_user: dict = Depends(get_optional_current_user),
):
    """Retrieve the latest or specified research run status and logs."""
    user_id = current_user["id"]

    query: Dict[str, Any] = {"user_id": user_id}
    if run_id:
        query["id"] = run_id

    run = await database.research_runs.find_one(
        query,
        sort=[("started_at", -1)]
    )

    if not run:
        return {"status": "none", "message": "No research runs found."}

    return _clean_doc(run)


@router.get("/insights")
async def get_insights(
    impact_area: Optional[str] = None,
    limit: int = Query(default=20, ge=1, le=100),
    current_user: dict = Depends(get_optional_current_user),
):
    """Fetch startup-specific research insights, ranked by relevance."""
    user_id = current_user["id"]

    filter_query: Dict[str, Any] = {"user_id": user_id}
    if impact_area and impact_area != "all":
        filter_query["impact_area"] = impact_area

    cursor = database.research_insights.find(filter_query).sort([
        ("relevance_score", -1),
        ("created_at", -1)
    ]).limit(limit)

    docs = await cursor.to_list(limit)
    return [_clean_doc(d) for d in docs]


@router.get("/evidence")
async def get_evidence(
    source_type: Optional[str] = None,
    query_intent: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=200),
    skip: int = Query(default=0, ge=0),
    current_user: dict = Depends(get_optional_current_user),
):
    """Fetch stored research evidence / sources with full traceability."""
    user_id = current_user["id"]

    filter_query: Dict[str, Any] = {"user_id": user_id}
    if source_type and source_type != "all":
        filter_query["source_type"] = source_type
    if query_intent and query_intent != "all":
        filter_query["query_intent"] = query_intent

    total = await database.research_evidence.count_documents(filter_query)
    cursor = database.research_evidence.find(filter_query).sort("retrieved_at", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(limit)

    return {
        "total": total,
        "items": [_clean_doc(d) for d in docs]
    }


@router.get("/entities")
async def get_entities(
    entity_type: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=150),
    current_user: dict = Depends(get_optional_current_user),
):
    """Fetch persistent market entities (companies, people, products, tech)."""
    user_id = current_user["id"]

    filter_query: Dict[str, Any] = {"user_id": user_id}
    if entity_type and entity_type != "all":
        filter_query["entity_type"] = entity_type

    cursor = database.research_entities.find(filter_query).sort([
        ("relevance_score", -1),
        ("mention_count", -1)
    ]).limit(limit)

    docs = await cursor.to_list(limit)
    return [_clean_doc(d) for d in docs]


@router.get("/events")
async def get_events(
    event_type: Optional[str] = None,
    limit: int = Query(default=30, ge=1, le=100),
    current_user: dict = Depends(get_optional_current_user),
):
    """Fetch discrete market events (launches, funding, partnerships)."""
    user_id = current_user["id"]

    filter_query: Dict[str, Any] = {"user_id": user_id}
    if event_type and event_type != "all":
        filter_query["event_type"] = event_type

    cursor = database.research_events.find(filter_query).sort("created_at", -1).limit(limit)
    docs = await cursor.to_list(limit)
    return [_clean_doc(d) for d in docs]


@router.get("/stats")
async def get_research_stats(
    current_user: dict = Depends(get_optional_current_user),
):
    """Return overview metrics for the research center."""
    user_id = current_user["id"]

    evidence_count = await database.research_evidence.count_documents({"user_id": user_id})
    entity_count = await database.research_entities.count_documents({"user_id": user_id})
    event_count = await database.research_events.count_documents({"user_id": user_id})
    insight_count = await database.research_insights.count_documents({"user_id": user_id})

    latest_run = await database.research_runs.find_one(
        {"user_id": user_id},
        sort=[("started_at", -1)]
    )

    return {
        "evidence_count": evidence_count,
        "entity_count": entity_count,
        "event_count": event_count,
        "insight_count": insight_count,
        "last_run": _clean_doc(latest_run) if latest_run else None,
    }


@router.post("/insights/{insight_id}/feedback")
async def submit_insight_feedback(
    insight_id: str,
    payload: FeedbackPayload,
    current_user: dict = Depends(get_optional_current_user),
):
    """Submit founder feedback (useful / not_useful / dismissed) to refine future relevance."""
    user_id = current_user["id"]

    now = datetime.utcnow()
    await database.research_feedback.update_one(
        {"user_id": user_id, "insight_id": insight_id},
        {"$set": {
            "feedback": payload.feedback,
            "created_at": now,
        }},
        upsert=True
    )

    # Adjust score of the insight immediately
    delta = 15 if payload.feedback == "useful" else -25 if payload.feedback == "not_useful" else -10
    await database.research_insights.update_one(
        {"user_id": user_id, "id": insight_id},
        {"$inc": {"relevance_score": delta}}
    )

    return {"success": True, "insight_id": insight_id, "feedback": payload.feedback}
