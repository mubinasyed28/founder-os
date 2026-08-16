"""
Competitor Intelligence API router.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any, List

from backend.auth import get_optional_current_user
from backend.models import CompetitorResearchResult
from backend.services.competitor_research_service import (
    trigger_competitor_research,
    get_latest_research,
    get_research_status,
)

router = APIRouter(prefix="/api/competitors", tags=["Competitor Intelligence"])

@router.post("/research")
async def start_research(current_user: dict = Depends(get_optional_current_user)):
    """Trigger a new competitor research task based on company profile context."""
    user_id = current_user["id"]
    try:
        research_id = await trigger_competitor_research(user_id)
        return {"success": True, "research_id": research_id, "status": "running"}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start research: {str(e)}"
        )

@router.get("/research/status")
async def check_status(current_user: dict = Depends(get_optional_current_user)):
    """Retrieve status of the latest research task."""
    user_id = current_user["id"]
    status_info = await get_research_status(user_id)
    if not status_info:
        return {"status": "none"}
    return status_info

@router.get("/results")
async def get_results(current_user: dict = Depends(get_optional_current_user)):
    """Get latest completed competitor research analysis."""
    user_id = current_user["id"]
    results = await get_latest_research(user_id)
    if not results:
        # Fallback to empty container rather than 404 so UI handles it gracefully
        return {
            "id": "",
            "competitors": [],
            "comparison": {"dimensions": [], "summary": ""},
            "gaps": [],
            "research_status": "none"
        }
    return results

@router.get("/{competitor_id}")
async def get_competitor_detail(competitor_id: str, current_user: dict = Depends(get_optional_current_user)):
    """Retrieve details for a specific competitor in the latest run."""
    user_id = current_user["id"]
    results = await get_latest_research(user_id)
    if not results:
        raise HTTPException(status_code=404, detail="No competitor research results found")
    
    for comp in results.get("competitors", []):
        if comp.get("id") == competitor_id:
            return comp
            
    raise HTTPException(status_code=404, detail="Competitor not found")
