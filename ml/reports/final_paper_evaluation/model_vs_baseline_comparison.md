# Model vs. Baseline Comparison Tables (Research Paper Ready)

## Model 1A: Next-Month MRR Regression
- **Dataset**: RavenStack SaaS Subscription Analytics (Out-of-time test split: 2024-07 to 2024-12, N = 2,070)
- **Target**: `next_month_mrr` (USD)

| Model | RMSE ($) | MAE ($) | MAPE (%) | R² | Directional Accuracy (%) |
|---|---|---|---|---|---|
| Naive Persistence | $5,804.14 | $2,681.17 | 19.05% | 0.8470 | 42.66% |
| Ridge Regression | $5,255.17 | $2,748.66 | 28.15% | 0.8745 | 47.83% |
| **XGBRegressor (Primary)** | **$6,748.16** | **$3,499.79** | **37.88%** | **0.7931** | **47.10%** |

*Empirical Note*: Due to high month-to-month autoregression, Naive Persistence achieves the lowest raw MAE ($2,681.17) and Ridge achieves lowest RMSE ($5,255.17, R² = 0.8745). In production serving, Cofoundr OS uses a hybrid formulation preserving current MRR baseline and applying model-predicted deltas for counterfactual simulations.

---

## Model 1B: Churn / Contraction Event Classification
- **Dataset**: RavenStack SaaS Subscription Analytics (Out-of-time test split: 2024-07 to 2024-12, N = 2,123)
- **Target**: `target_churn_event_t1` (Base rate: 12.95%)

| Model | ROC-AUC | PR-AUC | Precision | Recall | F1 Score | Brier Score |
|---|---|---|---|---|---|---|
| Dummy (Prior Class) | 0.5000 | 0.1295 | 0.0000 | 0.0000 | 0.0000 | 0.1163 |
| Logistic Regression (Balanced) | 0.6247 | 0.2003 | 0.1820 | 0.6255 | 0.2820 | 0.2316 |
| **XGBClassifier (Primary)** | **0.5583** | **0.1708** | **0.2114** | **0.0945** | **0.1307** | **0.1311** |

---

## Model 2: Startup Survival Risk (Stage 0 Day-0 Founding)
- **Dataset**: Startup Survival Master Dataset (Held-out stratified 20% split, N = 9,600)
- **Target**: `failed` (Base failure rate: 65.80%)
- **Data Governance**: Strict exclusion of post-hoc leakage variables (`years_to_outcome`, `failure_reason`, `total_raised_usd`).

| Model | Accuracy | Precision | Recall | F1 Score | ROC-AUC | PR-AUC | Brier Score |
|---|---|---|---|---|---|---|---|
| Dummy (Majority Class) | 0.6580 | 0.6580 | 1.0000 | 0.7937 | 0.5000 | 0.6580 | 0.2250 |
| Logistic Regression (Balanced) | 0.6181 | 0.7700 | 0.5984 | 0.6734 | 0.6774 | 0.7974 | 0.2265 |
| Random Forest (Balanced) | 0.6256 | 0.7708 | 0.6134 | 0.6832 | 0.6811 | 0.8001 | 0.2235 |
| **XGBClassifier (Primary)** | **0.6813** | **0.7049** | **0.8868** | **0.7855** | **0.6821** | **0.8020** | **0.2044** |
