import os
import json
import logging
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd
import joblib
import xgboost as xgb

logger = logging.getLogger(__name__)

# Base directories
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ML_DIR = os.path.join(BASE_DIR, "ml")
MODELS_DIR = os.path.join(ML_DIR, "models")
REGISTRY_PATH = os.path.join(ML_DIR, "model_registry.json")


class MLService:
    """
    Singleton service managing model loading, feature schema validation,
    exact encoder transformations, and structured inference for the Decision Simulator.
    """
    _instance: Optional["MLService"] = None

    def __init__(self):
        self.is_loaded = False
        self.registry: Dict[str, Any] = {}
        
        # Model 1: Revenue Forecast & Churn Risk
        self.model1_reg: Optional[xgb.XGBRegressor] = None
        self.model1_ridge: Optional[Any] = None
        self.model1_cls: Optional[xgb.XGBClassifier] = None
        self.model1_logreg: Optional[Any] = None
        self.model1_encoders: Dict[str, Any] = {}
        self.model1_meta: Dict[str, Any] = {}
        self.model1_reg_importance: List[Dict[str, Any]] = []
        self.model1_cls_importance: List[Dict[str, Any]] = []
        
        # Model 2: Startup Survival
        self.model2_cls: Optional[xgb.XGBClassifier] = None
        self.model2_rf: Optional[Any] = None
        self.model2_logreg: Optional[Any] = None
        self.model2_encoders: Dict[str, Any] = {}
        self.model2_meta: Dict[str, Any] = {}
        self.model2_importance: List[Dict[str, Any]] = []

    @classmethod
    def get_instance(cls) -> "MLService":
        if cls._instance is None:
            cls._instance = cls()
            cls._instance.load_models()
        return cls._instance

    def load_models(self) -> None:
        """Loads all serialized models, encoders, and schemas into memory once."""
        if self.is_loaded:
            return

        logger.info("[ml_service] Initializing ML Model Service...")

        # Load registry
        if os.path.exists(REGISTRY_PATH):
            with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
                self.registry = json.load(f)
        else:
            logger.warning(f"[ml_service] Registry file not found at {REGISTRY_PATH}")

        # ── 1. LOAD MODEL 1 (RavenStack) ──────────────────────────────────
        try:
            # Metadata
            m1_meta_path = os.path.join(MODELS_DIR, "model1_metadata.json")
            if os.path.exists(m1_meta_path):
                with open(m1_meta_path, "r", encoding="utf-8") as f:
                    self.model1_meta = json.load(f)

            # Encoders
            m1_enc_path = os.path.join(MODELS_DIR, "model1_label_encoders.joblib")
            if os.path.exists(m1_enc_path):
                self.model1_encoders = joblib.load(m1_enc_path)

            # XGBoost Models
            m1_reg_path = os.path.join(MODELS_DIR, "decision_simulator_revenue_v1.json")
            if os.path.exists(m1_reg_path):
                self.model1_reg = xgb.XGBRegressor()
                self.model1_reg.load_model(m1_reg_path)

            m1_cls_path = os.path.join(MODELS_DIR, "decision_simulator_churn_v1.json")
            if os.path.exists(m1_cls_path):
                self.model1_cls = xgb.XGBClassifier()
                self.model1_cls.load_model(m1_cls_path)

            # Baseline Models
            m1_ridge_path = os.path.join(MODELS_DIR, "model1_ridge_baseline.joblib")
            if os.path.exists(m1_ridge_path):
                self.model1_ridge = joblib.load(m1_ridge_path)

            m1_logreg_path = os.path.join(MODELS_DIR, "model1_logreg_baseline.joblib")
            if os.path.exists(m1_logreg_path):
                self.model1_logreg = joblib.load(m1_logreg_path)

            # Feature Importances
            m1_reg_fi_path = os.path.join(MODELS_DIR, "model1_reg_feature_importance.csv")
            if os.path.exists(m1_reg_fi_path):
                df_fi = pd.read_csv(m1_reg_fi_path)
                self.model1_reg_importance = df_fi.to_dict(orient="records")

            m1_cls_fi_path = os.path.join(MODELS_DIR, "model1_cls_feature_importance.csv")
            if os.path.exists(m1_cls_fi_path):
                df_fi = pd.read_csv(m1_cls_fi_path)
                self.model1_cls_importance = df_fi.to_dict(orient="records")

            logger.info("[ml_service] Model 1 (Revenue & Churn) successfully loaded.")
        except Exception as e:
            logger.error(f"[ml_service] Error loading Model 1: {e}", exc_info=True)

        # ── 2. LOAD MODEL 2 (Startup Survival) ────────────────────────────
        try:
            # Metadata
            m2_meta_path = os.path.join(MODELS_DIR, "model2_metadata.json")
            if os.path.exists(m2_meta_path):
                with open(m2_meta_path, "r", encoding="utf-8") as f:
                    self.model2_meta = json.load(f)

            # Encoders
            m2_enc_path = os.path.join(MODELS_DIR, "model2_label_encoders.joblib")
            if os.path.exists(m2_enc_path):
                self.model2_encoders = joblib.load(m2_enc_path)

            # XGBoost Model
            m2_cls_path = os.path.join(MODELS_DIR, "decision_simulator_startup_risk_v1.json")
            if os.path.exists(m2_cls_path):
                self.model2_cls = xgb.XGBClassifier()
                self.model2_cls.load_model(m2_cls_path)

            # Baselines
            m2_rf_path = os.path.join(MODELS_DIR, "model2_rf_baseline.joblib")
            if os.path.exists(m2_rf_path):
                self.model2_rf = joblib.load(m2_rf_path)

            m2_logreg_path = os.path.join(MODELS_DIR, "model2_logreg_baseline.joblib")
            if os.path.exists(m2_logreg_path):
                self.model2_logreg = joblib.load(m2_logreg_path)

            # Feature Importance
            m2_fi_path = os.path.join(MODELS_DIR, "model2_feature_importance.csv")
            if os.path.exists(m2_fi_path):
                df_fi = pd.read_csv(m2_fi_path)
                self.model2_importance = df_fi.to_dict(orient="records")

            logger.info("[ml_service] Model 2 (Startup Survival) successfully loaded.")
        except Exception as e:
            logger.error(f"[ml_service] Error loading Model 2: {e}", exc_info=True)

        self.is_loaded = True

    # ──────────────────────────────────────────────────────────────────────────
    # PREPROCESSING HELPERS
    # ──────────────────────────────────────────────────────────────────────────
    def _encode_category(self, encoder: Any, val: Any) -> int:
        """Safely encodes a categorical value, falling back to 0 if unseen."""
        val_str = str(val).strip()
        if hasattr(encoder, "classes_"):
            if val_str in encoder.classes_:
                return int(encoder.transform([val_str])[0])
            # Case insensitive check
            classes_lower = [c.lower() for c in encoder.classes_]
            if val_str.lower() in classes_lower:
                idx = classes_lower.index(val_str.lower())
                return int(idx)
            return 0
        return 0

    def transform_model1_features(self, raw_features: Dict[str, Any]) -> np.ndarray:
        """
        Validates and transforms dictionary of features into the exact 18-element
        vector expected by Model 1 (Revenue & Churn).
        """
        approved_features = self.model1_meta.get("approved_features", [
            "industry", "country", "referral_source", "account_plan_tier",
            "tenure_months", "calendar_month", "current_mrr", "active_subscriptions",
            "total_seats", "usage_count", "usage_duration_secs", "error_count",
            "n_unique_features", "has_beta_feature", "n_tickets", "avg_resolution_hours",
            "n_escalations", "had_churn_in_m"
        ])

        # Defaults based on training panel medians/modes
        defaults = {
            "industry": "DevTools",
            "country": "US",
            "referral_source": "organic",
            "account_plan_tier": "Pro",
            "tenure_months": 12,
            "calendar_month": 6,
            "current_mrr": 5000.0,
            "active_subscriptions": 1,
            "total_seats": 10,
            "usage_count": 150,
            "usage_duration_secs": 18000,
            "error_count": 2,
            "n_unique_features": 5,
            "has_beta_feature": 0,
            "n_tickets": 1,
            "avg_resolution_hours": 12.0,
            "n_escalations": 0,
            "had_churn_in_m": 0
        }

        row = []
        for feat in approved_features:
            val = raw_features.get(feat, defaults.get(feat, 0))
            if feat in self.model1_encoders:
                encoded_val = self._encode_category(self.model1_encoders[feat], val)
                row.append(encoded_val)
            else:
                try:
                    row.append(float(val))
                except (ValueError, TypeError):
                    row.append(float(defaults.get(feat, 0)))

        return np.array(row, dtype=np.float32).reshape(1, -1)

    def transform_model2_features(self, raw_features: Dict[str, Any]) -> np.ndarray:
        """
        Validates and transforms dictionary of features into the exact 16-element
        vector expected by Model 2 (Startup Survival Stage 0).
        """
        approved_features = self.model2_meta.get("approved_features", [
            "industry", "founding_year", "macro_climate", "market_size_score",
            "competition_intensity", "founder_prior_exits", "prior_failures",
            "domain_experience_years", "technical_cofounder", "n_cofounders",
            "team_completeness", "age_of_founder", "funding_path",
            "monthly_burn_rate", "runway_months", "did_customer_validation"
        ])

        defaults = {
            "industry": "tech_saas",
            "founding_year": 2024,
            "macro_climate": 6.0,
            "market_size_score": 7.0,
            "competition_intensity": 5.0,
            "founder_prior_exits": 0,
            "prior_failures": 0,
            "domain_experience_years": 4.0,
            "technical_cofounder": 1,
            "n_cofounders": 2,
            "team_completeness": 6.0,
            "age_of_founder": 30,
            "funding_path": "bootstrapped",
            "monthly_burn_rate": 15000.0,
            "runway_months": 12.0,
            "did_customer_validation": 1
        }

        row = []
        for feat in approved_features:
            val = raw_features.get(feat, defaults.get(feat, 0))
            if feat in self.model2_encoders:
                encoded_val = self._encode_category(self.model2_encoders[feat], val)
                row.append(encoded_val)
            else:
                try:
                    row.append(float(val))
                except (ValueError, TypeError):
                    row.append(float(defaults.get(feat, 0)))

        return np.array(row, dtype=np.float32).reshape(1, -1)

    # ──────────────────────────────────────────────────────────────────────────
    # PREDICTION METHODS
    # ──────────────────────────────────────────────────────────────────────────
    def predict_next_month_mrr(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predicts next-month MRR using both XGBoost and Ridge baseline.
        Applies transparent reporting acknowledging Ridge and Naive benchmarks.
        """
        if not self.is_loaded or self.model1_reg is None:
            self.load_models()
        if self.model1_reg is None:
            raise RuntimeError("Model 1 Regressor is not loaded.")

        X = self.transform_model1_features(features)
        xgb_pred = float(self.model1_reg.predict(X)[0])

        current_mrr = float(features.get("current_mrr", 0.0))
        persistence_pred = current_mrr

        ridge_pred = None
        if self.model1_ridge is not None:
            try:
                ridge_pred = float(self.model1_ridge.predict(X)[0])
            except Exception as e:
                logger.warning(f"[ml_service] Ridge prediction failed: {e}")

        # Top drivers from actual feature importance
        drivers = self.model1_reg_importance[:5] if self.model1_reg_importance else []

        delta_estimated = xgb_pred - current_mrr
        pct_change = (delta_estimated / current_mrr * 100.0) if current_mrr > 0 else 0.0

        return {
            "model": "DecisionSimulator-RevenueForecast-v1",
            "model_type": "xgb_regressor",
            "prediction": {
                "next_month_mrr": round(max(0.0, xgb_pred), 2),
                "estimated_delta": round(delta_estimated, 2),
                "estimated_pct_change": round(pct_change, 2),
                "baseline_persistence_mrr": round(persistence_pred, 2),
                "baseline_ridge_mrr": round(max(0.0, ridge_pred), 2) if ridge_pred is not None else None
            },
            "drivers": drivers,
            "metadata": {
                "forecast_horizon": "1_month",
                "model_version": "v1.0.0",
                "feature_count": 18,
                "benchmark_note": "Autoregressive persistence is strong in SaaS panel data. Ridge regression achieved lower RMSE ($5,255 vs $6,748) than XGBoost on holdout evaluation."
            },
            "causal_disclaimer": "Estimated next-month MRR based on correlational operational panel features. Does not establish guaranteed causal intervention outcomes."
        }

    def predict_churn_risk(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predicts next-month subscription contraction or churn probability.
        """
        if not self.is_loaded or self.model1_cls is None:
            self.load_models()
        if self.model1_cls is None:
            raise RuntimeError("Model 1 Classifier is not loaded.")

        X = self.transform_model1_features(features)
        proba = float(self.model1_cls.predict_proba(X)[0, 1])

        logreg_proba = None
        if self.model1_logreg is not None:
            try:
                logreg_proba = float(self.model1_logreg.predict_proba(X)[0, 1])
            except Exception as e:
                logger.warning(f"[ml_service] Logistic Regression prediction failed: {e}")

        drivers = self.model1_cls_importance[:5] if self.model1_cls_importance else []

        return {
            "model": "DecisionSimulator-ChurnRisk-v1",
            "model_type": "xgb_classifier",
            "risk": {
                "churn_probability": round(proba, 4),
                "retention_probability": round(1.0 - proba, 4),
                "baseline_logreg_churn_prob": round(logreg_proba, 4) if logreg_proba is not None else None
            },
            "drivers": drivers,
            "metadata": {
                "forecast_horizon": "1_month",
                "model_version": "v1.0.0",
                "test_brier_score": 0.1311,
                "test_pr_auc": 0.1708
            },
            "causal_disclaimer": "Estimated churn probability based on historical subscription panel patterns. Signals risk tendency rather than guaranteed cancellation."
        }

    def predict_startup_failure_risk(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predicts probability of venture liquidation/failure at Stage 0 (Day-0).
        """
        if not self.is_loaded or self.model2_cls is None:
            self.load_models()
        if self.model2_cls is None:
            raise RuntimeError("Model 2 Classifier is not loaded.")

        X = self.transform_model2_features(features)
        failure_prob = float(self.model2_cls.predict_proba(X)[0, 1])
        survival_prob = 1.0 - failure_prob

        # RF baseline
        rf_failure_prob = None
        if self.model2_rf is not None:
            try:
                rf_failure_prob = float(self.model2_rf.predict_proba(X)[0, 1])
            except Exception as e:
                logger.warning(f"[ml_service] RF baseline prediction failed: {e}")

        drivers = self.model2_importance[:5] if self.model2_importance else []

        return {
            "model": "DecisionSimulator-StartupSurvival-v1",
            "model_type": "xgb_classifier",
            "risk": {
                "failure_probability": round(failure_prob, 4),
                "survival_probability": round(survival_prob, 4),
                "baseline_rf_failure_prob": round(rf_failure_prob, 4) if rf_failure_prob is not None else None
            },
            "calibration": {
                "brier_score": 0.2044,
                "roc_auc": 0.6821,
                "pr_auc": 0.8020,
                "test_accuracy": 0.6813
            },
            "drivers": drivers,
            "metadata": {
                "prediction_stage": "stage_0",
                "model_version": "v1.0.0",
                "sample_count": 48000
            },
            "causal_disclaimer": "Estimated failure risk based on Stage 0 macroeconomic and founder profiles. Does not guarantee a venture outcome."
        }


def get_ml_service() -> MLService:
    """Dependency helper returning singleton ML service."""
    return MLService.get_instance()
