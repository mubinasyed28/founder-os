# Decision Simulator: Company-Context-First Architecture Report

**Version:** 2.0.0  
**Date:** September 11, 2026  
**Status:** Production Ready & Verified  
**Scope:** Backend Decision Intelligence Layer, Scenario Engine, Company Context Service, Frontend Simulator Integration

---

## 1. Executive Summary & Problem Definition

Prior implementations of the Decision Simulator suffered from a critical architectural anti-pattern: **synthetic metric hallucination**. When a startup had missing or incomplete financial metrics (e.g. cold-start founders in ideation or pre-revenue stages), the simulator engine was populating baseline metrics with arbitrary benchmark values (e.g., `$10,000` monthly MRR, `$20,000` burn rate, `12.0` months runway). 

This violated the core principle of an AI Co-Founder: **A founder's persistent startup data must always be the single source of truth.** Benchmark datasets from public venture repositories (e.g., RavenStack SaaS and US Startup Survival datasets) represent training distributions and statistical correlations; they are **never** the user's startup data.

This architecture upgrade refactored the Decision Simulator to be **Company-Context-First**:
1. **Zero Fabrication:** Financial metrics with no verified history are strictly preserved as `None`.
2. **Data Sufficiency Gating:** ML inference models (XGBoost Model 1 and Model 2) are invoked **only** when verified prerequisites exist.
3. **Transparent Insufficiency Reporting:** When data is insufficient, predictions clearly report `status: "INSUFFICIENT_DATA"` with actionable human-readable explanations instead of invented numbers.
4. **Rich Qualitative Guidance:** Unfunded or pre-revenue startups receive high-value qualitative decision analysis, risk factors, trade-offs, and competitor insights without requiring fabricated financials.
5. **Verified Company Financial Execution:** Startups with verified revenue, cash balance, and burn rate receive mathematically sound ML scenario projections and runway calculations.

---

## 2. Company-Context-First Hierarchy of Truth

The simulator resolves company state through a strict priority hierarchy:

```
┌────────────────────────────────────────────────────────┐
│ 1. MongoDB Company Database (db.profiles & metrics)    │  ← Primary Verified Source
├────────────────────────────────────────────────────────┤
│ 2. Conversational Onboarding / Verified System State   │  ← Structured Profile Inputs
├────────────────────────────────────────────────────────┤
│ 3. Uploaded Company Documents via Vector RAG           │  ← Internal Strategy / Audits
├────────────────────────────────────────────────────────┤
│ 4. Fresh External Research via Tavily Search           │  ← Real-time Competitors & Markets
├────────────────────────────────────────────────────────┤
│ 5. Missing / Unverified Metrics                        │  ← Strictly None (Truthful)
└────────────────────────────────────────────────────────┘
```

### Canonical Metrics Schema
All fundamental startup metrics are mapped into a standardized verification structure:
```json
{
  "monthly_revenue": {
    "value": 18000.0,
    "source": "company_profile",
    "status": "verified"
  },
  "monthly_burn_rate": {
    "value": 24000.0,
    "source": "company_profile",
    "status": "verified"
  },
  "runway_months": {
    "value": 10.0,
    "source": "calculated_from_cash_and_burn",
    "status": "verified"
  },
  "total_users": {
    "value": 250,
    "source": "company_profile",
    "status": "verified"
  },
  "funding_raised": {
    "value": 350000.0,
    "source": "company_profile",
    "status": "verified"
  }
}
```
If a metric is not present in the company profile, `value` is `null` and `status` is `"missing"`.

---

## 3. Data Sufficiency Gating in the Scenario Engine

In `backend/services/scenario_engine.py`, the `check_data_sufficiency` method inspects verified startup features before any ML prediction:

| Model / Output | Verified Prerequisites | Behavior when Sufficient | Behavior when Insufficient |
| :--- | :--- | :--- | :--- |
| **Model 1: Revenue Forecast** | `current_mrr is not None and current_mrr > 0` | XGBoost Model 1 predicts next-month MRR | `forecast: null`, `status: "INSUFFICIENT_DATA"`, truthful reason |
| **Model 1: Churn Risk** | Verified revenue + active subscription history (`active_subscriptions` or `total_users`) | XGBoost Model 1 predicts churn probability | `probability: null`, `status: "INSUFFICIENT_DATA"`, truthful reason |
| **Model 2: Startup Failure Risk** | `industry` and `current_stage` verified | XGBoost Model 2 predicts survival risk probability | `probability: null`, `status: "INSUFFICIENT_DATA"`, truthful reason |
| **Runway Calculation** | `runway_months` or (`cash_in_bank` + `monthly_burn_rate > 0`) | Exact calculated runway delta | `runway_months: null`, truthful reason |

---

## 4. Evidence Normalization & Source Traceability

The `EvidenceItem` schema standardizes all supporting evidence across 4 distinct categories (`company`, `documents`, `competitors`, `market`):

- **Primary Schema:**
  - `source_type`: Category identifier (`company_profile`, `company_metric`, `company_document`, `competitor`, `market_research`)
  - `title`: Descriptive document title or source name
  - `finding`: Concrete factual finding or quantitative signal
  - `source_url`: URL, filename, or system origin
  - `timestamp`: UTC ISO timestamp of retrieval
  - `confidence`: Signal confidence score (0.0 to 1.0)
  - `relevance`: Semantic relevance to the specific decision (0.0 to 1.0)
- **Backwards Compatibility:**
  - Instance properties and dictionary representations provide alias properties `claim` (alias for `finding`) and `source_reference` (alias for `source_url`).

### Decision-Dependent External Research Routing
Internal decisions (e.g. `burn_adjustment`, internal validation actions) do not perform redundant web searches. Market-facing decisions (`feature_launch`, `pricing_change`, `fundraising`, `market_expansion`, `hiring`) trigger live targeted queries through Tavily, cached with a 30-minute freshness TTL.

---

## 5. API Response Contract

The endpoint `POST /api/simulator/intelligence` returns a unified, backward-compatible payload:

```json
{
  "decision": {
    "decision_type": "feature_launch",
    "coverage_status": "PARTIALLY_SUPPORTED",
    "parameters": {
      "feature_name": "maps feature"
    }
  },
  "simulation_engine": "MODEL_POWERED",
  "coverage_status": "PARTIALLY_SUPPORTED",
  "baseline": {
    "metrics": {
      "runway_months": null
    },
    "revenue_forecast": null,
    "churn_probability": null,
    "failure_probability": null
  },
  "scenario": {
    "metrics": {
      "runway_months": null
    },
    "revenue_forecast": null,
    "churn_probability": null,
    "failure_probability": null
  },
  "predictions": {
    "revenue_forecast": {
      "status": "INSUFFICIENT_DATA",
      "available": false,
      "baseline": null,
      "scenario": null,
      "forecast": null,
      "reason": "No verified revenue history is available for this company."
    },
    "churn_risk": {
      "status": "INSUFFICIENT_DATA",
      "available": false,
      "reason": "No verified customer retention or cancellation history available."
    },
    "startup_failure_risk": {
      "status": "AVAILABLE",
      "available": true,
      "probability": 0.38
    },
    "runway_months": {
      "status": "INSUFFICIENT_DATA",
      "available": false,
      "reason": "No verified cash or monthly burn data provided."
    }
  },
  "company_context": {
    "canonical_metrics": { ... },
    "data_quality": {
      "completeness_pct": 20,
      "verified_metrics_count": 1
    }
  },
  "recommendation": "Proceed with caution",
  "ai_cofounder_explanation": "Your company profile does not contain verified revenue history, so I cannot produce a defensible revenue forecast. I can still evaluate the feature using your product context, customer evidence, competitor landscape, and market demand...",
  "assumptions": [ ... ],
  "limitations": [ ... ],
  "evidence": {
    "company": [ ... ],
    "documents": [ ... ],
    "competitors": [ ... ],
    "market": [ ... ]
  }
}
```

---

## 6. Frontend Simulator Integration

The frontend interface at `/simulator` (`src/routes/app.simulator.tsx`) was upgraded with strict non-destructive principles:

1. **Truthful Metric Cards:** The `MetricCompare` component renders `"Not available"` when data is missing, supplemented with the specific data deficiency reason from `predictions` (e.g. *"No verified revenue history is available for this company"*).
2. **Trajectory Chart Integrity:** The 6-month projected MRR chart `mlSeries` evaluates whether `revenue_forecast` exists. If `null`, it avoids plotting fictitious `$10k` curves.
3. **Advanced Scenario Controls Intact:** The sliders (Pricing, Hires, Marketing, Raise, Burn) remain fully functional for real-time manual sensitivity testing without interference.
4. **Clean TypeScript Compliance:** Fully typed with `exactOptionalPropertyTypes` conformance.

---

## 7. Verification & Test Suite Summary

### Automated Test Execution
All 30 tests pass with zero errors:

```bash
$ python -m pytest backend/tests/test_feature_launch_intelligence.py \
                   backend/tests/test_decision_intelligence.py \
                   backend/tests/test_ml_serving.py \
                   backend/tests/test_company_context_architecture.py -v

======================= 30 passed, 7 warnings in 28.94s =======================
```

#### Test Suite Breakdown:
1. **`test_company_context_architecture.py` (2 tests):**
   - `test_01_cold_start_company_no_fabricated_numbers`: Validates that cold-start startups receive truthful `null` values for MRR and runway, clear `INSUFFICIENT_DATA` prediction statuses, and helpful qualitative co-founder explanations.
   - `test_02_financial_company_known_metrics_produces_forecast`: Validates that startups with verified revenue, burn rate, and cash balance receive accurate quantitative ML forecasts and runway simulations.
2. **`test_feature_launch_intelligence.py` (4 tests):**
   - Natural language parsing variants for feature launches.
   - Regression validation across existing decision types.
   - End-to-end intelligence execution for the *"Launch a maps feature where users can connect with people in their area and hangout"* decision.
   - Fallback behavior for unsupported decisions.
3. **`test_decision_intelligence.py` (13 tests):**
   - RAG document chunk retrieval.
   - Decision-dependent research routing (internal vs external search).
   - Evidence normalization schema with backwards compatibility.
   - Structured signal extraction (pure numerical inputs to XGBoost, no raw web text).
   - End-to-end intelligence orchestration with Tavily search mocking.
   - Missing data resilience and causal disclaimers.
4. **`test_ml_serving.py` (11 tests):**
   - Model artifact loading and validation.
   - Feature preprocessing pipelines for RavenStack SaaS and Startup Survival models.
   - Baseline vs scenario delta comparisons.
   - Deterministic and rule-based fallback handling.

### Frontend Validation
- **TypeScript Type Checking:** `npx tsc --noEmit --pretty` passed with **0 errors**.
- **Production Bundle:** `npm run build` compiled client and server (SSR) bundles in **21.64s** with zero bundle errors.
