# Model Serving Architecture & Decision Simulator Intelligence Layer

**Document Version**: 1.0  
**Status**: Implemented & Verified  
**Date**: September 2026  
**Target Environment**: FounderOS Backend (`/api/ml` and `/api/simulator`)

---

## 1. Executive Architecture Overview

The **Decision Simulator Intelligence Layer** connects the trained machine learning models (`ml/models/`) to the FounderOS backend, transforming high-level founder decisions into structured scenarios, executing calibrated baseline and scenario predictions, and surfacing transparent comparisons without making invalid causal claims.

```
                  Founder Decision Input
         (Natural Language Text OR Slider Preset)
                           │
                           ▼
               [Decision Parser Service]
     (LLM Extraction with Deterministic NLP Fallback)
                           │
                           ▼
                 Structured Decision
     { decision_type, parameters, coverage_status }
                           │
                           ▼
               [Scenario Engine Service]
      (Applies Justified Feature State Modifications)
                           │
           ┌───────────────┴───────────────┐
           ▼                               ▼
    [Baseline State]               [Scenario State]
           │                               │
           └───────────────┬───────────────┘
                           ▼
                  [ML Model Service]
         (Preloaded Models, Encoders, Schemas)
           │                               │
           ├─ Model 1A: XGBRegressor + Ridge Baseline (MRR)
           ├─ Model 1B: XGBClassifier + LogReg Baseline (Churn)
           └─ Model 2:  XGBClassifier + RF Baseline (Survival)
                           │
                           ▼
          [Baseline vs. Scenario Comparison]
      - MRR Delta & % Change
      - Churn Probability Delta
      - Startup Failure Risk Delta
      - Model Drivers (Feature Importances)
      - Explicit Assumptions & Evidence Placeholders
      - Causal Limitation Disclaimer
```

---

## 2. Model Registry (`ml/model_registry.json`)

To decouple application logic from physical file paths, all models, encoders, metadata, performance summaries, and limitations are declared in a centralized configuration file at `ml/model_registry.json`.

### Registered Models:
1. **`revenue_forecast`** (`DecisionSimulator-RevenueForecast-v1`):
   - **File**: `ml/models/decision_simulator_revenue_v1.json`
   - **Baseline File**: `ml/models/model1_ridge_baseline.joblib`
   - **Preprocessing**: `ml/models/model1_label_encoders.joblib`
   - **Horizon**: 1 month forward ($MRR_{t+1}$)
   - **Performance**: Ridge RMSE $5,255.17, XGBoost RMSE $6,748.16, Directional Accuracy 47.10%
   - **Critical Respect Rule**: Ridge regression and Naive persistence outperform XGBoost on flat accounts; XGBoost is served alongside baseline Ridge persistence.

2. **`churn_risk`** (`DecisionSimulator-ChurnRisk-v1`):
   - **File**: `ml/models/decision_simulator_churn_v1.json`
   - **Baseline File**: `ml/models/model1_logreg_baseline.joblib`
   - **Target**: `target_churn_event_t1` (binary subscription contraction/churn)
   - **Performance**: ROC-AUC 0.5583, PR-AUC 0.1708, Brier Score 0.1311

3. **`startup_survival`** (`DecisionSimulator-StartupSurvival-v1`):
   - **File**: `ml/models/decision_simulator_startup_risk_v1.json`
   - **Baseline File**: `ml/models/model2_rf_baseline.joblib`
   - **Stage**: Stage 0 (Day-0 / Founding)
   - **Target**: `failed` (binary venture liquidation)
   - **Performance**: ROC-AUC 0.6821, PR-AUC 0.8020, Accuracy 68.13%, Brier Score 0.2044
   - **Critical Respect Rule**: XGBoost is the best-performing classifier tested, providing calibrated risk estimates (Brier 0.2044) rather than deterministic guarantees.

---

## 3. Preprocessing & Safe Feature Transformation

The singleton `MLService` (`backend/services/ml_service.py`) preloads all artifacts at application startup (`app.on_event("startup")`) to ensure zero-latency inference per request (< 1.5 ms):

- **Encoders**: `LabelEncoder` classes serialized from training are used directly.
- **Unseen Categories**: Unseen or out-of-vocabulary categories default safely to category 0 or mode rather than raising runtime errors.
- **Model 1 Vector (18 Features)**:
  `['industry', 'country', 'referral_source', 'account_plan_tier', 'tenure_months', 'calendar_month', 'current_mrr', 'active_subscriptions', 'total_seats', 'usage_count', 'usage_duration_secs', 'error_count', 'n_unique_features', 'has_beta_feature', 'n_tickets', 'avg_resolution_hours', 'n_escalations', 'had_churn_in_m']`
- **Model 2 Vector (16 Features)**:
  `['industry', 'founding_year', 'macro_climate', 'market_size_score', 'competition_intensity', 'founder_prior_exits', 'prior_failures', 'domain_experience_years', 'technical_cofounder', 'n_cofounders', 'team_completeness', 'age_of_founder', 'funding_path', 'monthly_burn_rate', 'runway_months', 'did_customer_validation']`

---

## 4. API Endpoints Specification

### 4.1 ML Prediction Endpoints (`backend/routers/ml_prediction.py`)

#### 1. Next-Month MRR Forecast
- **Endpoint**: `POST /api/ml/revenue/predict`
- **Request Body**:
```json
{
  "industry": "DevTools",
  "country": "US",
  "referral_source": "organic",
  "account_plan_tier": "Pro",
  "current_mrr": 15000.0,
  "active_subscriptions": 3,
  "total_seats": 35
}
```
- **Response**:
```json
{
  "model": "DecisionSimulator-RevenueForecast-v1",
  "model_type": "xgb_regressor",
  "prediction": {
    "next_month_mrr": 15820.45,
    "estimated_delta": 820.45,
    "estimated_pct_change": 5.47,
    "baseline_persistence_mrr": 15000.0,
    "baseline_ridge_mrr": 15410.20
  },
  "drivers": [
    { "feature": "current_mrr", "importance": 0.6765 },
    { "feature": "total_seats", "importance": 0.0839 }
  ],
  "metadata": {
    "forecast_horizon": "1_month",
    "model_version": "v1.0.0",
    "benchmark_note": "Autoregressive persistence is strong in SaaS panel data. Ridge regression achieved lower RMSE ($5,255 vs $6,748) than XGBoost on holdout evaluation."
  },
  "causal_disclaimer": "Estimated next-month MRR based on correlational operational panel features. Does not establish guaranteed causal intervention outcomes."
}
```

#### 2. Next-Month Churn Risk
- **Endpoint**: `POST /api/ml/churn/predict`
- **Response**:
```json
{
  "model": "DecisionSimulator-ChurnRisk-v1",
  "model_type": "xgb_classifier",
  "risk": {
    "churn_probability": 0.0842,
    "retention_probability": 0.9158,
    "baseline_logreg_churn_prob": 0.0910
  },
  "drivers": [
    { "feature": "n_unique_features", "importance": 0.0661 },
    { "feature": "current_mrr", "importance": 0.0654 }
  ],
  "metadata": {
    "forecast_horizon": "1_month",
    "test_brier_score": 0.1311
  }
}
```

#### 3. Startup Survival / Failure Risk
- **Endpoint**: `POST /api/ml/startup-risk/predict`
- **Request Body**:
```json
{
  "industry": "tech_saas",
  "founding_year": 2024,
  "macro_climate": 7.0,
  "monthly_burn_rate": 20000.0,
  "runway_months": 18.0,
  "did_customer_validation": 1,
  "funding_path": "bootstrapped"
}
```
- **Response**:
```json
{
  "model": "DecisionSimulator-StartupSurvival-v1",
  "model_type": "xgb_classifier",
  "risk": {
    "failure_probability": 0.5241,
    "survival_probability": 0.4759,
    "baseline_rf_failure_prob": 0.5420
  },
  "calibration": {
    "brier_score": 0.2044,
    "roc_auc": 0.6821,
    "pr_auc": 0.8020,
    "test_accuracy": 0.6813
  },
  "drivers": [
    { "feature": "did_customer_validation", "importance": 0.1478 },
    { "feature": "monthly_burn_rate", "importance": 0.1170 },
    { "feature": "funding_path", "importance": 0.0958 }
  ]
}
```

---

### 4.2 Decision Simulator Endpoints (`backend/routers/simulator.py`)

#### 1. End-to-End Simulation
- **Endpoint**: `POST /api/simulator/simulate`
- **Accepts**:
  - `decision_text`: natural language string (e.g. `"I'm thinking about raising $500k and hiring 2 engineers"`)
  - `structured_decision`: optional pre-parsed object
  - `company_state`: optional base parameters
- **Response Schema**:
```json
{
  "simulation_engine": "MODEL_POWERED",
  "coverage_status": "SUPPORTED",
  "decision": {
    "decision_type": "fundraising",
    "parameters": { "raise_amount": 500000.0, "funding_path": "vc_seed" }
  },
  "comparison": {
    "revenue_forecast": {
      "baseline_mrr": 10850.0,
      "scenario_mrr": 10850.0,
      "estimated_difference": 0.0,
      "estimated_pct_change": 0.0,
      "unit": "USD/mo"
    },
    "churn_risk": {
      "baseline_probability": 0.0812,
      "scenario_probability": 0.0812,
      "estimated_difference": 0.0
    },
    "startup_failure_risk": {
      "baseline_probability": 0.6420,
      "scenario_probability": 0.5180,
      "estimated_difference": -0.1240
    }
  },
  "state_changes": {
    "baseline": { "runway_months": 12.0, "monthly_burn_rate": 20000.0 },
    "scenario": { "runway_months": 36.0, "monthly_burn_rate": 20000.0 }
  },
  "drivers": [
    { "feature": "did_customer_validation", "importance": 0.1478 },
    { "feature": "monthly_burn_rate", "importance": 0.1170 },
    { "feature": "funding_path", "importance": 0.0958 }
  ],
  "assumptions": [
    "Current customer profile and product usage distribution remain otherwise constant",
    "Capital infusion of $500,000 directly extends cash runway by 25.0 months at current burn ($20,000/mo)",
    "Funding trajectory mapped to 'vc_seed'",
    "Prediction horizon is one calendar month forward for revenue/churn"
  ],
  "evidence": {
    "company": [],
    "documents": [],
    "market": [],
    "competitors": []
  },
  "causal_disclaimer": "All values represent model-based scenario estimates conditioned on input states. The trained models establish statistical associations, NOT guaranteed causal effects."
}
```

#### 2. Decision Parsing Endpoint
- **Endpoint**: `POST /api/simulator/parse-decision`
- Extracts structured parameters (`old_price`, `new_price`, `hire_count`, `raise_amount`, `burn_reduction_pct`, etc.) and determines model coverage status.

#### 3. Model Coverage Matrix
- **Endpoint**: `GET /api/simulator/coverage`
- Lists explicit coverage classification for all potential simulator decisions.

---

## 5. Supported vs. Unsupported Decision Matrix

| Decision Type | Simulator Label | Engine | Coverage Status | Justified Mapped Features |
| :--- | :--- | :---: | :---: | :--- |
| `fundraising` | Raise Funding / Capital Infusion | **MODEL_POWERED** | **SUPPORTED** | `runway_months`, `funding_path` (Model 2) |
| `burn_adjustment` | Adjust / Reduce Monthly Burn | **MODEL_POWERED** | **SUPPORTED** | `monthly_burn_rate`, `runway_months` (Model 2) |
| `validation_action` | Customer Validation Milestone | **MODEL_POWERED** | **SUPPORTED** | `did_customer_validation` (Model 2: #1 driver) |
| `pricing_change` | Modify Pricing / Tier | **MODEL_POWERED** | **PARTIALLY_SUPPORTED** | `account_plan_tier`, `current_mrr` (Model 1) |
| `hiring` | Hire Engineers / Headcount | **MODEL_POWERED** | **PARTIALLY_SUPPORTED** | `monthly_burn_rate`, `runway_months`, `team_completeness`, `total_seats` (Model 1 & 2) |
| `feature_launch` | Launch Feature / Beta | **MODEL_POWERED** | **PARTIALLY_SUPPORTED** | `has_beta_feature`, `n_unique_features` (Model 1) |
| `market_expansion` | Expand to New Country | **RULE_BASED** | **UNSUPPORTED** | Single-account monthly panel does not model cross-border expansion portfolios. |
| `marketing_spend` | Increase Marketing Budget | **RULE_BASED** | **UNSUPPORTED** | Continuous ad budget is not a feature in the trained schemas. |

---

## 6. Causal Limitations & Strict Disclaimers

1. **Non-Causal Associative Models**:
   - The trained models identify conditional probabilities and statistical correlations from historical panels.
   - The simulator **never** claims: *"Launching this feature will increase revenue by 18%"* or *"Raising $500k guarantees a 12% lower failure rate."*
   - All outputs are labeled with:
     - *"Estimated next-month MRR"*
     - *"Model-based scenario estimate"*
     - *"Estimated failure risk"*
     - *"Projected impact based on available company-state features"*

2. **Model 1 Nuance (MRR Regression)**:
   - High autocorrelation in SaaS panel data makes Naive persistence competitive on flat accounts. Ridge regression achieved the lowest RMSE ($5,255) and highest $R^2$ (0.8745).
   - The simulator presents both Ridge and Persistence benchmarks alongside the XGBoost prediction.

3. **Model 2 Calibration (Startup Risk)**:
   - XGBoost achieved ROC-AUC 0.6821 and Brier Score 0.2044 on 48,000 startups.
   - It functions as a probabilistic risk estimator, not an absolute outcome oracle.

---

## 7. Automated Test Suite (`backend/tests/test_ml_serving.py`)

All 11 automated test suites pass deterministically (`Ran 11 tests in 4.688s. OK`):
1. `test_01_model_loading`: Verifies all JSON boosters, Ridge/RF baselines, encoders, and schemas load into memory.
2. `test_02_valid_feature_transformation`: Verifies 18-element vector for Model 1 and 16-element vector for Model 2.
3. `test_03_invalid_feature_rejection`: Verifies Pydantic returns HTTP 422 on negative MRR or missing burn rate.
4. `test_04_revenue_prediction`: Verifies Next-Month MRR, Ridge baseline, persistence, and drivers.
5. `test_05_churn_prediction`: Verifies churn probability bounded in [0, 1] and drivers.
6. `test_06_startup_risk_prediction`: Verifies failure probability, Brier calibration, and drivers.
7. `test_07_decision_parsing`: Verifies parsing of fundraising, pricing, and hiring (including number words).
8. `test_08_scenario_transformation`: Verifies burn rate and runway state modifications.
9. `test_09_baseline_vs_scenario_comparison`: Verifies full comparative deltas and non-causal reporting.
10. `test_10_unsupported_decision_handling`: Verifies clean fallback to `RULE_BASED` and `UNSUPPORTED`.
11. `test_11_fastapi_endpoints`: Verifies HTTP endpoints `/api/ml/models`, `/api/simulator/coverage`, `/api/simulator/parse-decision`, `/api/simulator/simulate`.
