"""
Research Pipeline Orchestrator Service.
Coordinates the end-to-end intelligence loop:
1. Research Planning (Mistral queries tailored to startup profile)
2. Discovery via NewsData.io + Tavily Search
3. Deduplication via content hashes
4. Persistent Entity & Event Extraction & Merging
5. Insight Synthesis & Relevance Ranking (4-question framework)
6. Run Status & Audit Logging
"""
import asyncio
import logging
import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional

from backend.database import database
from backend.services.newsdata_service import search_newsdata
from backend.services.web_search_service import search_tavily
from backend.services.research_planner_service import generate_research_queries
from backend.services.evidence_processor_service import (
    process_and_deduplicate_evidence,
    extract_entities_and_events,
    merge_entities_into_db,
    merge_events_into_db,
)
from backend.services.research_insight_service import generate_insights_from_evidence

logger = logging.getLogger(__name__)


async def run_research_pipeline(user_id: str, run_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Executes the persistent research pipeline for a user.
    Can be called synchronously or run as a background task.
    """
    if not run_id:
        run_id = str(uuid.uuid4())

    now = datetime.utcnow()
    pipeline_log = [f"[{now.strftime('%H:%M:%S')}] Initialized pipeline run {run_id}"]

    run_record = {
        "id": run_id,
        "user_id": user_id,
        "status": "planning",
        "queries_used": [],
        "evidence_found": 0,
        "evidence_new": 0,
        "entities_found": 0,
        "events_found": 0,
        "insights_generated": 0,
        "started_at": now,
        "completed_at": None,
        "error_message": None,
        "pipeline_log": pipeline_log,
    }

    # Upsert run record
    await database.research_runs.update_one(
        {"id": run_id},
        {"$set": run_record},
        upsert=True
    )

    async def update_status(status: str, log_msg: str, extra: Dict[str, Any] = None):
        t_str = datetime.utcnow().strftime('%H:%M:%S')
        pipeline_log.append(f"[{t_str}] {log_msg}")
        update_data = {
            "status": status,
            "pipeline_log": pipeline_log,
        }
        if extra:
            update_data.update(extra)
        await database.research_runs.update_one(
            {"id": run_id},
            {"$set": update_data}
        )

    try:
        # Step 1: Load Profile & Context
        await update_status("planning", "Loading startup profile and context...")
        profile = await database.profiles.find_one({"user_id": user_id}) or {}
        
        # Load known competitors from competitor research if available
        comp_res = await database.competitor_research.find_one({"user_id": user_id})
        existing_competitors = []
        if comp_res and "competitors" in comp_res:
            existing_competitors = [c.get("name") for c in comp_res.get("competitors", []) if c.get("name")]
        if not existing_competitors:
            raw_comps = profile.get("competitors", [])
            if isinstance(raw_comps, str):
                existing_competitors = [c.strip() for c in raw_comps.split(",") if c.strip()]
            elif isinstance(raw_comps, list):
                existing_competitors = raw_comps

        # Load past feedback to adapt queries
        past_feedback = await database.research_feedback.find({"user_id": user_id}).to_list(50)

        # Step 2: Research Planner -> Generate Queries
        await update_status("planning", "Generating targeted research queries via Research Planner...")
        planned_queries = await generate_research_queries(
            profile=profile,
            existing_competitors=existing_competitors,
            past_feedback=past_feedback,
        )

        query_texts = [q.get("text", "") for q in planned_queries if q.get("text")]
        await update_status(
            "searching",
            f"Generated {len(query_texts)} search queries across industry, competitor, and regulatory intents.",
            {"queries_used": planned_queries}
        )

        # Step 3: Targeted Discovery (NewsData.io + Tavily in parallel)
        # NewsData.io indexes breaking news (last 48-72h); concise 2-4 word queries produce highest relevance
        industry_clean = profile.get("industry", "technology").strip()
        news_queries: List[str] = []
        if industry_clean:
            news_queries.append(f"{industry_clean} startup")
            news_queries.append(f"{industry_clean} AI")
            news_queries.append(f"{industry_clean} funding")
        if existing_competitors:
            for comp in existing_competitors[:2]:
                if comp and len(comp) < 30:
                    news_queries.append(f"{comp}")

        # Add concise head keywords from planned queries
        for q in planned_queries[:3]:
            q_text = q.get("text", "")
            part = q_text.split(":")[0].strip() if ":" in q_text else q_text.strip()
            words = part.split()
            if len(words) > 4:
                part = " ".join(words[:4])
            if part and len(part) <= 45 and part.lower() not in [nq.lower() for nq in news_queries]:
                news_queries.append(part)

        news_queries = news_queries[:5]
        tavily_queries = query_texts[:6]

        await update_status("searching", f"Querying NewsData.io ({len(news_queries)} news queries) & Tavily ({len(tavily_queries)} web queries)...")

        news_task = asyncio.create_task(search_newsdata(news_queries, max_results_per_query=5))
        tavily_task = asyncio.create_task(search_tavily(tavily_queries, max_results_per_query=6))

        news_results, tavily_results = await asyncio.gather(news_task, tavily_task, return_exceptions=True)

        if isinstance(news_results, Exception):
            logger.warning(f"[research_pipeline] NewsData search failed: {news_results}")
            news_results = []
        if isinstance(tavily_results, Exception):
            logger.warning(f"[research_pipeline] Tavily search failed: {tavily_results}")
            tavily_results = []

        # Convert to raw evidence records
        raw_evidence: List[Dict[str, Any]] = []

        for item in news_results:
            raw_evidence.append({
                "url": item.url,
                "title": item.title,
                "snippet": item.snippet,
                "full_text": item.snippet,
                "source_type": "newsdata",
                "source_query": getattr(item, "source_query", ""),
                "query_intent": "market_trend",
                "domain": item.domain,
                "metadata": {
                    "source_name": item.source_name,
                    "pub_date": item.pub_date,
                    "category": item.category,
                }
            })

        for item in tavily_results:
            raw_evidence.append({
                "url": item.url,
                "title": item.title,
                "snippet": item.snippet,
                "full_text": item.snippet,
                "source_type": "tavily",
                "source_query": getattr(item, "source_query", ""),
                "query_intent": "web_intelligence",
                "domain": item.domain,
                "metadata": {}
            })

        total_discovered = len(raw_evidence)
        await update_status("processing", f"Discovered {total_discovered} raw sources. Deduplicating against persistent store...")

        # Step 4: Deduplicate against persistent evidence store
        new_evidence, existing_count = await process_and_deduplicate_evidence(user_id, raw_evidence)
        await update_status(
            "processing",
            f"Deduplication complete: {len(new_evidence)} new sources added, {existing_count} existing sources updated.",
            {
                "evidence_found": total_discovered,
                "evidence_new": len(new_evidence),
            }
        )

        # Step 5: Entity & Event Extraction on newly found sources (or recent sources if first run)
        sources_to_extract = new_evidence
        if not sources_to_extract:
            # Check if entities exist; if none, take up to 10 stored sources to bootstrap
            ent_count = await database.research_entities.count_documents({"user_id": user_id})
            if ent_count == 0:
                sources_to_extract = await database.research_evidence.find({"user_id": user_id}).sort("retrieved_at", -1).limit(10).to_list(10)

        extracted_entities: List[Dict[str, Any]] = []
        extracted_events: List[Dict[str, Any]] = []

        if sources_to_extract:
            await update_status("processing", f"Extracting entities & market events from {len(sources_to_extract)} sources...")
            extracted_entities, extracted_events = await extract_entities_and_events(
                user_id=user_id,
                evidence_list=sources_to_extract,
                startup_context=profile
            )

            # Merge entities and events into persistent collections
            merged_ents = await merge_entities_into_db(user_id, extracted_entities)
            merged_evs = await merge_events_into_db(user_id, extracted_events)
            await update_status(
                "analyzing",
                f"Merged {merged_ents} persistent entities and {merged_evs} market events.",
                {"entities_found": merged_ents, "events_found": merged_evs}
            )
        else:
            await update_status("analyzing", "No new sources requiring entity extraction. Using existing knowledge store.")

        # Step 6: Load active intelligence context for insight synthesis
        top_evidence = await database.research_evidence.find({"user_id": user_id}).sort("retrieved_at", -1).limit(12).to_list(12)
        top_entities = await database.research_entities.find({"user_id": user_id}).sort("relevance_score", -1).limit(10).to_list(10)
        top_events = await database.research_events.find({"user_id": user_id}).sort("created_at", -1).limit(8).to_list(8)

        await update_status("analyzing", "Synthesizing startup-tailored strategic insights with 4-question framework...")

        insights = await generate_insights_from_evidence(
            user_id=user_id,
            evidence_list=top_evidence,
            entities_list=top_entities,
            events_list=top_events,
            profile=profile
        )

        completed_time = datetime.utcnow()
        await update_status(
            "completed",
            f"Pipeline complete! {len(insights)} strategic insights generated/verified.",
            {
                "completed_at": completed_time,
                "insights_generated": len(insights)
            }
        )

        final_run = await database.research_runs.find_one({"id": run_id})
        return final_run or run_record

    except Exception as e:
        logger.error(f"[research_pipeline] Pipeline error for user {user_id}: {e}", exc_info=True)
        t_str = datetime.utcnow().strftime('%H:%M:%S')
        pipeline_log.append(f"[{t_str}] Pipeline failed: {str(e)}")
        await database.research_runs.update_one(
            {"id": run_id},
            {
                "$set": {
                    "status": "failed",
                    "error_message": str(e),
                    "completed_at": datetime.utcnow(),
                    "pipeline_log": pipeline_log,
                }
            }
        )
        return {
            "id": run_id,
            "user_id": user_id,
            "status": "failed",
            "error_message": str(e)
        }
