import os
from dotenv import load_dotenv

# Load .env file from project root or backend dir
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

class Settings:
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "cofoundr_os")
    MISTRAL_API_KEY: str = os.getenv("MISTRAL_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("MISTRAL_API_KEY", "")  # Map to Mistral API key for compatibility
    TAVILY_API_KEY: str = os.getenv("TAVILY_API_KEY", "")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "cofoundr_super_secret_jwt_key_2026")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 60 * 24 * 7  # 7 days
    
    # Document storage & chunking
    UPLOAD_DIR: str = os.path.join(os.path.dirname(__file__), "..", "uploads")
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200

settings = Settings()

