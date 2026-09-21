import unittest
import asyncio
from fastapi.testclient import TestClient
from backend.main import app
from backend.services.decision_parser_service import parse_founder_decision


class TestFeatureLaunchParsingSuite(unittest.TestCase):
    """Verifies natural-language parsing of feature launch variants and regression protection."""

    def test_natural_language_feature_launch_variants(self):
        cases = [
            ("Launch a new feature", "feature_launch"),
            ("Launch a maps feature", "feature_launch"),
            ("Build a maps feature", "feature_launch"),
            ("Build a new feature", "feature_launch"),
            ("Add a maps feature", "feature_launch"),
            ("Add social discovery", "feature_launch"),
            ("Introduce a new feature", "feature_launch"),
            ("Ship a new feature", "feature_launch"),
            ("Release a feature", "feature_launch"),
            ("Roll out a feature", "feature_launch"),
            ("Launch functionality", "feature_launch"),
            ("Add functionality", "feature_launch"),
            ("Build functionality for users to connect", "feature_launch"),
            ("Introduce maps", "feature_launch"),
            ("Launch maps", "feature_launch"),
            ("Launch a community feature", "feature_launch"),
            ("Add a social feature", "feature_launch"),
            ("Launch a maps feature where users can connect with people in their area and hangout", "feature_launch"),
            ("I want to add a marketplace", "feature_launch"),
            ("I want to introduce team collaboration", "feature_launch"),
            ("I want users to be able to invite friends", "feature_launch"),
            ("I want to add location-based discovery", "feature_launch"),
        ]
        for text, expected_type in cases:
            res = asyncio.run(parse_founder_decision(text))
            self.assertEqual(res["decision_type"], expected_type, f"Failed for '{text}': got {res['decision_type']}")
            self.assertEqual(res["coverage_status"], "PARTIALLY_SUPPORTED")
            self.assertEqual(res["simulation_engine"], "MODEL_POWERED")
            self.assertIn("feature_name", res["parameters"])
            self.assertIsNotNone(res["parameters"]["feature_name"])

    def test_regression_existing_decisions(self):
        """Ensure other supported/unsupported decisions are not misclassified as feature_launch."""
        regression_cases = [
            ("Raise $500k", "fundraising", "SUPPORTED", "MODEL_POWERED"),
            ("Hire 2 engineers", "hiring", "PARTIALLY_SUPPORTED", "MODEL_POWERED"),
            ("Increase pricing from $99 to $149", "pricing_change", "PARTIALLY_SUPPORTED", "MODEL_POWERED"),
            ("Reduce monthly burn by 20%", "burn_adjustment", "SUPPORTED", "MODEL_POWERED"),
            ("Increase customer validation", "validation_action", "SUPPORTED", "MODEL_POWERED"),
            ("Expand into Germany", "market_expansion", "UNSUPPORTED", "RULE_BASED"),
            ("Increase marketing spend", "marketing_spend", "UNSUPPORTED", "RULE_BASED"),
        ]
        for text, expected_type, expected_coverage, expected_engine in regression_cases:
            res = asyncio.run(parse_founder_decision(text))
            self.assertEqual(res["decision_type"], expected_type, f"Failed for '{text}': got {res['decision_type']}")
            self.assertEqual(res["coverage_status"], expected_coverage)
            self.assertEqual(res["simulation_engine"], expected_engine)


from unittest.mock import patch, AsyncMock
from backend.services.company_context_service import _RESEARCH_CACHE
from backend.services.web_search_service import SearchResult


class TestFeatureLaunchIntegrationSuite(unittest.TestCase):
    """Verifies end-to-end intelligence execution for the maps feature prompt."""

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
                title="Maps & Geolocation Social Benchmark",
                url="https://benchmark.org/maps-social-2024",
                snippet="Location-based social discovery features increase daily session count by 12% in consumer MVP apps."
            )
        ]
        cls.profile_patcher = patch(
            "backend.services.company_context_service.CompanyContextService.get_company_profile",
            new_callable=AsyncMock
        )
        cls.mock_profile = cls.profile_patcher.start()
        cls.mock_profile.return_value = {
            "company_id": "default_company",
            "name": "SocialMap Startup",
            "industry": "Consumer Social",
            "current_stage": "seed",
            "monthly_revenue": 12000.0,
            "monthly_burn": 15000.0,
            "cash_balance": 150000.0,
            "runway_months": 10.0,
            "total_users": 500,
            "n_unique_features": 2,
            "has_beta_feature": 0,
            "did_customer_validation": 1,
            "funding_total_usd": 200000.0,
            "funding_rounds": 1
        }

    @classmethod
    def tearDownClass(cls):
        cls.search_patcher.stop()
        cls.profile_patcher.stop()
        _RESEARCH_CACHE.clear()

    def test_maps_feature_full_intelligence_pipeline(self):
        response = self.client.post(
            "/api/simulator/intelligence",
            json={
                "company_id": "default_company",
                "decision": "Launch a maps feature where users can connect with people in their area and hangout"
            }
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()

        # 1. Decision classification
        self.assertEqual(data["decision"]["decision_type"], "feature_launch")
        self.assertIsNotNone(data["decision"]["feature_name"])
        self.assertEqual(data["simulation_engine"], "MODEL_POWERED")
        self.assertEqual(data["coverage_status"], "PARTIALLY_SUPPORTED")

        # 2. Baseline and Proposed metrics are populated
        self.assertIsNotNone(data["baseline"]["revenue_forecast"])
        self.assertGreater(data["baseline"]["revenue_forecast"], 0)
        self.assertIsNotNone(data["scenario"]["revenue_forecast"])
        self.assertGreater(data["scenario"]["revenue_forecast"], 0)
        self.assertIsNotNone(data["baseline"]["churn_probability"])
        self.assertIsNotNone(data["scenario"]["churn_probability"])
        self.assertIsNotNone(data["baseline"]["failure_probability"])
        self.assertIsNotNone(data["scenario"]["failure_probability"])
        self.assertIsNotNone(data["baseline"]["metrics"]["runway_months"])
        self.assertIsNotNone(data["scenario"]["metrics"]["runway_months"])

        # 3. Evidence pipeline includes all 4 categories
        self.assertIn("evidence", data)
        for cat in ["company", "documents", "competitors", "market"]:
            self.assertIn(cat, data["evidence"], f"Category '{cat}' missing from evidence")
            self.assertIsInstance(data["evidence"][cat], list)

        # 4. Assumptions & Limitations
        self.assertGreater(len(data["assumptions"]), 0)
        self.assertGreater(len(data["limitations"]), 0)
        self.assertTrue(any("correlational" in lim.lower() or "causal" in lim.lower() for lim in data["limitations"]))

        # 5. AI Co-Founder explanation
        explanation = data["ai_cofounder_explanation"]
        self.assertNotIn("heuristic financial benchmarks", explanation.lower(), "Should not claim heuristic fallback for feature_launch")
        self.assertIn("baseline", explanation.lower())

    def test_unsupported_decision_fallback(self):
        response = self.client.post(
            "/api/simulator/intelligence",
            json={
                "company_id": "default_company",
                "decision": "Expand operations into Germany"
            }
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["simulation_engine"], "RULE_BASED")
        self.assertEqual(data["coverage_status"], "UNSUPPORTED")
        self.assertIsNotNone(data["baseline"]["metrics"]["runway_months"])
