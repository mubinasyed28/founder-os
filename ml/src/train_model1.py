"""
MODEL 1: Business Forecasting & Churn Prediction (RavenStack)
==============================================================
- XGBRegressor for Next-Month MRR
- XGBClassifier for Churn/Contraction Event
- Baselines: Naive Persistence, Ridge Regression, DummyClassifier, LogisticRegression
- Out-of-time split: Train 2023-01 to 2024-06, Test 2024-07 to 2024-12
"""
import os, json, warnings
import numpy as np
import pandas as pd
import joblib
from sklearn.linear_model import Ridge, LogisticRegression
from sklearn.dummy import DummyClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (
    mean_absolute_error, mean_squared_error, r2_score,
    roc_auc_score, average_precision_score, precision_score,
    recall_score, f1_score, confusion_matrix, brier_score_loss
)
import xgboost as xgb

warnings.filterwarnings('ignore')

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(BASE, 'data', 'raw', 'ravenstack')
PROCESSED = os.path.join(BASE, 'data', 'processed')
SPLITS = os.path.join(BASE, 'data', 'splits', 'model1')
MODELS = os.path.join(BASE, 'models')
for d in [PROCESSED, SPLITS, MODELS]:
    os.makedirs(d, exist_ok=True)

# ── 1. LOAD THE VALIDATED PANEL ──────────────────────────────────────────
print('=' * 70)
print('MODEL 1: LOADING PANEL DATA')
print('=' * 70)

panel = pd.read_csv(os.path.join(PROCESSED, 'ravenstack_monthly_panel.csv'))
panel['month'] = pd.to_datetime(panel['month']).dt.to_period('M')
if 'had_churn_in_m' not in panel.columns and 'has_churned_sub' in panel.columns:
    panel['had_churn_in_m'] = panel['has_churned_sub'].astype(int)
print(f'Panel loaded: {panel.shape[0]} rows, {panel.shape[1]} columns')

# ── 2. FEATURE ENGINEERING (Approved features only) ─────────────────────
APPROVED_FEATURES = [
    'industry', 'country', 'referral_source', 'account_plan_tier',
    'tenure_months', 'calendar_month',
    'current_mrr', 'active_subscriptions', 'total_seats',
    'usage_count', 'usage_duration_secs', 'error_count',
    'n_unique_features', 'has_beta_feature',
    'n_tickets', 'avg_resolution_hours', 'n_escalations',
    'had_churn_in_m'
]

CATEGORICAL_FEATURES = ['industry', 'country', 'referral_source', 'account_plan_tier']
NUMERICAL_FEATURES = [f for f in APPROVED_FEATURES if f not in CATEGORICAL_FEATURES]

# Encode categoricals
label_encoders = {}
for cat in CATEGORICAL_FEATURES:
    le = LabelEncoder()
    panel[cat] = le.fit_transform(panel[cat].astype(str))
    label_encoders[cat] = le

# Convert booleans to int
for col in ['has_beta_feature', 'had_churn_in_m']:
    panel[col] = panel[col].astype(int)

# ── 3. BUILD FEATURE / TARGET MATRICES ──────────────────────────────────
# Regression target: next_month_mrr
# Classification target: target_churn_event_t1

# Filter to rows with valid targets
reg_data = panel.dropna(subset=['next_month_mrr']).copy()
cls_data = panel.dropna(subset=['target_churn_event_t1']).copy()

# For regression, restrict to active accounts (current_mrr > 0)
reg_data = reg_data[reg_data['current_mrr'] > 0].copy()

print(f'Regression samples (active MRR): {len(reg_data)}')
print(f'Classification samples: {len(cls_data)}')

# Save features and targets
reg_data[APPROVED_FEATURES].to_csv(os.path.join(PROCESSED, 'model1_features.csv'), index=False)
reg_data[['next_month_mrr']].to_csv(os.path.join(PROCESSED, 'model1_target.csv'), index=False)

# ── 4. OUT-OF-TIME SPLIT ────────────────────────────────────────────────
TRAIN_END = pd.Period('2024-06', freq='M')
TEST_START = pd.Period('2024-07', freq='M')

# Regression split
reg_train = reg_data[reg_data['month'] <= TRAIN_END]
reg_test = reg_data[reg_data['month'] >= TEST_START]

# Classification split
cls_train = cls_data[cls_data['month'] <= TRAIN_END]
cls_test = cls_data[cls_data['month'] >= TEST_START]

print(f'\nRegression Train: {len(reg_train)} | Test: {len(reg_test)}')
print(f'Classification Train: {len(cls_train)} | Test: {len(cls_test)}')

# Save splits
reg_train[APPROVED_FEATURES + ['next_month_mrr', 'account_id', 'month']].to_csv(
    os.path.join(SPLITS, 'reg_train.csv'), index=False)
reg_test[APPROVED_FEATURES + ['next_month_mrr', 'account_id', 'month']].to_csv(
    os.path.join(SPLITS, 'reg_test.csv'), index=False)

X_train_reg = reg_train[APPROVED_FEATURES].values
y_train_reg = reg_train['next_month_mrr'].values
X_test_reg = reg_test[APPROVED_FEATURES].values
y_test_reg = reg_test['next_month_mrr'].values

X_train_cls = cls_train[APPROVED_FEATURES].values
y_train_cls = cls_train['target_churn_event_t1'].values
X_test_cls = cls_test[APPROVED_FEATURES].values
y_test_cls = cls_test['target_churn_event_t1'].values

# ── 5. HELPER: Compute Metrics ──────────────────────────────────────────
def regression_metrics(y_true, y_pred, label=''):
    mae = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    r2 = r2_score(y_true, y_pred)
    # MAPE (avoid division by zero)
    mask = y_true > 0
    if mask.sum() > 0:
        mape = np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100
    else:
        mape = float('nan')
    # Directional accuracy: does the predicted change direction match actual?
    # We need current_mrr for this
    return {'model': label, 'MAE': mae, 'RMSE': rmse, 'R2': r2, 'MAPE': mape}

def directional_accuracy(y_true, y_pred, current_mrr):
    actual_dir = np.sign(y_true - current_mrr)
    pred_dir = np.sign(y_pred - current_mrr)
    return np.mean(actual_dir == pred_dir) * 100

def classification_metrics(y_true, y_pred_proba, y_pred, label=''):
    rocauc = roc_auc_score(y_true, y_pred_proba) if len(np.unique(y_true)) > 1 else 0
    prauc = average_precision_score(y_true, y_pred_proba) if len(np.unique(y_true)) > 1 else 0
    prec = precision_score(y_true, y_pred, zero_division=0)
    rec = recall_score(y_true, y_pred, zero_division=0)
    f1 = f1_score(y_true, y_pred, zero_division=0)
    cm = confusion_matrix(y_true, y_pred).tolist()
    brier = brier_score_loss(y_true, y_pred_proba)
    return {
        'model': label, 'ROC_AUC': rocauc, 'PR_AUC': prauc,
        'Precision': prec, 'Recall': rec, 'F1': f1,
        'Confusion_Matrix': cm, 'Brier_Score': brier
    }

# ── 6. REGRESSION BASELINES + XGBOOST ───────────────────────────────────
print('\n' + '=' * 70)
print('MODEL 1A: NEXT-MONTH MRR REGRESSION')
print('=' * 70)

current_mrr_train = reg_train['current_mrr'].values
current_mrr_test = reg_test['current_mrr'].values

results_reg = []

# Baseline 1: Naive Persistence (predicted = current_mrr)
naive_pred = current_mrr_test.copy()
m = regression_metrics(y_test_reg, naive_pred, 'Naive Persistence')
m['DirAcc'] = directional_accuracy(y_test_reg, naive_pred, current_mrr_test)
results_reg.append(m)
print(f"\nNaive Persistence: MAE=${m['MAE']:.2f}, RMSE=${m['RMSE']:.2f}, R2={m['R2']:.4f}, MAPE={m['MAPE']:.2f}%, DirAcc={m['DirAcc']:.1f}%")

# Baseline 2: Ridge Regression
ridge = Ridge(alpha=1.0)
ridge.fit(X_train_reg, y_train_reg)
ridge_pred = ridge.predict(X_test_reg)
m = regression_metrics(y_test_reg, ridge_pred, 'Ridge Regression')
m['DirAcc'] = directional_accuracy(y_test_reg, ridge_pred, current_mrr_test)
results_reg.append(m)
print(f"Ridge Regression:  MAE=${m['MAE']:.2f}, RMSE=${m['RMSE']:.2f}, R2={m['R2']:.4f}, MAPE={m['MAPE']:.2f}%, DirAcc={m['DirAcc']:.1f}%")

# XGBRegressor
xgb_reg = xgb.XGBRegressor(
    n_estimators=300,
    max_depth=5,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    reg_alpha=0.1,
    reg_lambda=1.0,
    random_state=42,
    n_jobs=-1,
    verbosity=0
)
xgb_reg.fit(X_train_reg, y_train_reg,
            eval_set=[(X_test_reg, y_test_reg)],
            verbose=False)
xgb_pred = xgb_reg.predict(X_test_reg)
m = regression_metrics(y_test_reg, xgb_pred, 'XGBRegressor')
m['DirAcc'] = directional_accuracy(y_test_reg, xgb_pred, current_mrr_test)
results_reg.append(m)
print(f"XGBRegressor:      MAE=${m['MAE']:.2f}, RMSE=${m['RMSE']:.2f}, R2={m['R2']:.4f}, MAPE={m['MAPE']:.2f}%, DirAcc={m['DirAcc']:.1f}%")

# Feature importance
fi_reg = pd.DataFrame({
    'feature': APPROVED_FEATURES,
    'importance': xgb_reg.feature_importances_
}).sort_values('importance', ascending=False)
print('\nTop 10 Features (MRR Regression):')
for i, row in fi_reg.head(10).iterrows():
    print(f"  {row['feature']:30s}: {row['importance']:.4f}")

# ── 7. CHURN CLASSIFICATION BASELINES + XGBOOST ─────────────────────────
print('\n' + '=' * 70)
print('MODEL 1B: CHURN/CONTRACTION EVENT CLASSIFICATION')
print('=' * 70)

results_cls = []

# Baseline 1: DummyClassifier
dummy = DummyClassifier(strategy='prior', random_state=42)
dummy.fit(X_train_cls, y_train_cls)
dummy_pred = dummy.predict(X_test_cls)
dummy_proba = dummy.predict_proba(X_test_cls)[:, 1]
m = classification_metrics(y_test_cls, dummy_proba, dummy_pred, 'DummyClassifier')
results_cls.append(m)
print(f"\nDummy:    ROC-AUC={m['ROC_AUC']:.4f}, PR-AUC={m['PR_AUC']:.4f}, F1={m['F1']:.4f}, Precision={m['Precision']:.4f}, Recall={m['Recall']:.4f}")

# Baseline 2: Logistic Regression
logreg = LogisticRegression(max_iter=1000, random_state=42, class_weight='balanced')
logreg.fit(X_train_cls, y_train_cls)
logreg_pred = logreg.predict(X_test_cls)
logreg_proba = logreg.predict_proba(X_test_cls)[:, 1]
m = classification_metrics(y_test_cls, logreg_proba, logreg_pred, 'LogisticRegression')
results_cls.append(m)
print(f"LogReg:   ROC-AUC={m['ROC_AUC']:.4f}, PR-AUC={m['PR_AUC']:.4f}, F1={m['F1']:.4f}, Precision={m['Precision']:.4f}, Recall={m['Recall']:.4f}")

# XGBClassifier
pos_weight = (y_train_cls == 0).sum() / max((y_train_cls == 1).sum(), 1)
xgb_cls = xgb.XGBClassifier(
    n_estimators=300,
    max_depth=4,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    scale_pos_weight=pos_weight,
    reg_alpha=0.1,
    reg_lambda=1.0,
    random_state=42,
    n_jobs=-1,
    eval_metric='aucpr',
    verbosity=0
)
xgb_cls.fit(X_train_cls, y_train_cls,
            eval_set=[(X_test_cls, y_test_cls)],
            verbose=False)
xgb_cls_pred = xgb_cls.predict(X_test_cls)
xgb_cls_proba = xgb_cls.predict_proba(X_test_cls)[:, 1]
m = classification_metrics(y_test_cls, xgb_cls_proba, xgb_cls_pred, 'XGBClassifier')
results_cls.append(m)
print(f"XGBoost:  ROC-AUC={m['ROC_AUC']:.4f}, PR-AUC={m['PR_AUC']:.4f}, F1={m['F1']:.4f}, Precision={m['Precision']:.4f}, Recall={m['Recall']:.4f}")
print(f"          Confusion Matrix: {m['Confusion_Matrix']}")

# Feature importance
fi_cls = pd.DataFrame({
    'feature': APPROVED_FEATURES,
    'importance': xgb_cls.feature_importances_
}).sort_values('importance', ascending=False)
print('\nTop 10 Features (Churn Classification):')
for i, row in fi_cls.head(10).iterrows():
    print(f"  {row['feature']:30s}: {row['importance']:.4f}")

# ── 8. SAVE MODEL ARTIFACTS ─────────────────────────────────────────────
print('\n' + '=' * 70)
print('SAVING MODEL 1 ARTIFACTS')
print('=' * 70)

# Save XGBoost models
xgb_reg.save_model(os.path.join(MODELS, 'decision_simulator_revenue_v1.json'))
xgb_cls.save_model(os.path.join(MODELS, 'decision_simulator_churn_v1.json'))

# Save sklearn baselines
joblib.dump(ridge, os.path.join(MODELS, 'model1_ridge_baseline.joblib'))
joblib.dump(logreg, os.path.join(MODELS, 'model1_logreg_baseline.joblib'))

# Save label encoders
joblib.dump(label_encoders, os.path.join(MODELS, 'model1_label_encoders.joblib'))

# Save feature metadata
meta = {
    'approved_features': APPROVED_FEATURES,
    'categorical_features': CATEGORICAL_FEATURES,
    'numerical_features': NUMERICAL_FEATURES,
    'label_encoder_classes': {k: v.classes_.tolist() for k, v in label_encoders.items()},
    'train_period': '2023-01 to 2024-06',
    'test_period': '2024-07 to 2024-12',
    'regression_train_n': len(reg_train),
    'regression_test_n': len(reg_test),
    'classification_train_n': len(cls_train),
    'classification_test_n': len(cls_test),
}
with open(os.path.join(MODELS, 'model1_metadata.json'), 'w') as f:
    json.dump(meta, f, indent=2)

# Save feature importance
fi_reg.to_csv(os.path.join(MODELS, 'model1_reg_feature_importance.csv'), index=False)
fi_cls.to_csv(os.path.join(MODELS, 'model1_cls_feature_importance.csv'), index=False)

# Save results
results_all = {
    'regression': results_reg,
    'classification': [{k: v for k, v in r.items()} for r in results_cls]
}
with open(os.path.join(MODELS, 'model1_training_metrics.json'), 'w') as f:
    json.dump(results_all, f, indent=2, default=str)

print('All Model 1 artifacts saved to ml/models/')
print('  decision_simulator_revenue_v1.json')
print('  decision_simulator_churn_v1.json')
print('  model1_ridge_baseline.joblib')
print('  model1_logreg_baseline.joblib')
print('  model1_label_encoders.joblib')
print('  model1_metadata.json')
print('  model1_training_metrics.json')
print('  model1_reg_feature_importance.csv')
print('  model1_cls_feature_importance.csv')
