"""
Web Search Service for Competitor Research.
Handles DuckDuckGo and Tavily search, result merging, and deduplication.
"""
import asyncio
import json
import logging
import re
import urllib.request
import urllib.error
from datetime import datetime
from typing import Dict, Any, List, Optional
from urllib.parse import urlparse

import httpx

from backend.config import settings

logger = logging.getLogger(__name__)


# ── Search Result Type ───────────────────────────────────────────────

class SearchResult:
    def __init__(self, title: str, url: str, snippet: str, source: str = ""):
        self.title = title
        self.url = url.rstrip("/")
        self.domain = urlparse(url).netloc.lower().replace("www.", "")
        self.snippet = snippet
        self.source = source  # "duckduckgo" | "tavily"
        self.retrieved_at = datetime.utcnow()

    def to_dict(self):
        return {
            "title": self.title,
            "url": self.url,
            "domain": self.domain,
            "snippet": self.snippet,
            "source": self.source,
            "retrieved_at": self.retrieved_at.isoformat(),
        }


# ── Query Generation ─────────────────────────────────────────────────

def generate_search_queries(profile: Dict[str, Any]) -> List[str]:
    """Generate 6-10 targeted search queries from the startup profile."""
    queries = []

    company_name = profile.get("company_name", "")
    industry = profile.get("industry", "")
    problem = profile.get("problem_statement", "")
    solution = profile.get("solution", "")
    product = profile.get("product", "")
    target_customer = profile.get("target_customer", "")
    business_model = profile.get("business_model", "")
    location = profile.get("location", "")
    existing_competitors = profile.get("competitors", [])

    # 1. Direct competitors in same sector
    if industry:
        q = f"{industry} competitors startups"
        if target_customer:
            q += f" {target_customer}"
        queries.append(q)

    # 2. Companies solving the same problem
    if problem:
        short_problem = problem[:120]
        queries.append(f"companies solving {short_problem}")

    # 3. Companies offering similar products
    if product:
        queries.append(f"alternatives to {product}")
        if industry:
            queries.append(f"{product} competitors {industry}")

    # 4. Companies targeting the same customer
    if target_customer:
        model_suffix = f" {business_model}" if business_model else ""
        queries.append(f"{target_customer} products{model_suffix} startups")

    # 5. Solution alternatives
    if solution:
        short_solution = solution[:100]
        queries.append(f"startups {short_solution}")

    # 6. Geographic scope when relevant
    if location and industry:
        queries.append(f"{industry} startups {location}")

    # 7. Named competitors from onboarding profile
    if existing_competitors:
        for comp_name in existing_competitors[:5]:
            if comp_name and comp_name.strip():
                queries.append(f"{comp_name.strip()} company {industry}")

    # 8. Business model specific
    if business_model and product:
        queries.append(f"{business_model} {product} companies")

    # Deduplicate and limit
    seen = set()
    unique_queries = []
    for q in queries:
        q_norm = q.lower().strip()
        if q_norm and q_norm not in seen:
            seen.add(q_norm)
            unique_queries.append(q)
    
    return unique_queries[:10]


async def search_duckduckgo(queries: List[str], max_results_per_query: int = 8) -> List[SearchResult]:
    """Search DuckDuckGo (disabled)."""
    return []


# ── Tavily Search ────────────────────────────────────────────────────

async def search_tavily(queries: List[str], max_results_per_query: int = 8) -> List[SearchResult]:
    """Search Tavily for each query. Returns combined results."""
    api_key = settings.TAVILY_API_KEY
    if not api_key:
        logger.info("[tavily] No TAVILY_API_KEY set, skipping Tavily search")
        return []

    results = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        for query in queries:
            try:
                resp = await client.post(
                    "https://api.tavily.com/search",
                    json={
                        "api_key": api_key,
                        "query": query,
                        "max_results": max_results_per_query,
                        "include_answer": False,
                        "search_depth": "basic",
                    }
                )
                if resp.status_code == 200:
                    data = resp.json()
                    for r in data.get("results", []):
                        results.append(SearchResult(
                            title=r.get("title", ""),
                            url=r.get("url", ""),
                            snippet=r.get("content", ""),
                            source="tavily"
                        ))
                else:
                    logger.warning(f"[tavily] API returned {resp.status_code} for query '{query}'")
            except Exception as e:
                logger.warning(f"[tavily] Error for query '{query}': {e}")
                continue

    logger.info(f"[tavily] Collected {len(results)} results from {len(queries)} queries")
    return results


# ── Merge & Deduplicate ──────────────────────────────────────────────

def merge_and_deduplicate(ddg_results: List[SearchResult], tavily_results: List[SearchResult]) -> List[SearchResult]:
    """Combine results from both sources, deduplicating by normalized URL."""
    seen_urls = set()
    merged = []

    # Filter out unhelpful domains
    excluded_domains = {
        "youtube.com", "facebook.com", "twitter.com", "x.com",
        "instagram.com", "tiktok.com", "reddit.com", "pinterest.com",
        "wikipedia.org", "amazon.com", "ebay.com",
    }

    for result in ddg_results + tavily_results:
        if not result.url or not result.title:
            continue

        # Normalize URL
        normalized = result.url.lower().rstrip("/").split("?")[0].split("#")[0]
        
        if normalized in seen_urls:
            continue
        
        if result.domain in excluded_domains:
            continue
        
        seen_urls.add(normalized)
        merged.append(result)

    logger.info(f"[merge] {len(ddg_results)} DDG + {len(tavily_results)} Tavily → {len(merged)} unique results")
    return merged


# ── Company Identification via AI ────────────────────────────────────

async def identify_and_rank_companies(
    search_results: List[SearchResult],
    profile: Dict[str, Any],
    max_competitors: int = 7
) -> List[Dict[str, Any]]:
    """Use Mistral to identify actual companies from search results and rank relevance."""
    
    if not search_results:
        return []

    api_key = settings.MISTRAL_API_KEY
    if not api_key:
        logger.warning("[identify] No MISTRAL_API_KEY, using basic extraction fallback")
        return _basic_company_extraction(search_results, max_competitors)

    # Prepare search results summary for AI
    results_text = ""
    for i, r in enumerate(search_results[:60]):  # Limit to 60 results for context
        results_text += f"\n{i+1}. Title: {r.title}\n   URL: {r.url}\n   Domain: {r.domain}\n   Snippet: {r.snippet[:200]}\n"

    prompt = f"""You are analyzing web search results to identify real competitor companies for a startup.

STARTUP PROFILE:
- Company: {profile.get('company_name', 'Unknown')}
- Industry: {profile.get('industry', 'Unknown')}
- Product: {profile.get('product', 'Unknown')}
- Problem: {profile.get('problem_statement', 'Unknown')}
- Target Customer: {profile.get('target_customer', 'Unknown')}
- Business Model: {profile.get('business_model', 'Unknown')}
- Solution: {profile.get('solution', 'Unknown')}

SEARCH RESULTS:
{results_text}

TASK:
1. From these search results, identify ACTUAL COMPANIES that are competitors or alternatives to the startup described above.
2. Do NOT include the startup itself ({profile.get('company_name', '')}).
3. Do NOT include news sites, blogs, review sites, or non-company results.
4. For each company, determine its relevance_score (0-100) based on how directly it competes with or is an alternative to the startup.
5. Return at most {max_competitors} companies, ranked by relevance.

Return ONLY valid JSON:
{{
  "companies": [
    {{
      "name": "Company Name",
      "domain": "company.com",
      "urls": ["url1", "url2"],
      "snippets": ["relevant snippet 1", "relevant snippet 2"],
      "relevance_score": 85,
      "relevance_reason": "Brief reason why this is relevant"
    }}
  ]
}}"""

    try:
        def call_mistral():
            payload = {
                "model": "mistral-large-latest",
                "messages": [
                    {"role": "system", "content": "You are a startup competitive analysis expert. Return ONLY valid JSON."},
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
        companies = result.get("companies", [])
        
        # Map back source URLs for each company
        for comp in companies:
            comp_urls = comp.get("urls", [])
            comp_sources = []
            for sr in search_results:
                if sr.url in comp_urls or sr.domain == comp.get("domain", ""):
                    comp_sources.append(sr.to_dict())
            comp["sources"] = comp_sources

        # Sort by relevance and limit
        companies.sort(key=lambda c: c.get("relevance_score", 0), reverse=True)
        return companies[:max_competitors]

    except Exception as e:
        logger.error(f"[identify] Mistral API error: {e}")
        return _basic_company_extraction(search_results, max_competitors)


def _basic_company_extraction(search_results: List[SearchResult], max_count: int) -> List[Dict[str, Any]]:
    """Fallback: extract unique domains as potential companies."""
    domain_map: Dict[str, List[SearchResult]] = {}
    for r in search_results:
        if r.domain not in domain_map:
            domain_map[r.domain] = []
        domain_map[r.domain].append(r)
    
    companies = []
    for domain, results in sorted(domain_map.items(), key=lambda x: len(x[1]), reverse=True):
        if len(companies) >= max_count:
            break
        name = domain.split(".")[0].title()
        companies.append({
            "name": name,
            "domain": domain,
            "urls": [r.url for r in results],
            "snippets": [r.snippet for r in results[:3]],
            "relevance_score": min(100, len(results) * 15),
            "relevance_reason": f"Found in {len(results)} search results",
            "sources": [r.to_dict() for r in results],
        })
    
    return companies
