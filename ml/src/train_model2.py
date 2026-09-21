"""
MODEL 2: Startup Risk & Outcome Classification (Stage 0 Day-0)
==============================================================
- XGBClassifier for `failed` binary target
- Baselines: DummyClassifier, LogisticRegression, RandomForest
- Stage 0 features only (known at founding)
- Strict exclusion of leakage variables
"""
import os, json, warnings
import numpy as np
import pandas as pd
import joblib
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.dummy import DummyClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.calibration import calibration_curve
from sklearn.metrics import (
    roc_auc_score, average_precision_score, precision_score,
    recall_score, f1_score, confusion_matrix, brier_score_loss,
    accuracy_score
)
import xgboost as xgb

warnings.filterwarnings('ignore')

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(BASE, 'data', 'raw', 'startup_survival')
PROCESSED = os.path.join(BASE, 'data', 'processed')
SPLITS = os.path.join(BASE, 'data', 'splits', 'model2')
MODELS = os.path.join(BASE, 'models')
for d in [PROCESSED, SPLITS, MODELS]:
    os.makedirs(d, exist_ok=True)

# ── 1. LOAD RAW DATA ────────────────────────────────────────────────────
print('=' * 70)
print('MODEL 2: LOADING STARTUP SURVIVAL DATA')
print('=' * 70)

df = pd.read_csv(os.path.join(RAW, 'startup_survival_master.csv'))
print(f'Raw data loaded: {df.shape[0]} rows, {df.shape[1]} columns')

# ── 2. STRICT LEAKAGE EXCLUSION ─────────────────────────────────────────
EXCLUDED_COLUMNS = [
    'startup_id',         # Non-informative identifier
    'years_to_outcome',   # CRITICAL LEAKAGE: post-hoc lifespan
    'failure_reason',     # CRITICAL LEAKAGE: outcome proxy
    'survived_5y',        # Alternate target
    'outcome',            # Alternate target (multiclass)
    'total_raised_usd',   # Cumulative lifetime leakage
    'weekly_hours',       # Keep but note it's borderline
]

# Stage 0 features: known at founding / Day 0
STAGE0_FEATURES = [
    'industry',
    'founding_year',
    'macro_climate',
    'market_size_score',
    'competition_intensity',
    'founder_prior_exits',
    'prior_failures',
    'domain_experience_years',
    'technical_cofounder',
    'n_cofounders',
    'team_completeness',
    'age_of_founder',
    'funding_path',
    'monthly_burn_rate',
    'runway_months',
    'did_customer_validation',
]

TARGET = 'failed'
CATEGORICAL_FEATURES = ['industry', 'funding_path']

print(f'Stage 0 features: {len(STAGE0_FEATURES)}')
print(f'Target: {TARGET}')
print(f'Excluded (leakage): {EXCLUDED_COLUMNS}')

# ── 3. PREPROCESSING ────────────────────────────────────────────────────
data = df[STAGE0_FEATURES + [TARGET]].copy()

# Encode categoricals
label_encoders = {}
for cat in CATEGORICAL_FEATURES:
    le = LabelEncoder()
    data[cat] = le.fit_transform(data[cat].astype(str))
    label_encoders[cat] = le

X = data[STAGE0_FEATURES].values
y = data[TARGET].values

# Save processed features/targets
data[STAGE0_FEATURES].to_csv(os.path.join(PROCESSED, 'model2_features.csv'), index=False)
data[[TARGET]].to_csv(os.path.join(PROCESSED, 'model2_target.csv'), index=False)

# ── 4. STRATIFIED TRAIN/TEST SPLIT ──────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# Save splits
train_df = pd.DataFrame(X_train, columns=STAGE0_FEATURES)
train_df[TARGET] = y_train
train_df.to_csv(os.path.join(SPLITS, 'train.csv'), index=False)

test_df = pd.DataFrame(X_test, columns=STAGE0_FEATURES)
test_df[TARGET] = y_test
test_df.to_csv(os.path.join(SPLITS, 'test.csv'), index=False)

print(f'\nTrain: {len(X_train)} | Test: {len(X_test)}')
print(f'Train failure rate: {y_train.mean():.4f} | Test failure rate: {y_test.mean():.4f}')

# ── 5. HELPER ────────────────────────────────────────────────────────────
def cls_metrics(y_true, y_proba, y_pred, label=''):
    rocauc = roc_auc_score(y_true, y_proba) if len(np.unique(y_true)) > 1 else 0
    prauc = average_precision_score(y_true, y_proba) if len(np.unique(y_true)) > 1 else 0
    prec = precision_score(y_true, y_pred, zero_division=0)
    rec = recall_score(y_true, y_pred, zero_division=0)
    f1 = f1_score(y_true, y_pred, zero_division=0)
    acc = accuracy_score(y_true, y_pred)
    cm = confusion_matrix(y_true, y_pred).tolist()
    brier = brier_score_loss(y_true, y_proba)
    return {
        'model': label, 'ROC_AUC': rocauc, 'PR_AUC': prauc,
        'Precision': prec, 'Recall': rec, 'F1': f1,
        'Accuracy': acc, 'Confusion_Matrix': cm, 'Brier_Score': brier
    }

# ── 6. BASELINES + XGBOOST ──────────────────────────────────────────────
print('\n' + '=' * 70)
print('MODEL 2: STARTUP SURVIVAL CLASSIFICATION (STAGE 0)')
print('=' * 70)

results = []

# 1. DummyClassifier
dummy = DummyClassifier(strategy='prior', random_state=42)
dummy.fit(X_train, y_train)
dummy_pred = dummy.predict(X_test)
dummy_proba = dummy.predict_proba(X_test)[:, 1]
m = cls_metrics(y_test, dummy_proba, dummy_pred, 'DummyClassifier')
results.append(m)
print(f"\nDummy:   ROC-AUC={m['ROC_AUC']:.4f}, PR-AUC={m['PR_AUC']:.4f}, F1={m['F1']:.4f}, Brier={m['Brier_Score']:.4f}, Acc={m['Accuracy']:.4f}")

# 2. Logistic Regression
logreg = LogisticRegression(max_iter=1000, random_state=42, class_weight='balanced')
logreg.fit(X_train, y_train)
logreg_pred = logreg.predict(X_test)
logreg_proba = logreg.predict_proba(X_test)[:, 1]
m = cls_metrics(y_test, logreg_proba, logreg_pred, 'LogisticRegression')
results.append(m)
print(f"LogReg:  ROC-AUC={m['ROC_AUC']:.4f}, PR-AUC={m['PR_AUC']:.4f}, F1={m['F1']:.4f}, Brier={m['Brier_Score']:.4f}, Acc={m['Accuracy']:.4f}")

# 3. Random Forest
rf = RandomForestClassifier(
    n_estimators=200, max_depth=10, random_state=42,
    class_weight='balanced', n_jobs=-1
)
rf.fit(X_train, y_train)
rf_pred = rf.predict(X_test)
rf_proba = rf.predict_proba(X_test)[:, 1]
m = cls_metrics(y_test, rf_proba, rf_pred, 'RandomForest')
results.append(m)
print(f"RF:      ROC-AUC={m['ROC_AUC']:.4f}, PR-AUC={m['PR_AUC']:.4f}, F1={m['F1']:.4f}, Brier={m['Brier_Score']:.4f}, Acc={m['Accuracy']:.4f}")

# 4. XGBClassifier
xgb_cls = xgb.XGBClassifier(
    n_estimators=400,
    max_depth=5,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    reg_alpha=0.1,
    reg_lambda=1.0,
    random_state=42,
    n_jobs=-1,
    eval_metric='aucpr',
    verbosity=0
)
xgb_cls.fit(X_train, y_train,
            eval_set=[(X_test, y_test)],
            verbose=False)
xgb_pred = xgb_cls.predict(X_test)
xgb_proba = xgb_cls.predict_proba(X_test)[:, 1]
m = cls_metrics(y_test, xgb_proba, xgb_pred, 'XGBClassifier')
results.append(m)
print(f"XGBoost: ROC-AUC={m['ROC_AUC']:.4f}, PR-AUC={m['PR_AUC']:.4f}, F1={m['F1']:.4f}, Brier={m['Brier_Score']:.4f}, Acc={m['Accuracy']:.4f}")
print(f"         Confusion Matrix: {m['Confusion_Matrix']}")

# Feature importance
fi = pd.DataFrame({
    'feature': STAGE0_FEATURES,
    'importance': xgb_cls.feature_importances_
}).sort_values('importance', ascending=False)
print('\nTop 16 Features (Startup Survival):')
for i, row in fi.iterrows():
    print(f"  {row['feature']:30s}: {row['importance']:.4f}")

# Calibration check
print('\nCalibration Check (Brier Scores):')
for r in results:
    print(f"  {r['model']:25s}: Brier={r['Brier_Score']:.4f}")

# ── 7. SAVE ARTIFACTS ───────────────────────────────────────────────────
print('\n' + '=' * 70)
print('SAVING MODEL 2 ARTIFACTS')
print('=' * 70)

xgb_cls.save_model(os.path.join(MODELS, 'decision_simulator_startup_risk_v1.json'))
joblib.dump(logreg, os.path.join(MODELS, 'model2_logreg_baseline.joblib'))
joblib.dump(rf, os.path.join(MODELS, 'model2_rf_baseline.joblib'))
joblib.dump(label_encoders, os.path.join(MODELS, 'model2_label_encoders.joblib'))

meta = {
    'stage': 'Stage 0 (Day 0 / Founding)',
    'approved_features': STAGE0_FEATURES,
    'categorical_features': CATEGORICAL_FEATURES,
    'excluded_columns': EXCLUDED_COLUMNS,
    'target': TARGET,
    'label_encoder_classes': {k: v.classes_.tolist() for k, v in label_encoders.items()},
    'train_n': len(X_train),
    'test_n': len(X_test),
    'train_failure_rate': float(y_train.mean()),
    'test_failure_rate': float(y_test.mean()),
    'data_nature': 'SYNTHETIC (procedurally generated, calibrated to BLS/CBI statistics)',
}
with open(os.path.join(MODELS, 'model2_metadata.json'), 'w') as f:
    json.dump(meta, f, indent=2)

fi.to_csv(os.path.join(MODELS, 'model2_feature_importance.csv'), index=False)

with open(os.path.join(MODELS, 'model2_training_metrics.json'), 'w') as f:
    json.dump([{k: v for k, v in r.items()} for r in results], f, indent=2, default=str)

print('All Model 2 artifacts saved to ml/models/')
print('  decision_simulator_startup_risk_v1.json')
print('  model2_logreg_baseline.joblib')
print('  model2_rf_baseline.joblib')
print('  model2_label_encoders.joblib')
print('  model2_metadata.json')
print('  model2_training_metrics.json')
print('  model2_feature_importance.csv')
