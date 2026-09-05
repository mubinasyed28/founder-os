"""
Opportunities & Decision Intelligence API router.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any, List, Optional
from datetime import datetime
from pydantic import BaseModel

from backend.auth import get_optional_current_user
from backend.database import get_db
from backend.services.opportunities_generator_service import generate_opportunities_for_profile

router = APIRouter(prefix="/api/opportunities", tags=["Opportunities & Decision Intelligence"])


class DecisionRequest(BaseModel):
    decision: str  # "pursue", "park", "reject", "validate"
    reasoning: Optional[str] = ""
    action_summary: Optional[str] = ""


class ValidationUpdateRequest(BaseModel):
    experiment_id: str
    status: str  # "pending", "passed", "failed"


@router.get("")
async def get_opportunities(current_user: dict = Depends(get_optional_current_user)):
    """Retrieve all opportunities (generated for active startup profile) merged with founder decisions."""
    user_id = current_user.get("id", "guest")
    db = await get_db()

    # Load persisted decisions for this user
    decisions_cursor = db.opportunity_decisions.find({"user_id": user_id})
    user_decisions = {}
    async for d in decisions_cursor:
        opp_id = d.get("opportunity_id")
        if opp_id:
            user_decisions[opp_id] = {
                "decision": d.get("decision"),
                "decidedAt": d.get("decided_at"),
                "reasoning": d.get("reasoning", ""),
                "actionSummary": d.get("action_summary", ""),
                "createdTaskIds": d.get("created_task_ids", []),
                "memoryEventId": d.get("memory_event_id")
            }

    # Load experiment status overrides
    exp_cursor = db.opportunity_experiments.find({"user_id": user_id})
    user_experiments = {}
    async for e in exp_cursor:
        key = f"{e.get('opportunity_id')}_{e.get('experiment_id')}"
        user_experiments[key] = e.get("status")

    # Fetch user profile to generate dynamic startup-tailored opportunities
    profile_doc = await db.profiles.find_one({"user_id": user_id}) or {}
    profile_doc.pop("_id", None)
    profile_doc.pop("user_id", None)

    tailored_opps = await generate_opportunities_for_profile(profile_doc)

    return {
        "opportunities": tailored_opps,
        "decisions": user_decisions,
        "experiments": user_experiments,
        "companyName": profile_doc.get("company_name", "Your Startup"),
        "targetCustomer": profile_doc.get("target_customer", "")
    }


@router.post("/generate")
async def generate_opportunities_endpoint(current_user: dict = Depends(get_optional_current_user)):
    """Force AI re-scan and opportunity generation for active startup profile."""
    user_id = current_user.get("id", "guest")
    db = await get_db()

    profile_doc = await db.profiles.find_one({"user_id": user_id}) or {}
    profile_doc.pop("_id", None)
    profile_doc.pop("user_id", None)

    tailored_opps = await generate_opportunities_for_profile(profile_doc)
    return {
        "success": True,
        "opportunities": tailored_opps,
        "companyName": profile_doc.get("company_name", "Your Startup")
    }



@router.post("/{opportunity_id}/decide")
async def record_decision(
    opportunity_id: str,
    req: DecisionRequest,
    current_user: dict = Depends(get_optional_current_user)
):
    """Save a founder decision on an opportunity and commit to company memory."""
    user_id = current_user.get("id", "guest")
    db = await get_db()
    now_str = datetime.utcnow().strftime("%b %d, %Y")
    now_iso = datetime.utcnow().isoformat()

    memory_event_id = f"M-{int(datetime.utcnow().timestamp()) % 1000}"

    decision_doc = {
        "user_id": user_id,
        "opportunity_id": opportunity_id,
        "decision": req.decision,
        "reasoning": req.reasoning,
        "action_summary": req.action_summary,
        "decided_at": now_str,
        "updated_at": now_iso,
        "memory_event_id": memory_event_id
    }

    await db.opportunity_decisions.update_one(
        {"user_id": user_id, "opportunity_id": opportunity_id},
        {"$set": decision_doc},
        upsert=True
    )

    # Persist as a memory event in company timeline collection
    memory_event = {
        "user_id": user_id,
        "event_id": memory_event_id,
        "type": "decision",
        "title": f"Decided to {req.decision.upper()}: Opportunity {opportunity_id}",
        "detail": req.reasoning or f"Opportunity {opportunity_id} marked as {req.decision}.",
        "date": now_str,
        "links": [opportunity_id, "Opportunity", "Strategy"],
        "created_at": now_iso
    }
    await db.timeline_events.insert_one(memory_event)

    return {
        "success": True,
        "opportunity_id": opportunity_id,
        "decisionRecord": {
            "decision": req.decision,
            "decidedAt": now_str,
            "reasoning": req.reasoning,
            "actionSummary": req.action_summary,
            "memoryEventId": memory_event_id
        }
    }


@router.post("/{opportunity_id}/validate")
async def update_validation_experiment(
    opportunity_id: str,
    req: ValidationUpdateRequest,
    current_user: dict = Depends(get_optional_current_user)
):
    """Update status of a validation experiment for an opportunity."""
    user_id = current_user.get("id", "guest")
    db = await get_db()

    await db.opportunity_experiments.update_one(
        {"user_id": user_id, "opportunity_id": opportunity_id, "experiment_id": req.experiment_id},
        {"$set": {
            "user_id": user_id,
            "opportunity_id": opportunity_id,
            "experiment_id": req.experiment_id,
            "status": req.status,
            "updated_at": datetime.utcnow().isoformat()
        }},
        upsert=True
    )

    return {"success": True, "status": req.status}
