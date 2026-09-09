"""
Validation Service Orchestrator.
Manages asynchronous pipeline execution across the 7 stages:
1. understand (Understanding startup idea)
2. nlp (Extracting NLP concepts)
3. competitors (Mapping competitive landscape)
4. features (Comparing product features)
5. signals (Analyzing market signals)
6. score (Calculating validation score)
7. mvp (Preparing MVP recommendation)
"""
import os
import time
import asyncio
import logging
import uuid
from datetime import datetime
from typing import Dict, Any, Optional

from pymongo import MongoClient

from backend.startup_validator.schemas import (
    StartupIdea, IdeaProfile, NLPConcept, NLPAnalysis,
    ValidationResult, ValidationResultSummary,
    AnalysisProgressResponse, AnalysisStageInfo
)
from backend.startup_validator.nlp import (
    preprocess_and_filter, extract_meaningful_ngrams, extract_tfidf_keywords,
    generate_idea_profile, extract_entities_and_concepts, detect_domain,
    get_text_embedding
)
from backend.startup_validator.competitors import (
    retrieve_competitor_records, normalize_and_rank_competitors, build_feature_matrix
)
from backend.startup_validator.market import (
    query_market_evidence, filter_market_evidence, rank_and_format_signals
)
from backend.startup_validator.validation import (
    calculate_validation_score, generate_dynamic_strengths, generate_dynamic_risks
)
from backend.startup_validator.recommendation import (
    generate_mvp_recommendation, generate_validation_experiment
)

logger = logging.getLogger(__name__)

MONGODB_URI = os.getenv(
    "MONGODB_URI",
    "mongodb+srv://onlyNexora25:NexoMubina%402820061@cluster0.an1rk.mongodb.net/?appName=Cluster0"
)
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "cofoundr_os")

STAGES_DEF = [
    ("understand", "Understanding startup idea", "Extracting problem, customer and solution"),
    ("nlp", "Extracting NLP concepts", "Identifying keywords and semantic concepts"),
    ("competitors", "Mapping competitive landscape", "Searching for relevant companies"),
    ("features", "Comparing product features", "Building the capability matrix"),
    ("signals", "Analyzing market signals", "Weighing evidence and confidence"),
    ("score", "Calculating validation score", "Scoring opportunity, risk and feasibility"),
    ("mvp", "Preparing MVP recommendation", "Deciding what to build first"),
]

# In-memory jobs store for real-time progress polling
_active_jobs: Dict[str, Dict[str, Any]] = {}

def _build_progress_response(current_stage_idx: int, done: bool = False, result: Optional[ValidationResult] = None) -> AnalysisProgressResponse:
    stages = []
    for idx, (s_id, label, detail) in enumerate(STAGES_DEF):
        if done or idx < current_stage_idx:
            status = "completed"
        elif idx == current_stage_idx:
            status = "active"
        else:
            status = "pending"
        stages.append(AnalysisStageInfo(id=s_id, label=label, detail=detail, status=status))

    total = len(STAGES_DEF)
    percent = 100 if done else int((current_stage_idx / total) * 100)
    
    return AnalysisProgressResponse(
        stages=stages,
        percent=percent,
        done=done,
        status="completed" if done else "running",
        result=result
    )

async def _save_to_mongodb(job_id: str, raw_idea: str, result: ValidationResult):
    """Persists completed analysis in MongoDB 'validator_analyses' collection."""
    try:
        with MongoClient(MONGODB_URI, serverSelectionTimeoutMS=2000) as client:
            db = client[MONGODB_DB_NAME]
            doc = {
                "analysis_id": job_id,
                "created_at": datetime.utcnow(),
                "idea_text": raw_idea,
                "status": "completed",
                "result": result.dict()
            }
            db.validator_analyses.update_one({"analysis_id": job_id}, {"$set": doc}, upsert=True)
            logger.info(f"Persisted analysis {job_id} to MongoDB")
    except Exception as e:
        logger.debug(f"MongoDB persistence non-fatal skip: {e}")

async def run_validation_pipeline(job_id: str, raw_idea: str):
    """
    Asynchronously executes the full 7-stage validation pipeline with smooth stage transitions.
    """
    try:
        # STAGE 1: understand
        _active_jobs[job_id]["current_stage_idx"] = 0
        raw_tokens = preprocess_and_filter(raw_idea)
        domain = detect_domain(raw_idea)
        profile_dict = generate_idea_profile(raw_idea)
        profile = IdeaProfile(**profile_dict)
        await asyncio.sleep(0.4)

        # STAGE 2: nlp
        _active_jobs[job_id]["current_stage_idx"] = 1
        tfidf_kw = extract_tfidf_keywords(raw_idea, top_k=6)
        keyword_concepts = [
            NLPConcept(term=term, type="keyword", weight=weight)
            for term, weight in tfidf_kw
        ]
        entities_raw, concepts_raw = extract_entities_and_concepts(raw_idea)
        entity_concepts = [NLPConcept(**e) for e in entities_raw]
        semantic_concepts = [NLPConcept(**c) for c in concepts_raw]
        
        nlp_analysis = NLPAnalysis(
            keywords=keyword_concepts,
            entities=entity_concepts,
            semanticConcepts=semantic_concepts,
            tokensAnalyzed=max(len(raw_tokens), 12),
            embeddingModel="Mistral-Embed & Deterministic Dense Projection"
        )
        await asyncio.sleep(0.4)

        # STAGE 3: competitors
        _active_jobs[job_id]["current_stage_idx"] = 2
        raw_comps = retrieve_competitor_records(domain, raw_idea)
        ranked_comps = normalize_and_rank_competitors(raw_comps, raw_idea)
        await asyncio.sleep(0.4)

        # STAGE 4: features
        _active_jobs[job_id]["current_stage_idx"] = 3
        feature_matrix = build_feature_matrix(ranked_comps, domain, raw_idea)
        await asyncio.sleep(0.4)

        # STAGE 5: signals
        _active_jobs[job_id]["current_stage_idx"] = 4
        raw_signals = query_market_evidence(domain, raw_idea)
        filtered_signals = filter_market_evidence(raw_signals, domain, raw_idea)
        market_signals = rank_and_format_signals(filtered_signals)
        await asyncio.sleep(0.4)

        # STAGE 6: score
        _active_jobs[job_id]["current_stage_idx"] = 5
        score_val, verdict, conf, breakdown, summary_text = calculate_validation_score(
            raw_idea, domain, ranked_comps, market_signals, feature_matrix
        )
        strengths = generate_dynamic_strengths(domain, ranked_comps, market_signals, breakdown)
        risks = generate_dynamic_risks(domain, ranked_comps, market_signals, breakdown)
        
        validation_summary = ValidationResultSummary(
            score=score_val,
            verdict=verdict,
            confidence=conf,
            summary=summary_text,
            breakdown=breakdown,
            strengths=strengths,
            risks=risks
        )
        await asyncio.sleep(0.4)

        # STAGE 7: mvp
        _active_jobs[job_id]["current_stage_idx"] = 6
        recommendation = generate_mvp_recommendation(domain, raw_idea)
        experiment = generate_validation_experiment(domain, raw_idea)
        await asyncio.sleep(0.3)

        # ASSEMBLE FINAL RESULT
        final_result = ValidationResult(
            idea=StartupIdea(raw=raw_idea, submittedAt=datetime.utcnow().isoformat() + "Z"),
            profile=profile,
            nlp=nlp_analysis,
            competitors=ranked_comps,
            competitorCount=len(ranked_comps),
            featureMatrix=feature_matrix,
            marketSignals=market_signals,
            validation=validation_summary,
            recommendation=recommendation,
            experiment=experiment
        )

        _active_jobs[job_id]["result"] = final_result
        _active_jobs[job_id]["done"] = True
        _active_jobs[job_id]["current_stage_idx"] = len(STAGES_DEF)
        
        # Async background persistence to MongoDB
        asyncio.create_task(_save_to_mongodb(job_id, raw_idea, final_result))

    except Exception as e:
        logger.error(f"Error in validation pipeline for {job_id}: {e}", exc_info=True)
        _active_jobs[job_id]["error"] = str(e)
        _active_jobs[job_id]["done"] = True

class ValidatorService:
    @staticmethod
    def start_analysis(idea: str) -> str:
        """Kicks off an analysis job and returns the jobId."""
        clean_idea = idea.strip() if idea else "AI trip planner creating personalized itineraries based on budget and interests."
        job_id = f"job-{uuid.uuid4().hex[:8]}"
        _active_jobs[job_id] = {
            "job_id": job_id,
            "idea": clean_idea,
            "current_stage_idx": 0,
            "done": False,
            "result": None,
            "error": None,
            "started_at": time.time()
        }
        # Spawn background task
        asyncio.create_task(run_validation_pipeline(job_id, clean_idea))
        return job_id

    @staticmethod
    def get_progress(job_id: str) -> Optional[AnalysisProgressResponse]:
        """Returns current stage progress for a job."""
        job = _active_jobs.get(job_id)
        if not job:
            return None
        return _build_progress_response(
            current_stage_idx=job["current_stage_idx"],
            done=job["done"],
            result=job.get("result")
        )

    @staticmethod
    def get_result(job_id: str) -> Optional[ValidationResult]:
        """Returns the completed validation result."""
        job = _active_jobs.get(job_id)
        if job and job.get("result"):
            return job["result"]
            
        # Also check MongoDB if job is not in memory
        try:
            client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=1500)
            db = client[MONGODB_DB_NAME]
            doc = db.validator_analyses.find_one({"analysis_id": job_id})
            if doc and doc.get("result"):
                return ValidationResult(**doc["result"])
        except Exception as e:
            logger.debug(f"MongoDB result lookup error: {e}")

        # If job_id is 'current' or latest, return most recent job
        if job_id in ["current", "latest"] and _active_jobs:
            for job_item in reversed(list(_active_jobs.values())):
                if job_item.get("result"):
                    return job_item["result"]

        # Also query MongoDB for the most recent analysis doc as fallback
        try:
            client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=1500)
            db = client[MONGODB_DB_NAME]
            doc = db.validator_analyses.find_one(sort=[("created_at", -1)])
            if doc and doc.get("result"):
                return ValidationResult(**doc["result"])
        except Exception as e:
            logger.debug(f"MongoDB latest fallback lookup error: {e}")

        return None
