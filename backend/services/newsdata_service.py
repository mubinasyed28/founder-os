"""
NewsData.io Integration Service for Research Pipeline.
Dedicated news/event discovery source using the NewsData.io Latest News API.
"""
import logging
from datetime import datetime
from typing import Dict, Any, List
from urllib.parse import urlparse

import httpx

from backend.config import settings

logger = logging.getLogger(__name__)


class NewsResult:
    """Normalized news result from NewsData.io API."""
    def __init__(self, title: str, url: str, snippet: str, source_name: str = "",
                 pub_date: str = "", category: str = "", image_url: str = ""):
        self.title = title
        self.url = url.rstrip("/") if url else ""
        self.domain = urlparse(url).netloc.lower().replace("www.", "") if url else ""
        self.snippet = snippet
        self.source_name = source_name
        self.pub_date = pub_date
        self.category = category
        self.image_url = image_url
        self.retrieved_at = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "url": self.url,
            "domain": self.domain,
            "snippet": self.snippet,
            "source_name": self.source_name,
            "pub_date": self.pub_date,
            "category": self.category,
            "image_url": self.image_url,
            "retrieved_at": self.retrieved_at.isoformat(),
        }


async def search_newsdata(
    queries: List[str],
    max_results_per_query: int = 10,
    language: str = "en",
    category: str = ""
) -> List[NewsResult]:
    """
    Search NewsData.io Latest News API for each query.
    
    API: https://newsdata.io/api/1/latest
    Params: apikey, q, language, category, size
    Free tier: 200 requests/day, 10 results/request max.
    """
    api_key = settings.NEWSDATA_API_KEY
    if not api_key:
        logger.info("[newsdata] No NEWSDATA_API_KEY set, skipping NewsData.io search")
        return []

    results: List[NewsResult] = []

    async with httpx.AsyncClient(timeout=30.0) as client:
        for query in queries:
            try:
                # NewsData.io strict limit: query length must be <= 100 characters
                clean_q = query.strip()[:90]
                if not clean_q:
                    continue

                params: Dict[str, Any] = {
                    "apikey": api_key,
                    "q": clean_q,
                    "language": language,
                    "size": min(max_results_per_query, 10),  # Free tier max is 10
                }
                if category:
                    params["category"] = category

                resp = await client.get(
                    "https://newsdata.io/api/1/latest",
                    params=params,
                )

                if resp.status_code == 200:
                    data = resp.json()
                    articles = data.get("results", [])
                    for article in articles:
                        title = article.get("title", "")
                        link = article.get("link", "")
                        description = article.get("description", "") or ""
                        content = article.get("content", "") or ""
                        source_name = article.get("source_name", "") or article.get("source_id", "")
                        pub_date = article.get("pubDate", "") or article.get("pubDateTZ", "")
                        cats = article.get("category", [])
                        cat_str = cats[0] if isinstance(cats, list) and cats else ""
                        image = article.get("image_url", "") or ""

                        # Use description or first 500 chars of content as snippet
                        snippet = description if description else content[:500]

                        if title and link:
                            results.append(NewsResult(
                                title=title,
                                url=link,
                                snippet=snippet,
                                source_name=source_name,
                                pub_date=pub_date,
                                category=cat_str,
                                image_url=image,
                            ))
                elif resp.status_code == 401:
                    logger.warning("[newsdata] Invalid API key. Skipping remaining queries.")
                    break
                elif resp.status_code == 429:
                    logger.warning("[newsdata] Rate limit reached. Stopping queries.")
                    break
                else:
                    logger.warning(f"[newsdata] API returned {resp.status_code} for query '{query}': {resp.text[:200]}")

            except Exception as e:
                logger.warning(f"[newsdata] Error for query '{query}': {e}")
                continue

    logger.info(f"[newsdata] Collected {len(results)} results from {len(queries)} queries")
    return results
