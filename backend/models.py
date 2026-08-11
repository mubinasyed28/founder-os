from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime

# ── Auth & User Models ────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str

class UserLogin(BaseModel):
    username_or_email: str
    password: str

class UserOut(BaseModel):
    id: str
    email: str
    username: str
    created_at: datetime

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

# ── 25-Field Redesigned Company Profile Model ─────────────────────────

class CompanyProfile(BaseModel):
    company_name: str = ""
    one_line_pitch: str = ""
    description: str = ""
    industry: str = ""
    problem_statement: str = ""
    solution: str = ""
    product: str = ""
    target_customer: str = ""
    business_model: str = ""
    revenue_model: str = ""
    current_stage: str = ""
    team_size: Optional[str] = None
    founders: List[str] = Field(default_factory=list)
    location: str = ""
    website: str = ""
    current_progress: str = ""
    validation_done: bool = False
    validation_details: str = ""
    customer_interviews: str = ""
    survey_details: str = ""
    traction: str = ""
    competitors: List[str] = Field(default_factory=list)
    current_challenges: List[str] = Field(default_factory=list)
    short_term_goals: List[str] = Field(default_factory=list)
    long_term_vision: str = ""
    uploaded_documents: List[str] = Field(default_factory=list)
    missing_information: List[str] = Field(default_factory=list)
    profile_completeness: int = 0  # 0 to 100%
    
    # Financial and structured fields for health/RAG
    monthly_revenue: float = 0.0
    total_users: int = 0
    funding_raised: float = 0.0
    funding_stage: str = ""
    runway_months: float = 0.0
    revenue_model_details: str = ""
    num_customers: int = 0
    num_employees: int = 0

# ── Document Library Models ──────────────────────────────────────────

class DocumentMeta(BaseModel):
    id: str
    filename: str
    category: str = "other"  # "business_plan", "financial_report", "pitch_deck", "research", "blueprint", "other"
    mimeType: Optional[str] = None
    fileSizeBytes: int
    chunkCount: int
    status: str  # "processing", "indexed", "failed"
    uploadedAt: datetime
    error: Optional[str] = None

class DocumentRenameRequest(BaseModel):
    filename: str

class DocumentReclassifyRequest(BaseModel):
    category: str

# ── Health Engine Models ─────────────────────────────────────────────

class HealthComponent(BaseModel):
    name: str
    score: int
    status: str
    found_info: List[str] = Field(default_factory=list)
    missing_info: List[str] = Field(default_factory=list)
    problems: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)

class HealthReport(BaseModel):
    overall_score: int
    status: str
    components: List[HealthComponent] = Field(default_factory=list)
    missing_areas: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    calculated_at: datetime = Field(default_factory=datetime.utcnow)

# ── Chat & Conversation Models ───────────────────────────────────────

class ChatMessageModel(BaseModel):
    role: str  # "user" | "assistant"
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    assistant_reply: str
    profile_updates: Dict[str, Any]
    profile: CompanyProfile
    completeness_score: int
    missing_information: List[str]
    next_focus: str = ""

class ChatAttachment(BaseModel):
    filename: str
    text: str
    mimeType: str
    fileSizeBytes: int
    tempPath: Optional[str] = None
    base64: Optional[str] = None
    isSaved: bool = False
    savedDocId: Optional[str] = None

class RagMessage(BaseModel):
    role: str
    text: str
    attachment: Optional[ChatAttachment] = None

class RagChatRequest(BaseModel):
    messages: List[RagMessage]
    conversationId: Optional[str] = None

class RagChatResponse(BaseModel):
    text: str
    steps: List[str]
    sources: List[str]
    conversationId: str


