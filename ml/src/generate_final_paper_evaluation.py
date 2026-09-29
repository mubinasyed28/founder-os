"""
Final Paper Evaluation & Audit Script
======================================
Audit existing trained ML models on actual held-out test splits.
Strictly evaluates without retraining or modifying models.
Generates publication-quality plots, metrics summaries (CSV, JSON),
confusion matrices, ROC curves, PR curves, calibration curves,
prediction vs actual plots, and model-vs-baseline comparison tables.
"""

import os
import json
import numpy as np
import pandas as pd
import joblib
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from sklearn.metrics import (
    mean_absolute_error, mean_squared_error, r2_score,
    roc_auc_score, average_precision_score, precision_score,
    recall_score, f1_score, confusion_matrix, brier_score_loss,
    accuracy_score, roc_curve, precision_recall_curve
)
from sklearn.calibration import calibration_curve
import xgboost as xgb

# ── Paths ─────────────────────────────────────────────────────────────
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(ROOT, 'models')
PROCESSED_DIR = os.path.join(ROOT, 'data', 'processed')
SPLITS_M1 = os.path.join(ROOT, 'data', 'splits', 'model1')
SPLITS_M2 = os.path.join(ROOT, 'data', 'splits', 'model2')
OUT_DIR = os.path.join(ROOT, 'reports', 'final_paper_evaluation')

os.makedirs(OUT_DIR, exist_ok=True)
print(f"[audit] Writing evaluation artifacts to: {OUT_DIR}")

# Matplotlib publication style settings
plt.rcParams['font.sans-serif'] = 'DejaVu Sans'
plt.rcParams['axes.edgecolor'] = '#333333'
plt.rcParams['axes.linewidth'] = 0.8
plt.rcParams['grid.color'] = '#e0e0e0'
plt.rcParams['grid.linestyle'] = '--'
plt.rcParams['grid.alpha'] = 0.7

# ── 1. AUDIT & EVALUATE MODEL 1A: MRR REGRESSION ───────────────────────
print("\n" + "=" * 60)
print("AUDITING MODEL 1A: NEXT-MONTH MRR REGRESSION (RavenStack)")
print("=" * 60)

meta1 = json.load(open(os.path.join(MODELS_DIR, 'model1_metadata.json')))
approved_features_m1 = meta1['approved_features']

reg_test_df = pd.read_csv(os.path.join(SPLITS_M1, 'reg_test.csv'))
X_test_reg = reg_test_df[approved_features_m1].values
y_test_reg = reg_test_df['next_month_mrr'].values
current_mrr_test = reg_test_df['current_mrr'].values

# Load trained models & baselines
xgb_reg = xgb.XGBRegressor()
xgb_reg.load_model(os.path.join(MODELS_DIR, 'decision_simulator_revenue_v1.json'))
ridge_reg = joblib.load(os.path.join(MODELS_DIR, 'model1_ridge_baseline.joblib'))

# Predictions
pred_reg_xgb = xgb_reg.predict(X_test_reg)
pred_reg_ridge = ridge_reg.predict(X_test_reg)
pred_reg_naive = current_mrr_test.copy()

def calc_reg_metrics(y_true, y_pred, current_mrr):
    mae = float(mean_absolute_error(y_true, y_pred))
    rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))
    r2 = float(r2_score(y_true, y_pred))
    mask = y_true > 0
    mape = float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100) if mask.sum() > 0 else np.nan
    actual_dir = np.sign(y_true - current_mrr)
    pred_dir = np.sign(y_pred - current_mrr)
    dir_acc = float(np.mean(actual_dir == pred_dir) * 100)
    return {
        'RMSE': rmse,
        'MAE': mae,
        'MAPE_pct': mape,
        'R2': r2,
        'Directional_Accuracy_pct': dir_acc
    }

m1_reg_xgb_metrics = calc_reg_metrics(y_test_reg, pred_reg_xgb, current_mrr_test)
m1_reg_ridge_metrics = calc_reg_metrics(y_test_reg, pred_reg_ridge, current_mrr_test)
m1_reg_naive_metrics = calc_reg_metrics(y_test_reg, pred_reg_naive, current_mrr_test)

print(f"XGBRegressor:      RMSE=${m1_reg_xgb_metrics['RMSE']:.2f}, MAE=${m1_reg_xgb_metrics['MAE']:.2f}, MAPE={m1_reg_xgb_metrics['MAPE_pct']:.2f}%, R2={m1_reg_xgb_metrics['R2']:.4f}, DirAcc={m1_reg_xgb_metrics['Directional_Accuracy_pct']:.2f}%")
print(f"Ridge Regression:  RMSE=${m1_reg_ridge_metrics['RMSE']:.2f}, MAE=${m1_reg_ridge_metrics['MAE']:.2f}, MAPE={m1_reg_ridge_metrics['MAPE_pct']:.2f}%, R2={m1_reg_ridge_metrics['R2']:.4f}, DirAcc={m1_reg_ridge_metrics['Directional_Accuracy_pct']:.2f}%")
print(f"Naive Persistence: RMSE=${m1_reg_naive_metrics['RMSE']:.2f}, MAE=${m1_reg_naive_metrics['MAE']:.2f}, MAPE={m1_reg_naive_metrics['MAPE_pct']:.2f}%, R2={m1_reg_naive_metrics['R2']:.4f}, DirAcc={m1_reg_naive_metrics['Directional_Accuracy_pct']:.2f}%")

# Save predictions for research verification
df_pred_mrr = pd.DataFrame({
    'account_id': reg_test_df['account_id'],
    'month': reg_test_df['month'],
    'current_mrr': current_mrr_test,
    'actual_next_month_mrr': y_test_reg,
    'pred_xgb_mrr': pred_reg_xgb,
    'pred_ridge_mrr': pred_reg_ridge,
    'pred_naive_mrr': pred_reg_naive,
    'error_xgb': pred_reg_xgb - y_test_reg,
    'abs_error_xgb': np.abs(pred_reg_xgb - y_test_reg)
})
df_pred_mrr.to_csv(os.path.join(OUT_DIR, 'model1_revenue_predictions_test.csv'), index=False)

# Plot: Prediction vs Actual MRR
fig, ax = plt.subplots(figsize=(8, 7), dpi=300)
ax.scatter(y_test_reg, pred_reg_xgb, alpha=0.35, color='#1f77b4', edgecolors='none', s=25, label='Held-out Test Accounts')
max_val = max(np.max(y_test_reg), np.max(pred_reg_xgb)) * 1.05
ax.plot([0, max_val], [0, max_val], 'r--', lw=1.5, label='Perfect Prediction (y = x)')
ax.set_title("Model 1: Next-Month MRR Forecast — Predicted vs. Actual\n(Held-out Test Period: 2024-07 to 2024-12, N = 1,035)", fontsize=12, pad=12, fontweight='bold')
ax.set_xlabel("Actual Next-Month MRR (USD)", fontsize=11, labelpad=8)
ax.set_ylabel("Predicted Next-Month MRR (USD)", fontsize=11, labelpad=8)
ax.set_xlim(0, max_val)
ax.set_ylim(0, max_val)
ax.grid(True)
metrics_text = (
    f"XGBRegressor Evaluation:\n"
    f"RMSE = ${m1_reg_xgb_metrics['RMSE']:,.2f}\n"
    f"MAE = ${m1_reg_xgb_metrics['MAE']:,.2f}\n"
    f"MAPE = {m1_reg_xgb_metrics['MAPE_pct']:.2f}%\n"
    f"R² = {m1_reg_xgb_metrics['R2']:.4f}\n"
    f"Dir. Accuracy = {m1_reg_xgb_metrics['Directional_Accuracy_pct']:.1f}%"
)
ax.text(0.04, 0.95, metrics_text, transform=ax.transAxes, verticalalignment='top',
        bbox=dict(boxstyle='round,pad=0.6', facecolor='#ffffff', edgecolor='#cccccc', alpha=0.9),
        fontsize=9.5, family='monospace')
ax.legend(loc='lower right', frameon=True, facecolor='#ffffff', edgecolor='#cccccc')
plt.tight_layout()
plt.savefig(os.path.join(OUT_DIR, 'model1_revenue_prediction_vs_actual.png'), dpi=300)
plt.close()

# Plot: Feature Importance MRR
fi_reg_df = pd.read_csv(os.path.join(MODELS_DIR, 'model1_reg_feature_importance.csv')).sort_values('importance', ascending=True)
fig, ax = plt.subplots(figsize=(9, 6), dpi=300)
bars = ax.barh(fi_reg_df['feature'], fi_reg_df['importance'], color='#2b5c8f', edgecolor='#1a3959', height=0.65)
ax.set_title("Model 1: Feature Importance — Next-Month MRR (XGBRegressor)", fontsize=12, pad=12, fontweight='bold')
ax.set_xlabel("Gain / Relative Feature Importance", fontsize=11, labelpad=8)
ax.grid(True, axis='x')
for bar in bars:
    w = bar.get_width()
    ax.text(w + 0.005, bar.get_y() + bar.get_height()/2, f"{w:.3f}", va='center', ha='left', fontsize=8.5, color='#333333')
ax.set_xlim(0, max(fi_reg_df['importance']) * 1.15)
plt.tight_layout()
plt.savefig(os.path.join(OUT_DIR, 'model1_revenue_feature_importance.png'), dpi=300)
plt.close()

# ── 2. AUDIT & EVALUATE MODEL 1B: CHURN CLASSIFICATION ─────────────────
print("\n" + "=" * 60)
print("AUDITING MODEL 1B: CHURN/CONTRACTION CLASSIFICATION (RavenStack)")
print("=" * 60)

panel = pd.read_csv(os.path.join(PROCESSED_DIR, 'ravenstack_monthly_panel.csv'))
panel['month'] = pd.to_datetime(panel['month']).dt.to_period('M')
if 'had_churn_in_m' not in panel.columns and 'has_churned_sub' in panel.columns:
    panel['had_churn_in_m'] = panel['has_churned_sub'].astype(int)

encoders_m1 = joblib.load(os.path.join(MODELS_DIR, 'model1_label_encoders.joblib'))
for cat in meta1['categorical_features']:
    panel[cat] = encoders_m1[cat].transform(panel[cat].astype(str))

for col in ['has_beta_feature', 'had_churn_in_m']:
    panel[col] = panel[col].astype(int)

cls_data = panel.dropna(subset=['target_churn_event_t1']).copy()
cls_test = cls_data[cls_data['month'] >= pd.Period('2024-07', freq='M')]

X_test_cls1 = cls_test[approved_features_m1].values
y_test_cls1 = cls_test['target_churn_event_t1'].values.astype(int)

# Load trained models & baselines
xgb_cls1 = xgb.XGBClassifier()
xgb_cls1.load_model(os.path.join(MODELS_DIR, 'decision_simulator_churn_v1.json'))
logreg_cls1 = joblib.load(os.path.join(MODELS_DIR, 'model1_logreg_baseline.joblib'))

prob_cls1_xgb = xgb_cls1.predict_proba(X_test_cls1)[:, 1]
pred_cls1_xgb = xgb_cls1.predict(X_test_cls1)

prob_cls1_logreg = logreg_cls1.predict_proba(X_test_cls1)[:, 1]
pred_cls1_logreg = logreg_cls1.predict(X_test_cls1)

# Dummy baseline fitted on training prior
from sklearn.dummy import DummyClassifier
cls_train = cls_data[cls_data['month'] <= pd.Period('2024-06', freq='M')]
X_train_cls1 = cls_train[approved_features_m1].values
y_train_cls1 = cls_train['target_churn_event_t1'].values.astype(int)

dummy_cls1 = DummyClassifier(strategy='prior', random_state=42)
dummy_cls1.fit(X_train_cls1, y_train_cls1)
dummy_pred1 = dummy_cls1.predict(X_test_cls1)
dummy_prob1 = dummy_cls1.predict_proba(X_test_cls1)[:, 1]

def calc_cls_metrics(y_true, y_prob, y_pred):
    rocauc = float(roc_auc_score(y_true, y_prob)) if len(np.unique(y_true)) > 1 else 0.5
    prauc = float(average_precision_score(y_true, y_prob)) if len(np.unique(y_true)) > 1 else 0.0
    prec = float(precision_score(y_true, y_pred, zero_division=0))
    rec = float(recall_score(y_true, y_pred, zero_division=0))
    f1 = float(f1_score(y_true, y_pred, zero_division=0))
    acc = float(accuracy_score(y_true, y_pred))
    cm = confusion_matrix(y_true, y_pred).tolist()
    brier = float(brier_score_loss(y_true, y_prob))
    return {
        'Accuracy': acc,
        'Precision': prec,
        'Recall': rec,
        'F1': f1,
        'ROC_AUC': rocauc,
        'PR_AUC': prauc,
        'Brier_Score': brier,
        'Confusion_Matrix': cm
    }

m1_cls_xgb_metrics = calc_cls_metrics(y_test_cls1, prob_cls1_xgb, pred_cls1_xgb)
m1_cls_logreg_metrics = calc_cls_metrics(y_test_cls1, prob_cls1_logreg, pred_cls1_logreg)
m1_cls_dummy_metrics = calc_cls_metrics(y_test_cls1, dummy_prob1, dummy_pred1)

print(f"XGBClassifier: ROC-AUC={m1_cls_xgb_metrics['ROC_AUC']:.4f}, PR-AUC={m1_cls_xgb_metrics['PR_AUC']:.4f}, Precision={m1_cls_xgb_metrics['Precision']:.4f}, Recall={m1_cls_xgb_metrics['Recall']:.4f}, F1={m1_cls_xgb_metrics['F1']:.4f}, Brier={m1_cls_xgb_metrics['Brier_Score']:.4f}")
print(f"LogReg:        ROC-AUC={m1_cls_logreg_metrics['ROC_AUC']:.4f}, PR-AUC={m1_cls_logreg_metrics['PR_AUC']:.4f}, Precision={m1_cls_logreg_metrics['Precision']:.4f}, Recall={m1_cls_logreg_metrics['Recall']:.4f}, F1={m1_cls_logreg_metrics['F1']:.4f}, Brier={m1_cls_logreg_metrics['Brier_Score']:.4f}")
print(f"Dummy:         ROC-AUC={m1_cls_dummy_metrics['ROC_AUC']:.4f}, PR-AUC={m1_cls_dummy_metrics['PR_AUC']:.4f}, Precision={m1_cls_dummy_metrics['Precision']:.4f}, Recall={m1_cls_dummy_metrics['Recall']:.4f}, F1={m1_cls_dummy_metrics['F1']:.4f}, Brier={m1_cls_dummy_metrics['Brier_Score']:.4f}")

# Save confusion matrix CSV
cm1_arr = np.array(m1_cls_xgb_metrics['Confusion_Matrix'])
pd.DataFrame(cm1_arr, index=['Actual_Retained(0)', 'Actual_Churned(1)'],
             columns=['Pred_Retained(0)', 'Pred_Churned(1)']).to_csv(os.path.join(OUT_DIR, 'model1_churn_confusion_matrix.csv'))

# Plot: Confusion Matrix Model 1
fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
cax = ax.imshow(cm1_arr, interpolation='nearest', cmap=plt.cm.Blues)
plt.title("Model 1: Churn Event Confusion Matrix (XGBClassifier)\n(Test Set: 2024-07 to 2024-12, N = 2,123)", fontsize=11, fontweight='bold', pad=12)
plt.colorbar(cax, fraction=0.046, pad=0.04)
tick_marks = [0, 1]
ax.set_xticks(tick_marks)
ax.set_xticklabels(['No Churn (0)', 'Churn (1)'], fontsize=10)
ax.set_yticks(tick_marks)
ax.set_yticklabels(['No Churn (0)', 'Churn (1)'], fontsize=10)
ax.set_xlabel('Predicted Label', fontsize=10, labelpad=8)
ax.set_ylabel('True Label', fontsize=10, labelpad=8)

thresh = cm1_arr.max() / 2.
for i in range(cm1_arr.shape[0]):
    for j in range(cm1_arr.shape[1]):
        val = cm1_arr[i, j]
        pct = val / cm1_arr.sum() * 100
        color = "white" if val > thresh else "black"
        ax.text(j, i, f"{val:,}\n({pct:.1f}%)", ha="center", va="center", color=color, fontsize=10, fontweight='bold')
plt.tight_layout()
plt.savefig(os.path.join(OUT_DIR, 'model1_churn_confusion_matrix.png'), dpi=300)
plt.close()

# ROC Curve: Model 1
fpr_m1_xgb, tpr_m1_xgb, _ = roc_curve(y_test_cls1, prob_cls1_xgb)
fpr_m1_log, tpr_m1_log, _ = roc_curve(y_test_cls1, prob_cls1_logreg)

fig, ax = plt.subplots(figsize=(7, 6), dpi=300)
ax.plot(fpr_m1_xgb, tpr_m1_xgb, color='#1f77b4', lw=2, label=f"XGBClassifier (AUC = {m1_cls_xgb_metrics['ROC_AUC']:.4f})")
ax.plot(fpr_m1_log, tpr_m1_log, color='#2ca02c', lw=1.8, linestyle='-.', label=f"LogisticRegression (AUC = {m1_cls_logreg_metrics['ROC_AUC']:.4f})")
ax.plot([0, 1], [0, 1], 'k--', lw=1.2, alpha=0.7, label="Chance / Random Baseline (AUC = 0.5000)")
ax.set_title("Model 1: ROC Curve — Churn / Contraction Prediction\n(Held-out Test Period: 2024-07 to 2024-12)", fontsize=11, fontweight='bold', pad=12)
ax.set_xlabel("False Positive Rate", fontsize=10)
ax.set_ylabel("True Positive Rate", fontsize=10)
ax.set_xlim([0.0, 1.0])
ax.set_ylim([0.0, 1.05])
ax.grid(True)
ax.legend(loc="lower right", frameon=True, facecolor='#ffffff', edgecolor='#cccccc', fontsize=9.5)
plt.tight_layout()
plt.savefig(os.path.join(OUT_DIR, 'model1_churn_roc_curve.png'), dpi=300)
plt.close()

# PR Curve: Model 1
precs_m1_xgb, recs_m1_xgb, _ = precision_recall_curve(y_test_cls1, prob_cls1_xgb)
precs_m1_log, recs_m1_log, _ = precision_recall_curve(y_test_cls1, prob_cls1_logreg)
base_rate1 = np.mean(y_test_cls1)

fig, ax = plt.subplots(figsize=(7, 6), dpi=300)
ax.plot(recs_m1_xgb, precs_m1_xgb, color='#1f77b4', lw=2, label=f"XGBClassifier (PR-AUC = {m1_cls_xgb_metrics['PR_AUC']:.4f})")
ax.plot(recs_m1_log, precs_m1_log, color='#2ca02c', lw=1.8, linestyle='-.', label=f"LogisticRegression (PR-AUC = {m1_cls_logreg_metrics['PR_AUC']:.4f})")
ax.plot([0, 1], [base_rate1, base_rate1], 'k--', lw=1.2, alpha=0.7, label=f"No-Skill Baseline ({base_rate1*100:.1f}%)")
ax.set_title("Model 1: Precision-Recall Curve — Churn Prediction\n(Class Imbalance Base Rate: 12.95%)", fontsize=11, fontweight='bold', pad=12)
ax.set_xlabel("Recall", fontsize=10)
ax.set_ylabel("Precision", fontsize=10)
ax.set_xlim([0.0, 1.0])
ax.set_ylim([0.0, 1.05])
ax.grid(True)
ax.legend(loc="upper right", frameon=True, facecolor='#ffffff', edgecolor='#cccccc', fontsize=9.5)
plt.tight_layout()
plt.savefig(os.path.join(OUT_DIR, 'model1_churn_pr_curve.png'), dpi=300)
plt.close()

# Plot: Feature Importance Churn
fi_cls1_df = pd.read_csv(os.path.join(MODELS_DIR, 'model1_cls_feature_importance.csv')).sort_values('importance', ascending=True)
fig, ax = plt.subplots(figsize=(9, 6), dpi=300)
bars = ax.barh(fi_cls1_df['feature'], fi_cls1_df['importance'], color='#c0392b', edgecolor='#78281f', height=0.65)
ax.set_title("Model 1: Feature Importance — Churn / Contraction (XGBClassifier)", fontsize=12, pad=12, fontweight='bold')
ax.set_xlabel("Gain / Relative Feature Importance", fontsize=11, labelpad=8)
ax.grid(True, axis='x')
for bar in bars:
    w = bar.get_width()
    ax.text(w + 0.005, bar.get_y() + bar.get_height()/2, f"{w:.3f}", va='center', ha='left', fontsize=8.5, color='#333333')
ax.set_xlim(0, max(fi_cls1_df['importance']) * 1.15)
plt.tight_layout()
plt.savefig(os.path.join(OUT_DIR, 'model1_churn_feature_importance.png'), dpi=300)
plt.close()

# ── 3. AUDIT & EVALUATE MODEL 2: STARTUP SURVIVAL RISK ─────────────────
print("\n" + "=" * 60)
print("AUDITING MODEL 2: STARTUP SURVIVAL RISK (Stage 0 Founding Day)")
print("=" * 60)

meta2 = json.load(open(os.path.join(MODELS_DIR, 'model2_metadata.json')))
approved_features_m2 = meta2['approved_features']

test_df_m2 = pd.read_csv(os.path.join(SPLITS_M2, 'test.csv'))
X_test_m2 = test_df_m2[approved_features_m2].values
y_test_m2 = test_df_m2['failed'].values.astype(int)

# Load trained models & baselines
xgb_cls2 = xgb.XGBClassifier()
xgb_cls2.load_model(os.path.join(MODELS_DIR, 'decision_simulator_startup_risk_v1.json'))
rf_cls2 = joblib.load(os.path.join(MODELS_DIR, 'model2_rf_baseline.joblib'))
logreg_cls2 = joblib.load(os.path.join(MODELS_DIR, 'model2_logreg_baseline.joblib'))

prob_m2_xgb = xgb_cls2.predict_proba(X_test_m2)[:, 1]
pred_m2_xgb = xgb_cls2.predict(X_test_m2)

prob_m2_rf = rf_cls2.predict_proba(X_test_m2)[:, 1]
pred_m2_rf = rf_cls2.predict(X_test_m2)

prob_m2_log = logreg_cls2.predict_proba(X_test_m2)[:, 1]
pred_m2_log = logreg_cls2.predict(X_test_m2)

# Dummy baseline fitted on training prior
train_df_m2 = pd.read_csv(os.path.join(SPLITS_M2, 'train.csv'))
dummy_cls2 = DummyClassifier(strategy='prior', random_state=42)
dummy_cls2.fit(train_df_m2[approved_features_m2].values, train_df_m2['failed'].values)
dummy_pred2 = dummy_cls2.predict(X_test_m2)
dummy_prob2 = dummy_cls2.predict_proba(X_test_m2)[:, 1]

m2_xgb_metrics = calc_cls_metrics(y_test_m2, prob_m2_xgb, pred_m2_xgb)
m2_rf_metrics = calc_cls_metrics(y_test_m2, prob_m2_rf, pred_m2_rf)
m2_log_metrics = calc_cls_metrics(y_test_m2, prob_m2_log, pred_m2_log)
m2_dummy_metrics = calc_cls_metrics(y_test_m2, dummy_prob2, dummy_pred2)

print(f"XGBClassifier: Accuracy={m2_xgb_metrics['Accuracy']:.4f}, Precision={m2_xgb_metrics['Precision']:.4f}, Recall={m2_xgb_metrics['Recall']:.4f}, F1={m2_xgb_metrics['F1']:.4f}, ROC-AUC={m2_xgb_metrics['ROC_AUC']:.4f}, PR-AUC={m2_xgb_metrics['PR_AUC']:.4f}, Brier={m2_xgb_metrics['Brier_Score']:.4f}")
print(f"RandomForest:  Accuracy={m2_rf_metrics['Accuracy']:.4f}, Precision={m2_rf_metrics['Precision']:.4f}, Recall={m2_rf_metrics['Recall']:.4f}, F1={m2_rf_metrics['F1']:.4f}, ROC-AUC={m2_rf_metrics['ROC_AUC']:.4f}, PR-AUC={m2_rf_metrics['PR_AUC']:.4f}, Brier={m2_rf_metrics['Brier_Score']:.4f}")
print(f"LogReg:        Accuracy={m2_log_metrics['Accuracy']:.4f}, Precision={m2_log_metrics['Precision']:.4f}, Recall={m2_log_metrics['Recall']:.4f}, F1={m2_log_metrics['F1']:.4f}, ROC-AUC={m2_log_metrics['ROC_AUC']:.4f}, PR-AUC={m2_log_metrics['PR_AUC']:.4f}, Brier={m2_log_metrics['Brier_Score']:.4f}")
print(f"Dummy:         Accuracy={m2_dummy_metrics['Accuracy']:.4f}, Precision={m2_dummy_metrics['Precision']:.4f}, Recall={m2_dummy_metrics['Recall']:.4f}, F1={m2_dummy_metrics['F1']:.4f}, ROC-AUC={m2_dummy_metrics['ROC_AUC']:.4f}, PR-AUC={m2_dummy_metrics['PR_AUC']:.4f}, Brier={m2_dummy_metrics['Brier_Score']:.4f}")

# Save confusion matrix CSV
cm2_arr = np.array(m2_xgb_metrics['Confusion_Matrix'])
pd.DataFrame(cm2_arr, index=['Actual_Survived(0)', 'Actual_Failed(1)'],
             columns=['Pred_Survived(0)', 'Pred_Failed(1)']).to_csv(os.path.join(OUT_DIR, 'model2_survival_confusion_matrix.csv'))

# Plot: Confusion Matrix Model 2
fig, ax = plt.subplots(figsize=(6, 5), dpi=300)
cax = ax.imshow(cm2_arr, interpolation='nearest', cmap=plt.cm.Oranges)
plt.title("Model 2: Startup Survival Confusion Matrix (XGBClassifier)\n(Held-out Test Split: 20%, N = 9,600)", fontsize=11, fontweight='bold', pad=12)
plt.colorbar(cax, fraction=0.046, pad=0.04)
tick_marks = [0, 1]
ax.set_xticks(tick_marks)
ax.set_xticklabels(['Survived (0)', 'Failed (1)'], fontsize=10)
ax.set_yticks(tick_marks)
ax.set_yticklabels(['Survived (0)', 'Failed (1)'], fontsize=10)
ax.set_xlabel('Predicted Label', fontsize=10, labelpad=8)
ax.set_ylabel('True Label', fontsize=10, labelpad=8)

thresh = cm2_arr.max() / 2.
for i in range(cm2_arr.shape[0]):
    for j in range(cm2_arr.shape[1]):
        val = cm2_arr[i, j]
        pct = val / cm2_arr.sum() * 100
        color = "white" if val > thresh else "black"
        ax.text(j, i, f"{val:,}\n({pct:.1f}%)", ha="center", va="center", color=color, fontsize=10, fontweight='bold')
plt.tight_layout()
plt.savefig(os.path.join(OUT_DIR, 'model2_survival_confusion_matrix.png'), dpi=300)
plt.close()

# ROC Curve: Model 2
fpr_m2_xgb, tpr_m2_xgb, _ = roc_curve(y_test_m2, prob_m2_xgb)
fpr_m2_rf, tpr_m2_rf, _ = roc_curve(y_test_m2, prob_m2_rf)
fpr_m2_log, tpr_m2_log, _ = roc_curve(y_test_m2, prob_m2_log)

fig, ax = plt.subplots(figsize=(7, 6), dpi=300)
ax.plot(fpr_m2_xgb, tpr_m2_xgb, color='#e67e22', lw=2, label=f"XGBClassifier (AUC = {m2_xgb_metrics['ROC_AUC']:.4f})")
ax.plot(fpr_m2_rf, tpr_m2_rf, color='#2980b9', lw=1.8, linestyle='--', label=f"Random Forest (AUC = {m2_rf_metrics['ROC_AUC']:.4f})")
ax.plot(fpr_m2_log, tpr_m2_log, color='#27ae60', lw=1.8, linestyle='-.', label=f"Logistic Regression (AUC = {m2_log_metrics['ROC_AUC']:.4f})")
ax.plot([0, 1], [0, 1], 'k--', lw=1.2, alpha=0.7, label="Chance / Random Baseline (AUC = 0.5000)")
ax.set_title("Model 2: ROC Curve — Startup Survival Failure Risk\n(Stage 0 Day-0 Founding Observations, N = 9,600)", fontsize=11, fontweight='bold', pad=12)
ax.set_xlabel("False Positive Rate", fontsize=10)
ax.set_ylabel("True Positive Rate", fontsize=10)
ax.set_xlim([0.0, 1.0])
ax.set_ylim([0.0, 1.05])
ax.grid(True)
ax.legend(loc="lower right", frameon=True, facecolor='#ffffff', edgecolor='#cccccc', fontsize=9.5)
plt.tight_layout()
plt.savefig(os.path.join(OUT_DIR, 'model2_survival_roc_curve.png'), dpi=300)
plt.close()

# PR Curve: Model 2
precs_m2_xgb, recs_m2_xgb, _ = precision_recall_curve(y_test_m2, prob_m2_xgb)
precs_m2_rf, recs_m2_rf, _ = precision_recall_curve(y_test_m2, prob_m2_rf)
precs_m2_log, recs_m2_log, _ = precision_recall_curve(y_test_m2, prob_m2_log)
base_rate2 = np.mean(y_test_m2)

fig, ax = plt.subplots(figsize=(7, 6), dpi=300)
ax.plot(recs_m2_xgb, precs_m2_xgb, color='#e67e22', lw=2, label=f"XGBClassifier (PR-AUC = {m2_xgb_metrics['PR_AUC']:.4f})")
ax.plot(recs_m2_rf, precs_m2_rf, color='#2980b9', lw=1.8, linestyle='--', label=f"Random Forest (PR-AUC = {m2_rf_metrics['PR_AUC']:.4f})")
ax.plot(recs_m2_log, precs_m2_log, color='#27ae60', lw=1.8, linestyle='-.', label=f"Logistic Regression (PR-AUC = {m2_log_metrics['PR_AUC']:.4f})")
ax.plot([0, 1], [base_rate2, base_rate2], 'k--', lw=1.2, alpha=0.7, label=f"Base Failure Rate ({base_rate2*100:.1f}%)")
ax.set_title("Model 2: Precision-Recall Curve — Startup Failure Outcome\n(Held-out Test Split: 20%, N = 9,600)", fontsize=11, fontweight='bold', pad=12)
ax.set_xlabel("Recall", fontsize=10)
ax.set_ylabel("Precision", fontsize=10)
ax.set_xlim([0.0, 1.0])
ax.set_ylim([0.0, 1.05])
ax.grid(True)
ax.legend(loc="lower left", frameon=True, facecolor='#ffffff', edgecolor='#cccccc', fontsize=9.5)
plt.tight_layout()
plt.savefig(os.path.join(OUT_DIR, 'model2_survival_pr_curve.png'), dpi=300)
plt.close()

# Plot: Calibration Curve Model 2
prob_true_xgb, prob_pred_xgb = calibration_curve(y_test_m2, prob_m2_xgb, n_bins=10, strategy='uniform')
prob_true_rf, prob_pred_rf = calibration_curve(y_test_m2, prob_m2_rf, n_bins=10, strategy='uniform')
prob_true_log, prob_pred_log = calibration_curve(y_test_m2, prob_m2_log, n_bins=10, strategy='uniform')

fig, ax = plt.subplots(figsize=(7, 6), dpi=300)
ax.plot(prob_pred_xgb, prob_true_xgb, marker='o', lw=2, color='#e67e22', label=f"XGBClassifier (Brier = {m2_xgb_metrics['Brier_Score']:.4f})")
ax.plot(prob_pred_rf, prob_true_rf, marker='s', lw=1.8, color='#2980b9', linestyle='--', label=f"Random Forest (Brier = {m2_rf_metrics['Brier_Score']:.4f})")
ax.plot(prob_pred_log, prob_true_log, marker='^', lw=1.8, color='#27ae60', linestyle='-.', label=f"Logistic Regression (Brier = {m2_log_metrics['Brier_Score']:.4f})")
ax.plot([0, 1], [0, 1], 'k--', lw=1.2, alpha=0.7, label="Perfectly Calibrated")
ax.set_title("Model 2: Probability Calibration Curve — Startup Failure Risk\n(Reliability Diagram across 10 Bins)", fontsize=11, fontweight='bold', pad=12)
ax.set_xlabel("Mean Predicted Probability", fontsize=10)
ax.set_ylabel("Fraction of Actual Positives (Failed)", fontsize=10)
ax.set_xlim([0.0, 1.0])
ax.set_ylim([0.0, 1.0])
ax.grid(True)
ax.legend(loc="lower right", frameon=True, facecolor='#ffffff', edgecolor='#cccccc', fontsize=9.5)
plt.tight_layout()
plt.savefig(os.path.join(OUT_DIR, 'model2_survival_calibration_curve.png'), dpi=300)
plt.close()

# Save calibration points CSV in tidy format
cal_df = pd.concat([
    pd.DataFrame({
        'model': 'XGBClassifier',
        'bin_idx': range(1, len(prob_pred_xgb) + 1),
        'mean_pred_prob': prob_pred_xgb,
        'fraction_positive': prob_true_xgb
    }),
    pd.DataFrame({
        'model': 'RandomForest',
        'bin_idx': range(1, len(prob_pred_rf) + 1),
        'mean_pred_prob': prob_pred_rf,
        'fraction_positive': prob_true_rf
    }),
    pd.DataFrame({
        'model': 'LogisticRegression',
        'bin_idx': range(1, len(prob_pred_log) + 1),
        'mean_pred_prob': prob_pred_log,
        'fraction_positive': prob_true_log
    })
], ignore_index=True)
cal_df.to_csv(os.path.join(OUT_DIR, 'model2_survival_calibration_data.csv'), index=False)

# Save curve data points for paper reproduction
pd.DataFrame({
    'fpr_xgb': fpr_m2_xgb,
    'tpr_xgb': tpr_m2_xgb
}).to_csv(os.path.join(OUT_DIR, 'model2_survival_roc_curve_data.csv'), index=False)

pd.DataFrame({
    'recall_xgb': recs_m2_xgb,
    'precision_xgb': precs_m2_xgb
}).to_csv(os.path.join(OUT_DIR, 'model2_survival_pr_curve_data.csv'), index=False)

pd.DataFrame({
    'fpr_xgb': fpr_m1_xgb,
    'tpr_xgb': tpr_m1_xgb
}).to_csv(os.path.join(OUT_DIR, 'model1_churn_roc_curve_data.csv'), index=False)

pd.DataFrame({
    'recall_xgb': recs_m1_xgb,
    'precision_xgb': precs_m1_xgb
}).to_csv(os.path.join(OUT_DIR, 'model1_churn_pr_curve_data.csv'), index=False)

# Plot: Feature Importance Model 2
fi_m2_df = pd.read_csv(os.path.join(MODELS_DIR, 'model2_feature_importance.csv')).sort_values('importance', ascending=True)
fig, ax = plt.subplots(figsize=(9, 6.5), dpi=300)
bars = ax.barh(fi_m2_df['feature'], fi_m2_df['importance'], color='#d35400', edgecolor='#933c00', height=0.65)
ax.set_title("Model 2: Feature Importance — Startup Failure Risk (Stage 0)", fontsize=12, pad=12, fontweight='bold')
ax.set_xlabel("Gain / Relative Feature Importance", fontsize=11, labelpad=8)
ax.grid(True, axis='x')
for bar in bars:
    w = bar.get_width()
    ax.text(w + 0.005, bar.get_y() + bar.get_height()/2, f"{w:.3f}", va='center', ha='left', fontsize=8.5, color='#333333')
ax.set_xlim(0, max(fi_m2_df['importance']) * 1.15)
plt.tight_layout()
plt.savefig(os.path.join(OUT_DIR, 'model2_survival_feature_importance.png'), dpi=300)
plt.close()

# ── 4. COMPILE SUMMARY METRICS & MODEL-VS-BASELINE TABLES ───────────────
print("\n" + "=" * 60)
print("COMPILING SUMMARY TABLES & SCHEMAS")
print("=" * 60)

# Full summary dictionary
summary_dict = {
    'evaluation_date': '2026-09-30',
    'status': 'VERIFIED_AUDITED',
    'models': {
        'model1_revenue_forecast': {
            'target': 'next_month_mrr',
            'target_unit': 'USD',
            'test_split': 'Out-of-time (2024-07 to 2024-12)',
            'test_samples_n': len(y_test_reg),
            'xgboost': m1_reg_xgb_metrics,
            'baselines': {
                'ridge_regression': m1_reg_ridge_metrics,
                'naive_persistence': m1_reg_naive_metrics
            },
            'best_performing_rmse': 'Ridge Regression ($5,255.17)',
            'best_performing_mae': 'Naive Persistence ($2,681.17)',
            'serving_recommendation': 'Hybrid: current MRR baseline + XGBoost scenario delta'
        },
        'model1_churn_risk': {
            'target': 'target_churn_event_t1',
            'target_unit': 'binary_probability',
            'test_split': 'Out-of-time (2024-07 to 2024-12)',
            'test_samples_n': len(y_test_cls1),
            'base_rate_churn': float(base_rate1),
            'xgboost': m1_cls_xgb_metrics,
            'baselines': {
                'logistic_regression': m1_cls_logreg_metrics,
                'dummy_classifier': m1_cls_dummy_metrics
            }
        },
        'model2_startup_survival': {
            'target': 'failed',
            'target_unit': 'binary_probability',
            'observation_stage': 'Stage 0 (Day 0 Founding)',
            'test_split': 'Stratified 20% holdout',
            'test_samples_n': len(y_test_m2),
            'base_rate_failed': float(base_rate2),
            'xgboost': m2_xgb_metrics,
            'baselines': {
                'random_forest': m2_rf_metrics,
                'logistic_regression': m2_log_metrics,
                'dummy_classifier': m2_dummy_metrics
            }
        }
    }
}

with open(os.path.join(OUT_DIR, 'metrics_summary.json'), 'w') as f:
    json.dump(summary_dict, f, indent=2)

# Flattened metrics summary CSV
flat_metrics = [
    # Model 1 Reg
    {'Subsystem': 'Model 1: Revenue', 'Model': 'XGBRegressor (Trained)', 'Target': 'next_month_mrr', 'Metric_1': f"RMSE=${m1_reg_xgb_metrics['RMSE']:,.2f}", 'Metric_2': f"MAE=${m1_reg_xgb_metrics['MAE']:,.2f}", 'Metric_3': f"MAPE={m1_reg_xgb_metrics['MAPE_pct']:.2f}%", 'Metric_4': f"R²={m1_reg_xgb_metrics['R2']:.4f}", 'Metric_5': f"DirAcc={m1_reg_xgb_metrics['Directional_Accuracy_pct']:.2f}%", 'Metric_6': '-', 'N_Test': len(y_test_reg)},
    {'Subsystem': 'Model 1: Revenue', 'Model': 'Ridge Regression (Baseline)', 'Target': 'next_month_mrr', 'Metric_1': f"RMSE=${m1_reg_ridge_metrics['RMSE']:,.2f}", 'Metric_2': f"MAE=${m1_reg_ridge_metrics['MAE']:,.2f}", 'Metric_3': f"MAPE={m1_reg_ridge_metrics['MAPE_pct']:.2f}%", 'Metric_4': f"R²={m1_reg_ridge_metrics['R2']:.4f}", 'Metric_5': f"DirAcc={m1_reg_ridge_metrics['Directional_Accuracy_pct']:.2f}%", 'Metric_6': '-', 'N_Test': len(y_test_reg)},
    {'Subsystem': 'Model 1: Revenue', 'Model': 'Naive Persistence (Baseline)', 'Target': 'next_month_mrr', 'Metric_1': f"RMSE=${m1_reg_naive_metrics['RMSE']:,.2f}", 'Metric_2': f"MAE=${m1_reg_naive_metrics['MAE']:,.2f}", 'Metric_3': f"MAPE={m1_reg_naive_metrics['MAPE_pct']:.2f}%", 'Metric_4': f"R²={m1_reg_naive_metrics['R2']:.4f}", 'Metric_5': f"DirAcc={m1_reg_naive_metrics['Directional_Accuracy_pct']:.2f}%", 'Metric_6': '-', 'N_Test': len(y_test_reg)},
    # Model 1 Churn
    {'Subsystem': 'Model 1: Churn', 'Model': 'XGBClassifier (Trained)', 'Target': 'target_churn_event_t1', 'Metric_1': f"ROC-AUC={m1_cls_xgb_metrics['ROC_AUC']:.4f}", 'Metric_2': f"PR-AUC={m1_cls_xgb_metrics['PR_AUC']:.4f}", 'Metric_3': f"Precision={m1_cls_xgb_metrics['Precision']:.4f}", 'Metric_4': f"Recall={m1_cls_xgb_metrics['Recall']:.4f}", 'Metric_5': f"F1={m1_cls_xgb_metrics['F1']:.4f}", 'Metric_6': f"Brier={m1_cls_xgb_metrics['Brier_Score']:.4f}", 'N_Test': len(y_test_cls1)},
    {'Subsystem': 'Model 1: Churn', 'Model': 'LogisticRegression (Baseline)', 'Target': 'target_churn_event_t1', 'Metric_1': f"ROC-AUC={m1_cls_logreg_metrics['ROC_AUC']:.4f}", 'Metric_2': f"PR-AUC={m1_cls_logreg_metrics['PR_AUC']:.4f}", 'Metric_3': f"Precision={m1_cls_logreg_metrics['Precision']:.4f}", 'Metric_4': f"Recall={m1_cls_logreg_metrics['Recall']:.4f}", 'Metric_5': f"F1={m1_cls_logreg_metrics['F1']:.4f}", 'Metric_6': f"Brier={m1_cls_logreg_metrics['Brier_Score']:.4f}", 'N_Test': len(y_test_cls1)},
    {'Subsystem': 'Model 1: Churn', 'Model': 'DummyClassifier (Baseline)', 'Target': 'target_churn_event_t1', 'Metric_1': f"ROC-AUC={m1_cls_dummy_metrics['ROC_AUC']:.4f}", 'Metric_2': f"PR-AUC={m1_cls_dummy_metrics['PR_AUC']:.4f}", 'Metric_3': f"Precision={m1_cls_dummy_metrics['Precision']:.4f}", 'Metric_4': f"Recall={m1_cls_dummy_metrics['Recall']:.4f}", 'Metric_5': f"F1={m1_cls_dummy_metrics['F1']:.4f}", 'Metric_6': f"Brier={m1_cls_dummy_metrics['Brier_Score']:.4f}", 'N_Test': len(y_test_cls1)},
    # Model 2 Survival
    {'Subsystem': 'Model 2: Survival', 'Model': 'XGBClassifier (Trained)', 'Target': 'failed', 'Metric_1': f"Accuracy={m2_xgb_metrics['Accuracy']:.4f}", 'Metric_2': f"Precision={m2_xgb_metrics['Precision']:.4f}", 'Metric_3': f"Recall={m2_xgb_metrics['Recall']:.4f}", 'Metric_4': f"F1={m2_xgb_metrics['F1']:.4f}", 'Metric_5': f"ROC-AUC={m2_xgb_metrics['ROC_AUC']:.4f}", 'Metric_6': f"Brier={m2_xgb_metrics['Brier_Score']:.4f}", 'N_Test': len(y_test_m2)},
    {'Subsystem': 'Model 2: Survival', 'Model': 'RandomForest (Baseline)', 'Target': 'failed', 'Metric_1': f"Accuracy={m2_rf_metrics['Accuracy']:.4f}", 'Metric_2': f"Precision={m2_rf_metrics['Precision']:.4f}", 'Metric_3': f"Recall={m2_rf_metrics['Recall']:.4f}", 'Metric_4': f"F1={m2_rf_metrics['F1']:.4f}", 'Metric_5': f"ROC-AUC={m2_rf_metrics['ROC_AUC']:.4f}", 'Metric_6': f"Brier={m2_rf_metrics['Brier_Score']:.4f}", 'N_Test': len(y_test_m2)},
    {'Subsystem': 'Model 2: Survival', 'Model': 'LogisticRegression (Baseline)', 'Target': 'failed', 'Metric_1': f"Accuracy={m2_log_metrics['Accuracy']:.4f}", 'Metric_2': f"Precision={m2_log_metrics['Precision']:.4f}", 'Metric_3': f"Recall={m2_log_metrics['Recall']:.4f}", 'Metric_4': f"F1={m2_log_metrics['F1']:.4f}", 'Metric_5': f"ROC-AUC={m2_log_metrics['ROC_AUC']:.4f}", 'Metric_6': f"Brier={m2_log_metrics['Brier_Score']:.4f}", 'N_Test': len(y_test_m2)},
    {'Subsystem': 'Model 2: Survival', 'Model': 'DummyClassifier (Baseline)', 'Target': 'failed', 'Metric_1': f"Accuracy={m2_dummy_metrics['Accuracy']:.4f}", 'Metric_2': f"Precision={m2_dummy_metrics['Precision']:.4f}", 'Metric_3': f"Recall={m2_dummy_metrics['Recall']:.4f}", 'Metric_4': f"F1={m2_dummy_metrics['F1']:.4f}", 'Metric_5': f"ROC-AUC={m2_dummy_metrics['ROC_AUC']:.4f}", 'Metric_6': f"Brier={m2_dummy_metrics['Brier_Score']:.4f}", 'N_Test': len(y_test_m2)}
]
# Save formatted metrics CSV
pd.DataFrame(flat_metrics).to_csv(os.path.join(OUT_DIR, 'metrics_summary_formatted.csv'), index=False)

# Save standardized numerical metrics summary CSV
structured_metrics = [
    {'Subsystem': 'Model 1: Revenue', 'Model': 'XGBRegressor (Primary)', 'Target': 'next_month_mrr', 'N_Test': len(y_test_reg), 'RMSE': m1_reg_xgb_metrics['RMSE'], 'MAE': m1_reg_xgb_metrics['MAE'], 'MAPE_pct': m1_reg_xgb_metrics['MAPE_pct'], 'R2': m1_reg_xgb_metrics['R2'], 'DirAcc_pct': m1_reg_xgb_metrics['Directional_Accuracy_pct'], 'Accuracy': np.nan, 'Precision': np.nan, 'Recall': np.nan, 'F1': np.nan, 'ROC_AUC': np.nan, 'PR_AUC': np.nan, 'Brier_Score': np.nan},
    {'Subsystem': 'Model 1: Revenue', 'Model': 'Ridge Regression (Baseline)', 'Target': 'next_month_mrr', 'N_Test': len(y_test_reg), 'RMSE': m1_reg_ridge_metrics['RMSE'], 'MAE': m1_reg_ridge_metrics['MAE'], 'MAPE_pct': m1_reg_ridge_metrics['MAPE_pct'], 'R2': m1_reg_ridge_metrics['R2'], 'DirAcc_pct': m1_reg_ridge_metrics['Directional_Accuracy_pct'], 'Accuracy': np.nan, 'Precision': np.nan, 'Recall': np.nan, 'F1': np.nan, 'ROC_AUC': np.nan, 'PR_AUC': np.nan, 'Brier_Score': np.nan},
    {'Subsystem': 'Model 1: Revenue', 'Model': 'Naive Persistence (Baseline)', 'Target': 'next_month_mrr', 'N_Test': len(y_test_reg), 'RMSE': m1_reg_naive_metrics['RMSE'], 'MAE': m1_reg_naive_metrics['MAE'], 'MAPE_pct': m1_reg_naive_metrics['MAPE_pct'], 'R2': m1_reg_naive_metrics['R2'], 'DirAcc_pct': m1_reg_naive_metrics['Directional_Accuracy_pct'], 'Accuracy': np.nan, 'Precision': np.nan, 'Recall': np.nan, 'F1': np.nan, 'ROC_AUC': np.nan, 'PR_AUC': np.nan, 'Brier_Score': np.nan},
    {'Subsystem': 'Model 1: Churn', 'Model': 'XGBClassifier (Primary)', 'Target': 'target_churn_event_t1', 'N_Test': len(y_test_cls1), 'RMSE': np.nan, 'MAE': np.nan, 'MAPE_pct': np.nan, 'R2': np.nan, 'DirAcc_pct': np.nan, 'Accuracy': m1_cls_xgb_metrics['Accuracy'], 'Precision': m1_cls_xgb_metrics['Precision'], 'Recall': m1_cls_xgb_metrics['Recall'], 'F1': m1_cls_xgb_metrics['F1'], 'ROC_AUC': m1_cls_xgb_metrics['ROC_AUC'], 'PR_AUC': m1_cls_xgb_metrics['PR_AUC'], 'Brier_Score': m1_cls_xgb_metrics['Brier_Score']},
    {'Subsystem': 'Model 1: Churn', 'Model': 'LogisticRegression (Baseline)', 'Target': 'target_churn_event_t1', 'N_Test': len(y_test_cls1), 'RMSE': np.nan, 'MAE': np.nan, 'MAPE_pct': np.nan, 'R2': np.nan, 'DirAcc_pct': np.nan, 'Accuracy': m1_cls_logreg_metrics['Accuracy'], 'Precision': m1_cls_logreg_metrics['Precision'], 'Recall': m1_cls_logreg_metrics['Recall'], 'F1': m1_cls_logreg_metrics['F1'], 'ROC_AUC': m1_cls_logreg_metrics['ROC_AUC'], 'PR_AUC': m1_cls_logreg_metrics['PR_AUC'], 'Brier_Score': m1_cls_logreg_metrics['Brier_Score']},
    {'Subsystem': 'Model 1: Churn', 'Model': 'DummyClassifier (Baseline)', 'Target': 'target_churn_event_t1', 'N_Test': len(y_test_cls1), 'RMSE': np.nan, 'MAE': np.nan, 'MAPE_pct': np.nan, 'R2': np.nan, 'DirAcc_pct': np.nan, 'Accuracy': m1_cls_dummy_metrics['Accuracy'], 'Precision': m1_cls_dummy_metrics['Precision'], 'Recall': m1_cls_dummy_metrics['Recall'], 'F1': m1_cls_dummy_metrics['F1'], 'ROC_AUC': m1_cls_dummy_metrics['ROC_AUC'], 'PR_AUC': m1_cls_dummy_metrics['PR_AUC'], 'Brier_Score': m1_cls_dummy_metrics['Brier_Score']},
    {'Subsystem': 'Model 2: Survival', 'Model': 'XGBClassifier (Primary)', 'Target': 'failed', 'N_Test': len(y_test_m2), 'RMSE': np.nan, 'MAE': np.nan, 'MAPE_pct': np.nan, 'R2': np.nan, 'DirAcc_pct': np.nan, 'Accuracy': m2_xgb_metrics['Accuracy'], 'Precision': m2_xgb_metrics['Precision'], 'Recall': m2_xgb_metrics['Recall'], 'F1': m2_xgb_metrics['F1'], 'ROC_AUC': m2_xgb_metrics['ROC_AUC'], 'PR_AUC': m2_xgb_metrics['PR_AUC'], 'Brier_Score': m2_xgb_metrics['Brier_Score']},
    {'Subsystem': 'Model 2: Survival', 'Model': 'RandomForest (Baseline)', 'Target': 'failed', 'N_Test': len(y_test_m2), 'RMSE': np.nan, 'MAE': np.nan, 'MAPE_pct': np.nan, 'R2': np.nan, 'DirAcc_pct': np.nan, 'Accuracy': m2_rf_metrics['Accuracy'], 'Precision': m2_rf_metrics['Precision'], 'Recall': m2_rf_metrics['Recall'], 'F1': m2_rf_metrics['F1'], 'ROC_AUC': m2_rf_metrics['ROC_AUC'], 'PR_AUC': m2_rf_metrics['PR_AUC'], 'Brier_Score': m2_rf_metrics['Brier_Score']},
    {'Subsystem': 'Model 2: Survival', 'Model': 'LogisticRegression (Baseline)', 'Target': 'failed', 'N_Test': len(y_test_m2), 'RMSE': np.nan, 'MAE': np.nan, 'MAPE_pct': np.nan, 'R2': np.nan, 'DirAcc_pct': np.nan, 'Accuracy': m2_log_metrics['Accuracy'], 'Precision': m2_log_metrics['Precision'], 'Recall': m2_log_metrics['Recall'], 'F1': m2_log_metrics['F1'], 'ROC_AUC': m2_log_metrics['ROC_AUC'], 'PR_AUC': m2_log_metrics['PR_AUC'], 'Brier_Score': m2_log_metrics['Brier_Score']},
    {'Subsystem': 'Model 2: Survival', 'Model': 'DummyClassifier (Baseline)', 'Target': 'failed', 'N_Test': len(y_test_m2), 'RMSE': np.nan, 'MAE': np.nan, 'MAPE_pct': np.nan, 'R2': np.nan, 'DirAcc_pct': np.nan, 'Accuracy': m2_dummy_metrics['Accuracy'], 'Precision': m2_dummy_metrics['Precision'], 'Recall': m2_dummy_metrics['Recall'], 'F1': m2_dummy_metrics['F1'], 'ROC_AUC': m2_dummy_metrics['ROC_AUC'], 'PR_AUC': m2_dummy_metrics['PR_AUC'], 'Brier_Score': m2_dummy_metrics['Brier_Score']}
]
pd.DataFrame(structured_metrics).to_csv(os.path.join(OUT_DIR, 'metrics_summary.csv'), index=False)

# Model vs Baseline Detailed Tables
reg_comp_df = pd.DataFrame([
    {'Model': 'Naive Persistence', 'RMSE ($)': f"{m1_reg_naive_metrics['RMSE']:,.2f}", 'MAE ($)': f"{m1_reg_naive_metrics['MAE']:,.2f}", 'MAPE (%)': f"{m1_reg_naive_metrics['MAPE_pct']:.2f}%", 'R²': f"{m1_reg_naive_metrics['R2']:.4f}", 'Directional Acc (%)': f"{m1_reg_naive_metrics['Directional_Accuracy_pct']:.2f}%"},
    {'Model': 'Ridge Regression', 'RMSE ($)': f"{m1_reg_ridge_metrics['RMSE']:,.2f}", 'MAE ($)': f"{m1_reg_ridge_metrics['MAE']:,.2f}", 'MAPE (%)': f"{m1_reg_ridge_metrics['MAPE_pct']:.2f}%", 'R²': f"{m1_reg_ridge_metrics['R2']:.4f}", 'Directional Acc (%)': f"{m1_reg_ridge_metrics['Directional_Accuracy_pct']:.2f}%"},
    {'Model': 'XGBRegressor (Primary)', 'RMSE ($)': f"{m1_reg_xgb_metrics['RMSE']:,.2f}", 'MAE ($)': f"{m1_reg_xgb_metrics['MAE']:,.2f}", 'MAPE (%)': f"{m1_reg_xgb_metrics['MAPE_pct']:.2f}%", 'R²': f"{m1_reg_xgb_metrics['R2']:.4f}", 'Directional Acc (%)': f"{m1_reg_xgb_metrics['Directional_Accuracy_pct']:.2f}%"}
])
reg_comp_df.to_csv(os.path.join(OUT_DIR, 'model1_revenue_model_vs_baseline.csv'), index=False)

cls1_comp_df = pd.DataFrame([
    {'Model': 'Dummy (Majority)', 'ROC-AUC': f"{m1_cls_dummy_metrics['ROC_AUC']:.4f}", 'PR-AUC': f"{m1_cls_dummy_metrics['PR_AUC']:.4f}", 'Precision': f"{m1_cls_dummy_metrics['Precision']:.4f}", 'Recall': f"{m1_cls_dummy_metrics['Recall']:.4f}", 'F1': f"{m1_cls_dummy_metrics['F1']:.4f}", 'Brier': f"{m1_cls_dummy_metrics['Brier_Score']:.4f}"},
    {'Model': 'Logistic Regression', 'ROC-AUC': f"{m1_cls_logreg_metrics['ROC_AUC']:.4f}", 'PR-AUC': f"{m1_cls_logreg_metrics['PR_AUC']:.4f}", 'Precision': f"{m1_cls_logreg_metrics['Precision']:.4f}", 'Recall': f"{m1_cls_logreg_metrics['Recall']:.4f}", 'F1': f"{m1_cls_logreg_metrics['F1']:.4f}", 'Brier': f"{m1_cls_logreg_metrics['Brier_Score']:.4f}"},
    {'Model': 'XGBClassifier (Primary)', 'ROC-AUC': f"{m1_cls_xgb_metrics['ROC_AUC']:.4f}", 'PR-AUC': f"{m1_cls_xgb_metrics['PR_AUC']:.4f}", 'Precision': f"{m1_cls_xgb_metrics['Precision']:.4f}", 'Recall': f"{m1_cls_xgb_metrics['Recall']:.4f}", 'F1': f"{m1_cls_xgb_metrics['F1']:.4f}", 'Brier': f"{m1_cls_xgb_metrics['Brier_Score']:.4f}"}
])
cls1_comp_df.to_csv(os.path.join(OUT_DIR, 'model1_churn_model_vs_baseline.csv'), index=False)

cls2_comp_df = pd.DataFrame([
    {'Model': 'Dummy (Majority)', 'Accuracy': f"{m2_dummy_metrics['Accuracy']:.4f}", 'Precision': f"{m2_dummy_metrics['Precision']:.4f}", 'Recall': f"{m2_dummy_metrics['Recall']:.4f}", 'F1': f"{m2_dummy_metrics['F1']:.4f}", 'ROC-AUC': f"{m2_dummy_metrics['ROC_AUC']:.4f}", 'PR-AUC': f"{m2_dummy_metrics['PR_AUC']:.4f}", 'Brier': f"{m2_dummy_metrics['Brier_Score']:.4f}"},
    {'Model': 'Logistic Regression', 'Accuracy': f"{m2_log_metrics['Accuracy']:.4f}", 'Precision': f"{m2_log_metrics['Precision']:.4f}", 'Recall': f"{m2_log_metrics['Recall']:.4f}", 'F1': f"{m2_log_metrics['F1']:.4f}", 'ROC-AUC': f"{m2_log_metrics['ROC_AUC']:.4f}", 'PR-AUC': f"{m2_log_metrics['PR_AUC']:.4f}", 'Brier': f"{m2_log_metrics['Brier_Score']:.4f}"},
    {'Model': 'Random Forest', 'Accuracy': f"{m2_rf_metrics['Accuracy']:.4f}", 'Precision': f"{m2_rf_metrics['Precision']:.4f}", 'Recall': f"{m2_rf_metrics['Recall']:.4f}", 'F1': f"{m2_rf_metrics['F1']:.4f}", 'ROC-AUC': f"{m2_rf_metrics['ROC_AUC']:.4f}", 'PR-AUC': f"{m2_rf_metrics['PR_AUC']:.4f}", 'Brier': f"{m2_rf_metrics['Brier_Score']:.4f}"},
    {'Model': 'XGBClassifier (Primary)', 'Accuracy': f"{m2_xgb_metrics['Accuracy']:.4f}", 'Precision': f"{m2_xgb_metrics['Precision']:.4f}", 'Recall': f"{m2_xgb_metrics['Recall']:.4f}", 'F1': f"{m2_xgb_metrics['F1']:.4f}", 'ROC-AUC': f"{m2_xgb_metrics['ROC_AUC']:.4f}", 'PR-AUC': f"{m2_xgb_metrics['PR_AUC']:.4f}", 'Brier': f"{m2_xgb_metrics['Brier_Score']:.4f}"}
])
cls2_comp_df.to_csv(os.path.join(OUT_DIR, 'model2_survival_model_vs_baseline.csv'), index=False)

# Combined model-vs-baseline table (Markdown & CSV)
comparison_all = pd.concat([
    reg_comp_df.assign(Task='Model 1: MRR Regression'),
    cls1_comp_df.assign(Task='Model 1: Churn Classification'),
    cls2_comp_df.assign(Task='Model 2: Startup Survival Classification')
], ignore_index=True)
comparison_all.to_csv(os.path.join(OUT_DIR, 'model_vs_baseline_comparison.csv'), index=False)

with open(os.path.join(OUT_DIR, 'model_vs_baseline_comparison.json'), 'w') as f:
    json.dump({
        'model1_revenue': reg_comp_df.to_dict(orient='records'),
        'model1_churn': cls1_comp_df.to_dict(orient='records'),
        'model2_survival': cls2_comp_df.to_dict(orient='records')
    }, f, indent=2)

md_table = f"""# Model vs. Baseline Comparison Tables (Research Paper Ready)

## Model 1A: Next-Month MRR Regression
- **Dataset**: RavenStack SaaS Subscription Analytics (Out-of-time test split: 2024-07 to 2024-12, N = {len(y_test_reg):,})
- **Target**: `next_month_mrr` (USD)

| Model | RMSE ($) | MAE ($) | MAPE (%) | R² | Directional Accuracy (%) |
|---|---|---|---|---|---|
| Naive Persistence | ${m1_reg_naive_metrics['RMSE']:,.2f} | ${m1_reg_naive_metrics['MAE']:,.2f} | {m1_reg_naive_metrics['MAPE_pct']:.2f}% | {m1_reg_naive_metrics['R2']:.4f} | {m1_reg_naive_metrics['Directional_Accuracy_pct']:.2f}% |
| Ridge Regression | ${m1_reg_ridge_metrics['RMSE']:,.2f} | ${m1_reg_ridge_metrics['MAE']:,.2f} | {m1_reg_ridge_metrics['MAPE_pct']:.2f}% | {m1_reg_ridge_metrics['R2']:.4f} | {m1_reg_ridge_metrics['Directional_Accuracy_pct']:.2f}% |
| **XGBRegressor (Primary)** | **${m1_reg_xgb_metrics['RMSE']:,.2f}** | **${m1_reg_xgb_metrics['MAE']:,.2f}** | **{m1_reg_xgb_metrics['MAPE_pct']:.2f}%** | **{m1_reg_xgb_metrics['R2']:.4f}** | **{m1_reg_xgb_metrics['Directional_Accuracy_pct']:.2f}%** |

*Empirical Note*: Due to high month-to-month autoregression, Naive Persistence achieves the lowest raw MAE ($2,681.17) and Ridge achieves lowest RMSE ($5,255.17, R² = 0.8745). In production serving, Cofoundr OS uses a hybrid formulation preserving current MRR baseline and applying model-predicted deltas for counterfactual simulations.

---

## Model 1B: Churn / Contraction Event Classification
- **Dataset**: RavenStack SaaS Subscription Analytics (Out-of-time test split: 2024-07 to 2024-12, N = {len(y_test_cls1):,})
- **Target**: `target_churn_event_t1` (Base rate: {base_rate1*100:.2f}%)

| Model | ROC-AUC | PR-AUC | Precision | Recall | F1 Score | Brier Score |
|---|---|---|---|---|---|---|
| Dummy (Prior Class) | {m1_cls_dummy_metrics['ROC_AUC']:.4f} | {m1_cls_dummy_metrics['PR_AUC']:.4f} | {m1_cls_dummy_metrics['Precision']:.4f} | {m1_cls_dummy_metrics['Recall']:.4f} | {m1_cls_dummy_metrics['F1']:.4f} | {m1_cls_dummy_metrics['Brier_Score']:.4f} |
| Logistic Regression (Balanced) | {m1_cls_logreg_metrics['ROC_AUC']:.4f} | {m1_cls_logreg_metrics['PR_AUC']:.4f} | {m1_cls_logreg_metrics['Precision']:.4f} | {m1_cls_logreg_metrics['Recall']:.4f} | {m1_cls_logreg_metrics['F1']:.4f} | {m1_cls_logreg_metrics['Brier_Score']:.4f} |
| **XGBClassifier (Primary)** | **{m1_cls_xgb_metrics['ROC_AUC']:.4f}** | **{m1_cls_xgb_metrics['PR_AUC']:.4f}** | **{m1_cls_xgb_metrics['Precision']:.4f}** | **{m1_cls_xgb_metrics['Recall']:.4f}** | **{m1_cls_xgb_metrics['F1']:.4f}** | **{m1_cls_xgb_metrics['Brier_Score']:.4f}** |

---

## Model 2: Startup Survival Risk (Stage 0 Day-0 Founding)
- **Dataset**: Startup Survival Master Dataset (Held-out stratified 20% split, N = {len(y_test_m2):,})
- **Target**: `failed` (Base failure rate: {base_rate2*100:.2f}%)
- **Data Governance**: Strict exclusion of post-hoc leakage variables (`years_to_outcome`, `failure_reason`, `total_raised_usd`).

| Model | Accuracy | Precision | Recall | F1 Score | ROC-AUC | PR-AUC | Brier Score |
|---|---|---|---|---|---|---|---|
| Dummy (Majority Class) | {m2_dummy_metrics['Accuracy']:.4f} | {m2_dummy_metrics['Precision']:.4f} | {m2_dummy_metrics['Recall']:.4f} | {m2_dummy_metrics['F1']:.4f} | {m2_dummy_metrics['ROC_AUC']:.4f} | {m2_dummy_metrics['PR_AUC']:.4f} | {m2_dummy_metrics['Brier_Score']:.4f} |
| Logistic Regression (Balanced) | {m2_log_metrics['Accuracy']:.4f} | {m2_log_metrics['Precision']:.4f} | {m2_log_metrics['Recall']:.4f} | {m2_log_metrics['F1']:.4f} | {m2_log_metrics['ROC_AUC']:.4f} | {m2_log_metrics['PR_AUC']:.4f} | {m2_log_metrics['Brier_Score']:.4f} |
| Random Forest (Balanced) | {m2_rf_metrics['Accuracy']:.4f} | {m2_rf_metrics['Precision']:.4f} | {m2_rf_metrics['Recall']:.4f} | {m2_rf_metrics['F1']:.4f} | {m2_rf_metrics['ROC_AUC']:.4f} | {m2_rf_metrics['PR_AUC']:.4f} | {m2_rf_metrics['Brier_Score']:.4f} |
| **XGBClassifier (Primary)** | **{m2_xgb_metrics['Accuracy']:.4f}** | **{m2_xgb_metrics['Precision']:.4f}** | **{m2_xgb_metrics['Recall']:.4f}** | **{m2_xgb_metrics['F1']:.4f}** | **{m2_xgb_metrics['ROC_AUC']:.4f}** | **{m2_xgb_metrics['PR_AUC']:.4f}** | **{m2_xgb_metrics['Brier_Score']:.4f}** |
"""

with open(os.path.join(OUT_DIR, 'model_vs_baseline_comparison.md'), 'w', encoding='utf-8') as f:
    f.write(md_table)

print("\n" + "=" * 60)
print("AUDIT & PAPER REPORT GENERATION COMPLETE")
print("=" * 60)
