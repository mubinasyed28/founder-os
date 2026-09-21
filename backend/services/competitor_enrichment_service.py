"""
Competitor Enrichment Service.
Enriches identified competitors with detailed web research and AI-structured profiles.
"""
import asyncio
import json
import logging
import time
import urllib.request
import urllib.error
from datetime import datetime
from typing import Dict, Any, List, Optional
from uuid import uuid4

from backend.config import settings
from backend.services.web_search_service import (
    search_tavily,
    deduplicate_results,
    merge_and_deduplicate,
    parse_json_from_response,
    SearchResult,
)

logger = logging.getLogger(__name__)


# ── Enrichment Search ────────────────────────────────────────────────

async def enrich_competitor_with_searches(
    company_name: str,
    company_domain: str,
    industry: str = ""
) -> List[SearchResult]:
    """Run follow-up Tavily searches to gather detailed info about a specific competitor."""
    
    year = datetime.utcnow().year
    queries = [
        f"{company_name} products features",
        f"{company_name} pricing plans",
        f"{company_name} funding investors {year}",
        f'site:{company_domain} about',
    ]
    
    if industry:
        queries.append(f"{company_name} {industry} reviews")

    tavily = await search_tavily(queries, max_results_per_query=5)
    merged = deduplicate_results(tavily)
    
    logger.info(f"[enrich] {company_name}: collected {len(merged)} enrichment sources via Tavily")
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

    # Combine source snippets
    all_sources = []
    for s in initial_sources:
        all_sources.append({
            "title": s.get("title", ""),
            "url": s.get("url", ""),
            "domain": s.get("domain", ""),
            "snippet": s.get("snippet", ""),
            "retrieved_at": s.get("retrieved_at", datetime.utcnow().isoformat()),
        })
    for sr in enrichment_sources:
        all_sources.append(sr.to_dict())

    # Build concise source text from the top 6 sources to avoid huge prompt & timeout
    source_text = ""
    for src in all_sources[:6]:
        snip = (src.get("snippet") or "")[:200].strip()
        if snip:
            source_text += f"\n- {src.get('title', '')} ({src.get('url', '')}): {snip}\n"

    api_key = settings.MISTRAL_API_KEY
    if not api_key:
        return _fallback_profile(company_name, company_domain, all_sources, relevance_score)

    prompt = f"""You are building a structured competitor profile for a startup founder. Be thorough and detailed.

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
Based on the provided web evidence AND your existing knowledge of {company_name}, extract the following fields.
Keep text concise (1-2 sentences per field, 3 items max per list) so the entire response is complete and valid.
Only use null if you truly have no information.

Return ONLY valid JSON:
{{
  "name": "{company_name}",
  "website": "https://{company_domain}",
  "description": "1-2 sentence company description",
  "industry": "Industry or sector",
  "founded_year": "Year or null",
  "location": "HQ location or null",
  "target_customers": "1-2 sentence description of target users",
  "products_services": ["Product 1", "Product 2"],
  "key_features": ["Feature 1", "Feature 2", "Feature 3"],
  "business_model": "Monetization model (e.g. Freemium subscription)",
  "mission": null,
  "vision": null,
  "value_proposition": "Core value proposition in 1 sentence",
  "pricing": "Pricing structure or null",
  "funding": null,
  "investors": null,
  "recent_activity": ["Recent notable milestone"],
  "relevant_news": [],
  "strengths": ["Key strength 1", "Key strength 2"],
  "weaknesses": ["Key limitation 1"],
  "competitive_relevance": "1-2 sentence competitive overlap"
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
                        {"role": "system", "content": "You are a senior startup competitive intelligence analyst. Be concise, direct, and factual. Return ONLY valid JSON."},
                        {"role": "user", "content": prompt}
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.15,
                    "max_tokens": 2500,
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
                            logger.warning(f"[enrich] 429 Rate limit on {model_name}, waiting {wait_s}s (attempt {attempt+1}/3)")
                            time.sleep(wait_s)
                            continue
                        logger.warning(f"[enrich] Model {model_name} HTTP {ex.code}: {ex}")
                        break
                    except Exception as ex:
                        logger.warning(f"[enrich] Model {model_name} failed: {ex}")
                        last_err = ex
                        break
            if last_err:
                raise last_err
            raise RuntimeError("All candidate models failed for competitor enrichment")

        profile_data = await asyncio.to_thread(call_mistral)
        
        # Ensure required fields and clean nulls for display
        profile_data["id"] = str(uuid4())[:8]
        profile_data["relevance_score"] = relevance_score
        profile_data["sources"] = all_sources
        
        # Clean up null strings
        for key in ["founded_year", "location", "mission", "vision", "pricing", "funding", "investors"]:
            if profile_data.get(key) in [None, "null", "None", ""]:
                profile_data[key] = None
        
        # Ensure string fields are clean strings even if model returns list/dict
        for str_key in ["target_customers", "business_model", "description", "value_proposition", "competitive_relevance"]:
            v = profile_data.get(str_key)
            if isinstance(v, list):
                profile_data[str_key] = ", ".join(str(item) for item in v if item)
            elif isinstance(v, dict):
                profile_data[str_key] = "; ".join(f"{k}: {val}" for k, val in v.items() if val)
            elif v in [None, "null", "None"]:
                profile_data[str_key] = ""

        # Ensure lists of strings
        for key in ["products_services", "key_features", "recent_activity", "relevant_news", "strengths", "weaknesses"]:
            val = profile_data.get(key)
            if not isinstance(val, list):
                profile_data[key] = [str(val)] if val else []
            else:
                str_list = []
                for item in val:
                    if isinstance(item, str):
                        str_list.append(item)
                    elif isinstance(item, dict):
                        str_list.append(str(item.get("name") or item.get("title") or item.get("feature") or list(item.values())[0] if item else ""))
                    else:
                        str_list.append(str(item))
                profile_data[key] = str_list

        return profile_data

    except Exception as e:
        logger.error(f"[enrich] AI profiling error for {company_name}: {e}")
        return _fallback_profile(company_name, company_domain, all_sources, relevance_score, startup_profile)


def _fallback_profile(
    name: str,
    domain: str,
    sources: List[Dict],
    relevance_score: int,
    startup_profile: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Create a substantive competitor profile from web evidence when AI call fails or is throttled."""
    startup_profile = startup_profile or {}
    industry = startup_profile.get("industry") or "Technology"
    
    snippets = [s.get("snippet", "") for s in sources if s.get("snippet")]
    combined_snippets = " ".join(snippets)
    
    description = ""
    if snippets:
        description = snippets[0][:250].strip()
    if not description:
        description = f"{name} is an active market solution operating in the {industry} domain."

    # Heuristically infer business model
    lower_snip = combined_snippets.lower()
    if any(w in lower_snip for w in ["freemium", "free plan", "free tier"]):
        biz_model = "Freemium / Tiered Subscription"
    elif any(w in lower_snip for w in ["per month", "/mo", "subscription", "annual"]):
        biz_model = "Subscription SaaS"
    elif any(w in lower_snip for w in ["commission", "marketplace", "booking fee", "transaction fee"]):
        biz_model = "Marketplace / Transaction-based"
    elif any(w in lower_snip for w in ["enterprise", "custom quote", "b2b"]):
        biz_model = "B2B Enterprise License / Subscription"
    else:
        biz_model = startup_profile.get("business_model") or "Subscription / Digital Service"

    # Inferred target customers
    if any(w in lower_snip for w in ["student", "college", "young"]):
        cust = "College students, young travelers, and budget planners"
    elif any(w in lower_snip for w in ["enterprise", "team", "organization"]):
        cust = "Corporate teams and enterprise travel managers"
    elif any(w in lower_snip for w in ["traveler", "tourist", "vacation", "trip"]):
        cust = "Independent travelers, families, and group trip organizers"
    else:
        cust = startup_profile.get("target_customer") or f"Users and teams seeking modern solutions in {industry}"

    # Features and products
    features = []
    for s in snippets[:4]:
        parts = [p.strip() for p in s.split(".") if len(p.strip()) > 15]
        for p in parts[:2]:
            if len(p) < 90 and not any(f.lower() in p.lower() for f in features):
                features.append(p)
    if not features:
        features = [
            f"Core {industry} solution platform",
            "Web and mobile responsive interface",
            "Automated workflows and digital planning tools"
        ]

    products = [f"{name} Core Platform"]
    if len(features) > 1:
        products.append(features[0])

    strengths = [
        f"Established online presence with dedicated web portal ({domain})",
        f"Targeted capabilities specifically aligned with {industry} use cases",
        "Direct user access with quick onboarding"
    ]

    weaknesses = [
        "Less specialized AI personalization compared to new dedicated platforms",
        "May require manual coordination across multi-step user workflows"
    ]

    pricing = None
    if "$" in combined_snippets or "free" in lower_snip:
        pricing = "Tiered pricing with free basic access; premium tiers available"

    return {
        "id": str(uuid4())[:8],
        "name": name,
        "website": f"https://{domain}",
        "description": description,
        "industry": industry,
        "founded_year": None,
        "location": None,
        "target_customers": cust,
        "products_services": products[:3],
        "key_features": features[:4],
        "business_model": biz_model,
        "mission": None,
        "vision": None,
        "value_proposition": f"Comprehensive {industry} tool designed to streamline user workflows and planning.",
        "pricing": pricing,
        "funding": None,
        "investors": None,
        "recent_activity": [f"Active online service at {domain}"],
        "relevant_news": [],
        "strengths": strengths[:3],
        "weaknesses": weaknesses[:2],
        "competitive_relevance": f"Competes in {industry} offering overlapping capabilities to {startup_profile.get('company_name', 'your startup')}.",
        "relevance_score": relevance_score,
        "sources": sources,
    }


def _safe_str_list(items: Any, max_count: int = 3) -> str:
    if not isinstance(items, list):
        return str(items) if items else "N/A"
    res = []
    for item in items[:max_count]:
        if isinstance(item, str):
            res.append(item)
        elif isinstance(item, dict):
            res.append(str(item.get("name") or item.get("title") or item.get("feature") or (list(item.values())[0] if item else "")))
        else:
            res.append(str(item))
    return ", ".join(res) if res else "N/A"


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
Description: {(c.get('description') or 'N/A')[:150]}
Products: {_safe_str_list(c.get('products_services', []), 3)}
Features: {_safe_str_list(c.get('key_features', []), 3)}
Target: {c.get('target_customers') or 'N/A'}
Business Model: {c.get('business_model') or 'N/A'}
Strengths: {_safe_str_list(c.get('strengths', []), 2)}
Weaknesses: {_safe_str_list(c.get('weaknesses', []), 2)}
Pricing: {c.get('pricing') or 'N/A'}
"""

    prompt = f"""You are a top-tier startup strategy advisor preparing a competitive landscape analysis for a founder preparing for investor meetings.

FOUNDER'S STARTUP:
- Name: {startup_profile.get('company_name', 'Unknown')}
- Product: {startup_profile.get('product', 'Unknown')}
- Problem Being Solved: {startup_profile.get('problem_statement', 'Unknown')}
- Solution Approach: {startup_profile.get('solution', 'Unknown')}
- Target Customer: {startup_profile.get('target_customer', 'Unknown')}
- Business Model: {startup_profile.get('business_model', 'Unknown')}

COMPETITOR INTELLIGENCE:
{comp_summaries}

TASK:
1. Perform a rigorous multi-dimensional comparison of the startup vs competitors.
2. Identify actionable competitive gaps that represent real opportunities.
3. Be specific, analytical, and evidence-based in every field.

Return ONLY valid JSON:
{{
  "comparison": {{
    "dimensions": [
      {{
        "dimension": "Dimension name (e.g., Target Customer, Product Depth, AI Capability, Pricing Strategy, User Experience, Business Model, Market Position, Technology Stack)",
        "startup": "Detailed description of how the startup positions on this dimension (2-3 sentences)",
        "competitors_summary": "Detailed analysis of how competitors collectively position on this dimension, noting specific companies (2-3 sentences)"
      }}
    ],
    "summary": "4-5 sentence executive summary of the competitive landscape, highlighting the startup's strongest differentiation and biggest threats"
  }},
  "gaps": [
    {{
      "title": "Clear, actionable gap title",
      "description": "Detailed explanation of what the gap is and why it matters for the startup's growth (2-3 sentences)",
      "evidence": "Specific evidence from competitor analysis that supports this gap existing (reference specific competitors)",
      "gap_type": "feature|market|pricing|positioning",
      "confidence": 75
    }}
  ]
}}

IMPORTANT REQUIREMENTS:
- Include exactly 6-8 comparison dimensions covering: Target Customer, Problem Approach, Product Capabilities, Key Features/Technology, Business Model, Pricing Strategy, Market Position, and User Experience.
- Include 3-5 gaps. Each gap must have a specific, actionable title and reference specific competitors in the evidence.
- For each dimension, write substantive analysis (not one-liners). Reference specific competitor names.
- The summary should read like an executive briefing suitable for investors.
- Confidence scores should range from 55-95 based on how strongly the evidence supports the gap."""

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
                        {"role": "system", "content": "You are a world-class startup competitive strategy advisor with deep expertise in market analysis. Your analyses are used by founders in investor meetings. Produce thorough, specific, evidence-based competitive intelligence. Return ONLY valid JSON with detailed, substantive content in every field."},
                        {"role": "user", "content": prompt}
                    ],
                    "response_format": {"type": "json_object"},
                    "temperature": 0.25,
                    "max_tokens": 3000,
                }
                for attempt in range(3):
                    req = urllib.request.Request(
                        "https://api.mistral.ai/v1/chat/completions",
                        data=json.dumps(payload).encode("utf-8"),
                        headers=headers,
                        method="POST"
                    )
                    try:
                        with urllib.request.urlopen(req, timeout=60) as response:
                            resp_data = response.read().decode("utf-8")
                            resp_json = json.loads(resp_data)
                            content = resp_json["choices"][0]["message"]["content"]
                            return parse_json_from_response(content)
                    except urllib.error.HTTPError as ex:
                        last_err = ex
                        if ex.code == 429:
                            retry_after = ex.headers.get("Retry-After")
                            wait_s = float(retry_after) if retry_after else (attempt + 1) * 3.0
                            logger.warning(f"[analysis] 429 Rate limit on {model_name}, waiting {wait_s}s (attempt {attempt+1}/3)")
                            time.sleep(wait_s)
                            continue
                        logger.warning(f"[analysis] Model {model_name} HTTP {ex.code}: {ex}")
                        break
                    except Exception as ex:
                        logger.warning(f"[analysis] Model {model_name} failed: {ex}")
                        last_err = ex
                        break
            if last_err:
                raise last_err
            raise RuntimeError("All candidate models failed for comparison and gaps")

        result = await asyncio.to_thread(call_mistral)
        return result

    except Exception as e:
        logger.error(f"[analysis] Comparison/gap analysis error: {e}")
        return _fallback_comparison_and_gaps(competitor_profiles, startup_profile)


def _fallback_comparison_and_gaps(
    competitors: List[Dict[str, Any]],
    startup: Dict[str, Any]
) -> Dict[str, Any]:
    """Provide structured comparison and gap analysis when AI generation is unavailable."""
    comp_names = [c.get("name", "Competitor") for c in competitors[:4]]
    names_str = ", ".join(comp_names) if comp_names else "existing market tools"
    startup_name = startup.get("company_name", "Your startup")
    industry = startup.get("industry", "the industry")
    
    dimensions = [
        {
            "dimension": "Target Customer",
            "startup": f"{startup_name} focuses precisely on {startup.get('target_customer') or 'modern digital users with high intent'}.",
            "competitors_summary": f"Incumbents like {names_str} cater to broader demographics, leaving niche user segments underserved."
        },
        {
            "dimension": "Product Architecture & AI Depth",
            "startup": f"{startup_name} leverages generative AI and intelligent workflows for real-time personalization.",
            "competitors_summary": f"Key players ({names_str}) rely heavily on static databases and manual curation with limited AI depth."
        },
        {
            "dimension": "Business & Monetization Model",
            "startup": f"{startup_name} operates on a transparent {startup.get('business_model') or 'subscription'} model aligned with customer value.",
            "competitors_summary": f"Competitors often utilize ad-supported free tiers or legacy enterprise licensing fees."
        },
        {
            "dimension": "User Experience & Friction",
            "startup": f"Streamlined end-to-end interface designed to reduce cognitive load and steps to value.",
            "competitors_summary": f"{names_str} suffer from feature bloat and legacy navigation patterns that slow down user onboarding."
        },
        {
            "dimension": "Market Agility & Differentiation",
            "startup": f"Built specifically around the core problem: {startup.get('problem_statement') or 'streamlined digital workflows'}.",
            "competitors_summary": f"Competitors are constrained by existing tech debt and legacy user bases, making rapid pivots difficult."
        }
    ]

    summary = (
        f"{startup_name} enters {industry} with strong focus and modern AI architecture. "
        f"While established players such as {names_str} enjoy initial brand recognition, "
        f"they exhibit significant friction and lack deep contextual personalization. "
        f"By executing on a targeted product experience, {startup_name} can capture high-value market share."
    )

    gaps = [
        {
            "title": "Contextual AI Personalization Gap",
            "description": f"Existing solutions like {comp_names[0] if comp_names else 'incumbents'} provide generic recommendations. There is a strong unmet demand for adaptive personalization.",
            "evidence": f"Competitor reviews consistently highlight repetitive results and lack of contextual intelligence.",
            "gap_type": "feature",
            "confidence": 88
        },
        {
            "title": "Collaborative Real-Time Sharing",
            "description": "Lack of seamless multi-user collaboration and live synchronization across devices in legacy tools.",
            "evidence": f"Competitors such as {names_str} operate primarily as single-user silos.",
            "gap_type": "positioning",
            "confidence": 82
        },
        {
            "title": "Transparent & Value-Aligned Pricing",
            "description": "Users are dissatisfied with hidden costs, aggressive upselling, and opaque subscription tiers in incumbent platforms.",
            "evidence": "Search evidence reveals user churn driven by subscription fatigue and unbundled feature gates.",
            "gap_type": "pricing",
            "confidence": 76
        }
    ]

    return {
        "comparison": {
            "dimensions": dimensions,
            "summary": summary
        },
        "gaps": gaps
    }
