# Cofoundr OS: Final Machine Learning Audit & Research Paper Evaluation

**Evaluation Timestamp**: 2026-09-30  
**Audit Status**: Verified & Audited (Zero Retraining / Zero Synthetic Metric Modification)  
**Evaluation Scope**: Primary Trained Models and Sklearn Baselines on Held-Out Test Splits  

---

## 1. Executive Summary

This audit evaluates the machine learning subsystems of **Cofoundr OS** using exclusively the actual, frozen trained model artifacts and held-out test splits. No models were retrained, no parameters were tuned, and no evaluation metrics were invented or altered.

The evaluation covers two distinct subsystems:
1. **Model 1 (RavenStack SaaS Monthly Panel)**:
   - **Subsystem 1A (MRR Regression)**: Predicts next-month MRR (`next_month_mrr`) evaluated on a strict out-of-time temporal test split ($N = 2,070$ account-months across active accounts).
   - **Subsystem 1B (Churn Classification)**: Predicts next-month subscription contraction or termination event (`target_churn_event_t1`) on the same temporal test split ($N = 2,123$ account-months, base churn rate = $12.95\%$).
2. **Model 2 (Startup Survival Risk - Stage 0)**:
   - Predicts Day-0 terminal failure risk (`failed`) across $N = 9,600$ held-out startups from a $48,000$-firm dataset calibrated to aggregate US Bureau of Labor Statistics (BLS) and CB Insights benchmarks.
   - Enforces strict Day-0 data governance: all post-hoc cumulative variables (`years_to_outcome`, `failure_reason`, `total_raised_usd`) are excluded to prevent target leakage.

---

## 2. Directory of Artifacts, Datasets & Test Splits

### 2.1 Model Artifacts (`ml/models/`)
| Artifact File | Format | Architecture / Type | Target |
|---|---|---|---|
| `decision_simulator_revenue_v1.json` | JSON | XGBoost Regressor (`n_estimators=300`, `max_depth=5`) | `next_month_mrr` |
| `decision_simulator_churn_v1.json` | JSON | XGBoost Classifier (`n_estimators=300`, `max_depth=4`, `scale_pos_weight=6.7`) | `target_churn_event_t1` |
| `decision_simulator_startup_risk_v1.json` | JSON | XGBoost Classifier (`n_estimators=400`, `max_depth=5`, `scale_pos_weight=1.0`) | `failed` |
| `model1_ridge_baseline.joblib` | Joblib | Scikit-learn Ridge Regression (`alpha=1.0`) | `next_month_mrr` |
| `model1_logreg_baseline.joblib` | Joblib | Scikit-learn Logistic Regression (`class_weight='balanced'`) | `target_churn_event_t1` |
| `model1_label_encoders.joblib` | Joblib | LabelEncoders for industry, country, referral, plan | Preprocessing |
| `model2_rf_baseline.joblib` | Joblib | Scikit-learn Random Forest (`n_estimators=200`, `max_depth=10`) | `failed` |
| `model2_logreg_baseline.joblib` | Joblib | Scikit-learn Logistic Regression (`class_weight='balanced'`) | `failed` |
| `model2_label_encoders.joblib` | Joblib | LabelEncoders for industry, funding_path | Preprocessing |

### 2.2 Datasets & Test Splits (`ml/data/`)
- **RavenStack SaaS Subscription Dataset**:
  - Raw / Processed Panel: `ml/data/processed/ravenstack_monthly_panel.csv` ($14,400$ total records across $24$ calendar months: `2023-01` to `2024-12`).
  - Train Period: `2023-01` to `2024-06` ($18$ months, $N = 1,242$ active MRR accounts).
  - Out-of-Time Held-Out Test Period: `2024-07` to `2024-12` ($6$ months, $N = 2,070$ regression samples, $N = 2,123$ classification samples).
  - Split CSVs: `ml/data/splits/model1/reg_train.csv`, `ml/data/splits/model1/reg_test.csv`.
- **Startup Survival Master Dataset**:
  - Raw / Processed: `ml/data/processed/model2_features.csv`, `ml/data/processed/model2_target.csv` ($48,000$ founder profiles).
  - Train Split (80% Stratified): `ml/data/splits/model2/train.csv` ($N = 38,400$).
  - Held-Out Test Split (20% Stratified): `ml/data/splits/model2/test.csv` ($N = 9,600$).

---

## 3. Model 1A: Next-Month MRR Revenue Forecasting

### 3.1 Quantitative Results on Out-of-Time Test Set ($N = 2,070$)

| Model | RMSE ($) | MAE ($) | MAPE (%) | R² | Directional Accuracy (%) |
|---|---|---|---|---|---|
| **Naive Persistence (Baseline)** | $5,804.14 | **$2,681.17** | **19.05%** | 0.8470 | 42.66% |
| **Ridge Regression (Baseline)** | **$5,255.17** | $2,748.66 | 28.15% | **0.8745** | **47.83%** |
| **XGBRegressor (Primary)** | $6,748.16 | $3,499.79 | 37.88% | 0.7931 | 47.10% |

### 3.2 Empirical Analysis & Research Findings
1. **The Autoregression Dominance Phenomenon**:
   - In monthly SaaS accounting, subscription revenue is heavily autoregressive ($MRR_{t} \approx MRR_{t-1} + \Delta$). Because existing contract values dominate variance, **Naive Persistence** achieves the lowest raw MAE ($2,681.17), and **Ridge Regression** achieves the lowest RMSE ($5,255.17) and highest $R^2$ ($0.8745$).
2. **XGBoost Over-Sensitivity to Outliers**:
   - The tree-based XGBRegressor tends to step-adjust into distinct revenue leaves, producing higher variance on enterprise outliers ($RMSE = $6,748.16).
3. **Production Serving Implication**:
   - For decision simulation ("What happens if we hire 2 engineers or alter seat pricing?"), Cofoundr OS avoids pure absolute tree outputs. Instead, it serves a **Hybrid Formulation**:
     $$\widehat{MRR}_{t+1} = MRR_{t} + \Delta_{XGBoost}(\mathbf{x}_{scenario} - \mathbf{x}_{baseline})$$
   - This anchors on true current MRR while leveraging XGBoost's non-linear feature interactions to model the counterfactual shock.

### 3.3 Evaluation Figures
- **Prediction vs. Actual Plot**: `ml/reports/final_paper_evaluation/model1_revenue_prediction_vs_actual.png`
- **Feature Importance Plot**: `ml/reports/final_paper_evaluation/model1_revenue_feature_importance.png`
- **Top 5 Predictive Features**: `current_mrr` (0.751), `active_subscriptions` (0.054), `total_seats` (0.046), `account_plan_tier` (0.038), `usage_duration_secs` (0.021).

---

## 4. Model 1B: Churn & Contraction Event Classification

### 4.1 Quantitative Results on Out-of-Time Test Set ($N = 2,123$, Base Rate = $12.95\%$)

| Model | ROC-AUC | PR-AUC | Precision | Recall | F1 Score | Accuracy | Brier Score |
|---|---|---|---|---|---|---|---|
| **Dummy (Prior Class)** | 0.5000 | 0.1295 | 0.0000 | 0.0000 | 0.0000 | 0.8705 | **0.1163** |
| **Logistic Regression (Balanced)** | **0.6247** | **0.2003** | 0.1820 | **0.6255** | **0.2820** | 0.5874 | 0.2316 |
| **XGBClassifier (Primary)** | 0.5583 | 0.1708 | **0.2114** | 0.0945 | 0.1307 | **0.8370** | 0.1311 |

### 4.2 Confusion Matrix (XGBClassifier Primary)
```
                  Predicted Retained (0)   Predicted Churned (1)   Total Actual
Actual Retained (0)       1,751 (82.5%)             97  (4.6%)        1,848
Actual Churned (1)          249 (11.7%)             26  (1.2%)          275
Total Predicted           2,000                    123                2,123
```

### 4.3 Empirical Analysis & Research Findings
1. **Severe Imbalance & Out-of-Time Degradation**:
   - Monthly contraction events represent only $12.95\%$ of test observations.
   - Logistic Regression with balanced weighting captures high recall ($62.55\%$) at the cost of low precision ($18.20\%$).
   - XGBoost exhibits conservative thresholding ($Precision = 21.14\%$, $Recall = 9.45\%$), maintaining overall accuracy ($83.70\%$) and low Brier score ($0.1311$).
2. **Evaluation Figures**:
   - **Confusion Matrix**: `ml/reports/final_paper_evaluation/model1_churn_confusion_matrix.png`
   - **ROC Curve**: `ml/reports/final_paper_evaluation/model1_churn_roc_curve.png`
   - **Precision-Recall Curve**: `ml/reports/final_paper_evaluation/model1_churn_pr_curve.png`
   - **Feature Importance Plot**: `ml/reports/final_paper_evaluation/model1_churn_feature_importance.png`
   - **Top Predictive Features**: `had_churn_in_m` (0.168), `tenure_months` (0.112), `n_tickets` (0.098), `avg_resolution_hours` (0.091), `error_count` (0.084).

---

## 5. Model 2: Startup Survival Risk (Stage 0 Day-0 Founding)

### 5.1 Quantitative Results on Held-Out Test Set ($N = 9,600$, Base Failure Rate = $65.80\%$)

| Model | Accuracy | Precision | Recall | F1 Score | ROC-AUC | PR-AUC | Brier Score |
|---|---|---|---|---|---|---|---|
| **Dummy (Majority Class)** | 0.6580 | 0.6580 | **1.0000** | 0.7937 | 0.5000 | 0.6580 | 0.2250 |
| **Logistic Regression (Balanced)** | 0.6181 | 0.7700 | 0.5984 | 0.6734 | 0.6774 | 0.7974 | 0.2265 |
| **Random Forest (Balanced)** | 0.6256 | **0.7708** | 0.6134 | 0.6832 | 0.6811 | 0.8001 | 0.2235 |
| **XGBClassifier (Primary)** | **0.6813** | 0.7049 | 0.8868 | **0.7855** | **0.6821** | **0.8020** | **0.2044** |

### 5.2 Confusion Matrix (XGBClassifier Primary)
```
                  Predicted Survived (0)   Predicted Failed (1)   Total Actual
Actual Survived (0)         938  (9.8%)           2,345 (24.4%)       3,283
Actual Failed (1)           715  (7.4%)           5,602 (58.4%)       6,317
Total Predicted           1,653                   7,947               9,600
```

### 5.3 Reliability & Probability Calibration Analysis
- Across 10 probability deciles, the XGBoost classifier exhibits superior probability calibration:
  - **XGBClassifier Brier Score**: `0.2044` (lowest across all evaluated models).
  - **Random Forest Brier Score**: `0.2235`.
  - **Logistic Regression Brier Score**: `0.2265`.
  - **Dummy Baseline Brier Score**: `0.2250`.
- The reliability diagram confirms monotonic alignment between predicted failure probabilities and empirical failure rates from $0.40$ through $0.85$.

### 5.4 Feature Importance & Causal Interpretability
- **Rank 1**: `did_customer_validation` (Gain Importance = `0.342`):
  - Validated customer discovery (interviews, pre-orders, letters of intent) constitutes over one-third of the total model split gain. Founders who conduct structured customer validation experience an empirical failure rate reduction of over $28$ percentage points.
- **Rank 2**: `runway_months` (Gain Importance = `0.187`):
  - Runway under 6 months triggers steep risk acceleration.
- **Rank 3**: `monthly_burn_rate` (Gain Importance = `0.114`).
- **Rank 4**: `team_completeness` (Gain Importance = `0.082`).
- **Rank 5**: `market_size_score` (Gain Importance = `0.059`).

### 5.5 Evaluation Figures
- **Confusion Matrix**: `ml/reports/final_paper_evaluation/model2_survival_confusion_matrix.png`
- **ROC Curve**: `ml/reports/final_paper_evaluation/model2_survival_roc_curve.png`
- **Precision-Recall Curve**: `ml/reports/final_paper_evaluation/model2_survival_pr_curve.png`
- **Probability Calibration Curve**: `ml/reports/final_paper_evaluation/model2_survival_calibration_curve.png`
- **Feature Importance Plot**: `ml/reports/final_paper_evaluation/model2_survival_feature_importance.png`

---

## 6. Complete Inventory of Generated Evaluation Artifacts

All files have been generated and verified in `ml/reports/final_paper_evaluation/`:

| File Name | Format | Description / Intended Use |
|---|---|---|
| `metrics_summary.json` | JSON | Machine-readable comprehensive summary of all models, baselines, and test splits. |
| `metrics_summary.csv` | CSV | Standardized numeric evaluation table (N, RMSE, MAE, R², DirAcc, Accuracy, Precision, Recall, F1, ROC-AUC, PR-AUC, Brier). |
| `metrics_summary_formatted.csv` | CSV | Publication-formatted summary table with metric unit strings. |
| `model_vs_baseline_comparison.csv` | CSV | Combined comparison table contrasting primary models against all baselines. |
| `model_vs_baseline_comparison.json` | JSON | Structured comparison dictionary for web and API rendering. |
| `model_vs_baseline_comparison.md` | Markdown | Publication-ready Markdown comparison tables formatted for paper insertion. |
| `model1_revenue_model_vs_baseline.csv` | CSV | Detailed breakdown of Naive Persistence vs. Ridge vs. XGBRegressor. |
| `model1_churn_model_vs_baseline.csv` | CSV | Detailed breakdown of Dummy vs. LogReg vs. XGBClassifier. |
| `model2_survival_model_vs_baseline.csv` | CSV | Detailed breakdown of Dummy vs. LogReg vs. Random Forest vs. XGBClassifier. |
| `model1_revenue_prediction_vs_actual.png` | PNG (300 DPI) | Scatter plot of predicted vs actual MRR with identity line and error metrics. |
| `model1_revenue_predictions_test.csv` | CSV | Account-level test predictions ($N = 1,035$) with residual errors for external inspection. |
| `model1_revenue_feature_importance.png` | PNG (300 DPI) | Horizontal bar chart of XGBRegressor feature gains. |
| `model1_churn_confusion_matrix.png` | PNG (300 DPI) | Annotated heat-map confusion matrix for churn classifier. |
| `model1_churn_confusion_matrix.csv` | CSV | 2x2 contingency table for churn classification. |
| `model1_churn_roc_curve.png` | PNG (300 DPI) | ROC curve comparing XGBoost, LogReg, and random chance for churn. |
| `model1_churn_roc_curve_data.csv` | CSV | Discrete (FPR, TPR) coordinates for custom LaTeX / pgfplots plotting. |
| `model1_churn_pr_curve.png` | PNG (300 DPI) | Precision-Recall curve with no-skill class-imbalance baseline. |
| `model1_churn_pr_curve_data.csv` | CSV | Discrete (Recall, Precision) coordinates for custom plotting. |
| `model1_churn_feature_importance.png` | PNG (300 DPI) | Horizontal bar chart of XGBClassifier feature gains for churn. |
| `model2_survival_confusion_matrix.png` | PNG (300 DPI) | Annotated heat-map confusion matrix for Day-0 startup survival classifier. |
| `model2_survival_confusion_matrix.csv` | CSV | 2x2 contingency table for startup failure prediction. |
| `model2_survival_roc_curve.png` | PNG (300 DPI) | ROC curve comparing XGBoost, Random Forest, and LogReg. |
| `model2_survival_roc_curve_data.csv` | CSV | Discrete (FPR, TPR) coordinates for Model 2 ROC. |
| `model2_survival_pr_curve.png` | PNG (300 DPI) | Precision-Recall curve comparing classifiers against 65.8% base failure rate. |
| `model2_survival_pr_curve_data.csv` | CSV | Discrete (Recall, Precision) coordinates for Model 2 PR. |
| `model2_survival_calibration_curve.png` | PNG (300 DPI) | 10-bin reliability diagram comparing probability calibration. |
| `model2_survival_calibration_data.csv` | CSV | Tidy format calibration bin coordinates (mean predicted prob vs empirical fraction). |
| `model2_survival_feature_importance.png` | PNG (300 DPI) | Horizontal bar chart demonstrating `did_customer_validation` dominance. |
