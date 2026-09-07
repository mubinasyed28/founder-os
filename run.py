import os
import uvicorn

if __name__ == "__main__":
    port = int(os.getenv("PORT", "10000"))
    host = os.getenv("HOST", "0.0.0.0")
    print(f"[run.py] Launching Uvicorn on {host}:{port}...")
    uvicorn.run("backend.main:app", host=host, port=port)
