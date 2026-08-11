from fastapi import APIRouter, Depends, HTTPException, status
from typing import Dict, Any
from backend.models import HealthReport
from backend.auth import get_optional_current_user
from backend.database import get_db
from backend.services.health_engine import calculate_health

router = APIRouter(prefix="/api/health", tags=["Startup Health"])

@router.get("/report", response_model=HealthReport)
async def get_health_report_endpoint(current_user: dict = Depends(get_optional_current_user)):
    user_id = current_user["id"]
    db = await get_db()
    
    report = await db.health_reports.find_one({"user_id": user_id})
    if not report:
        # Generate initial report on the fly
        try:
            report = await calculate_health(user_id)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate health report: {str(e)}"
            )
            
    # Format for response
    return HealthReport(
        overall_score=report["overall_score"],
        status=report["status"],
        components=report["components"],
        missing_areas=report["missing_areas"],
        recommendations=report["recommendations"],
        calculated_at=report["calculated_at"]
    )

@router.post("/recalculate", response_model=HealthReport)
async def recalculate_health_endpoint(current_user: dict = Depends(get_optional_current_user)):
    user_id = current_user["id"]
    try:
        report = await calculate_health(user_id)
        return HealthReport(
            overall_score=report["overall_score"],
            status=report["status"],
            components=report["components"],
            missing_areas=report["missing_areas"],
            recommendations=report["recommendations"],
            calculated_at=report["calculated_at"]
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to recalculate health: {str(e)}"
        )
