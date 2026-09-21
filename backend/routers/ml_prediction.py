from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from backend.services.ml_service import MLService, get_ml_service

router = APIRouter(prefix="/api/ml", tags=["Machine Learning Inference"])


# ──────────────────────────────────────────────────────────────────────────────
# Pydantic Schemas
# ──────────────────────────────────────────────────────────────────────────────
class RevenuePredictRequest(BaseModel):
    industry: Optional[str] = Field("DevTools", description="Industry sector (DevTools, FinTech, Cybersecurity, HealthTech, EdTech)")
    country: Optional[str] = Field("US", description="Country code (US, UK, IN, AU, DE, CA, FR)")
    referral_source: Optional[str] = Field("organic", description="Referral channel (organic, paid, partner, ads, event, other)")
    account_plan_tier: Optional[str] = Field("Pro", description="Subscription tier (Basic, Pro, Enterprise)")
    tenure_months: Optional[float] = Field(12.0, description="Customer tenure in months")
    calendar_month: Optional[int] = Field(6, ge=1, le=12, description="Month of year (1-12)")
    current_mrr: float = Field(..., ge=0.0, description="Current month MRR in USD")
    active_subscriptions: Optional[int] = Field(1, ge=0, description="Active subscription count")
    total_seats: Optional[int] = Field(10, ge=1, description="Licensed seat count")
    usage_count: Optional[float] = Field(150.0, description="Monthly product interactions")
    usage_duration_secs: Optional[float] = Field(18000.0, description="Monthly duration in seconds")
    error_count: Optional[float] = Field(2.0, description="System/client error occurrences")
    n_unique_features: Optional[int] = Field(5, description="Distinct product features used")
    has_beta_feature: Optional[int] = Field(0, description="1 if beta features enabled, 0 otherwise")
    n_tickets: Optional[int] = Field(1, description="Support tickets opened in month")
    avg_resolution_hours: Optional[float] = Field(12.0, description="Mean ticket resolution time")
    n_escalations: Optional[int] = Field(0, description="Escalated ticket count")
    had_churn_in_m: Optional[int] = Field(0, description="1 if account experienced contraction in month")


class ChurnPredictRequest(RevenuePredictRequest):
    """Reuses the exact 18-feature schema from Model 1."""
    pass


class StartupRiskPredictRequest(BaseModel):
    industry: Optional[str] = Field("tech_saas", description="Sector (tech_saas, fintech, healthtech, ecommerce, consumer_app, marketplace, hardware, etc.)")
    founding_year: Optional[int] = Field(2024, description="Founding year")
    macro_climate: Optional[float] = Field(6.0, ge=0.0, le=10.0, description="External macroeconomic & capital climate score (0-10)")
    market_size_score: Optional[float] = Field(7.0, ge=0.0, le=10.0, description="Total addressable market score (0-10)")
    competition_intensity: Optional[float] = Field(5.0, ge=0.0, le=10.0, description="Competitive intensity score (0-10)")
    founder_prior_exits: Optional[int] = Field(0, ge=0, description="Count of successful founder exits")
    prior_failures: Optional[int] = Field(0, ge=0, description="Count of prior failed ventures")
    domain_experience_years: Optional[float] = Field(4.0, ge=0.0, description="Years of direct industry experience")
    technical_cofounder: Optional[int] = Field(1, description="1 if team has technical cofounder, 0 otherwise")
    n_cofounders: Optional[int] = Field(2, ge=1, description="Total number of cofounders")
    team_completeness: Optional[float] = Field(6.0, ge=0.0, le=10.0, description="Functional team completeness score (0-10)")
    age_of_founder: Optional[int] = Field(30, ge=18, description="Age of primary founder")
    funding_path: Optional[str] = Field("bootstrapped", description="Capital strategy (bootstrapped, angel, vc_seed, vc_series_a_plus)")
    monthly_burn_rate: float = Field(..., ge=0.0, description="Monthly net cash burn in USD")
    runway_months: float = Field(..., ge=0.0, description="Estimated cash runway in months")
    did_customer_validation: int = Field(1, ge=0, le=1, description="1 if customer interviews/validation completed, 0 otherwise")


# ──────────────────────────────────────────────────────────────────────────────
# Endpoints
# ──────────────────────────────────────────────────────────────────────────────
@router.post("/revenue/predict")
async def predict_revenue(
    payload: RevenuePredictRequest,
    service: MLService = Depends(get_ml_service)
):
    """
    Predicts next-month MRR ($MRR_{t+1}$) using trained RavenStack SaaS models.
    Returns both XGBoost and Ridge baseline forecasts alongside directional estimates.
    """
    try:
        return service.predict_next_month_mrr(payload.model_dump())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Revenue prediction error: {str(e)}")


@router.post("/churn/predict")
async def predict_churn(
    payload: ChurnPredictRequest,
    service: MLService = Depends(get_ml_service)
):
    """
    Predicts next-month churn/contraction probability using trained RavenStack classifier.
    """
    try:
        return service.predict_churn_risk(payload.model_dump())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Churn prediction error: {str(e)}")


@router.post("/startup-risk/predict")
async def predict_startup_risk(
    payload: StartupRiskPredictRequest,
    service: MLService = Depends(get_ml_service)
):
    """
    Predicts calibrated probability of venture failure at Stage 0 (Day-0) using XGBoost.
    """
    try:
        return service.predict_startup_failure_risk(payload.model_dump())
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Startup risk prediction error: {str(e)}")


@router.get("/models")
async def list_models(service: MLService = Depends(get_ml_service)):
    """
    Returns the active model registry with metadata, performance summaries, and limitations.
    """
    return service.registry
