# ML Dataset Validation & Feasibility Report

**Location**: `ml/reports/dataset_validation_report.md`  
**Report Date**: September 9, 2026  
**Scope**: Dataset Acquisition, Empirical Quality Audit, Leakage Analysis, and Feasibility Verification for Decision Simulator ML Prediction Layer  
**Status**: Pre-Training Dataset Validation Complete — Awaiting Approval Before Training  

---

## 1. Executive Summary

This report establishes the verified empirical foundation for the machine learning models in the Decision Simulator. Following rigorous acquisition and data auditing of both newly acquired and legacy datasets, we have resolved critical uncertainties regarding sample sizes, data origins, schema integrity, and temporal leakage.

### Key Audit Findings

1. **RavenStack SaaS Subscription & Churn Analytics**:
   - **Successfully Acquired**: Downloaded from Kaggle (`rivalytics/saas-subscription-and-churn-analytics-dataset`).
   - **Data Nature**: High-fidelity relational synthetic panel (500 accounts, 5,000 subscriptions, 25,000 usage events, 2,000 support tickets, 600 churn events) spanning 24 calendar months (2023-01 to 2024-12).
   - **Supervised Sample Reality**: Produces **5,307 valid month-level supervised samples** ($X_t \to Y_{t+1}$) across 483 unique accounts, of which **4,619 samples** have active baseline MRR ($MRR_t > 0$).
   - **Comparison to Prior Dataset**: Replaces the legacy SaaS Business Metrics dataset which yielded only 17 monthly samples (**a 312x increase in supervised sample size**).
   - **Verdict**: **TRAIN WITH RESTRICTIONS** (Exclude lifetime account `churn_flag`; enforce strict $t \to t+1$ temporal lag).

2. **Startup & Founder Survival Dataset**:
   - **Successfully Acquired**: Downloaded from Kaggle (`sergionefedov/startup-and-founder-survival-who-makes-it-folds`).
   - **Data Nature**: 48,000 startups across 30 columns. Contrary to the initial report's assumption of curated scraped data, empirical code and distribution analysis confirms this dataset is **100% procedurally generated**, specifically calibrated to Bureau of Labor Statistics (BLS) survival curves and CB Insights failure cause distributions.
   - **Target Balance**: `failed = 1` (31,587 startups, 65.81%) vs `failed = 0` (16,413 startups, 34.19%).
   - **Severe Raw Leakage Discovered**: `years_to_outcome` (correlation $-0.5811$ with failure) and `failure_reason` (contains 'survived' for non-failures) constitute **catastrophic target leakage** and must be purged.
   - **Verdict**: **TRAIN WITH RESTRICTIONS** (Strict feature gating: purge post-hoc outcome variables; separate Day 0 Pre-Seed features from Stage 1 Post-Validation execution features).

3. **Startup Success Prediction Dataset (Optional 923 Rows)**:
   - **Successfully Acquired**: Downloaded from Kaggle (`manishkc06/startup-success-prediction`).
   - **Data Nature**: 923 US startups, 49 columns, binary target (`acquired` 597 [64.7%] vs `closed` 326 [35.3%]).
   - **Limitation**: N=923 is small, lacks operational/founder features, and suffers from cumulative lifetime funding leakage.
   - **Verdict**: **VALIDATION ONLY** (Useful for benchmarking per-round milestone feature engineering).

4. **Legacy Datasets**:
   - `customers.csv`, `revenue.csv`, `subscriptions.csv`: **REJECT** (N=17, deterministic MRR).
   - `big_startup_secsees_dataset.csv` (66k rows): **VALIDATION ONLY** (Retain as an external generalizability benchmark, but do not use as primary training data due to lifetime aggregate leakage).

---

## 2. Dataset Acquisition Status

All three candidate datasets were legitimately obtained and verified directly from verified public sources:

| Dataset | Designated Storage Path | Source / Slug | Files Downloaded | Total Size | Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **RavenStack SaaS Analytics** | `ml/data/raw/ravenstack/` | Kaggle: `rivalytics/saas-subscription-and-churn-analytics-dataset` | 5 CSVs + `README.md` | ~2.07 MB | ✅ Verified complete (500 accounts, 5k subs, 25k usage, 2k tickets, 600 churns) |
| **Startup & Founder Survival** | `ml/data/raw/startup_survival/` | Kaggle: `sergionefedov/startup-and-founder-survival-who-makes-it-folds` | 2 CSVs | ~6.91 MB | ✅ Verified complete (48,000 rows, 30 columns, data dictionary) |
| **Startup Success Prediction** | `ml/data/raw/startup_success_prediction/` | Kaggle: `manishkc06/startup-success-prediction` | 1 CSV (`startup data.csv`) | ~210 KB | ✅ Verified complete (923 rows, 49 columns) |

> [!NOTE]
> All original raw files in `ml/data/raw/` (`customers.csv`, `revenue.csv`, `subscriptions.csv`, `big_startup_secsees_dataset.csv`) remain completely untouched and unmodified.

---

## 3. RavenStack — Deep ML Feasibility & Panel Audit

### 3.1 Table-by-Table Technical Audit

| Table File | Format | File Size | Rows | Cols | Duplicate Rows | Missing Values | Relational Keys | Date Span |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ravenstack_accounts.csv` | CSV | 36,649 B | 500 | 10 | 0 | 0 (0.0%) | `account_id` (PK) | 2023-01-02 to 2024-12-31 |
| `ravenstack_subscriptions.csv` | CSV | 437,566 B | 5,000 | 14 | 0 | `end_date`: 4,514 (90.3% active) | `subscription_id` (PK), `account_id` (FK) | 2023-01-09 to 2024-12-31 |
| `ravenstack_feature_usage.csv` | CSV | 1,400,898 B | 25,000 | 8 | 0 | 0 (0.0%) | `usage_id` (PK), `subscription_id` (FK) | 2023-01-01 to 2024-12-31 |
| `ravenstack_support_tickets.csv` | CSV | 145,598 B | 2,000 | 9 | 0 | `satisfaction_score`: 825 (41.2%) | `ticket_id` (PK), `account_id` (FK) | 2023-01-02 to 2024-12-31 |
| `ravenstack_churn_events.csv` | CSV | 44,630 B | 600 | 9 | 0 | `feedback_text`: 148 (24.7%) | `churn_event_id` (PK), `account_id` (FK) | 2023-01-25 to 2024-12-31 |

### 3.2 Relational Structure & Architectural Clarification

Our deep inspection revealed a critical behavioral nuance that the preliminary report missed:
- An individual account holds an average of **10.0 subscriptions** (min 2, max 19) representing multiple products, add-on modules, or seat licenses.
- Out of 600 churn event records, there are 352 unique `account_id`s, while `accounts.csv` only marks 110 accounts with `churn_flag = True`.
- **Reason**: 486 subscriptions churn while the parent company remains active on other subscriptions. In addition, 61 churn events represent reactivations (`is_reactivation = True`).
- Therefore, **`churn_events.csv` and `subscriptions.churn_flag` reflect subscription-level contraction/churn**, whereas **`accounts.churn_flag` represents terminal company demise**.

### 3.3 Entity-Time Panel Construction ($X_t \to Y_{t+1}$)

We built an exact panel across the 24 calendar months (2023-01 to 2024-12) for all 500 accounts. Features are strictly computed using information available up to month $t$, and shifted to predict targets at month $t+1$:

$$\text{Observation Unit: } (\text{account\_id}, \text{month } t) \implies \text{Target at month } t+1$$

```
Panel Summary:
  Total Account-Month Records: 5,807
  Unique Accounts: 500
  Calendar Range: 2023-01 to 2024-12 (24 months)
  Total Supervised Transitions (X_t → Y_t+1): 5,307
  Supervised Accounts: 483
  Supervised Observations with Active MRR (MRR_t > 0): 4,619
```

### 3.4 Feature Feasibility & Leakage Classification

| Proposed Feature | Source Table | Known at Time $t$? | Derived from Future? | Target Leakage Risk | Granularity | Usability Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `industry` | `accounts` | Yes (at signup) | No | None | Static Demographic | ✅ SAFE |
| `country` | `accounts` | Yes (at signup) | No | None | Static Geographic | ✅ SAFE |
| `referral_source` | `accounts` | Yes (at signup) | No | None | Static Channel | ✅ SAFE |
| `account_plan_tier` | `accounts` | Yes (initial tier) | No | None | Static Account | ✅ SAFE |
| `tenure_months` | Derived | Yes ($t - \text{signup}$) | No | None | Dynamic Integer | ✅ SAFE |
| `current_mrr` | `subscriptions` | Yes (active at $t$) | No | None | Monthly Financial | ✅ SAFE |
| `active_subscriptions` | `subscriptions` | Yes (active at $t$) | No | None | Monthly Count | ✅ SAFE |
| `total_seats` | `subscriptions` | Yes (active at $t$) | No | None | Monthly Count | ✅ SAFE |
| `usage_count` | `feature_usage` | Yes (logged in $t$) | No | None | Monthly Sum | ✅ SAFE |
| `usage_duration_secs` | `feature_usage` | Yes (logged in $t$) | No | None | Monthly Sum | ✅ SAFE |
| `error_count` | `feature_usage` | Yes (logged in $t$) | No | None | Monthly Sum | ✅ SAFE |
| `n_unique_features` | `feature_usage` | Yes (logged in $t$) | No | None | Monthly Count | ✅ SAFE |
| `has_beta_feature` | `feature_usage` | Yes (logged in $t$) | No | None | Monthly Boolean | ✅ SAFE |
| `n_tickets` | `support_tickets` | Yes (logged in $t$) | No | None | Monthly Count | ✅ SAFE |
| `avg_resolution_hours` | `support_tickets` | Yes (closed in $t$) | No | None | Monthly Continuous | ✅ SAFE |
| `n_escalations` | `support_tickets` | Yes (logged in $t$) | No | None | Monthly Count | ✅ SAFE |
| `had_churn_in_m` | `churn_events` | Yes (logged in $t$) | No | None | Monthly Boolean | ✅ SAFE |
| `account_churn_flag` | `accounts` | ❌ NO | **YES (Lifetime flag)** | **CRITICAL LEAKAGE** | Static Flag | ❌ **EXCLUDED** |
| `sub_churn_flag` (future) | `subscriptions` | ❌ NO | **YES (Future churn)** | **CRITICAL LEAKAGE** | Subscription Level | ❌ **EXCLUDED** |
| `refund_amount_usd` (future)| `churn_events` | ❌ NO | **YES (Future event)** | **CRITICAL LEAKAGE** | Churn Event Level | ❌ **EXCLUDED** |

### 3.5 Target Feasibility Evaluation

| Target Option | Task Type | Valid Supervised N | Unique Accounts | Distribution / Summary Stats | Missingness | Variance / Feasibility | Leakage Risk | Recommendation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **A. Next-Month MRR ($MRR_{t+1}$)** | Regression | **4,619** | 483 | Mean: $13,148<br>Std: $12,953<br>Min: $0, Max: $138,060<br>Median: $9,810 | 0.0% (active accounts) | High variance; realistic autocorrelation with $MRR_t$ ($r = 0.9435$) | 🟢 None (strict $t+1$ shift) | **PRIMARY REGRESSION TARGET** |
| **B. Next-Month MRR Growth Rate** | Regression | **4,619** | 483 | Mean: +67.2%<br>Std: 4.63<br>Positive: 45.2%<br>Zero (flat): 51.6%<br>Contraction: 3.2% | 0.0% | High positive skew due to small-base expansions; requires log-transform | 🟢 None | **SECONDARY REGRESSION TARGET** |
| **C. Churn / Contraction Event in $t+1$** | Binary Classification | **5,307** | 483 | Event = 1: 498 (9.38%)<br>Event = 0: 4,809 (90.62%) | 0.0% | Ideal class balance for XGBClassifier (event rate ~9.4%) | 🟢 None | **PRIMARY CLASSIFICATION TARGET** |
| **D. Complete Account Churn ($MRR_{t+1}=0$)** | Binary Classification | **4,619** | 483 | Churn = 1: 2 (0.04%)<br>Churn = 0: 4,617 (99.96%) | 0.0% | **Fatal class imbalance**; accounts rarely terminate all products simultaneously mid-year | 🟢 None | ❌ **REJECT AS TARGET** |
| **E. Customer Retention ($MRR_{t+1}>0$)** | Binary Classification | **4,619** | 483 | Retained = 1: 4,617 (99.96%)<br>Lost = 0: 2 (0.04%) | 0.0% | Inverse of Target D; zero variance | 🟢 None | ❌ **REJECT AS TARGET** |

---

## 4. Startup & Founder Survival — Deep Audit

### 4.1 Technical Profile

- **Filename**: `ml/data/raw/startup_survival/startup_survival_master.csv`
- **Rows**: 48,000 | **Columns**: 30 | **File Size**: 6.91 MB | **Duplicates**: 0 | **Missing Values**: 0 across all 30 columns
- **Data Origin**: Procedurally generated dataset calibrated against BLS survival curves and CB Insights post-mortem causes.
- **Target Distribution**:
  - `failed`: 1 = 31,587 (65.81%), 0 = 16,413 (34.19%)
  - `outcome`: `failed` = 31,587 (65.81%), `still_operating` = 14,432 (30.07%), `acquired` = 1,971 (4.11%), `ipo` = 10 (0.02%)
  - `survived_5y`: 1 = 24,334 (50.70%), 0 = 23,666 (49.30%)

### 4.2 Comprehensive 30-Feature Leakage Audit

To prevent circular reasoning, every column was evaluated against the question:  
*"If we predict startup failure at an early stage, is this variable known without knowledge of the future outcome?"*

| # | Column Name | Data Type | Correlation with `failed` | Classification | Explanation & Temporal Constraint |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `startup_id` | `object` | N/A | **SAFE** | Arbitrary string identifier (exclude from training features). |
| 2 | `industry` | `object` | Categorical | **SAFE** | Static sector (tech_saas, ecommerce, fintech, etc.); known on Day 0. |
| 3 | `founding_year` | `int64` | $+0.0016$ | **SAFE** | Founding cohort year (2008–2021); static temporal anchor. |
| 4 | `macro_climate` | `float64` | $-0.1073$ | **SAFE** | Macroeconomic climate index at founding; known on Day 0. |
| 5 | `market_size_score` | `float64` | $-0.0892$ | **SAFE** | Total addressable market score at founding; known on Day 0. |
| 6 | `competition_intensity` | `float64` | $+0.0787$ | **SAFE** | Competitive intensity score at founding; known on Day 0. |
| 7 | `founder_prior_exits` | `int64` | $-0.0313$ | **SAFE** | Founder track record prior to founding; known on Day 0. |
| 8 | `prior_failures` | `int64` | $+0.0050$ | **SAFE** | Founder prior failed ventures; known on Day 0. |
| 9 | `domain_experience_years` | `float64` | $-0.0714$ | **SAFE** | Years of domain experience prior to founding; known on Day 0. |
| 10 | `technical_cofounder` | `int64` | $-0.0107$ | **SAFE** | Binary flag for technical cofounder; known on Day 0. |
| 11 | `n_cofounders` | `int64` | $+0.0071$ | **SAFE** | Founding team size; known on Day 0. |
| 12 | `cofounder_conflict` | `float64` | $+0.1050$ | **CONDITIONALLY SAFE** | Team interpersonal tension; known early if assessing founding team dynamics. |
| 13 | `team_completeness` | `float64` | $-0.0853$ | **SAFE** | Founding team skillset completeness; known on Day 0. |
| 14 | `age_of_founder` | `int64` | $+0.0053$ | **SAFE** | Founder age at founding; known on Day 0. |
| 15 | `funding_path` | `object` | Categorical | **CONDITIONALLY SAFE** | Strategy (bootstrapped, angel, vc_seed, vc_series_a); valid if representing target funding strategy. |
| 16 | `total_raised_usd` | `float64` | $+0.1428$ | **LEAKAGE / RESTRICTED** | Represents cumulative funding (up to $52M for Series A+). Leaks longevity unless masked by stage. |
| 17 | `monthly_burn_rate` | `float64` | $+0.1506$ | **SAFE** | Initial monthly cash burn; known at founding. |
| 18 | `runway_months` | `float64` | $-0.1403$ | **SAFE** | Initial runway at founding; known on Day 0. |
| 19 | `product_market_fit_score` | `float64` | $-0.2047$ | **CONDITIONALLY SAFE** | Unknown on Day 0. Only usable in a **Stage 1 (Post-MVP)** simulation model. |
| 20 | `did_customer_validation` | `int64` | $-0.0766$ | **SAFE** | Pre-launch customer validation; known prior to building product. |
| 21 | `premature_scaling` | `int64` | $+0.0386$ | **CONDITIONALLY SAFE** | Execution failure mode; observable only after product launch (Stage 1). |
| 22 | `pivots` | `int64` | $-0.0005$ | **CONDITIONALLY SAFE** | Number of strategic pivots; 0 at Day 0, observable over time (Stage 1). |
| 23 | `unit_economics_score` | `float64` | $-0.1233$ | **CONDITIONALLY SAFE** | Requires commercial transactions; observable only in Stage 1. |
| 24 | `marketing_effectiveness` | `float64` | $-0.0548$ | **CONDITIONALLY SAFE** | Requires running acquisition campaigns; observable in Stage 1. |
| 25 | `weekly_hours` | `int64` | $-0.0019$ | **SAFE** | Founder weekly work hours; known early. |
| 26 | `years_to_outcome` | `float64` | $\mathbf{-0.5811}$ | ❌ **CRITICAL LEAKAGE** | Mean is 3.72y for failed vs 8.74y for survivors. Perfect post-hoc leakage. **MUST PURGE.** |
| 27 | `failure_reason` | `object` | Categorical | ❌ **CRITICAL LEAKAGE** | Explicitly labels 'survived' vs specific failure causes. Perfect target proxy. **MUST PURGE.** |
| 28 | `outcome` | `object` | Categorical | 🎯 **TARGET** | Multiclass outcome (failed, still_operating, acquired, ipo). Alternate target. |
| 29 | `survived_5y` | `int64` | $-0.7109$ | 🎯 **TARGET** | Binary 5-year survival milestone. Alternate target. |
| 30 | `failed` | `int64` | $+1.0000$ | 🎯 **PRIMARY TARGET** | Binary failure label ($1 = \text{failed}, 0 = \text{survived/acquired/operating}$). |

### 4.3 Temporal Masking & Staged Prediction Protocol

Because startup features evolve over time, we divide Model 2 into two legitimate prediction horizons:

```
STAGE 0: PRE-SEED / DAY 0 EVALUATION (16 Features)
  Founder Background: founder_prior_exits, prior_failures, domain_experience_years, 
                      technical_cofounder, n_cofounders, age_of_founder, team_completeness
  Circumstance:       industry, macro_climate, market_size_score, competition_intensity
  Initial Setup:      did_customer_validation, runway_months, monthly_burn_rate, weekly_hours, funding_path
  EXCLUDED:           All execution metrics (PMF, premature scaling, pivots, unit economics)

STAGE 1: POST-VALIDATION / SEED CHECKPOINT (22 Features)
  Stage 0 Features PLUS:
  Execution Metrics:  product_market_fit_score, premature_scaling, pivots, 
                      unit_economics_score, marketing_effectiveness, cofounder_conflict
```

---

## 5. Optional 923-Row Startup Dataset Audit

### 5.1 Technical Profile
- **Filename**: `ml/data/raw/startup_success_prediction/startup data.csv`
- **Rows**: 923 | **Columns**: 49 | **File Size**: 210 KB | **Duplicates**: 0
- **Target**: `status`: `acquired` = 597 (64.68%), `closed` = 326 (35.32%)
- **Missing Data**: `closed_at` (63.7%), `Unnamed: 6` (53.4%), `age_first_milestone_year` (16.5%), `age_last_milestone_year` (16.5%).

### 5.2 Feasibility Verdict: VALIDATION ONLY
While the dataset includes interesting round flags (`has_roundA`, `has_roundB`, `has_roundC`, `has_roundD`) and network signals (`relationships`, `avg_participants`), it suffers from:
1. **Tiny Sample Size**: 923 total rows makes multi-fold cross-validation fragile.
2. **Cumulative Lifetime Aggregates**: `funding_rounds`, `funding_total_usd`, and `age_last_funding_year` heavily leak longevity.
3. **Survivor Bias**: Acquired companies represent 64.7% of the dataset, which is completely unrepresentative of the broader startup base rate (<10% exit rate).
- **Recommendation**: Do not use for primary training. Retain to test how milestone timing features correlate with outcomes.

---

## 6. Comprehensive Dataset Comparison Matrix

| Dataset | Rows | Features | Unique Entities | Temporal Depth | Valid Supervised Samples | Target Definition | Leakage Risk | ML Suitability | Final Verdict |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **RavenStack SaaS Analytics** | 33,100 (5 tables) | 18 engineered | 500 accounts | 24 months (monthly panel) | **5,307** ($X_t \to Y_{t+1}$); **4,619** active MRR | Next-Month MRR ($) & Churn Event | 🟢 Low (with strict lagging) | High (rich usage, tickets, billing) | **TRAIN WITH RESTRICTIONS** |
| **Startup & Founder Survival** | 48,000 | 22 (gated) | 48,000 startups | Cross-sectional cohort (2008–2021) | **48,000** startups | `failed` (0/1 binary) | 🟡 Medium (after purging outcome leaks) | High (realistic BLS/CBI calibrated curves) | **TRAIN WITH RESTRICTIONS** |
| **Startup Success Prediction** | 923 | 48 | 923 startups | 2005–2012 snapshot | 923 startups | `status` (acquired vs closed) | 🔴 High (cumulative rounds) | Low (tiny N=923, severe survivor bias) | **VALIDATION ONLY** |
| **Current 66k Startup Dataset** | 66,368 | 14 | 66,368 companies | ~2015 Crunchbase snapshot | 13,334 terminal startups | `status` (4 classes) | 🔴 High (lifetime funding & rounds) | Moderate (sparse 6–8 safe features) | **VALIDATION ONLY** |
| **Current SaaS Dataset** | 1,000 / 988 | 6 | 1,000 customers | 18 months | **17** monthly transitions | Reconstructed MRR | 🟢 Low | Fatal (N=17, deterministic) | ❌ **REJECT** |
| **YC-OSS / API** | ~5,700+ | 10–12 | ~5,700 companies | Current point-in-time snapshot | 0 (no time series) | None | N/A | High for context matching; unsuited for ML | **CONTEXT ONLY** |
| **TrustMRR API** | 10,036 | 12–15 | 10,036 startups | Current point-in-time snapshot | 0 (no time series) | None | N/A | High for runtime MRR benchmark; unsuited for ML | **CONTEXT ONLY** |

---

## 7. XGBoost Feasibility Analysis

### 7.1 MODEL 1: Business Forecasting & Churn Prediction (RavenStack)

| Dimension | XGBoost Assessment |
| :--- | :--- |
| **Candidate Estimators** | `XGBRegressor` (for Next-Month MRR) and `XGBClassifier` (for Churn/Contraction Event) |
| **Usable Sample Count** | **4,619 samples** for MRR regression; **5,307 samples** for churn classification |
| **Feature Dimensionality** | 16–18 engineered features (MRR, subscriptions, seats, usage, errors, tickets, resolution time, tenure) |
| **Sample-to-Feature Ratio** | $\approx 256:1$ (substantially above the recommended 20:1 minimum) |
| **Class Imbalance** | Churn Event: 9.38% positive class (498 positive vs 4,809 negative). Easily balanced using `scale_pos_weight ≈ 9.6`. |
| **Overfitting Risk** | Low to moderate. Controlled via `max_depth = 4`, `subsample = 0.8`, `colsample_bytree = 0.8`, and GroupKFold cross-validation. |
| **Temporal Leakage Protection**| Train on Months 1–18 (2023-01 to 2024-06: ~3,400 samples); Test on Months 19–24 (2024-07 to 2024-12: ~1,200 samples). |
| **Required Baselines** | **Naive Persistence**: $\widehat{MRR}_{t+1} = MRR_t$ (autocorrelation is 0.9435; XGBoost must beat naive RMSE on $\Delta MRR$).<br>**DummyClassifier**: Prior churn rate (9.38%). |

### 7.2 MODEL 2: Startup Survival / Risk Classification (Startup Survival)

| Dimension | XGBoost Assessment |
| :--- | :--- |
| **Candidate Estimator** | `XGBClassifier` |
| **Usable Sample Count** | **48,000 samples** |
| **Feature Dimensionality** | 16 features (Stage 0 Day-0 model); 22 features (Stage 1 Post-Validation model) |
| **Sample-to-Feature Ratio** | $\approx 2,180:1$ (exceptional statistical power) |
| **Class Balance** | 65.81% failed vs 34.19% survived. Natural, realistic balance requiring no synthetic resampling. |
| **Overfitting Risk** | Very low. The extensive sample size (48k) easily accommodates gradient boosted tree learning. |
| **Required Baselines** | **DummyClassifier**: Always predicts majority class `failed = 1` (Base Accuracy: 65.81%).<br>**LogisticRegression**: Standard L2-penalized baseline. |

---

## 8. Summary of Validation Decisions

1. **RavenStack is Approved for Model 1 Training**:
   - Replaces the rejected SaaS Business Metrics dataset.
   - Panel yields 4,619 regression samples and 5,307 classification samples.
   - Primary regression target: **Next-Month MRR ($MRR_{t+1}$)**.
   - Primary classification target: **Next-Month Churn/Contraction Event**.

2. **Startup & Founder Survival is Approved for Model 2 Training**:
   - Replaces the 66k Crunchbase dataset as primary risk model.
   - Yields 48,000 training observations with 16–22 safe features.
   - Explicitly purged of `years_to_outcome` and `failure_reason`.

3. **External Context Stack Clarified**:
   - YC-OSS and TrustMRR are verified as runtime context and benchmarking integrations, not training datasets.
   - 66k Crunchbase dataset retained strictly as an out-of-distribution validation check.
