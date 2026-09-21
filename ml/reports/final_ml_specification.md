# Final Machine Learning Specification

**Location**: `ml/reports/final_ml_specification.md`  
**Report Date**: September 9, 2026  
**Scope**: Exact Pre-Training Architectural Specification for Decision Simulator ML Prediction Layer  
**Status**: Ready for Implementation (Awaiting Explicit Training Authorization)  

---

## 1. Overview & Architecture

The Decision Simulator utilizes a dual-model ML Prediction Layer designed to simulate the quantitative outcomes of strategic founder decisions:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           FOUNDER DECISION INPUT                        │
│   (e.g., "Hire 2 Support Engineers", "Launch Beta Feature", "Pivots")   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
    ┌──────────────────────────┐            ┌──────────────────────────┐
    │         MODEL 1          │            │         MODEL 2          │
    │   Business Forecasting   │            │   Startup Risk & Survival│
    │    & Impact Predictor    │            │        Classifier        │
    │      (RavenStack)        │            │    (Startup Survival)    │
    └────────────┬─────────────┘            └────────────┬─────────────┘
                 │                                       │
                 │ Forecasts:                            │ Classifies:
                 │ • Next-Month MRR ($)                  │ • Survival vs Failure
                 │ • Churn/Contraction Risk (%)          │ • Early-Stage Failure Modes
                 ▼                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    DECISION SIMULATOR OUTCOME ENGINE                    │
│   (Synthesizes Model 1 financial impacts with Model 2 survival risks)   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. MODEL 1 Specification — Business Forecasting & Impact Prediction

### 2.1 Model Identity & Role
- **Model Name**: `DecisionSimulator-RevenueForecast-v1`
- **Primary Task**: Predict next-month recurring revenue and subscription churn/contraction probability given operational and product telemetry.
- **Algorithms**: 
  - Primary: `XGBRegressor` (Target: $MRR_{t+1}$)
  - Auxiliary: `XGBClassifier` (Target: $ChurnEvent_{t+1}$)

### 2.2 Formal Training Setup

| Parameter | Specification |
| :--- | :--- |
| **Dataset** | RavenStack SaaS Subscription & Churn Analytics (`ml/data/raw/ravenstack/`) via engineered panel (`ml/data/processed/ravenstack_monthly_panel.csv`) |
| **Unit of Observation** | Single Account at Calendar Month $t$ (`account_id`, `month_t`) |
| **Prediction Timestamp** | End of Month $t$ (all events, usage, and billing through day 28–31 of month $t$ are finalized) |
| **Feature Window** | Month $t$ (30-day operational rolling window) plus cumulative tenure |
| **Forecast Horizon** | Month $t+1$ (1 calendar month ahead, 30-day forward step) |
| **Primary Target (Regression)** | **Next-Month MRR ($MRR_{t+1}$)** in USD. Continuous variable ($0 to $138,060; Mean: $13,148; Median: $9,810). |
| **Auxiliary Target (Classification)** | **Next-Month Churn / Contraction Event ($ChurnEvent_{t+1}$)**. Binary indicator (1 if any subscription churns in $t+1$, 0 otherwise). Event rate: 9.38% (498 positive / 4,809 negative). |
| **Usable Sample Count** | **4,619 valid active training samples** ($MRR_t > 0$) for MRR Regression; **5,307 samples** for Churn Classification across 483 unique accounts. |

### 2.3 Feature Matrix (18 Features)

```
1.  industry                  [Categorical: DevTools, FinTech, Cybersecurity, HealthTech, EdTech]
2.  country                   [Categorical: US, UK, IN, AU, DE, CA, FR]
3.  referral_source           [Categorical: organic, paid, referral, outbound, partner]
4.  account_plan_tier         [Categorical: Basic, Pro, Enterprise]
5.  tenure_months             [Numerical: integer count of months since signup]
6.  calendar_month            [Numerical: 1-12, seasonality capture]
7.  current_mrr               [Numerical: total active subscription MRR in month t]
8.  active_subscriptions      [Numerical: count of active subscriptions in month t]
9.  total_seats               [Numerical: total seats licensed in month t]
10. usage_count               [Numerical: aggregate product interactions in month t]
11. usage_duration_secs       [Numerical: total seconds spent in product in month t]
12. error_count               [Numerical: total system/client errors encountered in month t]
13. n_unique_features         [Numerical: distinct product features utilized in month t]
14. has_beta_feature          [Binary: 1 if beta features were tested in month t, 0 otherwise]
15. n_tickets                 [Numerical: total customer support tickets opened in month t]
16. avg_resolution_hours      [Numerical: average hours to close tickets in month t]
17. n_escalations             [Numerical: count of priority-escalated tickets in month t]
18. had_churn_in_m            [Binary: 1 if account experienced a contraction/churn in month t]
```

### 2.4 Excluded Features & Strict Leakage Controls

| Excluded Field | Source Table | Reason for Exclusion |
| :--- | :--- | :--- |
| `accounts.churn_flag` | `ravenstack_accounts.csv` | **Lifetime static flag** indicating if the account ever churned by Dec 2024. Leaks future churn at earlier months. |
| `subscriptions.churn_flag` | `ravenstack_subscriptions.csv` | Lifetime status of individual subscriptions; unknown until the subscription reaches end date. |
| `subscriptions.end_date` | `ravenstack_subscriptions.csv` | Future cancellation date; only active status during month $t$ is checked. |
| `churn_events.refund_amount_usd` | `ravenstack_churn_events.csv` | Occurs during or after the churn event; unknown at prediction time $t$. |
| `churn_events.feedback_text` | `ravenstack_churn_events.csv` | Qualitative post-churn exit survey text; unknown at prediction time $t$. |

### 2.5 Validation & Split Strategy
- **Time-Based Split (Out-of-Time Validation)**:
  - **Train Set**: Months 2023-01 to 2024-06 (18 calendar months, ~3,400 samples).
  - **Test Set**: Months 2024-07 to 2024-12 (6 calendar months, ~1,200 samples).
- **Cross-Validation**: 5-Fold `GroupKFold` grouped by `account_id` on the training set to prevent observations from the same entity appearing across both train and validation folds.

### 2.6 Evaluation Metrics
- **Regression ($MRR_{t+1}$)**:
  - Root Mean Squared Error (RMSE)
  - Mean Absolute Error (MAE)
  - Mean Absolute Percentage Error (MAPE)
  - Directional Accuracy on MRR Delta: $\text{Sign}(\widehat{MRR}_{t+1} - MRR_t) == \text{Sign}(MRR_{t+1} - MRR_t)$
- **Classification ($ChurnEvent_{t+1}$)**:
  - Area Under ROC Curve (ROC-AUC)
  - Precision-Recall AUC (PR-AUC / Average Precision)
  - F1-Score (optimized threshold)

### 2.7 Benchmark Baselines
1. **Naive Persistence Baseline**: $\widehat{MRR}_{t+1} = MRR_t$. Because autocorrelation is $0.9435$, any model that fails to achieve a lower MAE than naive persistence on non-zero transitions is useless.
2. **Ridge / Lasso Linear Regression**: Linear baseline with L2 penalty.
3. **DummyClassifier**: Predicts empirical positive churn prior ($9.38\%$).
4. **Logistic Regression**: Standard L2 logistic classifier.

---

## 3. MODEL 2 Specification — Startup Risk & Outcome Classification

### 3.1 Model Identity & Role
- **Model Name**: `DecisionSimulator-StartupSurvival-v1`
- **Primary Task**: Predict the probability of startup survival versus failure based on founder background, circumstance, and stage-gated execution metrics.
- **Algorithm**: `XGBClassifier`

### 3.2 Formal Training Setup

| Parameter | Specification |
| :--- | :--- |
| **Dataset** | Startup & Founder Survival Dataset (`ml/data/raw/startup_survival/startup_survival_master.csv`) |
| **Unit of Observation** | Individual Startup Entity (`startup_id`) |
| **Prediction Timestamp** | **Stage 0 (Day 0 / Founding)** and **Stage 1 (Post-Validation / 12-Month Checkpoint)** |
| **Feature Window** | Snapshot at the declared development stage |
| **Forecast Horizon** | Long-term terminal outcome (survival vs liquidation) |
| **Primary Target** | **`failed` (Binary)**: $1 = \text{Failed venture}$ (31,587 rows, 65.81%), $0 = \text{Survived / Active / Acquired / IPO}$ (16,413 rows, 34.19%). |
| **Usable Sample Count** | **48,000 startups** (100% complete, zero missing values across all records). |

### 3.3 Staged Feature Sets

#### Stage 0: Pre-Seed / Day 0 Model (16 Features)
*For early idea-stage founders with zero product history:*
```
1.  industry                    [Categorical: tech_saas, ecommerce, fintech, healthtech, etc.]
2.  founding_year               [Numerical: 2008-2021]
3.  macro_climate               [Numerical: 0-10, external funding and market index]
4.  market_size_score           [Numerical: 0-10, addressable market size]
5.  competition_intensity       [Numerical: 0-10, competitive density]
6.  founder_prior_exits         [Numerical: 0 (first-time), 1 (prior venture), 2 (successful exit)]
7.  prior_failures              [Numerical: 0-4, count of previous failed businesses]
8.  domain_experience_years     [Numerical: 0-30, years of direct industry experience]
9.  technical_cofounder         [Binary: 1 if technical builder on founding team, 0 otherwise]
10. n_cofounders                [Numerical: 1-4, founding team size]
11. team_completeness           [Numerical: 0-10, skill coverage score]
12. age_of_founder              [Numerical: 19-65, age of lead founder]
13. funding_path                [Categorical: bootstrapped, angel, vc_seed, vc_series_a_plus]
14. monthly_burn_rate           [Numerical: initial planned monthly burn in USD]
15. runway_months               [Numerical: initial runway at founding in months]
16. did_customer_validation     [Binary: 1 if demand validated prior to coding, 0 otherwise]
```

#### Stage 1: Post-Validation Checkpoint Model (22 Features)
*For startups with an active product in market:*
```
Stage 0 features (1-16) PLUS:
17. cofounder_conflict          [Numerical: 0-10, team tension / conflict metric]
18. product_market_fit_score    [Numerical: 0-10, measured customer demand fit]
19. premature_scaling           [Binary: 1 if marketing scaled before PMF was achieved]
20. pivots                      [Numerical: 0-3, strategic direction adjustments]
21. unit_economics_score        [Numerical: 0-10, LTV:CAC and gross margin health]
22. marketing_effectiveness     [Numerical: 0-10, customer acquisition efficiency]
```

### 3.4 Excluded Features & Critical Leakage Controls

| Excluded Variable | Correlation with `failed` | Reason for Absolute Exclusion |
| :--- | :--- | :--- |
| `years_to_outcome` | **$-0.5811$** | **CRITICAL LEAKAGE**: Post-hoc duration of life. Failed ventures average 3.7 years; survivors average 8.7 years. Trivially reveals the answer. |
| `failure_reason` | N/A (Categorical) | **CRITICAL LEAKAGE**: Explicitly populated with 'survived' for successful startups and root failure causes for folded startups. Perfect target proxy. |
| `survived_5y` | $-0.7109$ | **ALTERNATE TARGET**: Duplicate outcome definition. |
| `outcome` | Multi-class label | **ALTERNATE TARGET**: Detailed multiclass label (failed, still_operating, acquired, ipo). |
| `total_raised_usd` | $+0.1428$ | **CUMULATIVE LEAKAGE**: Represents lifetime capital raised (up to $52M), which correlates with surviving multiple rounds. |
| `startup_id` | N/A | Non-informative arbitrary identifier. |

### 3.5 Validation & Split Strategy
- **Stratified Split**: 80% Train (38,400 startups), 20% Test (9,600 startups), stratified by `failed` and `industry`.
- **Cross-Validation**: 5-Fold Stratified Cross-Validation on the 80% training set.
- **External Generalization Validation**: Evaluation against the 13,334 terminal companies from `big_startup_secsees_dataset.csv` on the subset of shared features (`industry`, `funding_path`, `founded_year`).

### 3.6 Evaluation Metrics
- **ROC-AUC**: Primary discriminatory metric (target: $>0.75$).
- **PR-AUC (Average Precision)**: Critical for measuring precision across decision thresholds.
- **Brier Score / Calibration Loss**: Ensures predicted probabilities (e.g. 68% failure risk) reflect genuine statistical frequencies for the Decision Simulator.
- **Confusion Matrix & Precision @ Top 20% Risk**: Measures whether high-risk alerts are highly actionable.

### 3.7 Benchmark Baselines
1. **DummyClassifier (Majority Class)**: Always predicts `failed = 1`. Base accuracy: $65.81\%$, ROC-AUC: $0.5000$.
2. **Logistic Regression (L2 Regularized)**: Linear baseline providing interpretable log-odds coefficients.
3. **Random Forest Classifier**: Non-boosting ensemble baseline.

---

## 4. Pre-Training Verification Sign-Off

- [x] All candidate datasets acquired and stored in designated paths.
- [x] All raw files verified byte-for-byte; zero modification of original assets.
- [x] Entity-time monthly panel constructed and audited for RavenStack ($N=5,307$).
- [x] Catastrophic leakage vectors identified and excluded (`years_to_outcome`, `failure_reason`, `accounts.churn_flag`).
- [x] Target distributions, variance, and sample sizes formally verified.
- [x] Baselines defined for rigorous comparative benchmarking.

> [!IMPORTANT]
> **No training code has been run.** In accordance with project governance, execution halts here until user review and formal authorization to proceed to Stage 2 (Preprocessing and Model Training).
