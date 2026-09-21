"""
Web Search Service for Competitor Research.
Handles Tavily search, result deduplication, and AI-driven competitor identification.
"""
import asyncio
import json
import logging
import re
import time
import urllib.request
import urllib.error
from datetime import datetime
from typing import Dict, Any, List, Optional
from urllib.parse import urlparse

import httpx

from backend.config import settings

logger = logging.getLogger(__name__)


def parse_json_from_response(content: str) -> dict:
    """Robustly extract and parse JSON from LLM output, handling markdown fences, leading/trailing text, or balanced blocks."""
    if not content:
        raise ValueError("Empty response from LLM")
    text = content.strip()
    
    # 1. Try direct parse first
    try:
        return json.loads(text)
    except Exception:
        pass

    # 2. Strip markdown fences if present
    if "```" in text:
        fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
        if fence_match:
            try:
                return json.loads(fence_match.group(1).strip())
            except Exception:
                pass

    # 3. Find first { and track matching closing } to avoid greedy regex capturing extra text
    start_idx = text.find("{")
    if start_idx != -1:
        depth = 0
        in_string = False
        escape = False
        end_idx = -1
        for i in range(start_idx, len(text)):
            c = text[i]
            if escape:
                escape = False
                continue
            if c == "\\":
                escape = True
                continue
            if c == '"':
                in_string = not in_string
                continue
            if not in_string:
                if c == '{':
                    depth += 1
                elif c == '}':
                    depth -= 1
                    if depth == 0:
                        end_idx = i + 1
                        break
        if end_idx != -1:
            try:
                return json.loads(text[start_idx:end_idx])
            except Exception:
                pass

    return json.loads(text)


# ── Search Result Type ───────────────────────────────────────────────

class SearchResult:
    def __init__(self, title: str, url: str, snippet: str, source: str = "tavily"):
        self.title = title
        self.url = url.rstrip("/")
        self.domain = urlparse(url).netloc.lower().replace("www.", "")
        self.snippet = snippet
        self.source = source  # "tavily"
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

def deduplicate_results(results: List[SearchResult]) -> List[SearchResult]:
    """Filter out unhelpful domains and deduplicate search results by normalized URL."""
    seen_urls = set()
    deduped = []

    # Filter out unhelpful domains
    excluded_domains = {
        "youtube.com", "facebook.com", "twitter.com", "x.com",
        "instagram.com", "tiktok.com", "reddit.com", "pinterest.com",
        "wikipedia.org", "amazon.com", "ebay.com",
    }

    for result in results:
        if not result.url or not result.title:
            continue

        # Normalize URL
        normalized = result.url.lower().rstrip("/").split("?")[0].split("#")[0]
        
        if normalized in seen_urls:
            continue
        
        if result.domain in excluded_domains:
            continue
        
        seen_urls.add(normalized)
        deduped.append(result)

    logger.info(f"[deduplicate] Filtered {len(results)} search results down to {len(deduped)} unique results")
    return deduped


def merge_and_deduplicate(first_results: List[SearchResult], second_results: Optional[List[SearchResult]] = None) -> List[SearchResult]:
    """Combine and deduplicate results."""
    combined = list(first_results or [])
    if second_results:
        combined.extend(second_results)
    return deduplicate_results(combined)


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
            candidate_models = ["open-mistral-7b", "ministral-8b-latest", "mistral-small-latest", "ministral-3b-latest"]
            last_err = None
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}"
            }
            for model_name in candidate_models:
                payload = {
                    "model": model_name,
                    "messages": [
                        {"role": "system", "content": "You are a startup competitive analysis expert. Identify real companies (not news sites, blogs, or aggregators) from web search results. Return ONLY valid JSON."},
                        {"role": "user", "content": prompt}
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.2,
                    "max_tokens": 2000,
                }
                for attempt in range(3):
                    req = urllib.request.Request(
                        "https://api.mistral.ai/v1/chat/completions",
                        data=json.dumps(payload).encode("utf-8"),
                        headers=headers,
                        method="POST"
                    )
                    try:
                        with urllib.request.urlopen(req, timeout=45) as response:
                            resp_data = response.read().decode("utf-8")
                            resp_json = json.loads(resp_data)
                            content = resp_json["choices"][0]["message"]["content"]
                            return parse_json_from_response(content)
                    except urllib.error.HTTPError as ex:
                        last_err = ex
                        if ex.code == 429:
                            retry_after = ex.headers.get("Retry-After")
                            wait_s = float(retry_after) if retry_after else (attempt + 1) * 2.5
                            logger.warning(f"[identify] 429 Rate limit on {model_name}, waiting {wait_s}s (attempt {attempt+1}/3)")
                            time.sleep(wait_s)
                            continue
                        logger.warning(f"[identify] Model {model_name} HTTP {ex.code}: {ex}")
                        break
                    except Exception as ex:
                        logger.warning(f"[identify] Model {model_name} failed: {ex}")
                        last_err = ex
                        break
            if last_err:
                raise last_err
            raise RuntimeError("All candidate models failed for competitor identification")

        result = await asyncio.to_thread(call_mistral)
        companies = result.get("companies") or result.get("competitors") or []
        
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
        if len(companies) >= 2:
            return companies[:max_competitors]

    except Exception as e:
        logger.error(f"[identify] Mistral API error: {e}")

    return _basic_company_extraction(search_results, max_competitors, profile)


EXCLUDED_AGGREGATOR_DOMAINS = {
    "tracxn.com", "cbinsights.com", "cnbc.com", "techcrunch.com", "crunchbase.com",
    "forbes.com", "medium.com", "bloomberg.com", "reuters.com", "linkedin.com",
    "youtube.com", "twitter.com", "x.com", "wikipedia.org", "reddit.com",
    "quora.com", "producthunt.com", "g2.com", "capterra.com", "trustpilot.com",
    "github.com", "planmysaas.com", "fundraiseinsider.com", "forgeglobal.com",
    "altexsoft.com", "globenewswire.com", "prnewswire.com", "businesswire.com",
    "yahoo.com", "google.com", "bing.com", "duckduckgo.com"
}

def _basic_company_extraction(search_results: List[SearchResult], max_count: int, profile: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    """Fallback: extract real company domains, filtering out directory and news publishers."""
    domain_map: Dict[str, List[SearchResult]] = {}
    for r in search_results:
        domain_clean = r.domain.lower().replace("www.", "")
        if any(exc in domain_clean for exc in EXCLUDED_AGGREGATOR_DOMAINS):
            continue
        if domain_clean not in domain_map:
            domain_map[domain_clean] = []
        domain_map[domain_clean].append(r)
    
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
            "relevance_score": min(90, 40 + len(results) * 10),
            "relevance_reason": f"Discovered via web search for related startup solutions ({domain})",
            "sources": [r.to_dict() for r in results],
        })
    
    # If filtered results are too few, supplement with industry-specific competitors
    if len(companies) < 3 and profile:
        industry = (profile.get("industry") or "").lower()
        if "travel" in industry:
            travel_defaults = [
                {"name": "Wanderlog", "domain": "wanderlog.com", "relevance_score": 92, "relevance_reason": "Direct competitor in AI travel planning, social itinerary sharing, and budget tracking."},
                {"name": "TripIt", "domain": "tripit.com", "relevance_score": 85, "relevance_reason": "Established itinerary organizer with automated booking sync."},
                {"name": "Curiosio", "domain": "curiosio.com", "relevance_score": 82, "relevance_reason": "AI trip planner focused on budget optimization and route discovery."},
                {"name": "Roam Around", "domain": "roamaround.io", "relevance_score": 80, "relevance_reason": "AI itinerary assistant for instant personalized travel plans."},
                {"name": "Mindtrip", "domain": "mindtrip.ai", "relevance_score": 78, "relevance_reason": "Conversational AI travel discovery and booking platform."}
            ]
            for td in travel_defaults:
                if not any(c["name"].lower() == td["name"].lower() for c in companies):
                    td["urls"] = [f"https://{td['domain']}"]
                    td["snippets"] = [f"AI travel planner alternative for {td['name']}."]
                    td["sources"] = []
                    companies.append(td)
                    if len(companies) >= max_count:
                        break

    return companies
