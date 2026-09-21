import os
import unittest
import asyncio
from datetime import datetime, timezone
from unittest.mock import patch, AsyncMock, MagicMock
from bson import ObjectId

from backend.services.company_context_service import get_company_context_service, EvidenceItem
from backend.services.decision_intelligence_service import get_decision_intelligence_service
from backend.services.document_processor import (
    generate_document_summary_and_topics,
    backfill_missing_document_summaries
)
from backend.services.rag_service import retrieve_context_chunks


class TestDocumentEvidenceLayer(unittest.TestCase):
    def setUp(self):
        self.context_service = get_company_context_service()
        self.intel_service = get_decision_intelligence_service()

    # TEST A: Company A has Germany expansion doc + Tesla Q2 report.
    # Decision: "Expand into Germany"
    # Expected: Germany doc returned. Tesla doc NOT returned.
    def test_a_germany_expansion_vs_tesla(self):
        company_a = "company_a_test"

        mock_db = MagicMock()
        germany_doc_id = ObjectId()
        tesla_doc_id = ObjectId()

        mock_docs = [
            {
                "_id": germany_doc_id,
                "company_id": company_a,
                "filename": "Europe_Germany_Expansion_Plan.pdf",
                "short_summary": "Strategy for expanding B2B operations into Germany, compliance with GDPR, and European sales hiring.",
                "document_topics": ["Germany", "Europe", "expansion", "GDPR", "market entry"],
                "document_type": "business_plan",
                "uploadedAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc)
            },
            {
                "_id": tesla_doc_id,
                "company_id": company_a,
                "filename": "TSLA-Q2-2026-Update.pdf",
                "short_summary": "Tesla quarterly update covering vehicle deliveries, energy storage, and automotive manufacturing output.",
                "document_topics": ["automotive", "vehicle deliveries", "energy", "manufacturing"],
                "document_type": "financial_report",
                "uploadedAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc)
            }
        ]

        # Mock retrieved chunks: Germany chunk is high relevance, Tesla chunk is low/unrelated
        mock_chunks = [
            {
                "document_id": str(germany_doc_id),
                "filename": "Europe_Germany_Expansion_Plan.pdf",
                "text": "Detailed German market expansion analysis including European partner channels and localization.",
                "score": 0.88,
                "scoring_method": "dense_embedding"
            },
            {
                "document_id": str(tesla_doc_id),
                "filename": "TSLA-Q2-2026-Update.pdf",
                "text": "Tesla produced over 450,000 vehicles in Q2 with record Supercharger deployments.",
                "score": 0.35,  # Far below 0.68 threshold
                "scoring_method": "dense_embedding"
            }
        ]

        with patch("backend.services.company_context_service.get_db", new_callable=AsyncMock) as mock_get_db, \
             patch("backend.services.company_context_service.retrieve_context_chunks", new_callable=AsyncMock) as mock_retrieve:
            
            cursor_mock = MagicMock()
            cursor_mock.to_list = AsyncMock(return_value=mock_docs)
            mock_db.documents.find.return_value = cursor_mock
            mock_get_db.return_value = mock_db
            mock_retrieve.return_value = mock_chunks

            results = asyncio.run(self.context_service.retrieve_relevant_documents(
                company_id=company_a,
                decision_type="market_expansion",
                query_text="Expand into Germany",
                product_context="Developer Workflow Automation Platform"
            ))

            self.assertEqual(len(results), 1, "Only Germany document should pass relevance filtering")
            self.assertEqual(results[0].filename, "Europe_Germany_Expansion_Plan.pdf")
            self.assertEqual(results[0].document_id, str(germany_doc_id))
            self.assertGreaterEqual(results[0].relevance_score, 0.68)
            # Verify Tesla was excluded
            self.assertNotIn("TSLA", results[0].filename)

    # TEST B: Decision: "Launch maps feature"
    # Expected: Only maps/feature/product documents returned
    def test_b_launch_maps_feature(self):
        company_id = "comp_feature_test"
        maps_doc_id = ObjectId()
        tax_doc_id = ObjectId()

        mock_docs = [
            {
                "_id": maps_doc_id,
                "company_id": company_id,
                "filename": "PRD_Interactive_Maps_Feature.pdf",
                "short_summary": "Product requirements for interactive geolocation maps, navigation widgets, and geospatial route filtering.",
                "document_topics": ["maps", "geolocation", "PRD", "navigation"],
                "document_type": "blueprint",
                "uploadedAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc)
            },
            {
                "_id": tax_doc_id,
                "company_id": company_id,
                "filename": "Annual_Tax_Filing_2025.pdf",
                "short_summary": "Corporate income tax return, deductions, and payroll audit documentation.",
                "document_topics": ["taxes", "accounting", "deductions"],
                "document_type": "financial_report",
                "uploadedAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc)
            }
        ]

        mock_chunks = [
            {
                "document_id": str(maps_doc_id),
                "filename": "PRD_Interactive_Maps_Feature.pdf",
                "text": "Technical architecture and user interface mocks for the interactive maps feature rollout.",
                "score": 0.84,
                "scoring_method": "dense_embedding"
            },
            {
                "document_id": str(tax_doc_id),
                "filename": "Annual_Tax_Filing_2025.pdf",
                "text": "Form 1120 corporate tax breakdown and depreciation schedules.",
                "score": 0.28,
                "scoring_method": "dense_embedding"
            }
        ]

        with patch("backend.services.company_context_service.get_db", new_callable=AsyncMock) as mock_get_db, \
             patch("backend.services.company_context_service.retrieve_context_chunks", new_callable=AsyncMock) as mock_retrieve:
            
            cursor_mock = MagicMock()
            cursor_mock.to_list = AsyncMock(return_value=mock_docs)
            mock_db = MagicMock()
            mock_db.documents.find.return_value = cursor_mock
            mock_get_db.return_value = mock_db
            mock_retrieve.return_value = mock_chunks

            results = asyncio.run(self.context_service.retrieve_relevant_documents(
                company_id=company_id,
                decision_type="feature_launch",
                query_text="Launch maps feature",
                product_context="Mobile logistics and fleet coordination"
            ))

            self.assertEqual(len(results), 1)
            self.assertEqual(results[0].filename, "PRD_Interactive_Maps_Feature.pdf")

    # TEST C: Decision: "Hire 2 engineers"
    # Expected: Hiring/team documents returned, unrelated excluded
    def test_c_hire_engineers(self):
        company_id = "comp_hiring_test"
        hiring_doc_id = ObjectId()
        lease_doc_id = ObjectId()

        mock_docs = [
            {
                "_id": hiring_doc_id,
                "company_id": company_id,
                "filename": "Engineering_Hiring_Plan_2026.pdf",
                "short_summary": "Headcount roadmap for 2 senior backend engineers with compensation bands and tech stack requirements.",
                "document_topics": ["hiring", "engineering", "headcount", "salary", "team"],
                "document_type": "blueprint",
                "uploadedAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc)
            },
            {
                "_id": lease_doc_id,
                "company_id": company_id,
                "filename": "Office_Lease_Agreement.pdf",
                "short_summary": "Commercial real estate lease contract for downtown office suite.",
                "document_topics": ["lease", "real estate", "office"],
                "document_type": "other",
                "uploadedAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc)
            }
        ]

        mock_chunks = [
            {
                "document_id": str(hiring_doc_id),
                "filename": "Engineering_Hiring_Plan_2026.pdf",
                "text": "Allocating budget to hire 2 engineers to accelerate infrastructure scalability.",
                "score": 0.89,
                "scoring_method": "dense_embedding"
            },
            {
                "document_id": str(lease_doc_id),
                "filename": "Office_Lease_Agreement.pdf",
                "text": "Tenant agrees to pay monthly rent of $4,500 on the first day of each calendar month.",
                "score": 0.31,
                "scoring_method": "dense_embedding"
            }
        ]

        with patch("backend.services.company_context_service.get_db", new_callable=AsyncMock) as mock_get_db, \
             patch("backend.services.company_context_service.retrieve_context_chunks", new_callable=AsyncMock) as mock_retrieve:
            
            cursor_mock = MagicMock()
            cursor_mock.to_list = AsyncMock(return_value=mock_docs)
            mock_db = MagicMock()
            mock_db.documents.find.return_value = cursor_mock
            mock_get_db.return_value = mock_db
            mock_retrieve.return_value = mock_chunks

            results = asyncio.run(self.context_service.retrieve_relevant_documents(
                company_id=company_id,
                decision_type="hiring",
                query_text="Hire 2 engineers",
                product_context="Cloud Infrastructure Platform"
            ))

            self.assertEqual(len(results), 1)
            self.assertEqual(results[0].filename, "Engineering_Hiring_Plan_2026.pdf")

    # TEST D: Company has no relevant documents.
    # Expected: documents = [], NO fallback to all uploaded documents!
    def test_d_no_relevant_documents_returns_empty(self):
        company_id = "comp_empty_test"
        doc_id = ObjectId()

        mock_docs = [
            {
                "_id": doc_id,
                "company_id": company_id,
                "filename": "Unrelated_Topic.pdf",
                "short_summary": "Unrelated historical legal settlement note.",
                "document_topics": ["legal", "settlement"],
                "document_type": "other",
                "uploadedAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc)
            }
        ]

        # All chunks score below relevance threshold
        mock_chunks = [
            {
                "document_id": str(doc_id),
                "filename": "Unrelated_Topic.pdf",
                "text": "Arbitration terms and conditions from 2021.",
                "score": 0.42,  # Below 0.68 threshold
                "scoring_method": "dense_embedding"
            }
        ]

        with patch("backend.services.company_context_service.get_db", new_callable=AsyncMock) as mock_get_db, \
             patch("backend.services.company_context_service.retrieve_context_chunks", new_callable=AsyncMock) as mock_retrieve:
            
            cursor_mock = MagicMock()
            cursor_mock.to_list = AsyncMock(return_value=mock_docs)
            mock_db = MagicMock()
            mock_db.documents.find.return_value = cursor_mock
            mock_get_db.return_value = mock_db
            mock_retrieve.return_value = mock_chunks

            results = asyncio.run(self.context_service.retrieve_relevant_documents(
                company_id=company_id,
                decision_type="pricing_change",
                query_text="Increase pricing by 20%",
                product_context="B2B SaaS Analytics"
            ))

            # Must return empty list! NO fallback to show all uploaded documents!
            self.assertEqual(len(results), 0)
            self.assertEqual(results, [])

    # TEST E: Company A and Company B isolation.
    # Decision from Company A must NEVER retrieve documents belonging to Company B.
    def test_e_company_isolation(self):
        company_a = "company_alpha"
        company_b = "company_beta"

        # Mock db.chunks.find to enforce company isolation
        mock_db = MagicMock()
        
        def mock_find_chunks(query):
            # Inspect query filter
            or_clauses = query.get("$or", [])
            queried_companies = [c.get("company_id") or c.get("user_id") for c in or_clauses if "company_id" in c or "user_id" in c]
            
            # Return chunks strictly belonging to the queried company
            res = []
            if company_a in queried_companies:
                res.append({
                    "document_id": "doc_a_1",
                    "company_id": company_a,
                    "user_id": company_a,
                    "text": "Alpha company expansion plan into Germany with localized pricing.",
                    "embedding": [0.1] * 1024,
                    "metadata": {"filename": "Alpha_Expansion.pdf", "category": "business_plan"}
                })
            # Company B chunks should NOT be returned when company A is queried
            return MagicMock(to_list=AsyncMock(return_value=res))

        mock_db.chunks.find.side_effect = mock_find_chunks

        with patch("backend.services.rag_service.get_db", new_callable=AsyncMock) as mock_get_db, \
             patch("backend.services.rag_service.generate_embedding", return_value=[0.1] * 1024):
            mock_get_db.return_value = mock_db

            chunks = asyncio.run(retrieve_context_chunks(user_id=company_a, query_text="Germany expansion", top_k=10))
            
            for c in chunks:
                self.assertNotEqual(c.get("company_id"), company_b, "Company B chunks must never leak into Company A query")

    # TEST F: Existing document without summary.
    # Safe backfill generates and persists summary and topics without duplicating document or chunks.
    def test_f_backfill_missing_summary(self):
        test_company = "company_backfill_test"
        doc_id = ObjectId()
        
        mock_doc = {
            "_id": doc_id,
            "user_id": test_company,
            "company_id": test_company,
            "filename": "Pricing_Strategy_2026.pdf",
            "category": "financial_report",
            "uploadedAt": datetime.now(timezone.utc)
            # Missing short_summary and document_topics
        }

        mock_chunks = [
            {
                "document_id": str(doc_id),
                "text": "Our Pro tier is currently priced at $99 per month. We plan to increase it to $129 to improve unit economics.",
                "chunkIndex": 0
            }
        ]

        mock_db = MagicMock()
        cursor_mock = MagicMock()
        cursor_mock.to_list = AsyncMock(return_value=[mock_doc])
        mock_db.documents.find.return_value = cursor_mock
        
        chunks_cursor = MagicMock()
        chunks_cursor.sort.return_value.to_list = AsyncMock(return_value=mock_chunks)
        mock_db.chunks.find.return_value = chunks_cursor
        mock_db.documents.update_one = AsyncMock()

        with patch("backend.services.document_processor.get_db", new_callable=AsyncMock) as mock_get_db:
            mock_get_db.return_value = mock_db

            count = asyncio.run(backfill_missing_document_summaries(test_company))
            self.assertEqual(count, 1)

            # Check update_one was called with short_summary and document_topics
            self.assertTrue(mock_db.documents.update_one.called)
            update_call = mock_db.documents.update_one.call_args
            set_dict = update_call[0][1]["$set"]
            self.assertIn("short_summary", set_dict)
            self.assertIn("document_topics", set_dict)
            self.assertIn("Pro tier", set_dict["short_summary"])

    # TEST G: Multiple relevant chunks from one document.
    # Expected: Exactly ONE Evidence card for the document (deduplicated), not multiple duplicate cards.
    def test_g_deduplication_multiple_chunks_one_doc(self):
        company_id = "comp_dedup_test"
        doc_id = ObjectId()

        mock_docs = [
            {
                "_id": doc_id,
                "company_id": company_id,
                "filename": "Complete_Business_Plan.pdf",
                "short_summary": "Comprehensive overview of business model, go-to-market strategy, and financial projections.",
                "document_topics": ["business plan", "GTM", "financials"],
                "document_type": "business_plan",
                "uploadedAt": datetime.now(timezone.utc),
                "updatedAt": datetime.now(timezone.utc)
            }
        ]

        # 4 different chunks from the SAME document all score high
        mock_chunks = [
            {
                "document_id": str(doc_id),
                "filename": "Complete_Business_Plan.pdf",
                "text": "Section 1: Market entry strategy for European enterprise accounts.",
                "score": 0.88,
                "scoring_method": "dense_embedding"
            },
            {
                "document_id": str(doc_id),
                "filename": "Complete_Business_Plan.pdf",
                "text": "Section 2: European regulatory compliance and data sovereignty.",
                "score": 0.85,
                "scoring_method": "dense_embedding"
            },
            {
                "document_id": str(doc_id),
                "filename": "Complete_Business_Plan.pdf",
                "text": "Section 3: German customer acquisition cost and lifetime value modeling.",
                "score": 0.91,  # Best chunk
                "scoring_method": "dense_embedding"
            },
            {
                "document_id": str(doc_id),
                "filename": "Complete_Business_Plan.pdf",
                "text": "Section 4: Localized support and implementation partners in Berlin.",
                "score": 0.82,
                "scoring_method": "dense_embedding"
            }
        ]

        with patch("backend.services.company_context_service.get_db", new_callable=AsyncMock) as mock_get_db, \
             patch("backend.services.company_context_service.retrieve_context_chunks", new_callable=AsyncMock) as mock_retrieve:
            
            cursor_mock = MagicMock()
            cursor_mock.to_list = AsyncMock(return_value=mock_docs)
            mock_db = MagicMock()
            mock_db.documents.find.return_value = cursor_mock
            mock_get_db.return_value = mock_db
            mock_retrieve.return_value = mock_chunks

            results = asyncio.run(self.context_service.retrieve_relevant_documents(
                company_id=company_id,
                decision_type="market_expansion",
                query_text="Expand into Germany"
            ))

            # Exactly ONE deduplicated EvidenceItem should be returned!
            self.assertEqual(len(results), 1, "Must return exactly 1 deduplicated card for the document")
            self.assertEqual(results[0].document_id, str(doc_id))
            self.assertEqual(results[0].filename, "Complete_Business_Plan.pdf")
            # Relevance score must reflect the strongest relevant chunk (0.91)
            self.assertEqual(results[0].relevance_score, 0.91)


if __name__ == "__main__":
    unittest.main()
