import unittest
import asyncio
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

from backend.main import app
from backend.services.company_context_service import CompanyContextService, _RESEARCH_CACHE
from backend.services.web_search_service import SearchResult


class TestCompanyContextArchitecture(unittest.TestCase):
    """
    Verifies that the Decision Simulator strictly adheres to the COMPANY-CONTEXT-FIRST principle:
    - Never fabricates startup metrics or defaults from benchmark datasets.
    - Cold-start startups (null MRR/runway) receive truthful nulls + rich qualitative guidance.
    - Verified financial startups receive accurate quantitative forecasts and runway updates.
    """

    @classmethod
    def setUpClass(cls):
        _RESEARCH_CACHE.clear()
        cls.client = TestClient(app)
        cls.search_patcher = patch(
            "backend.services.company_context_service.search_tavily",
            new_callable=AsyncMock
        )
        cls.mock_search = cls.search_patcher.start()
        cls.mock_search.return_value = [
            SearchResult(
                title="SaaS Benchmark Intelligence",
                url="https://saas-benchmarks.test/trends",
                snippet="B2B SaaS product adoption trends indicate feature expansion improves retention."
            )
        ]

    @classmethod
    def tearDownClass(cls):
        cls.search_patcher.stop()
        _RESEARCH_CACHE.clear()

    def setUp(self):
        _RESEARCH_CACHE.clear()

    def test_01_cold_start_company_no_fabricated_numbers(self):
        """
        Test 1: Cold-start company (null MRR / cash / runway).
        Ensures:
        - baseline & scenario revenue_forecast are None
        - runway_months is None (truthful)
        - predictions dictionary clearly reports INSUFFICIENT_DATA status
        - qualitative co-founder explanation and recommendation are still provided
        - company_context payload is attached and records 'unspecified' status
        """
        cold_start_profile = {
            "company_id": "cold_start_startup_101",
            "name": "StealthCorp",
            "industry": "Developer Tools",
            "stage": "ideation",
            "monthly_revenue": None,
            "monthly_burn": None,
            "cash_balance": None,
            "runway_months": None,
            "n_unique_features": 1,
            "has_beta_feature": 0,
            "did_customer_validation": 1
        }

        with patch.object(CompanyContextService, "get_company_profile", new_callable=AsyncMock) as mock_prof:
            mock_prof.return_value = cold_start_profile

            response = self.client.post(
                "/api/simulator/intelligence",
                json={
                    "company_id": "cold_start_startup_101",
                    "decision": "Launch a maps feature where users can connect with people in their area and hangout"
                }
            )
            self.assertEqual(response.status_code, 200)
            data = response.json()

            # 1. Decision classification
            self.assertEqual(data["decision"]["decision_type"], "feature_launch")
            self.assertEqual(data["simulation_engine"], "MODEL_POWERED")

            # 2. Truthful nulls: No fabricated revenue or runway
            self.assertIsNone(data["baseline"]["revenue_forecast"])
            self.assertIsNone(data["scenario"]["revenue_forecast"])
            self.assertIsNone(data["baseline"]["metrics"]["runway_months"])
            self.assertIsNone(data["scenario"]["metrics"]["runway_months"])

            # 3. Transparent prediction insufficiency status
            self.assertIn("predictions", data)
            rev_pred = data["predictions"]["revenue_forecast"]
            self.assertEqual(rev_pred["status"], "INSUFFICIENT_DATA")
            self.assertIsNone(rev_pred["forecast"])
            self.assertTrue(any(k in rev_pred["reason"].lower() for k in ["missing", "no verified", "unavailable"]))

            # 4. Rich qualitative analysis is still provided
            self.assertIn(data["recommendation"], ["Proceed", "Proceed with caution", "Reconsider", "Insufficient evidence"])
            self.assertTrue(len(data["ai_cofounder_explanation"]) > 20)
            self.assertTrue(any(phrase in data["ai_cofounder_explanation"].lower() for phrase in ["verified revenue", "defensible revenue forecast", "unknown"]))
            self.assertTrue(len(data["assumptions"]) > 0)
            self.assertTrue(len(data["limitations"]) > 0)

            # 5. Evidence pipeline is active
            self.assertIn("evidence", data)
            self.assertIn("competitors", data["evidence"])
            self.assertIn("market", data["evidence"])

            # 6. Company context metadata is truthful
            self.assertIn("company_context", data)
            metrics_meta = data["company_context"]["canonical_metrics"]
            self.assertIn(metrics_meta["monthly_revenue"]["status"], ["missing", "unspecified"])
            self.assertIsNone(metrics_meta["monthly_revenue"]["value"])

    def test_02_financial_company_known_metrics_produces_forecast(self):
        """
        Test 2: Financial company with verified MRR, burn, cash, and runway.
        Ensures:
        - baseline & scenario revenue_forecast are computed by ML model (positive floats)
        - baseline runway_months matches company verified data
        - predictions dictionary reports AVAILABLE status with numerical values
        - delta is computed truthfully
        """
        verified_profile = {
            "company_id": "verified_startup_202",
            "name": "ActiveMetrics Inc",
            "industry": "B2B SaaS",
            "stage": "seed",
            "current_stage": "seed",
            "monthly_revenue": 18000.0,
            "monthly_burn": 24000.0,
            "cash_balance": 240000.0,
            "runway_months": 10.0,
            "total_users": 250,
            "n_unique_features": 3,
            "has_beta_feature": 0,
            "did_customer_validation": 1,
            "funding_total_usd": 350000.0,
            "funding_rounds": 1
        }

        with patch.object(CompanyContextService, "get_company_profile", new_callable=AsyncMock) as mock_prof:
            mock_prof.return_value = verified_profile

            response = self.client.post(
                "/api/simulator/intelligence",
                json={
                    "company_id": "verified_startup_202",
                    "decision": "Launch a maps feature where users can connect with people in their area and hangout"
                }
            )
            self.assertEqual(response.status_code, 200)
            data = response.json()

            # 1. Decision classification
            self.assertEqual(data["decision"]["decision_type"], "feature_launch")
            self.assertEqual(data["simulation_engine"], "MODEL_POWERED")

            # 2. Quantitative predictions are available and positive
            self.assertIsNotNone(data["baseline"]["revenue_forecast"])
            self.assertGreater(data["baseline"]["revenue_forecast"], 0)
            self.assertIsNotNone(data["scenario"]["revenue_forecast"])
            self.assertGreater(data["scenario"]["revenue_forecast"], 0)

            # 3. Verified runway is preserved
            self.assertEqual(data["baseline"]["metrics"]["runway_months"], 10.0)

            # 4. Structured predictions report AVAILABLE
            self.assertIn("predictions", data)
            rev_pred = data["predictions"]["revenue_forecast"]
            self.assertEqual(rev_pred["status"], "AVAILABLE")
            self.assertIsInstance(rev_pred["forecast"], (int, float))

            # 5. Canonical metrics reflect verified company profile
            self.assertIn("company_context", data)
            metrics_meta = data["company_context"]["canonical_metrics"]
            self.assertEqual(metrics_meta["monthly_revenue"]["status"], "verified")
            self.assertEqual(metrics_meta["monthly_revenue"]["value"], 18000.0)


if __name__ == "__main__":
    unittest.main()
