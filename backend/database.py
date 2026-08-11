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
    
    print("[db] MongoDB connected & indexes initialized successfully.")

