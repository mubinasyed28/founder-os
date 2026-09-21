import os
import unittest
import asyncio
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from backend.main import app
from backend.services.company_context_service import CompanyContextService, get_company_context_service, EvidenceItem
from backend.services.decision_intelligence_service import DecisionIntelligenceService, get_decision_intelligence_service
from backend.services.web_search_service import SearchResult


class TestDecisionIntelligenceSuite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.context_service = get_company_context_service()
        cls.intel_service = get_decision_intelligence_service()
        cls.client = TestClient(app)
        
        # Patch search_tavily globally for deterministic test execution
        cls.search_patcher = patch(
            "backend.services.company_context_service.search_tavily",
            new_callable=AsyncMock
        )
        cls.mock_search = cls.search_patcher.start()
        cls.mock_search.return_value = [
            SearchResult(
                title="SaaS Market Benchmark 2024",
                url="https://benchmark.org/saas-2024",
                snippet="Typical B2B SaaS metrics report 15-20% month-over-month growth at seed stage."
            )
        ]

    @classmethod
    def tearDownClass(cls):
        cls.search_patcher.stop()

    # 1. TEST COMPANY CONTEXT RETRIEVAL
    def test_01_company_context_retrieval(self):
        profile = asyncio.run(self.context_service.get_company_profile("test_user_123"))
        self.assertIsNotNone(profile)
        self.assertIn("company_name", profile)
        self.assertIn("industry", profile)
        self.assertIn("monthly_revenue", profile)

    # 2. TEST RAG RETRIEVAL (MOCKED & REAL)
    def test_02_rag_retrieval(self):
        with patch("backend.services.company_context_service.retrieve_context_chunks", new_callable=AsyncMock) as mock_chunks:
            mock_chunks.return_value = [
                {"filename": "Financial_Plan_2026.pdf", "text": "Current monthly burn is $18,000 with 14 months runway.", "score": 0.94}
            ]
            evidence = asyncio.run(self.context_service.retrieve_relevant_documents(
                company_id="test_user_123",
                decision_type="burn_adjustment",
                query_text="cut burn"
            ))
            self.assertEqual(len(evidence), 1)
            self.assertEqual(evidence[0].source_type, "company_document")
            self.assertEqual(evidence[0].title, "Financial_Plan_2026.pdf")
            self.assertIn("$18,000", evidence[0].claim)
            self.assertGreater(evidence[0].relevance, 0.9)

    # 3. TEST DECISION-DEPENDENT RESEARCH ROUTING
    def test_03_decision_dependent_research_routing(self):
        # Burn reduction should NOT trigger web search (purely internal)
        comp_burn, mkt_burn = asyncio.run(self.context_service.perform_decision_research(
            decision_type="burn_adjustment",
            params={"target_burn": 15000},
            profile={"industry": "DevTools"}
        ))
        self.assertEqual(len(comp_burn) + len(mkt_burn), 0, "Burn reduction must not invoke web search")

        # Fundraising SHOULD trigger web search
        with patch("backend.services.company_context_service.search_tavily", new_callable=AsyncMock) as mock_search:
            mock_search.return_value = [
                SearchResult(title="SaaS Seed Benchmarks 2024", url="https://techcrunch.com/seed-2024", snippet="Average seed rounds in 2024 provide 18-24 months runway.")
            ]
            comp_raise, mkt_raise = asyncio.run(self.context_service.perform_decision_research(
                decision_type="fundraising",
                params={"raise_amount": 500000, "funding_path": "vc_seed"},
                profile={"industry": "DevTools"}
            ))
            res_raise = comp_raise + mkt_raise
            self.assertEqual(len(res_raise), 1)
            self.assertIn(res_raise[0].source_type, ["market_research", "web_source", "competitor"])
            self.assertEqual(res_raise[0].source_reference, "https://techcrunch.com/seed-2024")

    # 4. TEST EVIDENCE NORMALIZATION SCHEMA
    def test_04_evidence_normalization(self):
        item = EvidenceItem(
            source_type="competitor",
            title="Linear",
            claim="Linear charges $12/user/month on standard plan.",
            source_reference="https://linear.app/pricing",
            confidence=0.95,
            relevance=0.88
        )
        d = item.to_dict()
        required_keys = {"source_type", "title", "claim", "source_reference", "confidence", "relevance"}
        self.assertTrue(required_keys.issubset(d.keys()))
        self.assertEqual(d["source_type"], "competitor")
        self.assertEqual(d["confidence"], 0.95)

    # 5. TEST UNSUPPORTED EVIDENCE HANDLING
    def test_05_unsupported_evidence_handling(self):
        # When a market expansion query is run, external web search captures country context
        with patch("backend.services.company_context_service.search_tavily", new_callable=AsyncMock) as mock_search:
            mock_search.return_value = [
                SearchResult(title="SaaS in Germany", url="https://eu-startups.com/germany", snippet="GDPR compliance and local enterprise sales dominate German SaaS entry.")
            ]
            comp_exp, mkt_exp = asyncio.run(self.context_service.perform_decision_research(
                decision_type="market_expansion",
                params={"country": "Germany"},
                profile={"industry": "DevTools"}
            ))
            evidence = comp_exp + mkt_exp
            self.assertEqual(len(evidence), 1)
            self.assertEqual(evidence[0].source_reference, "https://eu-startups.com/germany")

    # 6. TEST STRUCTURED SIGNAL EXTRACTION (NO RAW WEB TEXT INTO XGBOOST)
    def test_06_structured_signal_extraction(self):
        structured = {
            "decision_type": "fundraising",
            "coverage_status": "SUPPORTED",
            "parameters": {"raise_amount": 500000.0, "funding_path": "vc_seed"}
        }
        with patch.object(self.context_service, "get_company_profile", new_callable=AsyncMock) as mock_prof:
            mock_prof.return_value = {
                "company_id": "test_user_1",
                "monthly_revenue": 10000.0,
                "monthly_burn": 20000.0,
                "cash_balance": 240000.0,
                "runway_months": 12.0,
                "industry": "DevTools"
            }
            context_data = asyncio.run(self.context_service.build_full_context("test_user_1", structured))
            # Ensure the state passed to engine is purely structured numeric/categorical features
            state = context_data["company_state_for_engine"]
            self.assertIsInstance(state["current_mrr"], (int, float))
            self.assertIsInstance(state["monthly_burn_rate"], (int, float))
            self.assertIsInstance(state["runway_months"], (int, float))
            self.assertNotIn("raw_html", state)
            self.assertNotIn("unstructured_text", state)

    # 7. TEST INTELLIGENCE ORCHESTRATION (END-TO-END SERVICE)
    def test_07_intelligence_orchestration(self):
        with patch("backend.services.company_context_service.search_tavily", new_callable=AsyncMock) as mock_search:
            mock_search.return_value = []
            report = asyncio.run(self.intel_service.analyze_decision_intelligently(
                company_id="test_user_demo",
                decision_text="I'm considering raising $500k in seed funding"
            ))
            self.assertIn("decision", report)
            self.assertIn("baseline", report)
            self.assertIn("scenario", report)
            self.assertIn("impact", report)
            self.assertIn("risk", report)
            self.assertIn("evidence", report)
            self.assertIn("recommendation", report)
            self.assertIn("confidence", report)
            self.assertIn("ai_cofounder_explanation", report)

    # 8. TEST FULL INTELLIGENCE API ENDPOINT
    def test_08_full_intelligence_endpoint(self):
        payload = {
            "company_id": "test_company_demo",
            "decision": "I want to increase our Pro pricing from $99 to $129."
        }
        resp = self.client.post("/api/simulator/intelligence", json=payload)
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["decision"]["decision_type"], "pricing_change")
        self.assertIn(data["recommendation"], ["Proceed", "Proceed with caution", "Reconsider", "Insufficient evidence"])
        self.assertIn("revenue_forecast", data["baseline"])
        self.assertIn("revenue_forecast", data["scenario"])

    # 9. TEST MISSING COMPANY DATA (GRACEFUL FALLBACK)
    def test_09_missing_company_data(self):
        # Even with nonexistent company id, should use balanced defaults and not crash
        report = asyncio.run(self.intel_service.analyze_decision_intelligently(
            company_id="nonexistent_company_99999",
            decision_text="I want to reduce monthly burn by 20%"
        ))
        self.assertEqual(report["decision"]["decision_type"], "burn_adjustment")
        self.assertEqual(report["simulation_engine"], "MODEL_POWERED")
        self.assertIsNone(report["baseline"]["metrics"]["runway_months"])
        self.assertIn("recommendation", report)
        self.assertIn("ai_cofounder_explanation", report)

    # 10. TEST NO-RESEARCH DECISION (INTERNAL FINANCIAL ADJUSTMENT)
    def test_10_no_research_decision(self):
        report = asyncio.run(self.intel_service.analyze_decision_intelligently(
            company_id="test_user_1",
            decision_text="Reduce our burn from $25k to $18k"
        ))
        # Market web evidence should be empty because burn reduction is purely internal
        self.assertEqual(len(report["evidence"]["market"]), 0)
        self.assertEqual(report["recommendation"], "Proceed")

    # 11. TEST UNSUPPORTED ML DECISION HANDLING
    def test_11_unsupported_ml_decision(self):
        report = asyncio.run(self.intel_service.analyze_decision_intelligently(
            company_id="test_user_1",
            decision_text="I want to expand our operations into Germany"
        ))
        self.assertEqual(report["simulation_engine"], "RULE_BASED")
        self.assertEqual(report["coverage_status"], "UNSUPPORTED")
        self.assertEqual(report["confidence"], "LOW")
        self.assertTrue(any("unsupported" in lim.lower() for lim in report["limitations"]))

    # 12. TEST SOURCE & REFERENCE PRESERVATION
    def test_12_source_reference_preservation(self):
        with patch("backend.services.company_context_service.retrieve_context_chunks", new_callable=AsyncMock) as mock_chunks:
            mock_chunks.return_value = [
                {"filename": "Internal_Audit_Q2.pdf", "text": "Audited retention is 92.4% on Pro tier.", "score": 0.91}
            ]
            report = asyncio.run(self.intel_service.analyze_decision_intelligently(
                company_id="test_user_1",
                decision_text="I'm thinking about increasing our Pro price from $99 to $129"
            ))
            doc_ev = report["evidence"]["documents"]
            self.assertTrue(len(doc_ev) > 0)
            self.assertEqual(doc_ev[0]["source_reference"], "Internal_Audit_Q2.pdf")

    # 13. TEST CAUSAL DISCLAIMER PRESERVATION
    def test_13_causal_disclaimer_preservation(self):
        report = asyncio.run(self.intel_service.analyze_decision_intelligently(
            company_id="test_user_1",
            decision_text="I'm considering hiring two senior engineers"
        ))
        disclaimer = report["model_metadata"]["causal_disclaimer"]
        self.assertIn("NOT guaranteed causal effects", disclaimer)
        self.assertIn("statistical associations", disclaimer)


if __name__ == "__main__":
    unittest.main()
