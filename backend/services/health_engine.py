import logging
from datetime import datetime
from typing import Dict, Any, List
from backend.database import get_db

logger = logging.getLogger(__name__)

async def calculate_health(user_id: str) -> Dict[str, Any]:
    """Calculates startup health components and overall score based on profile + document library."""
    db = await get_db()
    
    # 1. Fetch Company Profile
    profile = await db.profiles.find_one({"user_id": user_id})
    if not profile:
        profile = {}
        
    # 2. Fetch User Documents to check categories
    cursor = db.documents.find({"user_id": user_id, "status": "indexed"})
    docs = await cursor.to_list(length=100)
    
    doc_categories = {doc.get("category", "other") for doc in docs}
    
    components = []
    
    # ── BUSINESS HEALTH ──────────────────────────────────────────────
    biz_score = 0
    biz_found = []
    biz_missing = []
    biz_problems = []
    biz_recs = []
    
    if profile.get("company_name"):
        biz_score += 10
        biz_found.append("Company Name")
    else:
        biz_missing.append("Company Name")
        
    if profile.get("one_line_pitch"):
        biz_score += 10
        biz_found.append("One-Line Pitch")
    else:
        biz_missing.append("One-Line Pitch")
        
    if profile.get("business_model"):
        biz_score += 15
        biz_found.append("Business Model")
    else:
        biz_missing.append("Business Model")
        
    if profile.get("revenue_model") or profile.get("revenue_model_details"):
        biz_score += 15
        biz_found.append("Revenue Model details")
    else:
        biz_missing.append("Revenue Model details")
        
    has_revenue = profile.get("monthly_revenue", 0.0) > 0.0 or profile.get("traction")
    if has_revenue:
        biz_score += 15
        biz_found.append("Monthly Revenue or Traction details")
    else:
        biz_missing.append("Monthly Revenue / Traction metrics")
        biz_problems.append("No active monthly revenue or financial traction metrics logged.")
        biz_recs.append("Add your current monthly revenue details to validate business traction.")
        
    if profile.get("funding_stage") or profile.get("funding_raised", 0.0) > 0.0:
        biz_score += 15
        biz_found.append("Funding information")
    else:
        biz_missing.append("Funding information")
        
    if "business_plan" in doc_categories or "financial_report" in doc_categories:
        biz_score += 20
        biz_found.append("Business Plan / Financial documents uploaded")
    else:
        biz_missing.append("Business Plan / Financial Report file")
        biz_problems.append("No permanent business plan or financial model documents uploaded.")
        biz_recs.append("Upload your latest business plan or financial forecast document in the Document Library.")
        
    # Check for sufficient data (need at least 2 key pieces of data)
    biz_status = "Excellent" if biz_score >= 80 else "Good" if biz_score >= 50 else "Needs work"
    if len(biz_found) < 2:
        biz_status = "Insufficient data"
        biz_score = -1
        biz_recs.append("Set up your core company name, product details, and business model to unlock Business Health scoring.")
    
    components.append({
        "name": "Business Health",
        "score": biz_score,
        "status": biz_status,
        "found_info": biz_found,
        "missing_info": biz_missing,
        "problems": biz_problems,
        "recommendations": biz_recs
    })
    
    # ── PRODUCT HEALTH ───────────────────────────────────────────────
    prod_score = 0
    prod_found = []
    prod_missing = []
    prod_problems = []
    prod_recs = []
    
    if profile.get("product"):
        prod_score += 20
        prod_found.append("Product Definition")
    else:
        prod_missing.append("Product Definition")
        
    if profile.get("description"):
        prod_score += 15
        prod_found.append("Detailed Description")
    else:
        prod_missing.append("Detailed Description")
        
    if profile.get("current_stage"):
        prod_score += 15
        prod_found.append("Product Stage")
    else:
        prod_missing.append("Product Stage")
        
    if profile.get("current_progress"):
        prod_score += 15
        prod_found.append("Development Progress")
    else:
        prod_missing.append("Development Progress")
        
    if profile.get("validation_done") or profile.get("validation_details"):
        prod_score += 15
        prod_found.append("Validation Status")
    else:
        prod_missing.append("Validation details")
        prod_problems.append("No clear product validation details or survey results recorded.")
        prod_recs.append("Explain what validation, student surveys, or interviews have been completed.")
        
    if "blueprint" in doc_categories or "pitch_deck" in doc_categories:
        prod_score += 20
        prod_found.append("Product Specification / Pitch Deck uploaded")
    else:
        prod_missing.append("Product Blueprint / Pitch Deck file")
        prod_problems.append("Missing product spec / blueprint document in startup memory.")
        prod_recs.append("Upload a product roadmap, blueprint, or PRD file to seed product memory.")
        
    prod_status = "Excellent" if prod_score >= 80 else "Good" if prod_score >= 50 else "Needs work"
    if len(prod_found) < 2:
        prod_status = "Insufficient data"
        prod_score = -1
        prod_recs.append("Define what product you are building and current development stage to unlock Product Health scoring.")
        
    components.append({
        "name": "Product Health",
        "score": prod_score,
        "status": prod_status,
        "found_info": prod_found,
        "missing_info": prod_missing,
        "problems": prod_problems,
        "recommendations": prod_recs
    })
    
    # ── CUSTOMER HEALTH ──────────────────────────────────────────────
    cust_score = 0
    cust_found = []
    cust_missing = []
    cust_problems = []
    cust_recs = []
    
    if profile.get("target_customer") or profile.get("target_customers"):
        cust_score += 25
        cust_found.append("Target ICP Defined")
    else:
        cust_missing.append("Target Customer (ICP)")
        
    if profile.get("customer_interviews") or profile.get("survey_details") or profile.get("validation_details"):
        cust_score += 25
        cust_found.append("Customer Interviews / Surveys info")
    else:
        cust_missing.append("Customer validation data")
        
    if profile.get("total_users", 0) > 0 or profile.get("num_customers", 0) > 0 or "user" in str(profile.get("traction", "")).lower():
        cust_score += 25
        cust_found.append("Active User / Customer counts")
    else:
        cust_missing.append("Active User / Customer metrics")
        cust_problems.append("No active user retention or subscriber counts registered.")
        cust_recs.append("Record your active user count or number of paying customers.")
        
    if "research" in doc_categories:
        cust_score += 25
        cust_found.append("Customer research documents uploaded")
    else:
        cust_missing.append("Customer Interview / Survey transcripts")
        cust_problems.append("No customer interview transcript batches uploaded to persistent memory.")
        cust_recs.append("Upload raw customer interview transcripts or feedback logs to analyze user needs.")
        
    cust_status = "Excellent" if cust_score >= 80 else "Good" if cust_score >= 50 else "Needs work"
    if len(cust_found) < 2:
        cust_status = "Insufficient data"
        cust_score = -1
        cust_recs.append("Detail your target audience and user research in onboarding to unlock Customer Health scoring.")
        
    components.append({
        "name": "Customer Health",
        "score": cust_score,
        "status": cust_status,
        "found_info": cust_found,
        "missing_info": cust_missing,
        "problems": cust_problems,
        "recommendations": cust_recs
    })
    
    # ── MARKET HEALTH ────────────────────────────────────────────────
    mkt_score = 0
    mkt_found = []
    mkt_missing = []
    mkt_problems = []
    mkt_recs = []
    
    if profile.get("industry"):
        mkt_score += 25
        mkt_found.append("Industry Sector defined")
    else:
        mkt_missing.append("Industry Sector")
        
    if profile.get("website") or profile.get("location"):
        mkt_score += 25
        mkt_found.append("Company URL / HQ Location")
    else:
        mkt_missing.append("Company URL or Location")
        
    if "pitch_deck" in doc_categories or "research" in doc_categories:
        mkt_score += 25
        mkt_found.append("Pitch Deck / Research documents uploaded")
    else:
        mkt_missing.append("Market Analysis / Pitch Deck file")
        
    if profile.get("long_term_vision"):
        mkt_score += 25
        mkt_found.append("Long-Term Vision")
    else:
        mkt_missing.append("Long-Term Vision")
        cust_problems.append("Long-term strategic vision is currently empty.")
        mkt_recs.append("Outline your 3-5 year company vision to contextualize market opportunity.")
        
    mkt_status = "Excellent" if mkt_score >= 80 else "Good" if mkt_score >= 50 else "Needs work"
    if len(mkt_found) < 2:
        mkt_status = "Insufficient data"
        mkt_score = -1
        mkt_recs.append("Add your industry domain and company headquarters details to unlock Market Health scoring.")
        
    components.append({
        "name": "Market Health",
        "score": mkt_score,
        "status": mkt_status,
        "found_info": mkt_found,
        "missing_info": mkt_missing,
        "problems": mkt_problems,
        "recommendations": mkt_recs
    })
    
    # ── COMPETITION HEALTH ───────────────────────────────────────────
    comp_score = 0
    comp_found = []
    comp_missing = []
    comp_problems = []
    comp_recs = []
    
    competitors = profile.get("competitors", [])
    if isinstance(competitors, str):
        competitors = [c.strip() for c in competitors.split(",") if c.strip()]
        
    if competitors:
        comp_score += 40
        comp_found.append(f"Identified {len(competitors)} competitors")
    else:
        comp_missing.append("Competitor list")
        comp_problems.append("No competitors identified in company profile.")
        comp_recs.append("Add your direct and indirect competitors so we can track market threats.")
        
    if "pitch_deck" in doc_categories or "research" in doc_categories:
        comp_score += 30
        comp_found.append("Market Positioning / Pitch Deck uploaded")
    else:
        comp_missing.append("Competitor Teardown / Pitch Deck file")
        
    challenges = profile.get("current_challenges", [])
    if isinstance(challenges, str):
        challenges = [c.strip() for c in challenges.split(",") if c.strip()]
        
    if challenges:
        comp_score += 30
        comp_found.append("Bottlenecks & Challenges defined")
    else:
        comp_missing.append("Key bottlenecks / challenges")
        comp_problems.append("No active hurdles or challenges logged.")
        comp_recs.append("Detail your biggest immediate constraint (e.g. engineering velocity, GTM) in onboarding or profile.")
        
    comp_status = "Excellent" if comp_score >= 80 else "Good" if comp_score >= 50 else "Needs work"
    if len(comp_found) < 1:
        comp_status = "Insufficient data"
        comp_score = -1
        comp_recs.append("List at least one competitor or current bottleneck to unlock Competition Health scoring.")
        
    components.append({
        "name": "Competition Health",
        "score": comp_score,
        "status": comp_status,
        "found_info": comp_found,
        "missing_info": comp_missing,
        "problems": comp_problems,
        "recommendations": comp_recs
    })
    
    # ── OVERALL CALCULATION ──────────────────────────────────────────
    valid_scores = [c["score"] for c in components if c["score"] >= 0]
    if valid_scores:
        overall_score = int(sum(valid_scores) / len(valid_scores))
    else:
        overall_score = 0
        
    overall_status = (
        "Excellent" if overall_score >= 80 else
        "Good" if overall_score >= 60 else
        "Needs attention" if overall_score >= 35 else
        "Insufficient data"
    )
    
    # Compile critical recommendations and missing areas
    all_missing = []
    all_recs = []
    for c in components:
        all_missing.extend(c["missing_info"])
        # Take the top 1-2 recommendations from each component to avoid overwhelming
        all_recs.extend(c["recommendations"][:2])
        
    health_report = {
        "user_id": user_id,
        "overall_score": overall_score,
        "status": overall_status,
        "components": components,
        "missing_areas": list(set(all_missing)),
        "recommendations": list(set(all_recs)),
        "calculated_at": datetime.utcnow()
    }
    
    # Save to MongoDB health_reports collection
    await db.health_reports.replace_one(
        {"user_id": user_id},
        health_report,
        upsert=True
    )
    
    return health_report
