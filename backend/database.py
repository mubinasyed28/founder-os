from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from backend.config import settings

client: AsyncIOMotorClient | None = None
db: AsyncIOMotorDatabase | None = None

async def get_db_client() -> AsyncIOMotorClient:
    global client
    if client is None:
        client = AsyncIOMotorClient(settings.MONGODB_URI)
    return client

async def get_db() -> AsyncIOMotorDatabase:
    global db
    if db is None:
        c = await get_db_client()
        db = c[settings.MONGODB_DB_NAME]
    return db

class _DatabaseProxy:
    def __getattr__(self, name):
        global db, client
        if db is None:
            if client is None:
                client = AsyncIOMotorClient(settings.MONGODB_URI)
            db = client[settings.MONGODB_DB_NAME]
        return getattr(db, name)

database = _DatabaseProxy()

async def init_db():
    database = await get_db()
    
    # User indexes
    await database.users.create_index("email", unique=True)
    await database.users.create_index("username", unique=True)
    
    # Conversation indexes
    await database.conversations.create_index("user_id")
    
    # Profile indexes
    await database.profiles.create_index("user_id", unique=True)
    
    # Document and Chunk indexes
    await database.documents.create_index([("user_id", 1), ("uploadedAt", -1)])
    await database.chunks.create_index([("user_id", 1), ("document_id", 1)])
    
    # Chat conversation indexes
    await database.chat_conversations.create_index("user_id")
    
    # Health report indexes
    await database.health_reports.create_index("user_id")
    
    # Competitor research indexes
    await database.competitor_research.create_index("user_id")
    
    # Research pipeline indexes
    await database.research_evidence.create_index([("user_id", 1), ("content_hash", 1)], unique=True)
    await database.research_evidence.create_index([("user_id", 1), ("retrieved_at", -1)])
    await database.research_entities.create_index([("user_id", 1), ("canonical_name", 1), ("entity_type", 1)], unique=True)
    await database.research_entities.create_index([("user_id", 1), ("relevance_score", -1)])
    await database.research_events.create_index([("user_id", 1), ("created_at", -1)])
    await database.research_events.create_index([("user_id", 1), ("relevance_score", -1)])
    await database.research_insights.create_index([("user_id", 1), ("created_at", -1)])
    await database.research_insights.create_index([("user_id", 1), ("relevance_score", -1)])
    await database.research_insights.create_index([("user_id", 1), ("impact_area", 1)])
    await database.research_runs.create_index([("user_id", 1), ("started_at", -1)])
    await database.research_feedback.create_index([("user_id", 1), ("insight_id", 1)])

    print("[db] MongoDB connected & indexes initialized successfully.")

