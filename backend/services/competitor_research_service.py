"""
Competitor Research orchestrator service.
Manages the lifecycle of competitor research.
"""
import asyncio
import logging
from datetime import datetime
from uuid import uuid4
from typing import Dict, Any, List, Optional

from backend.database import get_db
from backend.models import CompetitorResearchResult
from backend.services.web_search_service import (
    generate_search_queries,
    search_duckduckgo,
    search_tavily,
    merge_and_deduplicate,
    identify_and_rank_companies,
)
from backend.services.competitor_enrichment_service import (
    enrich_competitor_with_searches,
    build_competitor_profile,
    generate_comparison_and_gaps,
)

logger = logging.getLogger(__name__)

async def get_latest_research(user_id: str) -> Optional[Dict[str, Any]]:
    """Retrieve the latest competitor research result for a user."""
    db = await get_db()
    result = await db.competitor_research.find_one(
        {"user_id": user_id},
        sort=[("completed_at", -1)]
    )
    if result:
        result["id"] = str(result.get("_id", result.get("id", "")))
        result.pop("_id", None)
    return result

async def get_research_status(user_id: str) -> Optional[Dict[str, Any]]:
    """Check the status of the current or latest research task."""
    db = await get_db()
    result = await db.competitor_research.find_one(
        {"user_id": user_id},
        sort=[("started_at", -1)]
    )
    if result:
        return {
            "status": result.get("research_status", "pending"),
            "started_at": result.get("started_at"),
            "completed_at": result.get("completed_at"),
            "error_message": result.get("error_message"),
        }
    return None

async def trigger_competitor_research(user_id: str) -> str:
    """Trigger the async competitor research pipeline."""
    db = await get_db()
    
    # 1. Check if there's already an active run
    active = await db.competitor_research.find_one({
        "user_id": user_id,
        "research_status": "running"
    })
    if active:
        return str(active.get("_id", active.get("id", "")))

    research_id = str(uuid4())[:8]
    
    # Get startup profile for context
    profile_doc = await db.profiles.find_one({"user_id": user_id}) or {}
    profile_doc.pop("_id", None)
    profile_doc.pop("user_id", None)

    # Initial pending record
    research_record = {
        "id": research_id,
        "user_id": user_id,
        "competitors": [],
        "comparison": None,
        "gaps": [],
        "research_status": "running",
        "started_at": datetime.utcnow(),
        "completed_at": None,
        "startup_context_used": profile_doc,
        "error_message": None
    }
    
    await db.competitor_research.insert_one(research_record)
    
    # Start background task
    asyncio.create_task(run_research_pipeline(user_id, research_id, profile_doc))
    
    return research_id

async def run_research_pipeline(user_id: str, research_id: str, profile: Dict[str, Any]):
    """Execute the full search, deduplication, enrichment, and analysis lifecycle."""
    db = await get_db()
    logger.info(f"[pipeline] Starting research pipeline for user {user_id}, run {research_id}")
    
    try:
        # 1. Generate search queries
        queries = generate_search_queries(profile)
        if not queries:
            raise ValueError("Could not generate search queries from company profile. Make sure profile is populated.")

        # 2. Run searches in parallel
        ddg_task = search_duckduckgo(queries)
        tavily_task = search_tavily(queries)
        ddg_results, tavily_results = await asyncio.gather(ddg_task, tavily_task)

        # 3. Merge & Deduplicate
        merged_results = merge_and_deduplicate(ddg_results, tavily_results)
        if not merged_results:
            raise ValueError("No search results returned from DuckDuckGo or Tavily.")

        # 4. Identify competitors (AI filtered and ranked, target: 5-7 companies)
        identified_companies = await identify_and_rank_companies(
            merged_results, profile, max_competitors=6
        )
        if not identified_companies:
            raise ValueError("No competitors could be identified from the web search results.")

        # 5. Enrich and Build Profiles in parallel/sequentially
        competitor_profiles = []
        for company in identified_companies:
            try:
                company_name = company["name"]
                company_domain = company["domain"]
                relevance_score = company.get("relevance_score", 50)
                relevance_reason = company.get("relevance_reason", "")
                initial_sources = company.get("sources", [])

                # Run follow-up enrichment searches
                enrichment_sources = await enrich_competitor_with_searches(
                    company_name, company_domain, profile.get("industry", "")
                )
                
                # Build profile
                comp_profile = await build_competitor_profile(
                    company_name,
                    company_domain,
                    initial_sources,
                    enrichment_sources,
                    profile,
                    relevance_score,
                    relevance_reason
                )
                competitor_profiles.append(comp_profile)
            except Exception as ex:
                logger.warning(f"[pipeline] Failed to enrich competitor {company.get('name')}: {ex}")
                continue

        if not competitor_profiles:
            raise ValueError("Failed to enrich any of the identified competitors.")

        # 6. Generate comparison and competitive gaps
        analysis = await generate_comparison_and_gaps(competitor_profiles, profile)
        
        # 7. Save completed results
        await db.competitor_research.update_one(
            {"id": research_id},
            {"$set": {
                "competitors": competitor_profiles,
                "comparison": analysis.get("comparison"),
                "gaps": analysis.get("gaps", []),
                "research_status": "completed",
                "completed_at": datetime.utcnow()
            }}
        )
        logger.info(f"[pipeline] Competitor research run {research_id} completed successfully.")

    except Exception as e:
        logger.error(f"[pipeline] Critical pipeline failure: {e}")
        await db.competitor_research.update_one(
            {"id": research_id},
            {"$set": {
                "research_status": "failed",
                "completed_at": datetime.utcnow(),
                "error_message": str(e)
            }}
        )
