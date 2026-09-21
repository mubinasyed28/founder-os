import asyncio
from backend.services.competitor_research_service import run_research_pipeline
from backend.database import get_db

async def run_test():
    user_id = "6a774a4d4b3130a994430501"
    db = await get_db()
    profile = await db.profiles.find_one({"user_id": user_id}) or {}
    print(f"Startup: {profile.get('company_name')} | {profile.get('industry')} | {profile.get('product')}", flush=True)
    research_id = "test_run_2"
    await run_research_pipeline(user_id, research_id, profile)
    res = await db.competitor_research.find_one({"id": research_id})
    print(f"STATUS: {res.get('research_status')}", flush=True)
    competitors = res.get("competitors", [])
    print(f"COMPETITORS COUNT: {len(competitors)}", flush=True)
    for c in competitors:
        name = c.get("name")
        domain = c.get("domain")
        target = c.get("target_customers") or "N/A"
        model = c.get("business_model") or "N/A"
        strengths = len(c.get("strengths", []))
        print(f" - {name} ({domain}) | Target: {target} | Model: {model} | Strengths: {strengths}", flush=True)
    gaps = res.get("gaps", [])
    print(f"GAPS COUNT: {len(gaps)}", flush=True)
    for g in gaps:
        print(f" * Gap: {g.get('title')} ({g.get('gap_type')})", flush=True)

if __name__ == "__main__":
    asyncio.run(run_test())
