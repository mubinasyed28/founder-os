"""
Competitor Enrichment Service.
Enriches identified competitors with detailed web research and AI-structured profiles.
"""
import asyncio
import json
import logging
import urllib.request
import urllib.error
from datetime import datetime
from typing import Dict, Any, List
from uuid import uuid4

from backend.config import settings
from backend.services.web_search_service import (
    search_duckduckgo,
    search_tavily,
    merge_and_deduplicate,
    SearchResult,
)

logger = logging.getLogger(__name__)


# ── Enrichment Search ────────────────────────────────────────────────

async def enrich_competitor_with_searches(
    company_name: str,
    company_domain: str,
    industry: str = ""
) -> List[SearchResult]:
    """Run follow-up searches to gather detailed info about a specific competitor."""
    
    year = datetime.utcnow().year
    queries = [
        f"{company_name} products features",
        f"{company_name} pricing plans",
        f"{company_name} funding investors {year}",
        f'site:{company_domain} about',
    ]
    
    if industry:
        queries.append(f"{company_name} {industry} reviews")

    ddg = await search_duckduckgo(queries, max_results_per_query=5)
    tavily = await search_tavily(queries, max_results_per_query=5)
    merged = merge_and_deduplicate(ddg, tavily)
    
    logger.info(f"[enrich] {company_name}: collected {len(merged)} enrichment sources")
    return merged


# ── AI Profile Builder ───────────────────────────────────────────────

async def build_competitor_profile(
    company_name: str,
    company_domain: str,
    initial_sources: List[Dict[str, Any]],
    enrichment_sources: List[SearchResult],
    startup_profile: Dict[str, Any],
    relevance_score: int = 50,
    relevance_reason: str = "",
) -> Dict[str, Any]:
    """Use AI to structure a competitor profile from collected web evidence."""

    # Combine all source snippets
    all_sources = []
    source_text = ""
    
    # From initial identification
    for s in initial_sources:
        src = {
            "title": s.get("title", ""),
            "url": s.get("url", ""),
            "domain": s.get("domain", ""),
            "snippet": s.get("snippet", ""),
            "retrieved_at": s.get("retrieved_at", datetime.utcnow().isoformat()),
        }
        all_sources.append(src)
        source_text += f"\nSource: {src['title']}\nURL: {src['url']}\nContent: {src['snippet'][:300]}\n"

    # From enrichment
    for sr in enrichment_sources:
        src = sr.to_dict()
        all_sources.append(src)
        source_text += f"\nSource: {src['title']}\nURL: {src['url']}\nContent: {src['snippet'][:300]}\n"

    api_key = settings.MISTRAL_API_KEY
    if not api_key:
        return _fallback_profile(company_name, company_domain, all_sources, relevance_score)

    prompt = f"""You are building a structured competitor profile for a startup founder.

COMPETITOR: {company_name} ({company_domain})

WEB EVIDENCE:
{source_text}

FOUNDER'S STARTUP CONTEXT:
- Company: {startup_profile.get('company_name', 'Unknown')}
- Industry: {startup_profile.get('industry', 'Unknown')}  
- Product: {startup_profile.get('product', 'Unknown')}
- Problem: {startup_profile.get('problem_statement', 'Unknown')}
- Target Customer: {startup_profile.get('target_customer', 'Unknown')}
- Business Model: {startup_profile.get('business_model', 'Unknown')}
- Solution: {startup_profile.get('solution', 'Unknown')}

TASK:
Based ONLY on the provided web evidence, extract the following fields for {company_name}.
If a field cannot be reliably determined from the evidence, use null.
Do NOT fabricate information.

Return ONLY valid JSON:
{{
  "name": "{company_name}",
  "website": "https://{company_domain}",
  "description": "Company description from evidence",
  "industry": "Industry/sector",
  "founded_year": "Year or null",
  "location": "HQ location or null",
  "target_customers": "Who they serve",
  "products_services": ["Product 1", "Product 2"],
  "key_features": ["Feature 1", "Feature 2", "Feature 3"],
  "business_model": "How they make money",
  "mission": "Mission statement or null",
  "vision": "Vision statement or null",
  "value_proposition": "Core value prop",
  "pricing": "Pricing info or null",
  "funding": "Funding info or null",
  "investors": "Investor names or null",
  "recent_activity": ["Recent notable event 1"],
  "relevant_news": ["News item 1"],
  "strengths": ["Strength 1", "Strength 2"],
  "weaknesses": ["Weakness/gap 1"],
  "competitive_relevance": "Why this competitor matters to the founder's startup"
}}"""

    try:
        def call_mistral():
            payload = {
                "model": "mistral-large-latest",
                "messages": [
                    {"role": "system", "content": "You are a competitive intelligence analyst. Extract factual information from web evidence only. Return ONLY valid JSON. Use null for unavailable fields."},
                    {"role": "user", "content": prompt}
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.1,
            }
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            }
            req = urllib.request.Request(
                "https://api.mistral.ai/v1/chat/completions",
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=60) as response:
                resp_data = response.read().decode("utf-8")
                resp_json = json.loads(resp_data)
                content = resp_json["choices"][0]["message"]["content"]
                return json.loads(content.strip())

        profile_data = await asyncio.to_thread(call_mistral)
        
        # Ensure required fields and clean nulls for display
        profile_data["id"] = str(uuid4())[:8]
        profile_data["relevance_score"] = relevance_score
        profile_data["sources"] = all_sources
        
        # Clean up null strings
        for key in ["founded_year", "location", "mission", "vision", "pricing", "funding", "investors"]:
            if profile_data.get(key) in [None, "null", "None", ""]:
                profile_data[key] = None
        
        # Ensure lists
        for key in ["products_services", "key_features", "recent_activity", "relevant_news", "strengths", "weaknesses"]:
            if not isinstance(profile_data.get(key), list):
                profile_data[key] = []

        return profile_data

    except Exception as e:
        logger.error(f"[enrich] AI profiling error for {company_name}: {e}")
        return _fallback_profile(company_name, company_domain, all_sources, relevance_score)


def _fallback_profile(
    name: str, domain: str, sources: List[Dict], relevance_score: int
) -> Dict[str, Any]:
    """Create a basic profile when AI is unavailable."""
    description = ""
    if sources:
        description = sources[0].get("snippet", "")[:200]
    
    return {
        "id": str(uuid4())[:8],
        "name": name,
        "website": f"https://{domain}",
        "description": description,
        "industry": "",
        "founded_year": None,
        "location": None,
        "target_customers": "",
        "products_services": [],
        "key_features": [],
        "business_model": "",
        "mission": None,
        "vision": None,
        "value_proposition": "",
        "pricing": None,
        "funding": None,
        "investors": None,
        "recent_activity": [],
        "relevant_news": [],
        "strengths": [],
        "weaknesses": [],
        "competitive_relevance": "",
        "relevance_score": relevance_score,
        "sources": sources,
    }


# ── Cross-Competitor Analysis ────────────────────────────────────────

async def generate_comparison_and_gaps(
    competitor_profiles: List[Dict[str, Any]],
    startup_profile: Dict[str, Any]
) -> Dict[str, Any]:
    """Generate cross-competitor comparison and gap analysis."""
    
    api_key = settings.MISTRAL_API_KEY
    if not api_key or not competitor_profiles:
        return {"comparison": {"dimensions": [], "summary": ""}, "gaps": []}

    # Build competitor summaries
    comp_summaries = ""
    for c in competitor_profiles:
        comp_summaries += f"""
--- {c.get('name', 'Unknown')} ---
Description: {c.get('description', 'N/A')[:150]}
Products: {', '.join(c.get('products_services', [])[:3])}
Features: {', '.join(c.get('key_features', [])[:3])}
Target: {c.get('target_customers', 'N/A')}
Business Model: {c.get('business_model', 'N/A')}
Strengths: {', '.join(c.get('strengths', [])[:2])}
Weaknesses: {', '.join(c.get('weaknesses', [])[:2])}
Pricing: {c.get('pricing') or 'N/A'}
"""

    prompt = f"""Analyze competitor landscape for a startup founder.

FOUNDER'S STARTUP:
- Name: {startup_profile.get('company_name', 'Unknown')}
- Product: {startup_profile.get('product', 'Unknown')}
- Problem: {startup_profile.get('problem_statement', 'Unknown')}
- Solution: {startup_profile.get('solution', 'Unknown')}
- Target Customer: {startup_profile.get('target_customer', 'Unknown')}
- Business Model: {startup_profile.get('business_model', 'Unknown')}

COMPETITORS:
{comp_summaries}

TASK:
1. Compare the startup against competitors on key dimensions.
2. Identify competitive gaps — areas where competitors are weak or areas not covered.

Return ONLY valid JSON:
{{
  "comparison": {{
    "dimensions": [
      {{
        "dimension": "Target Customer",
        "startup": "Brief description of startup's positioning",
        "competitors_summary": "How competitors position on this dimension"
      }}
    ],
    "summary": "Overall competitive landscape summary in 2-3 sentences"
  }},
  "gaps": [
    {{
      "title": "Gap title",
      "description": "What the gap is and why it matters",
      "evidence": "What evidence supports this gap (be specific)",
      "gap_type": "feature|market|pricing|positioning",
      "confidence": 70
    }}
  ]
}}

Include 5-7 comparison dimensions (target_customer, problem, product, features, business_model, positioning, differentiators).
Include 2-4 gaps, marked as potential opportunities. Be honest about confidence levels."""

    try:
        def call_mistral():
            payload = {
                "model": "mistral-large-latest",
                "messages": [
                    {"role": "system", "content": "You are a startup competitive strategy advisor. Provide evidence-based analysis. Return ONLY valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.2,
            }
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            }
            req = urllib.request.Request(
                "https://api.mistral.ai/v1/chat/completions",
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=60) as response:
                resp_data = response.read().decode("utf-8")
                resp_json = json.loads(resp_data)
                content = resp_json["choices"][0]["message"]["content"]
                return json.loads(content.strip())

        result = await asyncio.to_thread(call_mistral)
        return result

    except Exception as e:
        logger.error(f"[analysis] Comparison/gap analysis error: {e}")
        return {"comparison": {"dimensions": [], "summary": ""}, "gaps": []}
