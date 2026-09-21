import os
import unittest
import asyncio
from fastapi.testclient import TestClient
from backend.main import app
from backend.services.ml_service import MLService, get_ml_service
from backend.services.decision_parser_service import parse_founder_decision
from backend.services.scenario_engine import ScenarioEngine, get_scenario_engine


class TestMLServingSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ml_service = get_ml_service()
        cls.scenario_engine = get_scenario_engine()
        # Initialize test client
        cls.client = TestClient(app)

    # 1. TEST MODEL LOADING
    def test_01_model_loading(self):
        self.assertTrue(self.ml_service.is_loaded, "ML Service should be loaded")
        self.assertIsNotNone(self.ml_service.model1_reg, "Model 1 Regressor should be loaded")
        self.assertIsNotNone(self.ml_service.model1_cls, "Model 1 Classifier should be loaded")
        self.assertIsNotNone(self.ml_service.model2_cls, "Model 2 Classifier should be loaded")
        self.assertIsNotNone(self.ml_service.model1_ridge, "Model 1 Ridge baseline should be loaded")
        self.assertIsNotNone(self.ml_service.model2_rf, "Model 2 RF baseline should be loaded")
        self.assertIn("industry", self.ml_service.model1_encoders, "Model 1 encoders should contain industry")
        self.assertIn("funding_path", self.ml_service.model2_encoders, "Model 2 encoders should contain funding_path")

    # 2. TEST VALID FEATURE TRANSFORMATION
    def test_02_valid_feature_transformation(self):
        m1_input = {
            "industry": "DevTools",
            "country": "US",
            "referral_source": "organic",
            "account_plan_tier": "Pro",
            "current_mrr": 12000.0,
            "active_subscriptions": 2,
            "total_seats": 20
        }
        X1 = self.ml_service.transform_model1_features(m1_input)
        self.assertEqual(X1.shape, (1, 18), "Model 1 input vector must have 18 features")

        m2_input = {
            "industry": "tech_saas",
            "founding_year": 2024,
            "monthly_burn_rate": 25000.0,
            "runway_months": 15.0,
            "did_customer_validation": 1,
            "funding_path": "vc_seed"
        }
        X2 = self.ml_service.transform_model2_features(m2_input)
        self.assertEqual(X2.shape, (1, 16), "Model 2 input vector must have 16 features")

    # 3. TEST INVALID FEATURE REJECTION
    def test_03_invalid_feature_rejection(self):
        # Negative current_mrr should fail Pydantic validation
        resp = self.client.post("/api/ml/revenue/predict", json={"current_mrr": -500.0})
        self.assertEqual(resp.status_code, 422, "Negative MRR should be rejected with 422 Unprocessable Entity")

        # Missing required burn rate for startup risk
        resp2 = self.client.post("/api/ml/startup-risk/predict", json={"runway_months": 12.0})
        self.assertEqual(resp2.status_code, 422, "Missing monthly_burn_rate should be rejected with 422")

    # 4. TEST REVENUE PREDICTION
    def test_04_revenue_prediction(self):
        payload = {
            "industry": "DevTools",
            "country": "US",
            "referral_source": "organic",
            "account_plan_tier": "Pro",
            "current_mrr": 15000.0,
            "active_subscriptions": 3,
            "total_seats": 35
        }
        res = self.ml_service.predict_next_month_mrr(payload)
        self.assertEqual(res["model"], "DecisionSimulator-RevenueForecast-v1")
        self.assertIn("next_month_mrr", res["prediction"])
        self.assertIn("baseline_ridge_mrr", res["prediction"])
        self.assertIn("baseline_persistence_mrr", res["prediction"])
        self.assertGreater(res["prediction"]["next_month_mrr"], 0.0)
        self.assertIn("causal_disclaimer", res)
        self.assertGreater(len(res["drivers"]), 0)

    # 5. TEST CHURN PREDICTION
    def test_05_churn_prediction(self):
        payload = {
            "industry": "FinTech",
            "country": "UK",
            "current_mrr": 8500.0,
            "usage_count": 250,
            "error_count": 5
        }
        res = self.ml_service.predict_churn_risk(payload)
        self.assertEqual(res["model"], "DecisionSimulator-ChurnRisk-v1")
        self.assertIn("churn_probability", res["risk"])
        self.assertIn("retention_probability", res["risk"])
        self.assertGreaterEqual(res["risk"]["churn_probability"], 0.0)
        self.assertLessEqual(res["risk"]["churn_probability"], 1.0)

    # 6. TEST STARTUP RISK PREDICTION
    def test_06_startup_risk_prediction(self):
        payload = {
            "industry": "tech_saas",
            "founding_year": 2024,
            "macro_climate": 7.0,
            "monthly_burn_rate": 20000.0,
            "runway_months": 18.0,
            "did_customer_validation": 1,
            "funding_path": "bootstrapped"
        }
        res = self.ml_service.predict_startup_failure_risk(payload)
        self.assertEqual(res["model"], "DecisionSimulator-StartupSurvival-v1")
        self.assertIn("failure_probability", res["risk"])
        self.assertIn("survival_probability", res["risk"])
        self.assertIn("calibration", res)
        self.assertIn("brier_score", res["calibration"])
        self.assertAlmostEqual(
            res["risk"]["failure_probability"] + res["risk"]["survival_probability"],
            1.0,
            places=2
        )

    # 7. TEST DECISION PARSING
    def test_07_decision_parsing(self):
        # Fundraising
        d1 = asyncio.run(parse_founder_decision("I want to raise $500k in seed funding"))
        self.assertEqual(d1["decision_type"], "fundraising")
        self.assertEqual(d1["coverage_status"], "SUPPORTED")
        self.assertEqual(d1["parameters"]["raise_amount"], 500000.0)

        # Pricing
        d2 = asyncio.run(parse_founder_decision("I'm thinking about increasing our Pro pricing from $99 to $129."))
        self.assertEqual(d2["decision_type"], "pricing_change")
        self.assertEqual(d2["coverage_status"], "PARTIALLY_SUPPORTED")
        self.assertEqual(d2["parameters"]["old_price"], 99.0)
        self.assertEqual(d2["parameters"]["new_price"], 129.0)

        # Hiring
        d3 = asyncio.run(parse_founder_decision("I'm considering hiring two engineers."))
        self.assertEqual(d3["decision_type"], "hiring")
        self.assertEqual(d3["coverage_status"], "PARTIALLY_SUPPORTED")
        self.assertEqual(d3["parameters"]["hire_count"], 2)

    # 8. TEST SCENARIO TRANSFORMATION
    def test_08_scenario_transformation(self):
        base_state = {
            "current_mrr": 10000.0,
            "monthly_burn_rate": 20000.0,
            "cash_balance": 240000.0,
            "runway_months": 12.0,
            "has_beta_feature": 0,
            "n_unique_features": 3,
            "did_customer_validation": 1,
            "funding_total_usd": 500000.0,
            "funding_rounds": 1,
        }
        new_state, assumptions, transformed = self.scenario_engine._apply_transformation(
            base_state=base_state,
            decision_type="burn_adjustment",
            params={"target_burn": 12000.0}
        )
        self.assertEqual(new_state["monthly_burn_rate"], 12000.0)
        self.assertGreater(new_state["runway_months"], base_state["runway_months"])
        self.assertTrue(any("burn adjusted" in a.lower() for a in assumptions))
        self.assertIn("Model 2 (Startup Survival Risk)", transformed)

    # 9. TEST BASELINE VS SCENARIO COMPARISON
    def test_09_baseline_vs_scenario_comparison(self):
        base_state = {
            "current_mrr": 10000.0,
            "monthly_burn_rate": 20000.0,
            "cash_balance": 240000.0,
            "runway_months": 12.0,
            "industry": "DevTools",
            "current_stage": "seed",
            "active_subscriptions": 25,
            "total_users": 100,
            "has_beta_feature": 0,
            "n_unique_features": 3,
            "did_customer_validation": 1,
            "funding_total_usd": 500000.0,
            "funding_rounds": 1,
        }
        res = asyncio.run(self.scenario_engine.evaluate_decision(
            decision_text="Raise $500k seed funding",
            company_state=base_state
        ))
        self.assertEqual(res["simulation_engine"], "MODEL_POWERED")
        self.assertIn("comparison", res)
        self.assertIn("revenue_forecast", res["comparison"])
        self.assertIn("startup_failure_risk", res["comparison"])
        self.assertIn("assumptions", res)
        self.assertIn("evidence", res)
        self.assertIn("causal_disclaimer", res)
        # Raising money should reduce or maintain failure probability
        base_risk = res["comparison"]["startup_failure_risk"]["baseline_probability"]
        scen_risk = res["comparison"]["startup_failure_risk"]["scenario_probability"]
        self.assertIsNotNone(base_risk)
        self.assertIsNotNone(scen_risk)
        self.assertLessEqual(scen_risk, base_risk)

    # 10. TEST UNSUPPORTED DECISION HANDLING
    def test_10_unsupported_decision_handling(self):
        res = asyncio.run(self.scenario_engine.evaluate_decision(
            decision_text="Expand country to Germany and France"
        ))
        self.assertEqual(res["coverage_status"], "UNSUPPORTED")
        self.assertEqual(res["simulation_engine"], "RULE_BASED")
        self.assertIn("Insufficient model coverage", res["message"])
        self.assertIn("assumptions", res)
        self.assertIn("evidence", res)

    # 11. TEST API ENDPOINTS VIA TESTCLIENT
    def test_11_fastapi_endpoints(self):
        # GET /api/ml/models
        resp_models = self.client.get("/api/ml/models")
        self.assertEqual(resp_models.status_code, 200)
        self.assertIn("revenue_forecast", resp_models.json()["models"])

        # POST /api/simulator/coverage
        resp_cov = self.client.get("/api/simulator/coverage")
        self.assertEqual(resp_cov.status_code, 200)
        self.assertIn("supported_decisions", resp_cov.json())

        # POST /api/simulator/parse-decision
        resp_parse = self.client.post("/api/simulator/parse-decision", json={"decision_text": "Reduce burn by 30%"})
        self.assertEqual(resp_parse.status_code, 200)
        self.assertEqual(resp_parse.json()["decision_type"], "burn_adjustment")

        # POST /api/simulator/simulate
        resp_sim = self.client.post("/api/simulator/simulate", json={"decision_text": "Talk to 50 customers to validate willingness to pay"})
        self.assertEqual(resp_sim.status_code, 200)
        sim_data = resp_sim.json()
        self.assertEqual(sim_data["simulation_engine"], "MODEL_POWERED")
        self.assertIn("comparison", sim_data)


if __name__ == "__main__":
    unittest.main()
