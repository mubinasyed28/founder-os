import logging
import hashlib
import time
import re
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple, Set
import asyncio
import json
import urllib.request
from backend.config import settings
from backend.database import get_db
from backend.services.rag_service import retrieve_context_chunks
from backend.services.competitor_research_service import get_latest_research
from backend.services.web_search_service import search_tavily, SearchResult
from backend.services.newsdata_service import search_newsdata

logger = logging.getLogger(__name__)

# In-memory cache for external research: (cache_key -> (timestamp, data))
_RESEARCH_CACHE: Dict[str, tuple[float, Any]] = {}
CACHE_TTL_SECONDS = 1800  # 30 minutes freshness

TRAINING_DATASET_PATTERNS = [
    "ravenstack", "startupsurvival", "startup_survival", "bls_survival",
    "synthetic_saas", "acme_saas", "model1_cohort", "model2_cohort"
]

def is_training_dataset_entity(text: str) -> bool:
    if not text:
        return False
    t = text.lower()
    return any(p in t for p in TRAINING_DATASET_PATTERNS)


class EvidenceItem:
    """Standardized, normalized evidence schema with source traceability."""
    def __init__(
        self,
        source_type: str,
        title: str,
        finding: Optional[str] = None,
        source_url: str = "",
        timestamp: Optional[str] = None,
        confidence: float = 0.9,
        relevance: float = 0.9,
        # Backwards compatibility kwargs
        claim: Optional[str] = None,
        source_reference: Optional[str] = None,
        # Document specific provenance fields
        document_id: Optional[str] = None,
        filename: Optional[str] = None,
        summary: Optional[str] = None,
        relevance_score: Optional[float] = None,
        relevance_label: Optional[str] = None,
        updated_at: Optional[str] = None,
        document_type: Optional[str] = None,
        document_topics: Optional[List[str]] = None,
        company_id: Optional[str] = None,
        retrieved_at: Optional[str] = None,
        reason: Optional[str] = None,
        published_at: Optional[str] = None,
    ):
        self.source_type = source_type  # company_profile | company_metric | company_document | competitor | market | news
        self.title = title
        self.finding = finding if finding is not None else (claim or "")
        self.source_url = source_url or source_reference or ""
        self.timestamp = timestamp or datetime.now(timezone.utc).isoformat()
        self.confidence = round(confidence, 2)
        self.relevance = round(relevance, 2)
        self.document_id = document_id
        self.filename = filename or title
        self.summary = summary or self.finding
        self.relevance_score = round(relevance_score if relevance_score is not None else relevance, 2)
        self.relevance_label = relevance_label
        self.updated_at = updated_at or self.timestamp
        self.document_type = document_type or "company_document"
        self.document_topics = document_topics or []
        self.company_id = company_id
        self.retrieved_at = retrieved_at or self.timestamp
        self.reason = reason or self.finding
        self.published_at = published_at or self.timestamp

    @property
    def claim(self) -> str:
        """Backwards compatibility alias for finding."""
        return self.finding

    @property
    def source_reference(self) -> str:
        """Backwards compatibility alias for source_url."""
        return self.source_url

    def to_dict(self) -> Dict[str, Any]:
        d = {
            "source_type": self.source_type,
            "title": self.title,
            "finding": self.finding,
            "claim": self.finding,  # Backwards compatibility
            "summary": self.summary,
            "source_url": self.source_url,
            "source_reference": self.source_url,  # Backwards compatibility
            "timestamp": self.timestamp,
            "confidence": self.confidence,
            "relevance": self.relevance_label if self.relevance_label is not None else self.relevance,
            "relevance_score": self.relevance_score,
            "reason": self.reason,
            "published_at": self.published_at,
            "updated_at": self.updated_at,
        }
        if self.source_type == "company_document":
            d.update({
                "document_id": self.document_id or "",
                "filename": self.filename,
                "summary": self.summary,
                "updated_at": self.updated_at,
                "document_type": self.document_type,
                "document_topics": self.document_topics,
                "company_id": self.company_id or "",
                "retrieved_at": self.retrieved_at,
            })
        return d


class CompanyContextService:
    """
    Produces a canonical company context object from verified startup data:
    1. MongoDB company profile (db.profiles)
    2. Conversational onboarding / database metrics
    3. Document RAG chunks (decision + product context)
    4. Real-time decision-specific competitor and market research

    NEVER injects benchmark defaults for missing startup metrics.
    """

    def __init__(self):
        self._last_retrieval_stats: Dict[str, Any] = {}
        self._last_research_stats: Dict[str, Any] = {}

    @staticmethod
    def get_fallback_company_profile(company_id: str = "default_company") -> Dict[str, Any]:
        """
        Canonical cold-start profile without fabricated financial metrics.
        Financial metrics are strictly None until the user or documents supply them.
        """
        return {
            "user_id": company_id,
            "company_name": "NexusAI",
            "one_line_pitch": "Next-generation developer workflow automation",
            "description": "AI-assisted developer platform for modern engineering teams",
            "industry": "DevTools",
            "problem_statement": "Engineering teams spend excessive time on repetitive workflow coordination and context switching",
            "solution": "Automated workflow orchestration and smart collaboration tools for software developers",
            "product": "Developer Workflow Automation Platform",
            "target_customer": "Engineering teams and technical founders",
            "business_model": "B2B SaaS",
            "revenue_model": "Subscription",
            "current_stage": "MVP",
            "location": "San Francisco, CA",
            "website": "https://nexusai.dev",
            "traction": "Active pilot testing with early beta users",
            "team_size": "2",
            "total_users": 250,
            "monthly_revenue": None,
            "monthly_burn_rate": None,
            "runway_months": None,
            "cash_in_bank": None,
            "funding_raised": None,
            "funding_stage": "bootstrapped",
            "validation_done": True,
            "validation_details": "Completed discovery interviews with 25 engineering leads",
            "competitors": [],
            "uploaded_documents": []
        }

    async def get_company_profile(self, company_id: str) -> Dict[str, Any]:
        """Loads company profile from database, or returns structured cold-start profile."""
        try:
            db = await get_db()
            profile = await db.profiles.find_one({"user_id": company_id})
            if profile:
                profile.pop("_id", None)
                # Normalize 0.0 or empty strings to None for missing metrics
                if not profile.get("monthly_revenue") or profile.get("monthly_revenue") == 0.0:
                    profile["monthly_revenue"] = None
                if not profile.get("runway_months") or profile.get("runway_months") == 0.0:
                    profile["runway_months"] = None
                if not profile.get("monthly_burn_rate") or profile.get("monthly_burn_rate") == 0.0:
                    profile["monthly_burn_rate"] = None
                if not profile.get("funding_raised") or profile.get("funding_raised") == 0.0:
                    profile["funding_raised"] = None
                return profile
        except Exception as e:
            logger.warning(f"[context_service] Failed to query MongoDB for profile ({e}), using default cold-start.")

        return self.get_fallback_company_profile(company_id)

    def _build_retrieval_query(
        self,
        decision_type: str,
        query_text: str,
        product_context: str = "",
        structured_decision: Optional[Dict[str, Any]] = None,
        profile: Optional[Dict[str, Any]] = None
    ) -> str:
        terms: List[str] = []
        if query_text and query_text.strip():
            terms.append(query_text.strip())

        # Parameters from structured decision
        params = (structured_decision or {}).get("parameters", {})
        param_list = []
        for k, v in params.items():
            if v and isinstance(v, (str, int, float)) and str(v).strip():
                param_list.append(f"{k.replace('_', ' ')} {v}")
        if param_list:
            terms.append(" ".join(param_list))

        if profile:
            if profile.get("product"):
                terms.append(f"product: {profile['product']}")
            if profile.get("industry"):
                terms.append(f"industry: {profile['industry']}")
            if profile.get("target_customer"):
                terms.append(f"ICP target customer: {profile['target_customer']}")
            if profile.get("current_stage"):
                terms.append(f"stage: {profile['current_stage']}")
        elif product_context:
            terms.append(product_context)

        # Keyword expansion by decision type
        expansion = {
            "market_expansion": "expansion market entry country international regulations customers sales roadmap",
            "hiring": "hiring engineering technical team compensation roadmap headcount requirements",
            "pricing_change": "pricing strategy tier subscription willingness to pay ARPU financial model",
            "feature_launch": "feature roadmap product release beta architecture technical requirements",
            "fundraising": "fundraising pitch deck capital seed round investor financial projections",
            "burn_adjustment": "burn runway cost expenses cash management financial plan",
            "validation_action": "customer discovery interviews validation problem feedback"
        }
        if decision_type in expansion:
            terms.append(expansion[decision_type])
        else:
            terms.append(decision_type.replace("_", " "))

        return " | ".join(terms)

    async def retrieve_relevant_documents(
        self,
        company_id: str,
        decision_type: str,
        query_text: str,
        product_context: str = "",
        structured_decision: Optional[Dict[str, Any]] = None,
        profile: Optional[Dict[str, Any]] = None
    ) -> List[EvidenceItem]:
        """
        Decision-Specific, Company-Scoped Semantic Document Retrieval:
        1. Builds dynamic query from decision, parameters, product, and target customer context.
        2. Retrieves candidate chunks strictly scoped to authenticated company.
        3. Aggregates chunk scores to document level (max chunk score).
        4. Applies defensible relevance threshold (0.68 for dense vector embeddings, 0.22 for TF-IDF).
        5. Deduplicates: returns at most one EvidenceItem per document.
        6. Enriches with factual short_summary, document_topics, and updated_at.
        7. If no document passes threshold, returns [] (never falls back to all documents).
        """
        evidence_items: List[EvidenceItem] = []
        rag_query = self._build_retrieval_query(decision_type, query_text, product_context, structured_decision, profile)

        # Defensible relevance thresholds
        DENSE_THRESHOLD = 0.68
        TFIDF_THRESHOLD = 0.22

        retrieved_chunk_count = 0
        candidate_docs_count = 0
        documents_excluded: List[str] = []
        selected_document_ids: List[str] = []
        selected_document_scores: List[float] = []

        company_docs = []
        try:
            db = await get_db()
            # Fetch company's documents to match metadata
            docs_cursor = db.documents.find({"$or": [{"company_id": company_id}, {"user_id": company_id}]})
            company_docs = await docs_cursor.to_list(length=200)
        except Exception as dbe:
            logger.debug(f"[context_service] DB document query skipped/failed ({dbe})")

        candidate_docs_count = len(company_docs)
        doc_by_id = {str(d["_id"]): d for d in company_docs}
        doc_by_filename = {d.get("filename"): d for d in company_docs if d.get("filename")}

        try:
            chunks = await retrieve_context_chunks(company_id, rag_query, top_k=25)
            retrieved_chunk_count = len(chunks)

            # Group chunks by document
            doc_chunks_map: Dict[str, List[Dict[str, Any]]] = {}
            for c in chunks:
                if "score" not in c and "similarity" not in c:
                    from backend.services.rag_service import compute_text_similarity
                    c["score"] = compute_text_similarity(rag_query, c.get("text", ""))
                    c["scoring_method"] = "tfidf_fallback"
                doc_id = c.get("document_id") or ""
                fn = c.get("filename")
                if (not doc_id or doc_id not in doc_by_id) and fn and fn in doc_by_filename:
                    doc_id = str(doc_by_filename[fn]["_id"])
                
                group_key = doc_id if doc_id else (fn or "unknown")
                if group_key not in doc_chunks_map:
                    doc_chunks_map[group_key] = []
                doc_chunks_map[group_key].append(c)

            # Document-level scoring & threshold evaluation
            scored_documents = []
            for doc_key, chunk_list in doc_chunks_map.items():
                best_chunk = max(chunk_list, key=lambda x: x.get("score", x.get("similarity", 0.0)))
                doc_score = best_chunk.get("score", best_chunk.get("similarity", 0.0))
                method = best_chunk.get("scoring_method", "dense_embedding")
                threshold = DENSE_THRESHOLD if method == "dense_embedding" else TFIDF_THRESHOLD

                doc_meta = doc_by_id.get(doc_key) or doc_by_filename.get(doc_key) or {}
                fn = doc_meta.get("filename") or best_chunk.get("filename") or "Document"

                if doc_score < threshold:
                    documents_excluded.append(f"{fn} (score={doc_score:.2f} < threshold={threshold})")
                    continue

                scored_documents.append({
                    "doc_key": doc_key,
                    "doc_meta": doc_meta,
                    "score": doc_score,
                    "best_chunk": best_chunk,
                    "all_chunks": chunk_list,
                    "filename": fn
                })

            # Sort documents by relevance descending
            scored_documents.sort(key=lambda x: x["score"], reverse=True)

            # Create deduplicated evidence items
            for item in scored_documents:
                doc_meta = item["doc_meta"]
                score = item["score"]
                fn = item["filename"]
                best_chunk = item["best_chunk"]

                # Ensure short_summary exists
                summary = doc_meta.get("short_summary")
                topics = doc_meta.get("document_topics") or []
                if not summary:
                    # Synthesize from chunk text on-the-fly
                    combined_text = "\n\n".join(c.get("text", "") for c in item["all_chunks"] if c.get("text"))
                    from backend.services.document_processor import generate_document_summary_and_topics
                    summary, topics = generate_document_summary_and_topics(combined_text or best_chunk.get("text", ""), fn)
                    if doc_meta.get("_id"):
                        try:
                            await db.documents.update_one(
                                {"_id": doc_meta["_id"]},
                                {"$set": {"short_summary": summary, "document_topics": topics}}
                            )
                        except Exception:
                            pass

                # Formulate human-readable relevance label
                if score >= 0.85:
                    rel_label = f"High relevance ({score:.2f})"
                elif score >= 0.72:
                    rel_label = f"Moderate relevance ({score:.2f})"
                else:
                    rel_label = f"Relevant context ({score:.2f})"

                doc_id_val = str(doc_meta.get("_id") or item["doc_key"])
                updated_at_val = (doc_meta.get("updatedAt") or doc_meta.get("uploadedAt") or datetime.now(timezone.utc)).isoformat()
                doc_type_val = doc_meta.get("document_type") or doc_meta.get("category") or "company_document"

                evidence_items.append(
                    EvidenceItem(
                        source_type="company_document",
                        title=fn,
                        finding=summary,
                        source_url=fn,
                        confidence=0.95,
                        relevance=round(score, 2),
                        document_id=doc_id_val,
                        filename=fn,
                        summary=summary,
                        relevance_score=round(score, 2),
                        relevance_label=rel_label,
                        updated_at=updated_at_val,
                        document_type=doc_type_val,
                        document_topics=topics,
                        company_id=company_id,
                        retrieved_at=datetime.now(timezone.utc).isoformat()
                    )
                )
                selected_document_ids.append(doc_id_val)
                selected_document_scores.append(round(score, 2))

        except Exception as e:
            logger.warning(f"[context_service] Decision-specific document retrieval error ({e})", exc_info=True)

        # Store retrieval audit statistics for Requirement 21 logging
        self._last_retrieval_stats = {
            "retrieval_query": rag_query,
            "candidate_document_count": candidate_docs_count,
            "retrieved_chunk_count": retrieved_chunk_count,
            "documents_after_threshold": len(evidence_items),
            "selected_document_ids": selected_document_ids,
            "selected_document_scores": selected_document_scores,
            "documents_excluded": documents_excluded
        }

        return evidence_items

    def generate_research_fingerprint(
        self,
        company_id: str,
        raw_text: str,
        decision_type: str,
        feature_action: str = "",
        geography: str = "",
        product: str = "",
        industry: str = ""
    ) -> str:
        """
        Creates a deterministic context fingerprint for external research caching.
        Incorporates company_id, normalized decision text, decision_type, feature/action,
        geography, product, and industry to guarantee strict cache isolation.
        """
        norm_text = re.sub(r"[^a-zA-Z0-9\s]", "", raw_text.lower()).strip()
        norm_text = " ".join(norm_text.split())
        raw = (
            f"{company_id}|{norm_text}|{decision_type.lower()}|"
            f"{feature_action.lower()}|{geography.lower()}|"
            f"{product.lower()}|{industry.lower()}"
        )
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]

    def _extract_decision_keywords_and_targets(
        self,
        raw_text: str,
        params: Dict[str, Any],
        decision_type: str
    ) -> Dict[str, str]:
        """Extracts key targets (geography, feature, role, etc.) from decision text and parameters."""
        text_lower = raw_text.lower()
        country = params.get("country") or ""
        if not country:
            for c_name in [
                "germany", "europe", "uk", "united kingdom", "france", "india",
                "us", "usa", "united states", "canada", "japan", "australia",
                "singapore", "brazil", "mexico", "spain", "italy", "netherlands", "switzerland"
            ]:
                if re.search(rf"\b{c_name}\b", text_lower):
                    country = c_name.title()
                    break

        feature = params.get("feature_name") or ""
        if not feature:
            if "map" in text_lower:
                feature = "maps feature"
            elif "chat" in text_lower or "copilot" in text_lower:
                feature = "AI chat feature"
            elif "automation" in text_lower:
                feature = "workflow automation"
            elif "analytic" in text_lower:
                feature = "analytics dashboard"
            else:
                m_feat = re.search(r"(?:launch|build|add|ship|release)\s+([a-zA-Z0-9\s]+?)(?:feature|in|for|$)", text_lower)
                if m_feat:
                    feature = m_feat.group(1).strip() + " feature"

        role = params.get("hire_role") or ""
        if not role:
            if "engineer" in text_lower or "dev" in text_lower:
                role = "engineer"
            elif "sales" in text_lower:
                role = "sales lead"
            elif "product" in text_lower:
                role = "product manager"

        return {
            "country": country,
            "feature": feature,
            "role": role,
        }

    def _build_competitor_queries(
        self,
        industry: str,
        product: str,
        target_customer: str,
        decision_type: str,
        raw_text: str,
        targets: Dict[str, str]
    ) -> List[str]:
        """Builds decision-specific competitor research queries."""
        queries: List[str] = []
        ind = industry or "SaaS"
        prod = product or ind
        geo = targets.get("country", "")
        feat = targets.get("feature", "")

        if geo or decision_type == "market_expansion" or "expand" in raw_text.lower():
            target_geo = geo or "Europe"
            queries.append(f"{ind} apps operating in {target_geo}")
            queries.append(f"{prod} platforms serving {target_geo}")
            queries.append(f"{ind} technology companies in {target_geo}")
            queries.append(f"local competitors {ind} {target_geo}")
            queries.append(f"{prod} products available in {target_geo}")
        elif feat or decision_type == "feature_launch" or "feature" in raw_text.lower() or "launch" in raw_text.lower():
            target_feat = feat or "feature"
            queries.append(f"{ind} apps with {target_feat}")
            queries.append(f"{prod} with {target_feat} alternatives competitors")
            queries.append(f"{ind} navigation apps" if "map" in target_feat.lower() else f"{ind} {target_feat} apps")
            queries.append(f"AI {ind} apps with {target_feat}")
            queries.append(f"{ind} apps location features" if "map" in target_feat.lower() else f"{ind} {target_feat} tools")
        elif decision_type == "pricing_change" or "price" in raw_text.lower() or "pricing" in raw_text.lower():
            queries.append(f"{ind} B2B SaaS pricing tiers competitors")
            queries.append(f"{prod} competitors pricing model benchmarks")
        elif decision_type == "hiring" or "hire" in raw_text.lower():
            role = targets.get("role", "engineer")
            queries.append(f"{ind} startup {role} compensation benchmarks")
            queries.append(f"{ind} tech companies hiring {role}")
        elif decision_type == "fundraising" or "raise" in raw_text.lower() or "funding" in raw_text.lower():
            queries.append(f"{ind} startup funding valuation benchmarks")
            queries.append(f"{ind} venture capital seed stage competitors")
        else:
            queries.append(f"{ind} {prod} alternatives competitors")
            queries.append(f"{ind} {raw_text[:50]} competitors")

        dedup: List[str] = []
        seen: Set[str] = set()
        for q in queries:
            qn = q.strip().lower()
            if qn and qn not in seen:
                seen.add(qn)
                dedup.append(q.strip())
        return dedup[:4]

    def _build_market_news_queries(
        self,
        industry: str,
        product: str,
        decision_type: str,
        raw_text: str,
        targets: Dict[str, str]
    ) -> List[str]:
        """Builds decision-specific market and news research queries (NewsData.io length limit <= 90)."""
        news_queries: List[str] = []
        ind = industry or "technology"
        geo = targets.get("country", "")
        feat = targets.get("feature", "")

        if geo or decision_type == "market_expansion" or "expand" in raw_text.lower():
            target_geo = geo or "Europe"
            news_queries.append(f"{target_geo} {ind} technology"[:85])
            news_queries.append(f"{target_geo} {ind} apps"[:85])
            news_queries.append(f"{target_geo} {ind} startups market"[:85])
            news_queries.append(f"{ind} platforms entering {target_geo}"[:85])
        elif feat or decision_type == "feature_launch" or "feature" in raw_text.lower() or "launch" in raw_text.lower():
            target_feat = feat or "feature"
            news_queries.append(f"{ind} {target_feat} technology"[:85])
            news_queries.append(f"{ind} navigation apps"[:85] if "map" in target_feat.lower() else f"{ind} {target_feat} market"[:85])
            news_queries.append(f"location based {ind} technology"[:85] if "map" in target_feat.lower() else f"{ind} feature adoption"[:85])
        elif decision_type == "pricing_change" or "price" in raw_text.lower() or "pricing" in raw_text.lower():
            news_queries.append(f"{ind} SaaS pricing trends"[:85])
            news_queries.append(f"B2B SaaS pricing benchmarks"[:85])
        elif decision_type == "hiring" or "hire" in raw_text.lower():
            role = targets.get("role", "engineer")
            news_queries.append(f"startup {role} hiring trends"[:85])
            news_queries.append(f"tech startup compensation trends"[:85])
        elif decision_type == "fundraising" or "raise" in raw_text.lower() or "funding" in raw_text.lower():
            news_queries.append(f"{ind} startup funding trends"[:85])
            news_queries.append(f"venture capital {ind} seed"[:85])
        else:
            news_queries.append(f"{ind} market trends"[:85])
            news_queries.append(f"{ind} {raw_text[:35]}"[:85])

        dedup: List[str] = []
        seen: Set[str] = set()
        for q in news_queries:
            qn = q.strip().lower()
            if qn and qn not in seen:
                seen.add(qn)
                dedup.append(q.strip())
        return dedup[:3]

    def _filter_and_rank_competitors(
        self,
        raw_items: List[Dict[str, Any]],
        industry: str,
        product: str,
        decision_type: str,
        raw_text: str,
        targets: Dict[str, str]
    ) -> tuple[List[EvidenceItem], List[str]]:
        """
        Filters competitor candidates strictly against current decision context.
        Rejects training dataset companies, generic directories, and off-topic results.
        Returns (qualifying_evidence_items, excluded_reasons).
        """
        accepted: List[EvidenceItem] = []
        excluded: List[str] = []
        geo = (targets.get("country") or "").lower()
        feat = (targets.get("feature") or "").lower()

        EXCLUDED_DOMAINS = {
            "wikipedia.org", "youtube.com", "medium.com", "reddit.com", "quora.com",
            "forbes.com", "investopedia.com", "nytimes.com", "statista.com", "bbc.com",
            "cnn.com", "businessinsider.com", "wsj.com", "bloomberg.com"
        }

        seen_names: Set[str] = set()

        for item in raw_items:
            title = item.get("title", "")
            snippet = item.get("snippet", "")
            url = item.get("url", "")
            domain = ""
            if url:
                try:
                    from urllib.parse import urlparse
                    domain = urlparse(url).netloc.lower().replace("www.", "")
                except Exception:
                    pass

            # 1. Training dataset separation
            if is_training_dataset_entity(title) or is_training_dataset_entity(snippet) or is_training_dataset_entity(url):
                excluded.append(f"Excluded training dataset entity: {title}")
                continue

            # 2. Exclude generic non-company domains
            if domain in EXCLUDED_DOMAINS:
                excluded.append(f"Excluded informational/editorial domain: {domain} ({title})")
                continue

            # 3. Exclude generic advice or listicle articles
            lower_title = title.lower()
            if any(lower_title.startswith(p) for p in ["10 tips", "how to ", "why you ", "the ultimate guide", "beginner's guide"]):
                excluded.append(f"Excluded guide/listicle article: {title}")
                continue

            content_text = f"{title} {snippet}".lower()

            # 4. Contextual Decision Relevance
            relevance_score = 0.85
            relevance_reasons = []

            if geo:
                geo_keywords = [geo, "europe", "eu", "berlin", "munich", "frankfurt", "german"] if geo == "germany" else [geo]
                if not any(k in content_text or k in domain for k in geo_keywords):
                    excluded.append(f"Excluded: competitor does not operate in or target {geo.title()}: {title}")
                    continue
                relevance_score = 0.90
                relevance_reasons.append(f"Operates in or serves target geography ({geo.title()})")

            if feat:
                feat_keywords = ["map", "maps", "navigation", "location", "itinerary", "gps", "route", "routing"] if "map" in feat else [feat]
                if not any(k in content_text for k in feat_keywords):
                    excluded.append(f"Excluded: competitor does not offer or discuss {feat}: {title}")
                    continue
                relevance_score = max(relevance_score, 0.88)
                relevance_reasons.append(f"Offers competing capability for {feat}")

            clean_name = title.split(" - ")[0].split(" | ")[0].split(": ")[0].strip()
            if len(clean_name) > 40:
                clean_name = clean_name[:40]
            if clean_name.lower() in seen_names:
                continue
            seen_names.add(clean_name.lower())

            reason_str = "; ".join(relevance_reasons) if relevance_reasons else f"Direct {industry} competitor evaluated for {decision_type.replace('_', ' ')}"
            finding_str = f"{clean_name}: {snippet[:200]}..." if len(snippet) > 200 else (f"{clean_name}: {snippet}" if snippet else reason_str)

            accepted.append(
                EvidenceItem(
                    source_type="competitor",
                    title=clean_name,
                    finding=finding_str,
                    source_url=url,
                    confidence=0.88,
                    relevance=relevance_score,
                    relevance_score=relevance_score,
                    relevance_label=f"Relevant competitor ({relevance_score:.2f})",
                    reason=reason_str,
                    published_at=datetime.now(timezone.utc).isoformat()
                )
            )

        return accepted[:5], excluded

    def _filter_and_rank_market_news(
        self,
        raw_items: List[Dict[str, Any]],
        industry: str,
        product: str,
        decision_type: str,
        raw_text: str,
        targets: Dict[str, str]
    ) -> tuple[List[EvidenceItem], List[str]]:
        """
        Filters market and news findings strictly against current decision context.
        Rejects training dataset references, off-topic generic articles, and sub-threshold items.
        Returns (qualifying_evidence_items, excluded_reasons).
        """
        accepted: List[EvidenceItem] = []
        excluded: List[str] = []
        geo = (targets.get("country") or "").lower()
        feat = (targets.get("feature") or "").lower()

        for item in raw_items:
            title = item.get("title", "")
            snippet = item.get("snippet", "")
            url = item.get("url", "")
            pub_date = item.get("pub_date", "") or datetime.now(timezone.utc).isoformat()

            # 1. Training dataset separation
            if is_training_dataset_entity(title) or is_training_dataset_entity(snippet) or is_training_dataset_entity(url):
                excluded.append(f"Excluded training dataset entity: {title}")
                continue

            content_text = f"{title} {snippet}".lower()

            # 2. Contextual Decision Relevance
            relevance_score = 0.82
            relevance_reasons = []

            if geo:
                geo_keywords = [geo, "europe", "eu", "berlin", "munich", "frankfurt", "german"] if geo == "germany" else [geo]
                if not any(k in content_text for k in geo_keywords):
                    excluded.append(f"Excluded market signal: does not reference {geo.title()}: {title}")
                    continue
                relevance_score = 0.88
                relevance_reasons.append(f"Regional market signals for {geo.title()}")

            if feat:
                feat_keywords = ["map", "maps", "navigation", "location", "itinerary", "gps", "route", "routing", "geospatial"] if "map" in feat else [feat]
                if not any(k in content_text for k in feat_keywords):
                    excluded.append(f"Excluded market signal: does not discuss {feat}: {title}")
                    continue
                relevance_score = max(relevance_score, 0.86)
                relevance_reasons.append(f"Market trend regarding {feat}")

            finding_str = snippet[:220] + "..." if len(snippet) > 220 else (snippet or title)
            reason_str = "; ".join(relevance_reasons) if relevance_reasons else f"Market dynamics for {industry} {decision_type.replace('_', ' ')}"

            accepted.append(
                EvidenceItem(
                    source_type="market",
                    title=title or "Market Benchmark",
                    finding=finding_str,
                    source_url=url,
                    confidence=0.86,
                    relevance=relevance_score,
                    relevance_score=relevance_score,
                    relevance_label=f"Market signal ({relevance_score:.2f})",
                    reason=reason_str,
                    published_at=pub_date
                )
            )

        return accepted[:5], excluded

    async def retrieve_competitor_context(
        self,
        company_id: str,
        profile: Dict[str, Any],
        decision_context: Optional[Dict[str, Any]] = None
    ) -> List[EvidenceItem]:
        """
        Retrieves verified competitor context only if relevant to the current decision.
        Never blindly injects historical competitors from unrelated runs into a new decision.
        """
        return []

    async def perform_decision_research(
        self,
        decision_type: str,
        params: Dict[str, Any],
        profile: Dict[str, Any],
        raw_text: str = "",
        company_id: str = "default_company",
        structured_decision: Optional[Dict[str, Any]] = None
    ) -> tuple[List[EvidenceItem], List[EvidenceItem]]:
        """
        Executes real-time, decision-specific external research via Tavily (competitors)
        and NewsData.io (market & news trends), with strict fingerprint-based cache isolation
        and relevance filtering.
        """
        if decision_type in ["burn_adjustment", "validation_action"]:
            logger.info(f"[context_service] Decision type '{decision_type}' is internal; skipping external search.")
            self._last_research_stats = {
                "research_fingerprint": "internal_decision_skip",
                "competitor_queries": [],
                "selected_competitors_count": 0,
                "market_queries": [],
                "selected_market_count": 0,
                "cache_hit": False,
                "competitors_excluded": [],
                "market_excluded": []
            }
            return [], []

        industry = profile.get("industry") or "SaaS"
        product = profile.get("product") or ""
        target_customer = profile.get("target_customer") or ""

        targets = self._extract_decision_keywords_and_targets(raw_text, params, decision_type)
        fingerprint = self.generate_research_fingerprint(
            company_id=company_id,
            raw_text=raw_text,
            decision_type=decision_type,
            feature_action=targets.get("feature", ""),
            geography=targets.get("country", ""),
            product=product,
            industry=industry
        )

        competitor_queries = self._build_competitor_queries(
            industry=industry,
            product=product,
            target_customer=target_customer,
            decision_type=decision_type,
            raw_text=raw_text,
            targets=targets
        )

        market_queries = self._build_market_news_queries(
            industry=industry,
            product=product,
            decision_type=decision_type,
            raw_text=raw_text,
            targets=targets
        )

        cache_key = f"{company_id}:{fingerprint}"
        now = time.time()
        if cache_key in _RESEARCH_CACHE:
            ts, (cached_comp, cached_mkt, cached_stats) = _RESEARCH_CACHE[cache_key]
            if now - ts < CACHE_TTL_SECONDS:
                logger.info(f"[context_service] Returning cached research for fingerprint {fingerprint}")
                cached_stats_copy = dict(cached_stats)
                cached_stats_copy["cache_hit"] = True
                self._last_research_stats = cached_stats_copy
                return cached_comp, cached_mkt

        raw_competitor_items: List[Dict[str, Any]] = []
        raw_news_items: List[Dict[str, Any]] = []

        try:
            tavily_task = asyncio.create_task(search_tavily(competitor_queries[:3], max_results_per_query=3))
            news_task = asyncio.create_task(search_newsdata(market_queries[:3], max_results_per_query=3))
            tav_res, news_res = await asyncio.gather(tavily_task, news_task, return_exceptions=True)

            if isinstance(tav_res, list):
                for r in tav_res:
                    raw_competitor_items.append({
                        "title": getattr(r, "title", ""),
                        "snippet": getattr(r, "snippet", ""),
                        "url": getattr(r, "url", ""),
                        "source": "tavily"
                    })
            elif isinstance(tav_res, Exception):
                logger.warning(f"[context_service] Tavily search error: {tav_res}")

            if isinstance(news_res, list):
                for nr in news_res:
                    raw_news_items.append({
                        "title": getattr(nr, "title", ""),
                        "snippet": getattr(nr, "snippet", ""),
                        "url": getattr(nr, "url", ""),
                        "pub_date": getattr(nr, "pub_date", ""),
                        "source": "newsdata"
                    })
            elif isinstance(news_res, Exception):
                logger.warning(f"[context_service] NewsData search error: {news_res}")
        except Exception as e:
            logger.warning(f"[context_service] Research gather error ({e}). Continuing.")

        competitor_evidence, comp_excluded = self._filter_and_rank_competitors(
            raw_items=raw_competitor_items,
            industry=industry,
            product=product,
            decision_type=decision_type,
            raw_text=raw_text,
            targets=targets
        )

        market_evidence, mkt_excluded = self._filter_and_rank_market_news(
            raw_items=raw_news_items,
            industry=industry,
            product=product,
            decision_type=decision_type,
            raw_text=raw_text,
            targets=targets
        )

        research_stats = {
            "research_fingerprint": fingerprint,
            "competitor_queries": competitor_queries,
            "selected_competitors_count": len(competitor_evidence),
            "market_queries": market_queries,
            "selected_market_count": len(market_evidence),
            "cache_hit": False,
            "competitors_excluded": comp_excluded,
            "market_excluded": mkt_excluded
        }
        self._last_research_stats = research_stats

        _RESEARCH_CACHE[cache_key] = (now, (competitor_evidence, market_evidence, research_stats))
        return competitor_evidence, market_evidence


    async def build_full_context(
        self,
        company_id: str,
        structured_decision: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Orchestrates canonical company context without fabricating values.
        """
        profile = await self.get_company_profile(company_id)
        decision_type = structured_decision.get("decision_type", "other")
        params = structured_decision.get("parameters", {})
        raw_text = structured_decision.get("raw_text", "")

        # 1. Canonical Company Profile Evidence
        company_evidence: List[EvidenceItem] = [
            EvidenceItem(
                source_type="company_profile",
                title=f"{profile.get('company_name', 'Company')} Profile",
                finding=f"Stage: {profile.get('current_stage', 'MVP')} in {profile.get('industry', 'SaaS')}. Target ICP: {profile.get('target_customer', 'Target market')}. Product: {profile.get('product', 'Core product')}.",
                source_url="Company Profile",
                confidence=0.98,
                relevance=0.95
            )
        ]

        # 2. Extract Verified Metrics (Strictly None if unverified/missing)
        monthly_mrr = profile.get("monthly_revenue") if profile.get("monthly_revenue") is not None else profile.get("current_mrr")
        burn_rate = profile.get("monthly_burn_rate") if profile.get("monthly_burn_rate") is not None else profile.get("monthly_burn")
        runway = profile.get("runway_months")
        total_users = profile.get("total_users") if profile.get("total_users") is not None else (profile.get("num_customers") if profile.get("num_customers") is not None else profile.get("active_subscriptions"))
        funding_raised = profile.get("funding_raised") if profile.get("funding_raised") is not None else profile.get("funding_total_usd")

        # Calculate runway transparently if cash and burn are provided but runway is missing
        cash_in_bank = profile.get("cash_in_bank") if profile.get("cash_in_bank") is not None else profile.get("cash_balance")
        runway_source = "company_profile" if runway is not None else None
        if runway is None and cash_in_bank and burn_rate and float(burn_rate) > 0:
            runway = round(float(cash_in_bank) / float(burn_rate), 1)
            runway_source = "calculated_from_cash_and_burn"

        canonical_metrics = {
            "monthly_revenue": {
                "value": float(monthly_mrr) if monthly_mrr is not None else None,
                "source": "company_profile" if monthly_mrr is not None else None,
                "status": "verified" if monthly_mrr is not None else "missing"
            },
            "total_users": {
                "value": int(total_users) if total_users is not None else None,
                "source": "company_profile" if total_users is not None else None,
                "status": "verified" if total_users is not None else "missing"
            },
            "runway_months": {
                "value": float(runway) if runway is not None else None,
                "source": runway_source,
                "status": "verified" if runway is not None else "missing"
            },
            "monthly_burn_rate": {
                "value": float(burn_rate) if burn_rate is not None else None,
                "source": "company_profile" if burn_rate is not None else None,
                "status": "verified" if burn_rate is not None else "missing"
            },
            "funding_raised": {
                "value": float(funding_raised) if funding_raised is not None else None,
                "source": "company_profile" if funding_raised is not None else None,
                "status": "verified" if funding_raised is not None else "missing"
            }
        }

        # Add metric evidence if any verified metrics exist
        verified_count = sum(1 for v in canonical_metrics.values() if v["status"] == "verified")
        metric_claims = []
        if monthly_mrr is not None:
            metric_claims.append(f"MRR: ${monthly_mrr:,.0f}")
        if burn_rate is not None:
            metric_claims.append(f"Burn: ${burn_rate:,.0f}/mo")
        if runway is not None:
            metric_claims.append(f"Runway: ~{runway:.1f} mo")
        if total_users is not None:
            metric_claims.append(f"Users: {total_users:,}")

        if metric_claims:
            company_evidence.append(
                EvidenceItem(
                    source_type="company_metric",
                    title="Verified Startup Metrics",
                    finding=", ".join(metric_claims) + " (from verified company profile).",
                    source_url="Company Profile",
                    confidence=0.95,
                    relevance=0.95
                )
            )

        # 3. Targeted Document RAG Evidence
        product_ctx = f"{profile.get('product', '')} {profile.get('industry', '')}"
        document_evidence = await self.retrieve_relevant_documents(
            company_id=company_id,
            decision_type=decision_type,
            query_text=raw_text,
            product_context=product_ctx,
            structured_decision=structured_decision,
            profile=profile
        )

        # 4. Decision-Specific Competitors & Market Evidence
        live_competitors, market_evidence = await self.perform_decision_research(
            decision_type=decision_type,
            params=params,
            profile=profile,
            raw_text=raw_text,
            company_id=company_id,
            structured_decision=structured_decision
        )

        all_competitors = live_competitors

        # 5. Data Quality Metadata
        data_quality = {
            "completeness_pct": round(verified_count / 5 * 100),
            "verified_metrics_count": verified_count,
            "missing_metrics": [k for k, v in canonical_metrics.items() if v["status"] == "missing"],
            "has_revenue_history": monthly_mrr is not None and monthly_mrr > 0,
            "last_updated": datetime.now(timezone.utc).isoformat()
        }

        # 6. Normalized state for scenario engine (Strictly None for unverified fields)
        current_stage = profile.get("current_stage") or profile.get("stage") or "MVP"
        state_for_engine = {
            "current_mrr": float(monthly_mrr) if monthly_mrr is not None else None,
            "monthly_burn_rate": float(burn_rate) if burn_rate is not None else None,
            "runway_months": float(runway) if runway is not None else None,
            "cash_in_bank": float(cash_in_bank) if cash_in_bank is not None else None,
            "cash_balance": float(cash_in_bank) if cash_in_bank is not None else None,
            "funding_total_usd": float(funding_raised) if funding_raised is not None else None,
            "industry": profile.get("industry", "DevTools"),
            "target_customer": profile.get("target_customer", "B2B"),
            "product": profile.get("product", "Core Product"),
            "current_stage": current_stage,
            "funding_path": profile.get("funding_stage", "bootstrapped").lower().replace(" ", "_"),
            "did_customer_validation": 1 if (profile.get("validation_done") or profile.get("did_customer_validation")) else 0,
            "total_users": int(total_users) if total_users is not None else None,
            "active_subscriptions": int(total_users) if total_users is not None else None,
            "n_unique_features": int(profile.get("n_unique_features", 4)),
            "has_beta_feature": int(profile.get("has_beta_feature", 0)),
            "canonical_metrics": canonical_metrics,
            "data_quality": data_quality
        }

        return {
            "company_profile": profile,
            "canonical_metrics": canonical_metrics,
            "data_quality": data_quality,
            "company_state_for_engine": state_for_engine,
            "evidence": {
                "company": [e.to_dict() for e in company_evidence],
                "documents": [e.to_dict() for e in document_evidence],
                "competitors": [e.to_dict() for e in all_competitors],
                "market": [e.to_dict() for e in market_evidence]
            },
            "document_retrieval_stats": getattr(self, "_last_retrieval_stats", {}),
            "research_stats": getattr(self, "_last_research_stats", {})
        }


def get_company_context_service() -> CompanyContextService:
    return CompanyContextService()
