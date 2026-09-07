from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database import init_db
from backend.routers import auth, onboarding, documents, chat, health, competitors, opportunities, research

app = FastAPI(
    title="Cofoundr OS API",
    description="Backend API for Cofoundr OS AI Co-Founder & Live Memory Engine",
    version="1.0.0"
)

import os

# CORS Middleware for React frontend (local dev & production deployments such as Render/Vercel)
cors_origins_env = os.getenv("CORS_ORIGINS", "")
allowed_origins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "http://localhost:8000"
]
if cors_origins_env:
    allowed_origins.extend([origin.strip() for origin in cors_origins_env.split(",") if origin.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    print("[main] Starting FastAPI server & initializing MongoDB...")
    await init_db()

@app.api_route("/", methods=["GET", "HEAD"])
async def root_endpoint():
    return {"status": "ok", "service": "Cofoundr OS API", "version": "1.0.0"}

@app.api_route("/health", methods=["GET", "HEAD"])
async def health_status_endpoint():
    return {"status": "ok", "service": "Cofoundr OS API", "version": "1.0.0"}

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "Cofoundr OS FastAPI Backend"}

# Mount Routers
app.include_router(auth.router)
app.include_router(onboarding.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(health.router)
app.include_router(competitors.router)
app.include_router(opportunities.router)
app.include_router(research.router)

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("backend.main:app", host=host, port=port, reload=False)

# Trigger reload


