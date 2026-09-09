"""
Pydantic schemas for the Startup Idea Validator.
Strictly corresponds to the frontend TypeScript interfaces in src/types/validation.ts.
"""
from typing import List, Optional, Literal
from pydantic import BaseModel, Field

class Source(BaseModel):
    id: str
    title: str
    publisher: str
    url: str
    date: Optional[str] = None

class StartupIdea(BaseModel):
    raw: str
    submittedAt: str

class IdeaProfile(BaseModel):
    name: str
    problem: str
    targetUsers: List[str]
    solution: str
    domain: str
    coreConcepts: List[str]

class NLPConcept(BaseModel):
    term: str
    type: Literal["keyword", "entity", "concept"]
    weight: float

class NLPAnalysis(BaseModel):
    keywords: List[NLPConcept]
    entities: List[NLPConcept]
    semanticConcepts: List[NLPConcept]
    tokensAnalyzed: int
    embeddingModel: str

class Competitor(BaseModel):
    id: str
    name: str
    similarity: float
    relevance: Literal["High", "Medium", "Low"]
    source: Source
    description: str
    relevantFeatures: List[str]
    whySimilar: str
    competitiveRelevance: str
    evidence: List[str]

class FeatureMatrixRow(BaseModel):
    feature: str
    values: List[Literal["yes", "no", "unknown"]]

class FeatureMatrix(BaseModel):
    competitors: List[str]
    rows: List[FeatureMatrixRow]
    opportunity: str

class MarketSignal(BaseModel):
    id: str
    headline: str
    whatHappened: str
    whyItMatters: str
    impact: Literal["Competitive", "Positive", "Cautionary"]
    confidence: float
    source: Source

class ValidationScore(BaseModel):
    label: str
    value: int
    note: str

class ValidationResultSummary(BaseModel):
    score: int
    verdict: str
    confidence: float
    summary: str
    breakdown: List[ValidationScore]
    strengths: List[str]
    risks: List[str]

class Recommendation(BaseModel):
    buildFirst: List[str]
    dontBuildYet: List[str]

class ValidationExperiment(BaseModel):
    title: str
    recommendation: str
    questions: List[str]

class ValidationResult(BaseModel):
    idea: StartupIdea
    profile: IdeaProfile
    nlp: NLPAnalysis
    competitors: List[Competitor]
    competitorCount: int
    featureMatrix: FeatureMatrix
    marketSignals: List[MarketSignal]
    validation: ValidationResultSummary
    recommendation: Recommendation
    experiment: ValidationExperiment

class AnalysisRequest(BaseModel):
    idea: str

class AnalysisJobResponse(BaseModel):
    jobId: str
    idea: str

class AnalysisStageInfo(BaseModel):
    id: str
    label: str
    detail: str
    status: Literal["pending", "active", "completed"]

class AnalysisProgressResponse(BaseModel):
    stages: List[AnalysisStageInfo]
    percent: int
    done: bool
    status: str
    result: Optional[ValidationResult] = None
