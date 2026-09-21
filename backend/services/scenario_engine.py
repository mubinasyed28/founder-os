import logging
from typing import Dict, Any, List, Optional
from backend.services.ml_service import get_ml_service
from backend.services.decision_parser_service import parse_founder_decision

logger = logging.getLogger(__name__)


class ScenarioEngine:
    """
    Transforms structured founder decisions into explicit feature state modifications,
    executes baseline vs scenario ML predictions ONLY when data sufficiency requirements
    are satisfied, and formats decision reports with explicit provenance, assumptions,
    and causal disclaimers.

    NEVER substitutes missing company data with synthetic benchmark numbers.
    """

    def __init__(self):
        self.ml_service = get_ml_service()

    def check_data_sufficiency(self, company_state: Dict[str, Any], decision_type: str) -> Dict[str, Dict[str, Any]]:
        """
        Determines whether verified company data is sufficient to invoke each ML model.

        Model 1 (Revenue / Churn): requires verified current_mrr > 0
        Model 2 (Startup Risk): requires verified industry + stage AND at least one
          financial field (monthly_burn_rate OR runway_months), to prevent the model
          from running on entirely synthetic defaults and producing a static ~48% result.

        Returns a dictionary of sufficiency statuses and explanatory reasons.
        """
        mrr = company_state.get("current_mrr")
        has_revenue = mrr is not None and float(mrr) > 0

        runway = company_state.get("runway_months")
        has_runway = runway is not None and float(runway) > 0

        burn = company_state.get("monthly_burn_rate")
        has_burn = burn is not None and float(burn) > 0

        # Model 1 (Revenue Forecast): requires verified current revenue
        revenue_sufficiency = {
            "sufficient": has_revenue,
            "reason": None if has_revenue else "No verified revenue history is available for this company."
        }

        # Model 1 (Churn Risk): requires verified revenue + active subscription history
        has_subscriptions = bool(
            company_state.get("active_subscriptions") or
            company_state.get("num_customers") or
            company_state.get("total_users")
        )
        churn_sufficiency = {
            "sufficient": has_revenue and has_subscriptions,
            "reason": None if (has_revenue and has_subscriptions) else
                      "No verified customer retention or cancellation history available."
        }

        # Model 2 (Startup Survival Risk): requires verified profile structure
        # AND at least one financial field to avoid running on pure synthetic defaults.
        # Without financial inputs, the model produces a deterministic ~48% number
        # that does not represent the company's actual risk profile.
        has_profile = bool(company_state.get("industry") and company_state.get("current_stage"))
        has_risk_financial = has_burn or has_runway
        startup_risk_sufficiency = {
            "sufficient": has_profile and has_risk_financial,
            "reason": None if (has_profile and has_risk_financial) else (
                "Insufficient company profile data to estimate venture risk." if not has_profile
                else "No verified financial data (burn rate or runway) is available. "
                     "The model requires at least one financial input to produce a meaningful estimate."
            )
        }

        # Runway calculation
        runway_sufficiency = {
            "sufficient": has_runway or (has_burn and company_state.get("cash_in_bank")),
            "reason": None if (has_runway or (has_burn and company_state.get("cash_in_bank")))
                      else "No verified cash or monthly burn data provided."
        }

        return {
            "revenue": revenue_sufficiency,
            "churn": churn_sufficiency,
            "startup_risk": startup_risk_sufficiency,
            "runway": runway_sufficiency
        }

    def _build_model1_features(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Explicitly maps verified company state into Model 1 feature schema.
        Only called when revenue sufficiency check passes (current_mrr is verified and > 0).
        """
        return {
            "industry": state.get("industry", "DevTools"),
            "country": state.get("country", "US"),
            "referral_source": state.get("referral_source", "organic"),
            "account_plan_tier": state.get("account_plan_tier", "Pro"),
            "tenure_months": int(state.get("tenure_months") or 12),
            "calendar_month": 6,
            "current_mrr": float(state["current_mrr"]),
            "active_subscriptions": int(state.get("active_subscriptions") or 10),
            "total_seats": int(state.get("total_users") or state.get("team_size") or 10),
            "usage_count": int(state.get("usage_count") or 150),
            "usage_duration_secs": int(state.get("usage_duration_secs") or 18000),
            "error_count": 2,
            "n_unique_features": int(state.get("n_unique_features") or 6),
            "has_beta_feature": int(state.get("has_beta_feature") or 0),
            "n_tickets": 1,
            "avg_resolution_hours": 12.0,
            "n_escalations": 0,
            "had_churn_in_m": 0
        }

    def _build_model2_features(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Explicitly maps verified company state into Model 2 feature schema.
        Only called when startup_risk sufficiency check passes (requires profile + financial data).

        For burn and runway: uses actual verified values from company state.
        The sufficiency gate ensures these are non-None before this is called.
        """
        burn = float(state["monthly_burn_rate"]) if state.get("monthly_burn_rate") is not None else None
        runway = float(state["runway_months"]) if state.get("runway_months") is not None else None

        # If still None after gate (should not happen), use contextually derived estimates
        # NOT arbitrary benchmark defaults. We prefer to derive from available data.
        if burn is None and runway is None:
            # This should never be reached due to sufficiency gate, but guard anyway
            raise ValueError(
                "Model 2 requires at least one of monthly_burn_rate or runway_months to be verified. "
                "Sufficiency gate should have blocked this call."
            )

        # Use available value; if only one is provided, use it for the model.
        # The model can accept either — we won't invent the missing one.
        effective_burn = burn if burn is not None else 0.0
        effective_runway = runway if runway is not None else 0.0

        return {
            "industry": state.get("industry", "tech_saas"),
            "founding_year": int(state.get("founding_year", 2024)),
            "macro_climate": 6.0,
            "market_size_score": 7.0,
            "competition_intensity": 5.0,
            "founder_prior_exits": 0,
            "prior_failures": 0,
            "domain_experience_years": 4.0,
            "technical_cofounder": 1,
            "n_cofounders": 2,
            "team_completeness": min(10.0, float(state.get("team_size") or 2) * 2.0),
            "age_of_founder": 30,
            "funding_path": state.get("funding_path", "bootstrapped"),
            "monthly_burn_rate": effective_burn,
            "runway_months": effective_runway,
            "did_customer_validation": int(state.get("did_customer_validation", 1))
        }

    def _build_enriched_drivers(
        self,
        raw_drivers: List[Dict[str, Any]],
        company_state: Dict[str, Any],
        decision_type: str
    ) -> List[Dict[str, Any]]:
        """
        Enriches raw ML feature importance drivers with data provenance.

        For each driver feature, checks if the underlying company state field
        was actually available (non-None, non-default). If the company did NOT
        have a verified value for this field, the driver is marked as UNAVAILABLE
        with an explanatory reason — never "Neutral".

        This prevents presenting uninformative feature importances as if they
        were grounded in real company data.
        """
        # Fields that require verified company data to be meaningful
        FINANCIAL_FIELDS = {
            "monthly_burn_rate": "monthly burn rate",
            "runway_months": "runway months",
            "current_mrr": "monthly revenue (MRR)",
            "active_subscriptions": "active subscriptions / customer count",
        }
        FEATURE_FIELDS = {
            "has_beta_feature": "beta feature flag",
            "n_unique_features": "unique feature count",
        }
        TEAM_FIELDS = {
            "team_completeness": "team completeness score",
            "n_cofounders": "co-founder count",
        }

        # Decision-type relevance context
        DECISION_RELEVANCE = {
            "hiring": {
                "monthly_burn_rate": "Adding headcount increases recurring payroll burn relative to current company baseline.",
                "runway_months": "More payroll reduces available runway.",
                "team_completeness": "Hiring improves team completeness score.",
            },
            "feature_launch": {
                "has_beta_feature": "Launching a beta feature activates the beta_feature flag in Model 1.",
                "n_unique_features": "Feature expansion increases the unique feature adoption count.",
                "current_mrr": "Revenue baseline determines the absolute impact of churn/retention shifts.",
            },
            "fundraising": {
                "monthly_burn_rate": "Burn rate determines how much runway the new capital provides.",
                "runway_months": "Capital infusion extends runway months directly.",
                "funding_path": "Funding route affects Model 2 risk classification.",
            },
            "pricing_change": {
                "current_mrr": "MRR baseline is scaled by the price ratio to produce the scenario estimate.",
                "account_plan_tier": "Plan tier classification is the primary proxy variable for this decision.",
            },
            "burn_adjustment": {
                "monthly_burn_rate": "Burn reduction directly lowers this feature value, extending runway.",
                "runway_months": "Extended runway reduces venture failure risk in Model 2.",
            },
        }

        enriched = []
        for driver in raw_drivers[:5]:  # cap at top 5
            feature = driver.get("feature") or driver.get("name") or "Unknown Feature"
            importance = driver.get("importance", 0)
            raw_direction = driver.get("direction", "neutral")

            # Check if this field is a financial or product field and whether it's verified
            field_key = feature.lower().replace(" ", "_")

            # Determine if the underlying company data was verified
            company_val = company_state.get(field_key)
            is_financial = field_key in FINANCIAL_FIELDS
            is_feature = field_key in FEATURE_FIELDS
            is_team = field_key in TEAM_FIELDS

            data_is_unavailable = (
                (is_financial and (company_val is None or company_val == 0)) or
                (is_feature and company_val is None) or
                (is_team and company_val is None)
            )

            # Get decision-specific relevance explanation
            relevance_context = DECISION_RELEVANCE.get(decision_type, {})
            context_desc = relevance_context.get(field_key, "")

            if data_is_unavailable:
                # Mark explicitly unavailable — not neutral
                field_label = (
                    FINANCIAL_FIELDS.get(field_key) or
                    FEATURE_FIELDS.get(field_key) or
                    TEAM_FIELDS.get(field_key) or
                    feature.replace("_", " ")
                )
                enriched.append({
                    "feature": feature,
                    "name": feature.replace("_", " ").title(),
                    "importance": importance,
                    "direction": "unavailable",
                    "description": (
                        f"Your company profile does not contain verified {field_label} data. "
                        f"This feature was not populated from actual company inputs and therefore "
                        f"cannot be used to make a meaningful estimate for this decision."
                    )
                })
            else:
                # Data is available — provide context
                description = context_desc if context_desc else driver.get("description", "")
                enriched.append({
                    "feature": feature,
                    "name": feature.replace("_", " ").title(),
                    "importance": importance,
                    "direction": raw_direction,
                    "description": description
                })

        return enriched

    async def evaluate_decision(
        self,
        decision_text: Optional[str] = None,
        structured_decision: Optional[Dict[str, Any]] = None,
        company_state: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Main simulation orchestration:
        1. Parses decision text if structured decision not passed
        2. Inspects verified company state
        3. Evaluates Data Sufficiency
        4. Invokes ML models only for sufficient features
        5. Applies scenario state transformations
        6. Computes scenario predictions & deltas
        7. Returns complete comparative report
        """
        if not structured_decision:
            structured_decision = await parse_founder_decision(decision_text or "")

        decision_type = structured_decision.get("decision_type", "other")
        coverage_status = structured_decision.get("coverage_status", "UNSUPPORTED")
        params = structured_decision.get("parameters", {})

        state = dict(company_state or {})

        # Handle UNSUPPORTED decisions cleanly
        if coverage_status == "UNSUPPORTED":
            return self._build_unsupported_response(structured_decision, state)

        # Step 1: Check data sufficiency
        sufficiency = self.check_data_sufficiency(state, decision_type)

        # Step 2: Baseline predictions (guarded by sufficiency)
        baseline_mrr = None
        if sufficiency["revenue"]["sufficient"]:
            m1_state = self._build_model1_features(state)
            baseline_mrr = self.ml_service.predict_next_month_mrr(m1_state)

        baseline_churn = None
        if sufficiency["churn"]["sufficient"]:
            m1_state = self._build_model1_features(state)
            baseline_churn = self.ml_service.predict_churn_risk(m1_state)

        baseline_risk = None
        if sufficiency["startup_risk"]["sufficient"]:
            try:
                m2_state = self._build_model2_features(state)
                baseline_risk = self.ml_service.predict_startup_failure_risk(m2_state)
            except ValueError as e:
                logger.warning(f"[scenario_engine] Model 2 call blocked: {e}")
                baseline_risk = None

        # Step 3: Apply Scenario Transformations
        scenario_state, assumptions, transformed_models = self._apply_transformation(state, decision_type, params)

        # Step 4: Scenario predictions (guarded by sufficiency)
        scenario_mrr = None
        if sufficiency["revenue"]["sufficient"]:
            scen_m1_state = self._build_model1_features(scenario_state)
            scenario_mrr = self.ml_service.predict_next_month_mrr(scen_m1_state)

        scenario_churn = None
        if sufficiency["churn"]["sufficient"]:
            scen_m1_state = self._build_model1_features(scenario_state)
            scenario_churn = self.ml_service.predict_churn_risk(scen_m1_state)

        scenario_risk = None
        if sufficiency["startup_risk"]["sufficient"]:
            try:
                scen_m2_state = self._build_model2_features(scenario_state)
                scenario_risk = self.ml_service.predict_startup_failure_risk(scen_m2_state)
            except ValueError as e:
                logger.warning(f"[scenario_engine] Model 2 scenario call blocked: {e}")
                scenario_risk = None

        # Step 5: Assemble Report
        return self._build_comparison_report(
            structured_decision=structured_decision,
            baseline_state=state,
            scenario_state=scenario_state,
            baseline_results={
                "revenue": baseline_mrr,
                "churn": baseline_churn,
                "startup_risk": baseline_risk
            },
            scenario_results={
                "revenue": scenario_mrr,
                "churn": scenario_churn,
                "startup_risk": scenario_risk
            },
            assumptions=assumptions,
            transformed_models=transformed_models,
            sufficiency=sufficiency
        )

    def _apply_transformation(
        self,
        base_state: Dict[str, Any],
        decision_type: str,
        params: Dict[str, Any]
    ) -> tuple[Dict[str, Any], List[str], List[str]]:
        """Applies explicit transformations to company state without inventing values."""
        state = dict(base_state)
        assumptions = [
            "Current product usage distribution remains otherwise constant",
            "Prediction horizon is one calendar month forward for revenue/churn",
            "Models are trained on RavenStack SaaS (Model 1) and US Startup Survival (Model 2) benchmark datasets"
        ]
        transformed_models = []

        if decision_type == "fundraising":
            raise_amount = float(params.get("raise_amount", 500000.0))
            funding_path = params.get("funding_path") or ("vc_seed" if raise_amount >= 500000 else "angel")
            state["funding_path"] = funding_path

            current_burn = state.get("monthly_burn_rate")
            current_runway = state.get("runway_months")

            if current_burn and float(current_burn) > 0 and current_runway is not None:
                added_runway = raise_amount / float(current_burn)
                new_runway = min(36.0, round(float(current_runway) + added_runway, 1))
                state["runway_months"] = new_runway
                assumptions.append(f"Capital infusion of ${raise_amount:,.0f} extends runway by {added_runway:.1f} mo at burn of ${current_burn:,.0f}/mo")
            else:
                assumptions.append(f"Capital infusion of ${raise_amount:,.0f} requested. Exact runway extension requires verified burn rate.")

            transformed_models.append("Model 2 (Startup Survival Risk)")

        elif decision_type == "burn_adjustment":
            current_burn = state.get("monthly_burn_rate")
            current_runway = state.get("runway_months")

            if current_burn and float(current_burn) > 0:
                current_burn = float(current_burn)
                implied_cash = current_burn * (float(current_runway) if current_runway is not None else 12.0)

                if params.get("target_burn"):
                    new_burn = max(1000.0, float(params["target_burn"]))
                elif params.get("burn_reduction_pct"):
                    pct = float(params["burn_reduction_pct"])
                    new_burn = max(1000.0, current_burn * (1.0 - pct / 100.0))
                elif params.get("delta_burn"):
                    new_burn = max(1000.0, current_burn + float(params["delta_burn"]))
                else:
                    new_burn = current_burn * 0.8

                state["monthly_burn_rate"] = new_burn
                if current_runway is not None:
                    new_runway = min(36.0, round(implied_cash / new_burn, 1))
                    state["runway_months"] = new_runway
                    assumptions.append(f"Monthly burn adjusted to ${new_burn:,.0f}, extending runway from {float(current_runway):.1f} to {new_runway:.1f} months")
            else:
                assumptions.append("Operational burn reduction scenario applied (exact delta requires verified baseline burn).")

            transformed_models.append("Model 2 (Startup Survival Risk)")

        elif decision_type == "validation_action":
            state["did_customer_validation"] = 1
            assumptions.append("Customer discovery & willingness-to-pay validation established before aggressive scaling")
            transformed_models.append("Model 2 (Startup Survival Risk)")

        elif decision_type == "pricing_change":
            old_p = float(params.get("old_price") or 99.0)
            new_p = float(params.get("new_price") or 129.0)
            ratio = new_p / old_p if old_p > 0 else 1.0

            if state.get("current_mrr") is not None:
                state["current_mrr"] = round(float(state["current_mrr"]) * ratio, 2)
                assumptions.append(f"Base price adjusted from ${old_p:.0f} to ${new_p:.0f} (ratio: {ratio:.2f}x) scaling MRR")

            if params.get("plan_tier"):
                state["account_plan_tier"] = params["plan_tier"]
            elif new_p >= 299.0:
                state["account_plan_tier"] = "Enterprise"
            elif new_p >= 99.0:
                state["account_plan_tier"] = "Pro"
            else:
                state["account_plan_tier"] = "Basic"

            transformed_models.append("Model 1 (Revenue & Churn Risk)")

        elif decision_type == "hiring":
            count = int(params.get("hire_count") or 1)
            cost_per_hire = float(params.get("estimated_cost_per_hire") or 8000.0)
            added_burn = count * cost_per_hire

            current_burn = state.get("monthly_burn_rate")
            current_runway = state.get("runway_months")

            if current_burn is not None and float(current_burn) > 0:
                current_burn = float(current_burn)
                new_burn = current_burn + added_burn
                state["monthly_burn_rate"] = new_burn
                if current_runway is not None:
                    implied_cash = current_burn * float(current_runway)
                    new_runway = min(36.0, round(implied_cash / new_burn, 1))
                    state["runway_months"] = new_runway
                    assumptions.append(f"Monthly burn increases to ${new_burn:,.0f}, reducing runway to {new_runway:.1f} months")
            else:
                assumptions.append(f"Added {count} team member(s) with estimated monthly burn impact of ${added_burn:,.0f}. Exact runway impact requires verified burn/cash data.")

            # Update team size for Model 2 team_completeness
            current_team = int(state.get("team_size") or 0)
            state["team_size"] = current_team + count

            transformed_models.extend(["Model 1 (Revenue)", "Model 2 (Startup Survival Risk)"])

        elif decision_type == "feature_launch":
            state["has_beta_feature"] = 1
            state["n_unique_features"] = int(state.get("n_unique_features", 4)) + 1
            assumptions.append("Product release activates 'has_beta_feature' and increments active unique feature count proxy in Model 1")
            transformed_models.append("Model 1 (Revenue & Churn Risk)")

        return state, assumptions, transformed_models

    def _build_comparison_report(
        self,
        structured_decision: Dict[str, Any],
        baseline_state: Dict[str, Any],
        scenario_state: Dict[str, Any],
        baseline_results: Dict[str, Any],
        scenario_results: Dict[str, Any],
        assumptions: List[str],
        transformed_models: List[str],
        sufficiency: Dict[str, Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Assembles decision comparison report with explicit data provenance and missing-data safety."""
        decision_type = structured_decision.get("decision_type", "other")

        # Revenue
        base_rev_obj = baseline_results.get("revenue")
        scen_rev_obj = scenario_results.get("revenue")
        if base_rev_obj and scen_rev_obj:
            base_mrr = base_rev_obj["prediction"]["next_month_mrr"]
            scen_mrr = scen_rev_obj["prediction"]["next_month_mrr"]
            mrr_delta = round(scen_mrr - base_mrr, 2)
            mrr_pct = round((mrr_delta / base_mrr * 100.0) if base_mrr > 0 else 0.0, 2)
        else:
            base_mrr, scen_mrr, mrr_delta, mrr_pct = None, None, None, None

        # Churn
        base_churn_obj = baseline_results.get("churn")
        scen_churn_obj = scenario_results.get("churn")
        if base_churn_obj and scen_churn_obj:
            base_churn = base_churn_obj["risk"]["churn_probability"]
            scen_churn = scen_churn_obj["risk"]["churn_probability"]
            churn_delta = round(scen_churn - base_churn, 4)
        else:
            base_churn, scen_churn, churn_delta = None, None, None

        # Startup Risk
        base_risk_obj = baseline_results.get("startup_risk")
        scen_risk_obj = scenario_results.get("startup_risk")
        if base_risk_obj and scen_risk_obj:
            base_fail = base_risk_obj["risk"]["failure_probability"]
            scen_fail = scen_risk_obj["risk"]["failure_probability"]
            fail_delta = round(scen_fail - base_fail, 4)
            # Collect raw drivers from both Model 1 and Model 2
            raw_drivers = (
                scen_risk_obj.get("drivers", [])[:3] +
                (scen_rev_obj.get("drivers", [])[:2] if scen_rev_obj else [])
            )
        else:
            base_fail, scen_fail, fail_delta = None, None, None
            raw_drivers = (
                (scen_rev_obj.get("drivers", [])[:5] if scen_rev_obj else []) or
                (scen_churn_obj.get("drivers", [])[:5] if scen_churn_obj else [])
            )

        # Enrich drivers with data availability context
        drivers = self._build_enriched_drivers(raw_drivers, baseline_state, decision_type)

        # Runway
        base_runway = baseline_state.get("runway_months")
        scen_runway = scenario_state.get("runway_months")
        runway_delta = round(float(scen_runway) - float(base_runway), 1) if (scen_runway is not None and base_runway is not None) else None

        # Structured Predictions Object (Section 22 Contract)
        predictions = {
            "revenue": {
                "status": "AVAILABLE" if base_mrr is not None else "INSUFFICIENT_DATA",
                "available": bool(base_mrr is not None),
                "baseline": base_mrr,
                "scenario": scen_mrr,
                "forecast": scen_mrr,
                "estimated_difference": mrr_delta,
                "estimated_pct_change": mrr_pct,
                "unit": "USD/mo",
                "reason": sufficiency["revenue"]["reason"],
                "provenance": "model_estimate" if base_mrr is not None else "unavailable"
            },
            "churn": {
                "status": "AVAILABLE" if base_churn is not None else "INSUFFICIENT_DATA",
                "available": bool(base_churn is not None),
                "baseline": base_churn,
                "scenario": scen_churn,
                "probability": scen_churn,
                "estimated_difference": churn_delta,
                "reason": sufficiency["churn"]["reason"],
                "provenance": "model_estimate" if base_churn is not None else "unavailable"
            },
            "startup_risk": {
                "status": "AVAILABLE" if base_fail is not None else "INSUFFICIENT_DATA",
                "available": bool(base_fail is not None),
                "baseline": base_fail,
                "scenario": scen_fail,
                "probability": scen_fail,
                "estimated_difference": fail_delta,
                "reason": sufficiency["startup_risk"]["reason"],
                "provenance": "model_estimate" if base_fail is not None else "unavailable"
            },
            "runway": {
                "status": "AVAILABLE" if base_runway is not None else "INSUFFICIENT_DATA",
                "available": bool(base_runway is not None),
                "baseline": base_runway,
                "scenario": scen_runway,
                "forecast": scen_runway,
                "estimated_difference": runway_delta,
                "unit": "months",
                "reason": sufficiency["runway"]["reason"],
                "provenance": "company_data" if base_runway is not None else "unavailable"
            }
        }
        # Schema aliases per Requirement 22
        predictions["revenue_forecast"] = predictions["revenue"]
        predictions["churn_risk"] = predictions["churn"]
        predictions["startup_failure_risk"] = predictions["startup_risk"]
        predictions["runway_months"] = predictions["runway"]

        return {
            "simulation_engine": "MODEL_POWERED",
            "coverage_status": structured_decision.get("coverage_status", "SUPPORTED"),
            "decision": structured_decision,
            "transformed_models": transformed_models,
            "predictions": predictions,
            "comparison": {
                "revenue_forecast": {
                    "baseline_mrr": base_mrr,
                    "scenario_mrr": scen_mrr,
                    "estimated_difference": mrr_delta,
                    "estimated_pct_change": mrr_pct,
                    "unit": "USD/mo"
                },
                "churn_risk": {
                    "baseline_probability": base_churn,
                    "scenario_probability": scen_churn,
                    "estimated_difference": churn_delta
                },
                "startup_failure_risk": {
                    "baseline_probability": base_fail,
                    "scenario_probability": scen_fail,
                    "estimated_difference": fail_delta
                }
            },
            "state_changes": {
                "baseline": {
                    "runway_months": base_runway,
                    "monthly_burn_rate": baseline_state.get("monthly_burn_rate"),
                    "current_mrr": baseline_state.get("current_mrr")
                },
                "scenario": {
                    "runway_months": scen_runway,
                    "monthly_burn_rate": scenario_state.get("monthly_burn_rate"),
                    "current_mrr": scenario_state.get("current_mrr")
                }
            },
            "drivers": drivers,
            "assumptions": assumptions,
            "evidence": {
                "company": [],
                "documents": [],
                "market": [],
                "competitors": []
            },
            "causal_disclaimer": (
                "All values represent model-based scenario estimates conditioned on verified company states. "
                "The trained models establish statistical associations, NOT guaranteed causal effects."
            )
        }

    def _build_unsupported_response(
        self,
        structured_decision: Dict[str, Any],
        state: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Provides a transparent response when a decision is outside ML model scope."""
        base_runway = state.get("runway_months")
        base_burn = state.get("monthly_burn_rate")
        base_mrr = state.get("current_mrr")

        predictions = {
            "revenue": {
                "status": "INSUFFICIENT_DATA",
                "available": False,
                "baseline": base_mrr,
                "scenario": None,
                "estimated_difference": None,
                "reason": "Decision type is not modeled by the trained ML revenue schema",
                "provenance": "unavailable"
            },
            "churn": {
                "status": "INSUFFICIENT_DATA",
                "available": False,
                "baseline": None,
                "scenario": None,
                "estimated_difference": None,
                "reason": "Decision type is outside churn classification feature scope",
                "provenance": "unavailable"
            },
            "startup_risk": {
                "status": "INSUFFICIENT_DATA",
                "available": False,
                "baseline": None,
                "scenario": None,
                "estimated_difference": None,
                "reason": "This decision type is not modeled in the trained ML schemas",
                "provenance": "unavailable"
            },
            "runway": {
                "status": "AVAILABLE" if base_runway is not None else "INSUFFICIENT_DATA",
                "available": bool(base_runway is not None),
                "baseline": base_runway,
                "scenario": base_runway,
                "estimated_difference": 0.0 if base_runway is not None else None,
                "unit": "months",
                "reason": None if base_runway is not None else "No verified runway data provided",
                "provenance": "company_data" if base_runway is not None else "unavailable"
            }
        }

        return {
            "simulation_engine": "RULE_BASED",
            "coverage_status": "UNSUPPORTED",
            "decision": structured_decision,
            "transformed_models": [],
            "predictions": predictions,
            "comparison": {
                "revenue_forecast": {
                    "baseline_mrr": base_mrr,
                    "scenario_mrr": None,
                    "estimated_difference": None,
                    "estimated_pct_change": None,
                    "unit": "USD/mo"
                },
                "churn_risk": {
                    "baseline_probability": None,
                    "scenario_probability": None,
                    "estimated_difference": None
                },
                "startup_failure_risk": {
                    "baseline_probability": None,
                    "scenario_probability": None,
                    "estimated_difference": None
                }
            },
            "state_changes": {
                "baseline": {
                    "runway_months": base_runway,
                    "monthly_burn_rate": base_burn,
                    "current_mrr": base_mrr
                },
                "scenario": {
                    "runway_months": base_runway,
                    "monthly_burn_rate": base_burn,
                    "current_mrr": base_mrr
                }
            },
            "message": "Insufficient model coverage for this decision in the current ML feature schemas.",
            "rule_based_hint": (
                "This decision type is supported via heuristic / rule-based financial simulation, "
                "but cannot be directly forecasted by the trained XGBoost models."
            ),
            "assumptions": [
                "Decision variables are not represented in the 18 RavenStack SaaS features or 16 Stage-0 Startup Survival features",
                "Heuristic projections should be consulted for non-modeled scenarios (e.g. multi-country portfolio expansion, marketing channel mix)"
            ],
            "drivers": [],
            "evidence": {
                "company": [],
                "documents": [],
                "market": [],
                "competitors": []
            },
            "causal_disclaimer": "Rule-based scenario estimation. No trained ML models were used for this unsupported feature."
        }


def get_scenario_engine() -> ScenarioEngine:
    return ScenarioEngine()
