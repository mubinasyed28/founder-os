import os
import json
import logging
from typing import Dict, Any, List, Optional
import urllib.request
from backend.config import settings
from backend.services.decision_parser_service import parse_founder_decision
from backend.services.company_context_service import get_company_context_service
from backend.services.scenario_engine import get_scenario_engine

logger = logging.getLogger(__name__)

SYNTHESIS_SYSTEM_PROMPT = """You are an experienced serial founder and YC partner advising a startup founder on a strategic decision in FounderOS.
You are provided with:
1. Structured decision parameters
2. Quantitative ML Model predictions (statistical survival risk, churn sensitivity, and revenue trends)
3. Data availability summary (indicates which metrics are verified vs. insufficient data)
4. Ground truth company evidence (profile, verified financial metrics, uploaded documents)
5. Live competitor and market research evidence (retrieved via external search & market news APIs)

Your objective:
Synthesize an authoritative, candid, evidence-grounded decision report.

STRICT GUIDELINES:
- ML MODELS & DATASET ROLE: The machine learning models and training datasets provide AGGREGATE STATISTICAL TRENDS and macro failure distributions for reasoning (e.g., "Survival models indicate ~40% of early-stage startups in this profile fail due to high burn before milestone validation").
- DO NOT cite, name, or invent specific individual startup companies from the training datasets.
- ALL competitor references and market benchmark facts MUST be drawn strictly from the provided live external evidence (Tavily, NewsData, company profile).
- DATA AVAILABILITY CHECK: Examine 'data_availability'. If any metric (e.g. revenue, startup failure risk) is marked unavailable or insufficient data, DO NOT fabricate or claim model predictions for that metric. Explicitly explain that verified data for that metric is unavailable in the company profile, and base your advice on available evidence and qualitative benchmarks.
- DO NOT claim the ML models establish causal certainty. Use "projected", "estimated", or "model-based association".
- Ground your explanation directly in the company's verified metrics, documents, and live market facts.
- Produce a clear recommendation: "Proceed", "Proceed with caution", "Reconsider", or "Insufficient evidence".
- Explain the confidence level (HIGH, MEDIUM, LOW, INSUFFICIENT DATA).
- Provide concise bullet points for positive impacts, negative risks, and key assumptions.

Return JSON matching this schema:
{
  "recommendation": "Proceed" | "Proceed with caution" | "Reconsider" | "Insufficient evidence",
  "recommendation_reasoning": ["reason 1", "reason 2", "reason 3"],
  "confidence": "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT DATA",
  "confidence_reasoning": "Explanation of data quality and model applicability",
  "risk_level": "LOW" | "MODERATE" | "HIGH" | "CRITICAL",
  "risk_factors": ["risk 1", "risk 2"],
  "impact": {
    "positive": ["positive point 1", "positive point 2"],
    "negative": ["negative risk 1"],
    "changes": ["summary of key operational change"]
  },
  "ai_cofounder_explanation": "2-3 concise, high-signal paragraphs explaining what the founder should do, why, and what trap to avoid."
}
"""


class DecisionIntelligenceService:
    """
    End-to-End Orchestrator:
    Founder Decision -> Parser -> Company Context (RAG + Research) -> Structured Signals ->
    Scenario Engine -> ML Predictions -> Evidence Synthesis -> Final Decision Report.
    """

    def __init__(self):
        self.context_service = get_company_context_service()
        self.scenario_engine = get_scenario_engine()

    def _calculate_confidence(
        self,
        coverage_status: str,
        evidence_counts: Dict[str, int],
        has_metrics: bool
    ) -> tuple[str, str]:
        """Calculates transparent, non-arbitrary confidence rating."""
        total_evidence = sum(evidence_counts.values())

        if coverage_status == "UNSUPPORTED":
            return "LOW", "Decision type is not modeled by the trained ML schemas; relying on heuristic rules and qualitative evidence."

        if coverage_status == "PARTIALLY_SUPPORTED":
            if total_evidence >= 3 and has_metrics:
                return "MEDIUM", "Decision is partially mapped to proxy ML features, supported by verified internal company metrics and context."
            return "LOW", "Decision relies on proxy ML features with limited company-specific documentation."

        # FULLY SUPPORTED
        if total_evidence >= 4 and has_metrics:
            return "HIGH", "High model schema alignment combined with verified company metrics, internal context, and calibrated risk models."
        elif has_metrics:
            return "MEDIUM", "Supported by calibrated ML models, but company documentation coverage is moderate."
        else:
            return "LOW", "Model support is strong, but company baseline relies on generalized defaults."

    def _determine_recommendation_and_risk(
        self,
        coverage_status: str,
        comparison: Dict[str, Any],
        decision_type: str,
        runway_months: Optional[float],
        evidence: Dict[str, List[Any]]
    ) -> Dict[str, Any]:
        """
        Deterministic, grounded recommendation engine used directly or as
        a robust fallback when LLM API is unavailable.
        """
        rev_comp = comparison.get("revenue_forecast", {})
        risk_comp = comparison.get("startup_failure_risk", {})
        churn_comp = comparison.get("churn_risk", {})

        mrr_diff = rev_comp.get("estimated_difference")
        pct_diff = rev_comp.get("estimated_pct_change")
        fail_diff = risk_comp.get("estimated_difference")
        scen_fail = risk_comp.get("scenario_probability")

        reasons = []
        positive_impacts = []
        negative_impacts = []
        risk_factors = []

        # Evaluate Runway & Burn
        if runway_months is None:
            risk_level = "MODERATE"
            risk_factors.append("Runway buffer is unavailable because verified cash in bank and monthly burn rate have not been provided.")
        elif runway_months < 6.0:
            risk_level = "CRITICAL"
            risk_factors.append(f"Immediate cash runway hazard ({runway_months:.1f} months remaining). Insolvency danger is acute.")
        elif runway_months < 10.0:
            risk_level = "HIGH"
            risk_factors.append(f"Sub-optimal runway ({runway_months:.1f} months). Execution delays could trigger a fundraising crunch.")
        elif runway_months < 18.0:
            risk_level = "MODERATE"
            risk_factors.append(f"Standard runway ({runway_months:.1f} months). Balanced buffer for near-term milestones.")
        else:
            risk_level = "LOW"
            positive_impacts.append(f"Strong runway buffer ({runway_months:.1f} months) insulating the company against market shocks.")

        # Decision-specific reasoning
        if decision_type == "fundraising":
            positive_impacts.append("Capital extension substantially lowers venture failure probability.")
            if runway_months is not None:
                positive_impacts.append(f"Extends runway buffer to {runway_months:.1f} months.")
                recommendation = "Proceed" if runway_months < 14.0 else "Proceed with caution"
            else:
                positive_impacts.append("Extends cash runway to provide operational runway.")
                recommendation = "Proceed"
            reasons.append("Provides necessary liquidity to reach product-market fit milestones.")
            reasons.append("Reduces execution pressure from short cash horizon.")

        elif decision_type == "burn_adjustment":
            positive_impacts.append("Conserves vital cash reserves and extends runway without requiring dilution.")
            if fail_diff is not None:
                reasons.append(f"Lowers model failure risk by {abs(fail_diff)*100:.1f} percentage points.")
            else:
                reasons.append("Lowering burn rate preserves existing capital efficiency.")
            recommendation = "Proceed"

        elif decision_type == "validation_action":
            positive_impacts.append("Customer discovery & validation is the #1 statistical driver of startup survival (14.8% weight).")
            reasons.append("Significantly de-risks future development spend by confirming willingness to pay before scaling.")
            recommendation = "Proceed"

        elif decision_type == "pricing_change":
            if mrr_diff is not None and mrr_diff > 0:
                pct_str = f" (+{pct_diff:.1f}%)" if pct_diff is not None else ""
                positive_impacts.append(f"Projected next-month MRR increases by ${mrr_diff:,.0f}{pct_str}.")
                reasons.append("Higher pricing captures superior unit economics from core active accounts.")
            elif mrr_diff is not None:
                negative_impacts.append("Price elasticity may compress expansion or trigger churn.")
            else:
                positive_impacts.append("Optimizing pricing structures helps align willingness to pay with unit economics.")
            
            churn_diff = churn_comp.get("estimated_difference")
            if churn_diff is not None and churn_diff > 0.02:
                risk_factors.append("Slightly elevated contraction risk detected following tier adjustment.")
            recommendation = "Proceed with caution"
            reasons.append("Monitor customer cohort retention closely over the first 60 days following price rollout.")

        elif decision_type == "hiring":
            if runway_months is not None:
                negative_impacts.append(f"Increases monthly fixed burn, compressing cash runway to {runway_months:.1f} months.")
                if runway_months < 9.0:
                    recommendation = "Reconsider"
                    reasons.append(f"Added payroll compresses runway below 9 months ({runway_months:.1f} mo), creating immediate cash risk.")
                else:
                    recommendation = "Proceed with caution"
                    reasons.append("Staged hiring is recommended: ensure hiring is tied to explicit product milestones.")
            else:
                negative_impacts.append("Increases monthly fixed payroll burn.")
                recommendation = "Proceed with caution"
                reasons.append("Verify cash runway before committing to recurring payroll obligations.")
            positive_impacts.append("Enhances technical and operational team completeness.")

        elif decision_type == "feature_launch":
            positive_impacts.append("Expands unique feature adoption and product breadth (Model 1 revenue/churn mapping).")
            reasons.append("Engages existing users with beta capabilities and strengthens feature density.")
            reasons.append("Validate user retention on the feature before committing full engineering roadmap.")
            recommendation = "Proceed with caution"

        else:
            recommendation = "Proceed with caution"
            reasons.append("Decision is evaluated primarily via heuristic financial benchmarks.")

        # Default changes
        changes = [f"Adjusted {decision_type.replace('_', ' ')} parameters in company simulation state."]

        # Co-founder explanation using actual values
        base_mrr = rev_comp.get("baseline_mrr")
        scen_mrr = rev_comp.get("scenario_mrr")
        runway_str = f", {runway_months:.1f} months runway" if runway_months is not None else ""

        if decision_type == "feature_launch":
            if base_mrr is not None and scen_mrr is not None and mrr_diff is not None:
                co_founder_text = (
                    f"The current company state provides the baseline (${base_mrr:,.0f}/mo MRR{runway_str}). "
                    f"The proposed feature is evaluated using the feature-launch scenario mapping available in the trained models "
                    f"(projected scenario MRR: ${scen_mrr:,.0f}/mo, delta: {mrr_diff:+,.0f}/mo), supplemented by company and market evidence. "
                    f"These are model-based estimates rather than causal guarantees. "
                    f"{' '.join(positive_impacts[:2])} "
                    f"My recommendation is to **{recommendation.upper()}**: {' '.join(reasons[:2])}"
                )
            else:
                co_founder_text = (
                    f"Your company profile does not contain verified revenue history, so I cannot produce a defensible revenue forecast. "
                    f"I can still evaluate the feature using your product context, customer evidence, competitor landscape and current market signals. "
                    f"These are directional qualitative estimates rather than causal guarantees. "
                    f"{' '.join(positive_impacts[:2])} "
                    f"My recommendation is to **{recommendation.upper()}**: {' '.join(reasons[:2])}"
                )
        elif coverage_status == "UNSUPPORTED":
            runway_clause = f"Your baseline position shows {runway_months:.1f} months of runway. " if runway_months is not None else "Runway data is unverified in your company profile. "
            co_founder_text = (
                f"Here is how I read this move: {runway_clause}"
                f"ML models do not currently support this decision type, so this scenario is evaluated primarily through heuristic financial benchmarks. "
                f"{' '.join(positive_impacts[:2])} "
                f"{' '.join(risk_factors[:1])} "
                f"My recommendation is to **{recommendation.upper()}**. {' '.join(reasons[:2])}"
            )
        else:
            runway_clause = f"Your baseline position shows {runway_months:.1f} months of runway " if runway_months is not None else "Runway data is unverified in your company profile "
            risk_clause = f"with survival risk models estimating a {scen_fail*100:.1f}% macro failure risk based on operational baseline trends. " if scen_fail is not None else ". "
            co_founder_text = (
                f"Here is how I read this move: {runway_clause}{risk_clause}"
                f"{' '.join(positive_impacts[:2])} "
                f"{' '.join(risk_factors[:1])} "
                f"My recommendation is to **{recommendation.upper()}**. {' '.join(reasons[:2])}"
            )

        return {
            "recommendation": recommendation,
            "recommendation_reasoning": reasons,
            "risk_level": risk_level,
            "risk_factors": risk_factors,
            "impact": {
                "positive": positive_impacts,
                "negative": negative_impacts,
                "changes": changes
            },
            "ai_cofounder_explanation": co_founder_text
        }

    async def _generate_llm_synthesis(
        self,
        structured_decision: Dict[str, Any],
        scenario_report: Dict[str, Any],
        context_data: Dict[str, Any],
        deterministic_fallback: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Attempts LLM synthesis with prompt grounded in evidence and ML outputs."""
        api_key = settings.MISTRAL_API_KEY
        if not api_key:
            return deterministic_fallback

        try:
            predictions = scenario_report.get("predictions", {})
            data_availability = {
                k: {
                    "available": v.get("available", False),
                    "status": v.get("status", "INSUFFICIENT_DATA"),
                    "reason": v.get("reason")
                }
                for k, v in predictions.items()
                if isinstance(v, dict)
            }
            prompt_payload = {
                "decision": structured_decision,
                "data_availability": data_availability,
                "ml_comparison": scenario_report.get("comparison", {}),
                "state_changes": scenario_report.get("state_changes", {}),
                "drivers": scenario_report.get("drivers", []),
                "evidence": context_data.get("evidence", {}),
                "assumptions": scenario_report.get("assumptions", [])
            }

            candidate_models = ["mistral-small-latest", "ministral-8b-latest", "open-mistral-7b", "ministral-3b-latest"]
            for model_name in candidate_models:
                payload = {
                    "model": model_name,
                    "messages": [
                        {"role": "system", "content": SYNTHESIS_SYSTEM_PROMPT},
                        {"role": "user", "content": f"Synthesize this decision scenario into structured JSON:\n{json.dumps(prompt_payload, indent=2)}"}
                    ],
                    "response_format": {"type": "json_object"},
                    "max_tokens": 2500
                }

                req = urllib.request.Request(
                    "https://api.mistral.ai/v1/chat/completions",
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"},
                    method="POST"
                )
                try:
                    with urllib.request.urlopen(req, timeout=45) as resp:
                        data = json.loads(resp.read().decode("utf-8"))
                        parsed = json.loads(data["choices"][0]["message"]["content"].strip())
                        # Ensure all required keys exist
                        for k in ["recommendation", "recommendation_reasoning", "risk_level", "risk_factors", "impact", "ai_cofounder_explanation"]:
                            if k not in parsed:
                                parsed[k] = deterministic_fallback[k]
                        return parsed
                except Exception as ex:
                    logger.debug(f"[intelligence_service] Model {model_name} failed: {ex}")
                    continue
        except Exception as e:
            logger.warning(f"[intelligence_service] LLM synthesis failed ({e}). Using deterministic co-founder synthesis.")

        return deterministic_fallback

    async def analyze_decision_intelligently(
        self,
        company_id: str,
        decision_text: Optional[str] = None,
        structured_decision: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Full Stage 4 End-to-End Pipeline:
        1. Decision Parsing
        2. Context Retrieval (Profile + Metrics + Document RAG + Competitors + Market)
        3. Structured Signal Extraction
        4. Scenario Engine & ML Inference
        5. Grounded Evidence Synthesis
        6. Final Decision Report Assembly
        """
        # 1. Parse decision
        if not structured_decision:
            structured_decision = await parse_founder_decision(decision_text or "")

        decision_type = structured_decision.get("decision_type", "other")
        coverage_status = structured_decision.get("coverage_status", "UNSUPPORTED")

        # 2. Gather full context & evidence
        context_data = await self.context_service.build_full_context(company_id, structured_decision)
        company_state = context_data["company_state_for_engine"]
        evidence = context_data["evidence"]

        # 3. Scenario Engine Evaluation
        scenario_report = await self.scenario_engine.evaluate_decision(
            structured_decision=structured_decision,
            company_state=company_state
        )

        # 4. Determine confidence
        evidence_counts = {k: len(v) for k, v in evidence.items()}
        has_metrics = bool(context_data.get("company_profile", {}).get("monthly_revenue"))
        confidence_level, confidence_reasoning = self._calculate_confidence(coverage_status, evidence_counts, has_metrics)

        # 5. Recommendation & Risk Synthesis
        runway_raw = scenario_report.get("state_changes", {}).get("scenario", {}).get("runway_months")
        runway = float(runway_raw) if runway_raw is not None else None
        deterministic_synth = self._determine_recommendation_and_risk(
            coverage_status=coverage_status,
            comparison=scenario_report.get("comparison", {}),
            decision_type=decision_type,
            runway_months=runway,
            evidence=evidence
        )

        # 6. LLM Refinement if available
        synthesis = await self._generate_llm_synthesis(
            structured_decision=structured_decision,
            scenario_report=scenario_report,
            context_data=context_data,
            deterministic_fallback=deterministic_synth
        )

        # 7. Requirement 21: Structured Logging
        profile_fields_used = [k for k, v in context_data.get("canonical_metrics", {}).items() if v.get("status") == "verified"]
        profile_fields_missing = context_data.get("data_quality", {}).get("missing_metrics", [])
        sufficiency_summary = {
            k: {"available": v.get("available"), "reason": v.get("reason", "")}
            for k, v in scenario_report.get("predictions", {}).items()
            if isinstance(v, dict)
        }
        final_rec = synthesis.get("recommendation", deterministic_synth["recommendation"])
        final_risk = synthesis.get("risk_level", deterministic_synth["risk_level"])

        retrieval_stats = context_data.get("document_retrieval_stats", {})
        retrieval_query = retrieval_stats.get("retrieval_query", "")
        cand_doc_count = retrieval_stats.get("candidate_document_count", 0)
        ret_chunk_count = retrieval_stats.get("retrieved_chunk_count", 0)
        docs_after_thresh = retrieval_stats.get("documents_after_threshold", len(evidence.get("documents", [])))
        sel_doc_ids = retrieval_stats.get("selected_document_ids", [d.get("document_id") for d in evidence.get("documents", []) if d.get("document_id")])
        sel_doc_scores = retrieval_stats.get("selected_document_scores", [d.get("relevance_score") for d in evidence.get("documents", []) if d.get("relevance_score") is not None])
        docs_excluded = retrieval_stats.get("documents_excluded", [])

        research_stats = context_data.get("research_stats", {})
        research_fingerprint = research_stats.get("research_fingerprint", "")
        competitor_queries = research_stats.get("competitor_queries", [])
        selected_competitors = [c.get("title") for c in evidence.get("competitors", []) if c.get("title")]
        market_queries = research_stats.get("market_queries", [])
        selected_market = [m.get("title") for m in evidence.get("market", []) if m.get("title")]
        cache_hit = research_stats.get("cache_hit", False)
        relevance_filtering_counts = {
            "competitors_excluded": len(research_stats.get("competitors_excluded", [])),
            "market_excluded": len(research_stats.get("market_excluded", []))
        }

        logger.info(
            f"[DECISION_SIMULATOR] company_id={company_id} | "
            f"decision_text=\"{decision_text}\" | "
            f"decision_type={decision_type} | "
            f"research_fingerprint=\"{research_fingerprint}\" | "
            f"retrieval_query=\"{retrieval_query}\" | "
            f"candidate_document_count={cand_doc_count} | "
            f"retrieved_chunk_count={ret_chunk_count} | "
            f"documents_after_threshold={docs_after_thresh} | "
            f"selected_document_ids={sel_doc_ids} | "
            f"selected_document_scores={sel_doc_scores} | "
            f"documents_excluded={docs_excluded} | "
            f"competitor_queries={competitor_queries} | "
            f"selected_competitors={selected_competitors} | "
            f"market_queries={market_queries} | "
            f"selected_market={selected_market} | "
            f"cache_hit={cache_hit} | "
            f"relevance_filtering_counts={relevance_filtering_counts} | "
            f"fields_used={profile_fields_used} | "
            f"fields_missing={profile_fields_missing} | "
            f"evidence_counts={evidence_counts} | "
            f"models_run={sufficiency_summary} | "
            f"recommendation={final_rec} | "
            f"risk={final_risk} | "
            f"confidence={confidence_level}"
        )

        # 8. Final Assembled Report matching Section 9 & Section 22 Schema
        limitations = [
            "ML models establish correlational scenario projections conditioned on input state; they do NOT establish causal certainty.",
            "Model 1 (Revenue): Ridge regression and Naive persistence perform competitively on flat accounts; single-month forward horizon.",
            "Model 2 (Startup Risk): Stage-0 classification calibrated to BLS survival rates with ROC-AUC ~0.68; provides risk estimate rather than guaranteed outcome."
        ]
        if coverage_status == "PARTIALLY_SUPPORTED":
            limitations.append("Decision parameters mapped through proxy variables (tier classifications, seat counts, compensation burn).")
        elif coverage_status == "UNSUPPORTED":
            limitations.append("Decision type is unsupported and unmapped in ML feature space; evaluated strictly via heuristic financial guidelines.")

        return {
            "decision": structured_decision,
            "simulation_engine": scenario_report.get("simulation_engine", "MODEL_POWERED"),
            "coverage_status": coverage_status,
            "company_context": {
                "profile_source": context_data.get("company_profile", {}).get("source", "database"),
                "canonical_metrics": context_data.get("canonical_metrics", {}),
                "data_quality": context_data.get("data_quality", {}),
                "missing_metrics": context_data.get("data_quality", {}).get("missing_metrics", []),
                "rag_documents_matched": {
                    "count": len(context_data.get("evidence", {}).get("documents", [])),
                    "titles": [doc.get("finding", "")[:60] for doc in context_data.get("evidence", {}).get("documents", [])]
                }
            },
            "predictions": scenario_report.get("predictions", {}),
            "baseline": {
                "metrics": scenario_report.get("state_changes", {}).get("baseline", {}),
                "revenue_forecast": scenario_report.get("comparison", {}).get("revenue_forecast", {}).get("baseline_mrr"),
                "churn_probability": scenario_report.get("comparison", {}).get("churn_risk", {}).get("baseline_probability"),
                "failure_probability": scenario_report.get("comparison", {}).get("startup_failure_risk", {}).get("baseline_probability")
            },
            "scenario": {
                "metrics": scenario_report.get("state_changes", {}).get("scenario", {}),
                "revenue_forecast": scenario_report.get("comparison", {}).get("revenue_forecast", {}).get("scenario_mrr"),
                "churn_probability": scenario_report.get("comparison", {}).get("churn_risk", {}).get("scenario_probability"),
                "failure_probability": scenario_report.get("comparison", {}).get("startup_failure_risk", {}).get("scenario_probability")
            },
            "impact": synthesis.get("impact", deterministic_synth["impact"]),
            "risk": {
                "level": final_risk,
                "factors": synthesis.get("risk_factors", deterministic_synth["risk_factors"])
            },
            "evidence": evidence,
            "assumptions": scenario_report.get("assumptions", []),
            "limitations": limitations,
            "recommendation": final_rec,
            "recommendation_reasoning": synthesis.get("recommendation_reasoning", deterministic_synth["recommendation_reasoning"]),
            "confidence": confidence_level,
            "confidence_reasoning": confidence_reasoning,
            "ai_cofounder_explanation": synthesis.get("ai_cofounder_explanation", deterministic_synth["ai_cofounder_explanation"]),
            "model_metadata": {
                "model_version": "v1.0.0",
                "drivers": scenario_report.get("drivers", []),
                "causal_disclaimer": "All values represent model-based scenario estimates conditioned on input states. The trained models establish statistical associations, NOT guaranteed causal effects."
            }
        }


def get_decision_intelligence_service() -> DecisionIntelligenceService:
    return DecisionIntelligenceService()
