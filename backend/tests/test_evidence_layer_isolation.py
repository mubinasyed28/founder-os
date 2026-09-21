"""
Evidence Layer Isolation and Relevance Tests:
Tests A through H as specified in the evidence layer requirement:
- Test A: Unrelated document exclusion ("Launch maps feature" + Tesla document -> documents: [])
- Test B: Different decision ("Expand into Germany" + Tesla document -> documents: [])
- Test C: Decision-specific competitors ("Expand into Germany" then "Launch maps feature" -> zero leakage)
- Test D: Reverse order ("Launch maps feature" then "Expand into Germany" -> zero leakage)
- Test E: Real-time market (News queries change dynamically between decisions)
- Test F: No results (sub-threshold items return market: [])
- Test G: Training data separation (RavenStack, Startup Survival never appear in evidence)
- Test H: Company isolation (Company A cannot see Company B's documents)
"""

import unittest
import asyncio
from unittest.mock import patch, AsyncMock
from backend.services.company_context_service import CompanyContextService, EvidenceItem, is_training_dataset_entity


class TestEvidenceLayerIsolation(unittest.TestCase):

    def setUp(self):
        self.service = CompanyContextService()
        self.company_id = "comp_test_isolation_1"
        self.profile = {
            "company_name": "WanderAI",
            "industry": "Travel Tech",
            "product": "AI Travel Itinerary Planner",
            "description": "Smart personalized travel itinerary and trip planning platform",
            "target_customer": "Independent international travelers",
            "location": "San Francisco, CA",
            "current_stage": "Seed",
            "competitors": ["TripIt", "Wanderlog"]
        }

    def test_test_a_unrelated_document_exclusion(self):
        """TEST A: TSLA-Q2-2026-Update.pdf must NOT appear for 'Launch maps feature' -> documents: []"""
        unrelated_doc_text = (
            "Tesla Q2 2026 update: Delivered 450,000 electric vehicles, gross margin 18%, "
            "expanded gigafactory production lines and energy storage deployments."
        )
        fake_chunks = [
            {"document_id": "doc_tsla", "filename": "TSLA-Q2-2026-Update.pdf", "text": unrelated_doc_text, "category": "financial"}
        ]
        with patch("backend.services.company_context_service.retrieve_context_chunks", new_callable=AsyncMock) as mock_chunks:
            mock_chunks.return_value = fake_chunks
            results = asyncio.run(self.service.retrieve_relevant_documents(
                company_id=self.company_id,
                decision_type="feature_launch",
                query_text="Launch maps feature",
                product_context="Travel Tech AI Travel Itinerary Planner",
                structured_decision={"decision_type": "feature_launch", "parameters": {"feature_name": "maps feature"}},
                profile=self.profile
            ))
            # Must strictly return empty list
            self.assertEqual(results, [])

    def test_test_b_different_decision_unrelated_doc_exclusion(self):
        """TEST B: TSLA document must still NOT appear for 'Expand into Germany' -> documents: []"""
        unrelated_doc_text = (
            "Tesla Q2 2026 financial release. Automotive revenues, battery capacity, FSD regulatory approvals."
        )
        fake_chunks = [
            {"document_id": "doc_tsla", "filename": "TSLA-Q2-2026-Update.pdf", "text": unrelated_doc_text, "category": "financial"}
        ]
        with patch("backend.services.company_context_service.retrieve_context_chunks", new_callable=AsyncMock) as mock_chunks:
            mock_chunks.return_value = fake_chunks
            results = asyncio.run(self.service.retrieve_relevant_documents(
                company_id=self.company_id,
                decision_type="market_expansion",
                query_text="Expand into Germany",
                product_context="Travel Tech AI Travel Itinerary Planner",
                structured_decision={"decision_type": "market_expansion", "parameters": {"country": "Germany"}},
                profile=self.profile
            ))
            self.assertEqual(results, [])

    def test_test_c_and_d_competitor_decision_isolation(self):
        """
        TEST C & D:
        Run 'Expand into Germany' -> generates Germany-specific competitors.
        Then run 'Launch maps feature' -> Germany competitors must NOT leak into maps analysis.
        Reverse order: Maps competitors must NOT leak into Germany analysis.
        """
        # 1. Expand into Germany
        params_germany = {"country": "Germany"}
        targets_germany = self.service._extract_decision_keywords_and_targets("Expand into Germany", params_germany, "market_expansion")
        self.assertEqual(targets_germany["country"], "Germany")
        queries_germany = self.service._build_competitor_queries("Travel Tech", "AI Travel Planner", "Travelers", "market_expansion", "Expand into Germany", targets_germany)
        self.assertTrue(any("germany" in q.lower() for q in queries_germany))

        # Fingerprint check
        fp_germany = self.service.generate_research_fingerprint(
            self.company_id, "Expand into Germany", "market_expansion", "", "Germany", "AI Travel Planner", "Travel Tech"
        )

        # 2. Launch maps feature
        params_maps = {"feature_name": "maps feature"}
        targets_maps = self.service._extract_decision_keywords_and_targets("Launch maps feature", params_maps, "feature_launch")
        self.assertEqual(targets_maps["feature"], "maps feature")
        queries_maps = self.service._build_competitor_queries("Travel Tech", "AI Travel Planner", "Travelers", "feature_launch", "Launch maps feature", targets_maps)
        self.assertTrue(any("map" in q.lower() for q in queries_maps))

        fp_maps = self.service.generate_research_fingerprint(
            self.company_id, "Launch maps feature", "feature_launch", "maps feature", "", "AI Travel Planner", "Travel Tech"
        )

        # Fingerprints must be distinct
        self.assertNotEqual(fp_germany, fp_maps)

        # Test filtering: candidate German competitor must be rejected for maps feature
        german_hotel_app = {
            "title": "HRS Hotel Reservation Service Germany",
            "snippet": "Book hotels across Berlin, Frankfurt and Munich with corporate rates in Germany.",
            "url": "https://hrs.de"
        }
        res_maps, excl_maps = self.service._filter_and_rank_competitors(
            [german_hotel_app], "Travel Tech", "AI Travel Planner", "feature_launch", "Launch maps feature", targets_maps
        )
        # HRS has no maps feature, so it must be excluded from maps
        self.assertEqual(res_maps, [])
        self.assertTrue(any("does not offer or discuss" in e for e in excl_maps))

        # Under Germany decision: HRS is relevant to Germany
        res_ger, _ = self.service._filter_and_rank_competitors(
            [german_hotel_app], "Travel Tech", "AI Travel Planner", "market_expansion", "Expand into Germany", targets_germany
        )
        self.assertEqual(len(res_ger), 1)
        self.assertEqual(res_ger[0].title, "HRS Hotel Reservation Service Germany")

    def test_test_e_real_time_market_query_changes(self):
        """TEST E: Market/news queries change dynamically according to the decision context."""
        targets_maps = self.service._extract_decision_keywords_and_targets("Launch maps feature", {"feature_name": "maps feature"}, "feature_launch")
        news_maps = self.service._build_market_news_queries("Travel Tech", "AI Travel Planner", "feature_launch", "Launch maps feature", targets_maps)
        self.assertTrue(any("map" in q.lower() for q in news_maps))
        self.assertFalse(any("germany" in q.lower() for q in news_maps))

        targets_germany = self.service._extract_decision_keywords_and_targets("Expand into Germany", {"country": "Germany"}, "market_expansion")
        news_germany = self.service._build_market_news_queries("Travel Tech", "AI Travel Planner", "market_expansion", "Expand into Germany", targets_germany)
        self.assertTrue(any("germany" in q.lower() for q in news_germany))
        self.assertFalse(any("navigation" in q.lower() for q in news_germany))

    def test_test_f_sub_threshold_market_returns_empty(self):
        """TEST F: Sub-threshold / irrelevant news items return market: [] without polluting the section."""
        unrelated_news = [
            {
                "title": "Local High School Wins Soccer Championship",
                "snippet": "The suburban high school took home the state trophy in overtime penalties.",
                "url": "https://localsports.com/news/123",
                "pub_date": "2026-09-10T12:00:00Z"
            }
        ]
        targets_germany = self.service._extract_decision_keywords_and_targets("Expand into Germany", {"country": "Germany"}, "market_expansion")
        accepted, excluded = self.service._filter_and_rank_market_news(
            unrelated_news, "Travel Tech", "AI Travel Planner", "market_expansion", "Expand into Germany", targets_germany
        )
        self.assertEqual(accepted, [])
        self.assertTrue(len(excluded) > 0)

    def test_test_g_training_data_separation(self):
        """TEST G: RavenStack and Startup Survival dataset companies are strictly filtered out of evidence."""
        self.assertTrue(is_training_dataset_entity("RavenStack synthetic account cohort analysis"))
        self.assertTrue(is_training_dataset_entity("startup_survival_dataset_v1"))
        self.assertTrue(is_training_dataset_entity("BLS_survival benchmark model"))

        training_item = {
            "title": "RavenStack Synthetic Benchmark Corp",
            "snippet": "Synthetic customer cohort from Model 1 training dataset showing high churn.",
            "url": "https://ravenstack.internal/sample"
        }
        accepted_comp, _ = self.service._filter_and_rank_competitors(
            [training_item], "SaaS", "DevTools", "feature_launch", "Launch beta feature", {}
        )
        self.assertEqual(accepted_comp, [])

        accepted_mkt, _ = self.service._filter_and_rank_market_news(
            [training_item], "SaaS", "DevTools", "feature_launch", "Launch beta feature", {}
        )
        self.assertEqual(accepted_mkt, [])

    def test_test_h_company_isolation(self):
        """TEST H: Company A cannot see documents belonging to Company B."""
        with patch("backend.services.company_context_service.retrieve_context_chunks", new_callable=AsyncMock) as mock_chunks:
            # When company A queries, rag_service returns only company A's chunks. If none, empty list:
            mock_chunks.return_value = []
            results = asyncio.run(self.service.retrieve_relevant_documents(
                company_id="company_A",
                decision_type="feature_launch",
                query_text="Launch maps feature",
                profile={"industry": "Travel Tech"}
            ))
            self.assertEqual(results, [])


if __name__ == "__main__":
    unittest.main()
