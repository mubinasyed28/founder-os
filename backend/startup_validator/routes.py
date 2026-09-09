"""
FastAPI Routes for Startup Idea Validator.
Supports:
- POST /analyze
- GET  /analyze/{job_id}
- GET  /results/{job_id}
"""
from fastapi import APIRouter, HTTPException, status
from backend.startup_validator.schemas import (
    AnalysisRequest, AnalysisJobResponse, AnalysisProgressResponse, ValidationResult
)
from backend.startup_validator.service import ValidatorService

router = APIRouter(tags=["Startup Idea Validator"])

@router.post("/analyze", response_model=AnalysisJobResponse)
async def analyze_idea(payload: AnalysisRequest):
    """Start asynchronous validation analysis of a startup idea."""
    if not payload.idea or not payload.idea.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Startup idea description cannot be empty."
        )
    job_id = ValidatorService.start_analysis(payload.idea)
    return AnalysisJobResponse(jobId=job_id, idea=payload.idea)

@router.get("/analyze/{job_id}", response_model=AnalysisProgressResponse)
async def get_analysis_progress(job_id: str):
    """Retrieve progress and current stage status for an analysis job."""
    progress = ValidatorService.get_progress(job_id)
    if not progress:
        # Fallback check if result already exists in DB
        result = ValidatorService.get_result(job_id)
        if result:
            from backend.startup_validator.service import _build_progress_response, STAGES_DEF
            return _build_progress_response(len(STAGES_DEF), done=True, result=result)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Analysis job {job_id} not found."
        )
    return progress

@router.get("/results/{job_id}", response_model=ValidationResult)
async def get_validation_result(job_id: str):
    """Retrieve the finished validation report for a job."""
    result = ValidatorService.get_result(job_id)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Validation result for job '{job_id}' is not yet available or does not exist."
        )
    return result
