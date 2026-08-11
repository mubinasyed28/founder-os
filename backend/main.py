from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database import init_db
from backend.routers import auth, onboarding, documents, chat, health

app = FastAPI(
    title="Cofoundr OS API",
    description="Backend API for Cofoundr OS AI Co-Founder & Live Memory Engine",
    version="1.0.0"
)

# CORS Middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://localhost:8000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    print("[main] Starting FastAPI server & initializing MongoDB...")
    await init_db()

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "Cofoundr OS FastAPI Backend"}

# Mount Routers
app.include_router(auth.router)
app.include_router(onboarding.router)
app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(health.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)

