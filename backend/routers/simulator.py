import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from backend.auth import get_optional_current_user
from backend.services.scenario_engine import ScenarioEngine, get_scenario_engine
from backend.services.decision_parser_service import parse_founder_decision
from backend.services.decision_intelligence_service import DecisionIntelligenceService, get_decision_intelligence_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/simulator", tags=["Decision Simulator Intelligence Layer"])


class ParseDecisionRequest(BaseModel):
    decision_text: str = Field(..., min_length=2, description="Natural language founder decision description")


class SimulateDecisionRequest(BaseModel):
    decision_text: Optional[str] = Field(None, description="Optional natural language decision text (e.g. 'raise $500k and hire 2 engineers')")
    structured_decision: Optional[Dict[str, Any]] = Field(None, description="Optional pre-structured decision dictionary")
    company_state: Optional[Dict[str, Any]] = Field(None, description="Optional custom current company state parameters")


class IntelligenceDecisionRequest(BaseModel):
    company_id: Optional[str] = Field("default_company", description="Company or user identifier")
    decision: str = Field(..., min_length=2, description="Natural language founder decision string")


@router.post("/parse-decision")
async def parse_decision_endpoint(payload: ParseDecisionRequest):
    """
    Parses natural language decision text into a structured decision object
    with coverage classification (SUPPORTED, PARTIALLY_SUPPORTED, UNSUPPORTED).
    """
    try:
        return await parse_founder_decision(payload.decision_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Decision parsing error: {str(e)}")


@router.post("/simulate")
async def simulate_endpoint(
    payload: SimulateDecisionRequest,
    engine: ScenarioEngine = Depends(get_scenario_engine)
):
    """
    Executes end-to-end Decision Simulator workflow:
    1. Parses decision if provided as natural language
    2. Runs baseline predictions on current company state
    3. Transforms state according to scenario variables
    4. Runs scenario predictions
    5. Returns comparative report with deltas, assumptions, evidence, and drivers.
    """
    try:
        return await engine.evaluate_decision(
            decision_text=payload.decision_text,
            structured_decision=payload.structured_decision,
            company_state=payload.company_state
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation error: {str(e)}")


@router.post("/intelligence")
async def intelligence_endpoint(
    payload: IntelligenceDecisionRequest,
    current_user: dict = Depends(get_optional_current_user),
    intel_service: DecisionIntelligenceService = Depends(get_decision_intelligence_service)
):
    """
    Stage 4 Evidence-Grounded Decision Intelligence:
    1. Parses natural language decision
    2. Builds company context (Profile + Metrics + Document RAG + Competitors + Market)
    3. Executes scenario engine & ML models
    4. Synthesizes evidence-grounded recommendation, confidence, and AI Co-founder explanation.
    """
    try:
        user_id = current_user.get("id")
        company_id = payload.company_id
        if user_id and user_id != "guest_session_user":
            company_id = user_id
        elif not company_id or company_id == "default_company":
            company_id = user_id or "default_company"

        return await intel_service.analyze_decision_intelligently(
            company_id=company_id,
            decision_text=payload.decision
        )
    except Exception as e:
        logger.error(f"[simulator_router] Intelligence endpoint error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Decision Intelligence error: {str(e)}")


@router.get("/coverage")
async def get_decision_coverage():
    """
    Returns the explicit capability matrix distinguishing MODEL-POWERED
    decisions from RULE-BASED / UNSUPPORTED decisions.
    """
    return {
        "framework": "FounderOS Decision Simulator Intelligence Layer",
        "supported_decisions": [
            {
                "type": "fundraising",
                "label": "Raise Funding / Capital Infusion",
                "engine": "MODEL_POWERED",
                "status": "SUPPORTED",
                "mapped_features": ["runway_months", "funding_path"],
                "target_model": "Model 2 (Startup Survival Risk)",
                "example": "I want to raise $500k in seed funding"
            },
            {
                "type": "burn_adjustment",
                "label": "Adjust / Reduce Monthly Burn Rate",
                "engine": "MODEL_POWERED",
                "status": "SUPPORTED",
                "mapped_features": ["monthly_burn_rate", "runway_months"],
                "target_model": "Model 2 (Startup Survival Risk)",
                "example": "Reduce burn from $25k to $18k"
            },
            {
                "type": "validation_action",
                "label": "Customer Validation Milestone",
                "engine": "MODEL_POWERED",
                "status": "SUPPORTED",
                "mapped_features": ["did_customer_validation"],
                "target_model": "Model 2 (Startup Survival Risk - #1 Driver)",
                "example": "Complete 30 user interviews and willingness-to-pay tests"
            }
        ],
        "partially_supported_decisions": [
            {
                "type": "pricing_change",
                "label": "Modify Pricing or Subscription Tier",
                "engine": "MODEL_POWERED",
                "status": "PARTIALLY_SUPPORTED",
                "mapped_features": ["account_plan_tier", "current_mrr"],
                "target_model": "Model 1 (Revenue & Churn Risk)",
                "limitation": "Price point is mapped via tier classification and baseline MRR scaling; granular price elasticity curves are not modeled.",
                "example": "Increase Pro pricing from $99 to $129"
            },
            {
                "type": "hiring",
                "label": "Hire Engineers / Expand Team",
                "engine": "MODEL_POWERED",
                "status": "PARTIALLY_SUPPORTED",
                "mapped_features": ["monthly_burn_rate", "runway_months", "team_completeness", "total_seats"],
                "target_model": "Model 1 & Model 2",
                "limitation": "Headcount modifies compensation burn and seat count; specific individual productivity is not modeled.",
                "example": "Hire two senior full-stack engineers"
            },
            {
                "type": "feature_launch",
                "label": "Launch New Product Feature / Beta",
                "engine": "MODEL_POWERED",
                "status": "PARTIALLY_SUPPORTED",
                "mapped_features": ["has_beta_feature", "n_unique_features"],
                "target_model": "Model 1 (Revenue & Churn Risk)",
                "limitation": "Tracks beta flag and unique feature usage; specific feature domain/utility is not modeled.",
                "example": "Launch new AI automation workflow in beta"
            }
        ],
        "unsupported_decisions": [
            {
                "type": "market_expansion",
                "label": "Expand to New Country / Region",
                "engine": "RULE_BASED",
                "status": "UNSUPPORTED",
                "reason": "Single-account monthly panel does not model cross-border geographic expansion portfolios.",
                "fallback": "Standard heuristic / rule-based financial projection"
            },
            {
                "type": "marketing_spend",
                "label": "Increase Advertising / Marketing Budget",
                "engine": "RULE_BASED",
                "status": "UNSUPPORTED",
                "reason": "Continuous advertising budget is not a feature in the trained RavenStack or Startup Survival datasets.",
                "fallback": "Standard heuristic / rule-based CAC projection"
            }
        ]
    }
