from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database import init_db
from backend.routers import auth, onboarding, documents, chat, health, competitors, opportunities, research, ml_prediction, simulator
from backend.startup_validator.routes import router as validator_router
from backend.services.ml_service import get_ml_service


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
    print("[main] Preloading ML models and encoders...")
    try:
        get_ml_service().load_models()
        print("[main] ML models preloaded successfully.")
    except Exception as e:
        print(f"[main] Warning: ML service model preloading encountered an error: {e}")

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
app.include_router(validator_router, prefix="/api/v1")
app.include_router(validator_router, prefix="/api/validator")
app.include_router(ml_prediction.router)
app.include_router(simulator.router)


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    uvicorn.run("backend.main:app", host=host, port=port, reload=False)

# Trigger reload



