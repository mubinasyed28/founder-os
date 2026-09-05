# Machine Learning Model & Feature Specification Report

**Location**: `ml/reports/model_feature_specification.md`  
**Date**: September 5, 2026  
**Status**: Completed Design — Awaiting User Approval  

---

## Executive Summary

Based on the empirical findings from the complete data audit (`ml/reports/dataset_audit.md`), this document defines the formal Machine Learning specification and feature engineering design for two distinct models:

1. **MODEL 1 (XGBoost Regression)**: Predicts next-period monthly recurring revenue ($\text{MRR}_{t+1}$) for a SaaS business using a monthly business-state panel reconstructed strictly from `customers.csv`.
2. **MODEL 2 (XGBoost Classification)**: Predicts startup exit outcome / failure risk (`is_exit_success`: $1 =$ Acquired/IPO, $0 =$ Closed) using early-stage context features from `big_startup_secsees_dataset.csv`.

---

## Part 1: Model 1 — SaaS Next-Period MRR Regression

### 1.1 Business Objective & Prediction Setup
- **Goal**: Forecast next month's total Monthly Recurring Revenue ($\text{MRR}_{t+1}$) from current and historical monthly business states.
- **Unit of Observation**: A single calendar month $t$ (e.g., `2024-01`, `2024-02`, ..., `2025-05`).
- **Prediction Horizon**: 1 month ahead ($t \to t+1$).
- **Primary Data Source**: `customers.csv` (Reconstructed monthly customer panel).
  - *Data Source Justification*: `subscriptions.csv` is redundant with `revenue.csv`. `revenue.csv` suffers from 83.2% data truncation (only contains logs for 168 churned accounts). Reconstructing the panel from `customers.csv` ($\text{signup\_date} \le t < \text{churn\_date}$) recovers the full 1,000 customer history without survivor bias.

---

### 1.2 Model 1 Detailed Feature Specification Table

| Feature Name | Source Column(s) | Definition | Data Type | Why Useful | Potential Leakage? | Included? | Transformation Required |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `active_customers_t` | `customers.csv` (`signup_date`, `churn_date`) | Count of active customers at month $t$ | `int64` | Primary driver of recurring revenue scale | No (Known at end of month $t$) | **YES** | None |
| `total_mrr_t` | `customers.csv` (`monthly_fee`, `signup_date`, `churn_date`) | Sum of `monthly_fee` across active accounts in month $t$ | `float64` | Current revenue baseline | No (Current state) | **YES** | Numeric scale ($) |
| `arpu_t` | `total_mrr_t`, `active_customers_t` | Average Revenue Per User ($\text{MRR}_t / N_t$) | `float64` | Measures average contract value per customer | No | **YES** | Division |
| `mrr_growth_lag1` | `total_mrr_t`, `total_mrr_{t-1}` | Absolute MRR delta ($\text{MRR}_t - \text{MRR}_{t-1}$) | `float64` | Captures revenue momentum and direction | No (Uses $t-1$ and $t$) | **YES** | Lag 1 difference |
| `mrr_growth_pct_lag1` | `total_mrr_t`, `total_mrr_{t-1}` | Percentage MRR growth ($(\text{MRR}_t - \text{MRR}_{t-1}) / \text{MRR}_{t-1}$) | `float64` | Relative expansion rate | No | **YES** | Percentage change, fillna(0) |
| `churn_count_t` | `customers.csv` (`churn_date`) | Number of customers who churned in month $t$ | `int64` | Measures monthly account loss volume | No (Observed in month $t$) | **YES** | None |
| `churn_rate_t` | `churn_count_t`, `active_customers_{t-1}` | Churn rate percentage ($\text{Churn}_t / N_{t-1} \times 100$) | `float64` | Core retention metric | No | **YES** | Division by lagged active count |
| `new_signups_t` | `customers.csv` (`signup_date`) | Number of new customers acquired in month $t$ | `int64` | Acquisition velocity | No | **YES** | Monthly count |
| `monthly_cac_t` | `customers.csv` (`acquisition_cost`, `signup_date`) | Total CAC spent on new signups in month $t$ | `float64` | Quantifies growth capital expenditure | No | **YES** | Sum of `acquisition_cost` for signups in $t$ |
| `basic_pct_t` | `customers.csv` (`plan_type`) | % of active customers on Basic plan ($50/mo) | `float64` | Plan distribution tier balance | No | **YES** | Value count / active count |
| `pro_pct_t` | `customers.csv` (`plan_type`) | % of active customers on Pro plan ($200/mo) | `float64` | Plan distribution tier balance | No | **YES** | Value count / active count |
| `enterprise_pct_t` | `customers.csv` (`plan_type`) | % of active customers on Enterprise plan ($500/mo) | `float64` | Plan distribution tier balance | No | **YES** | Value count / active count |
| `cumulative_cac_t` | `monthly_cac_t` | Cumulative CAC expenditure up to month $t$ | `float64` | Total acquisition investment history | No | **YES** | Cumulative sum |
| `ltv_est_t` | `arpu_t`, `churn_rate_t` | Estimated Customer Lifetime Value ($\text{ARPU}_t / \text{ChurnRate}_t$) | `float64` | Long-term customer value proxy | No | **YES** | Safe division (clip churn rate min 0.01) |

---

### 1.3 Target Variable Definition (Model 1)
- **Target Feature ($y$)**: `next_month_mrr` ($\text{MRR}_{t+1}$)
- **Definition**: Total sum of monthly subscription fees across all active customers in month $t+1$.
- **Leakage Prevention**: Features $X_t$ use data available strictly on or before the last day of month $t$. `next_month_mrr` is shifted by $-1$ period relative to $X_t$.

---

### 1.4 Model 1 Training & Validation Strategy
- **Total Panel Samples**: 18 calendar months (`2024-01` to `2025-06`).
- **Valid Supervised Pairs ($X_t \to y_{t+1}$)**: 17 months (`2024-01` through `2025-05`). Month `2025-06` lacks a $t+1$ target.
- **Split Protocol**: Expanding Temporal Split (Time-Series Split)
  - **Train Set**: Months `2024-01` to `2024-12` (12 months).
  - **Validation / Test Set**: Months `2025-01` to `2025-05` (5 months).
  - *No Random K-Fold Split*: Standard random K-fold is strictly prohibited for time-series data to avoid look-ahead data leakage across temporal boundaries.

---

## Part 2: Model 2 — Startup Success/Failure Classification

### 2.1 Business Objective & Prediction Setup
- **Goal**: Predict the ultimate success or failure outcome of a startup (`is_exit_success`) to provide a risk assessment signal in the Decision Simulator.
- **Unit of Observation**: A single startup organization (one row per company).
- **Primary Data Source**: `big_startup_secsees_dataset.csv` (66,368 total rows).

---

### 2.2 Target Formulation & Leakage Control
- **Target Variable ($y$)**: `is_exit_success`
  - $1 =$ Exit Success (`acquired` [5,549] or `ipo` [1,547] $\rightarrow$ 7,096 total / 53.22%)
  - $0 =$ Closed / Failed (`closed` [6,238] $\rightarrow$ 6,238 total / 46.78%)
  - **Sample Size**: 13,334 terminal companies.
- **Treatment of `operating` Companies (53,034 rows / 79.91%)**:
  - `operating` companies are **excluded from binary terminal classification training**.
  - *Justification*: Operating startups are right-censored active entities that have neither achieved a terminal exit nor closed down. Labeling operating startups as failures or successes introduces severe class noise and misclassification bias.

---

### 2.3 Model 2 Detailed Feature Specification Table

| Feature Name | Source Column(s) | Definition | Data Type | Why Useful | Potential Leakage? | Included? | Transformation Required |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `primary_category` | `category_list` | Top/first industry category extracted from pipe list | `string` | Strong baseline sector risk signal (Software vs Biotech vs Retail) | No (Static domain) | **YES** | Extract first element, Frequency / Target Encoding |
| `country_code` | `country_code` | ISO 3-letter country code of startup HQ | `string` | Captures geographic ecosystem capital availability | No (Static HQ) | **YES** | One-Hot Encoding (Top 15 countries + 'Other') |
| `state_code` | `state_code` | US/Regional state code | `string` | Micro-location signal (e.g. CA, NY, MA) | No | **YES** | One-Hot Encoding for top US states |
| `days_to_first_funding` | `first_funding_at`, `founded_at` | Days elapsed between founding date and first funding date | `float64` | Measures early execution velocity & investor traction speed | No (Early event) | **YES** | $\text{first\_funding} - \text{founded}$; clip negative outliers to 0 |
| `founded_year` | `founded_at` | Calendar year startup was founded | `int64` | Controls for macroeconomic funding vintage / macro cycle | No | **YES** | Extract year from date string |
| `is_funded_at_founding` | `days_to_first_funding` | Binary flag ($1$ if first funding within 90 days of founding) | `int64` | Signals immediate institutional backing at inception | No | **YES** | Boolean check ($\le 90$ days) |
| `has_homepage` | `homepage_url` | Binary flag ($1$ if valid website URL present) | `int64` | Web presence indicator | No | **YES** | Non-null check |
| `category_count` | `category_list` | Number of listed industry tags | `int64` | Proxies business scope multi-segment breadth | No | **YES** | Count pipe separators $+ 1$ |
| `last_funding_at` | `last_funding_at` | Date of last funding round | `string` | Date of final round | **HIGH LEAKAGE** (Aggregates post-outcome date) | **NO** | **EXCLUDED** |
| `funding_total_usd` | `funding_total_usd` | Cumulative USD funding raised over lifetime | `string` | Lifetime capital raised | **HIGH LEAKAGE** (Accumulates lifetime funding post-founding) | **NO** | **EXCLUDED** |
| `funding_rounds` | `funding_rounds` | Cumulative number of funding rounds raised | `int64` | Lifetime rounds count | **HIGH LEAKAGE** (Accumulates post-exit funding iterations) | **NO** | **EXCLUDED** |

---

### 2.4 Model 2 Training & Validation Strategy
- **Sample Population**: 13,334 terminal outcome startups (`target` $1: 7,096$, $0: 6,238$).
- **Class Balance**: 53.22% Success, 46.78% Closed (Well-balanced).
- **Split Protocol**:
  - **Stratified 80/20 Train/Test Split**: 10,667 train samples, 2,667 test samples.
  - **5-Fold Stratified Cross-Validation** on training set for hyperparameter tuning.
- **Evaluation Metrics**: ROC-AUC, PR-AUC, F1-Score, Confusion Matrix.

---

## Part 3: Features NOT Supported by Available Data

The following features are theoretically desirable for startup decision modeling but **MUST NOT** be included because the raw datasets cannot support them reliably:

| Theoretically Possible Feature | Why Desirable | Why Unsupported / Excluded |
| :--- | :--- | :--- |
| **Product Usage & Engagement Metrics** (DAU/MAU, feature adoption, session length) | Strongest predictor of customer churn and expansion | Completely absent from raw SaaS datasets (`customers.csv` only contains billing metadata). |
| **Customer Support Ticket Volume & CSAT** | Early indicator of customer dissatisfaction | No support ticket logs exist in the repository. |
| **Granular Funding Round Series Breakdown** (Seed $, Series A $, Series B $) | Allows modeling funding trajectory without lifetime leakage | Dataset provides only a single aggregate `funding_total_usd` string, lacking per-round timestamps. |
| **Operating Expenses / Burn Rate / Payroll** | Required for exact net cash flow and runway calculation | SaaS dataset provides revenue (`monthly_fee`) and CAC (`acquisition_cost`), but zero OPEX/COGS data. |
| **Founder Background / Education / Past Exits** | Significant determinant of early venture success | No founder attributes or team composition metrics exist in Crunchbase raw export. |
| **Customer Contraction / Expansion Revenue (Net MRR Retention)** | Differentiates plan upgrades vs down-sells | `customers.csv` records a single static `plan_type` per customer; plan change events are not tracked. |

---

## Part 4: Preprocessing & Engineering Workflow Summary

```
                      +---------------------------------------+
                      |         RAW DATASET AUDIT             |
                      +---------------------------------------+
                                          |
                   +----------------------+----------------------+
                   |                                             |
                   v                                             v
+------------------------------------+         +------------------------------------+
|        MODEL 1 PREPROCESSING       |         |        MODEL 2 PREPROCESSING       |
|          (customers.csv)           |         | (big_startup_secsees_dataset.csv)  |
+------------------------------------+         +------------------------------------+
| 1. Reconstruct monthly panel       |         | 1. Filter terminal status          |
|    (signup_date <= t < churn_date) |         |    (acquired/ipo = 1, closed = 0)  |
| 2. Aggregate monthly X_t features  |         | 2. Parse clean founded_at dates   |
| 3. Create 1-month shifted target   |         | 3. Compute days_to_first_funding   |
|    y_{t+1} = next_month_mrr        |         | 4. Encode category & country codes |
| 4. Temporal Train/Val Split        |         | 5. Stratified Train/Test Split     |
+------------------------------------+         +------------------------------------+
```

---

## Summary of Exact Design Outputs

| Model | Algorithm | Exact Target ($y$) | Sample Count | Primary Predictors ($X$) | Validation Method |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **MODEL 1** | XGBoost / Ridge Regression | `next_month_mrr` ($MRR_{t+1}$) | 17 monthly panel transitions | `active_customers`, `total_mrr`, `arpu`, `mrr_growth_lag1`, `churn_rate`, `monthly_cac`, `plan_mix_%` | Expanding Time-Series Split (2024 train / 2025 val) |
| **MODEL 2** | XGBoost Classifier | `is_exit_success` (1 / 0) | 13,334 terminal startups | `primary_category`, `country_code`, `state_code`, `days_to_first_funding`, `founded_year`, `has_homepage` | Stratified 80/20 Split + 5-Fold Cross-Validation |

---

*Feature Specification Document produced following complete data verification. Awaiting user approval prior to executing preprocessing scripts.*
