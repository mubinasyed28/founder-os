# Stage 5 Decision Intelligence Fix Report: Feature Launch Routing & Evidence Pipeline

## 1. Executive Summary
During conversational evaluation of the Decision Simulator with the input:
> *"Launch a maps feature where users can connect with people in their area and hangout"*

The system previously misclassified the intent as `decision_type = "other"` with `coverage = "Rule-Based"`, resulting in `null` metric comparison states (`—`) and a fallback explanation claiming evaluation was conducted via heuristic financial benchmarks.

This issue has been resolved. Natural language feature launches and product capability expansions are now recognized and routed through the trained Model 1 ML pipeline (`has_beta_feature` and `n_unique_features`), producing grounded baseline vs. scenario comparisons, multi-tab evidence, and authoritative AI Co-Founder recommendations.

---

## 2. Root Cause Analysis

1. **LLM API Fallback**: The parser attempts an extraction call to the Mistral API. When the API key is expired, rate-limited, or forbidden (HTTP 403), the parser correctly invokes `_rule_based_fallback_parse`.
2. **Brittle String Substring Matching**: The deterministic fallback parser previously used strict two-word substring checks:
   ```python
   # Previous implementation
   if any(w in text_lower for w in ["launch feature", "build feature", "ship feature", "beta"]):
   ```
   Intervening adjectives, feature names, or conversational phrasing (e.g. `"Launch a maps feature..."`, `"I want to add a marketplace"`, `"Introduce team collaboration"`) prevented matching, causing the parser to drop through to `other` / `UNSUPPORTED`.
3. **Empty Metric Deltas in Unsupported State**: In `scenario_engine.py`, `_build_unsupported_response` previously returned no `comparison` or `state_changes` keys. In `decision_intelligence_service.py`, this caused baseline and scenario metric lookups to resolve to `None`, rendering `—` across all cards in the frontend.
4. **Evidence Tab Filtering**: In `app.simulator.tsx`, `EvidenceSection` filtered out categories with 0 items, preventing founders from seeing whether documents or external market research had been checked.

---

## 3. Files Changed

| File | Changes Made |
| :--- | :--- |
| [`backend/services/decision_parser_service.py`](file:///c:/Users/YOCKET-271/Documents/GitHub/founder-os/backend/services/decision_parser_service.py) | • Enhanced `DECISION_PARSER_SYSTEM_PROMPT` with feature launch few-shot schemas.<br>• Replaced rigid substring matching in `_rule_based_fallback_parse` with regex patterns covering creation verbs (`launch`, `build`, `ship`, `release`, `roll out`, `add`, `introduce`), feature domain nouns (`maps`, `marketplace`, `social discovery`, `collaboration`, `community`), user-action intents (`users can connect`, `allow users to`), and beta flags.<br>• Extracted structured parameters (`action`, `feature_name`, `goal`, `confidence`). |
| [`backend/services/scenario_engine.py`](file:///c:/Users/YOCKET-271/Documents/GitHub/founder-os/backend/services/scenario_engine.py) | • Verified Model 1 proxy mapping (`has_beta_feature = 1`, `n_unique_features = n + 1`).<br>• Enhanced `_build_unsupported_response` to include baseline state values and explicit `None` scenario targets, ensuring predictable schema contracts. |
| [`backend/services/decision_intelligence_service.py`](file:///c:/Users/YOCKET-271/Documents/GitHub/founder-os/backend/services/decision_intelligence_service.py) | • Tailored `_determine_recommendation_and_risk` for `feature_launch` using actual baseline MRR, scenario MRR, deltas, and non-causal disclosures.<br>• Eliminated false claims of heuristic financial evaluation for supported ML paths.<br>• Safely handled `None` for unsupported scenario probabilities without raising `TypeError`. |
| [`src/routes/app.simulator.tsx`](file:///c:/Users/YOCKET-271/Documents/GitHub/founder-os/src/routes/app.simulator.tsx) | • Updated `EvidenceSection` to display all 4 categories (`Company`, `Documents`, `Competitors`, `Market`) with counts and dedicated empty state messages.<br>• Updated `MetricCompare` to render `"Not available for this scenario"` when a metric is unsupported/null instead of `—`.<br>• Updated coverage tag to render `ML-Powered / Partial` for `PARTIALLY_SUPPORTED`.<br>• Updated trajectory disclaimer to explicitly state when rule-based simulation is used. |
| [`backend/tests/test_feature_launch_intelligence.py`](file:///c:/Users/YOCKET-271/Documents/GitHub/founder-os/backend/tests/test_feature_launch_intelligence.py) | • Added 22 natural language test cases for feature launch variants.<br>• Added regression protection tests for all 7 existing decisions.<br>• Added full integration tests for `POST /api/simulator/intelligence` testing maps prompt execution and unsupported fallback. |

---

## 4. End-to-End API Flow for Feature Launches

```
Founder Input: "Launch a maps feature where users can connect with people in their area and hangout"
                                    │
                                    ▼
       POST /api/simulator/intelligence (FastAPI Router)
                                    │
                                    ▼
             Decision Parser (LLM or Enhanced Fallback)
         • decision_type: "feature_launch"
         • coverage_status: "PARTIALLY_SUPPORTED"
         • simulation_engine: "MODEL_POWERED"
         • feature_name: "maps feature"
         • action: "launch"
         • goal: "users can connect with people in their area and hangout"
                                    │
                                    ▼
       Company Context Service (RAG + Profile + Competitor + Market)
         • Baseline MRR: $10,000 | Monthly Burn: $20,000 | Runway: 12.0 mo
         • Evidence: Company (2 items), Documents, Competitors (3 items), Market
                                    │
                                    ▼
                     Scenario Engine & ML Service
         • Baseline State: has_beta_feature=0, n_unique_features=6
         • Scenario State: has_beta_feature=1, n_unique_features=7
         • Model 1 (Revenue): $11,648 -> $11,863 (+ $215/mo, +1.85%)
         • Model 1 (Churn): 0.15% -> 0.14% (-0.01%)
         • Model 2 (Survival Risk): 53.45% (Stage 0 baseline preserved)
                                    │
                                    ▼
              Evidence-Grounded Intelligence Synthesis
         • Recommendation: "Proceed with caution"
         • AI Co-Founder: "The current company state provides the baseline ($11,648/mo MRR, 12.0 months runway).
           The proposed feature is evaluated using the feature-launch scenario mapping available in the trained models
           (projected scenario MRR: $11,863/mo, delta: +$215/mo)..."
                                    │
                                    ▼
            Frontend Simulator View (/app/simulator)
         • Tag: Feature Launch | ML-Powered / Partial
         • Projected Impact: All 4 cards populated (MRR, Churn, Runway, Failure Risk)
         • Evidence: All 4 tabs active with accurate count badges
```

---

## 5. Verification & Test Results

### Test Suite Execution
```bash
python -m pytest backend/tests/test_feature_launch_intelligence.py backend/tests/test_decision_intelligence.py backend/tests/test_ml_serving.py -v
```

**Results: 28 PASSED, 0 FAILED**
- `test_feature_launch_intelligence.py`: 4/4 Passed
  - `test_natural_language_feature_launch_variants` (22 variants verified)
  - `test_regression_existing_decisions` (all 7 existing decisions verified)
  - `test_maps_feature_full_intelligence_pipeline` (end-to-end integration verified)
  - `test_unsupported_decision_fallback` (clean fallback verified)
- `test_decision_intelligence.py`: 13/13 Passed
- `test_ml_serving.py`: 11/11 Passed

### TypeScript & Production Build
- `npx tsc --noEmit --pretty`: **0 Errors**
- `npm run build`: **Client and Server SSR bundles built cleanly**

---

## 6. Remaining Model Limitations & Non-Causal Disclaimers
1. **Proxy Feature Mapping**: The trained Model 1 (RavenStack SaaS) represents feature additions through `has_beta_feature` and `n_unique_features`. The specific domain utility (e.g. geospatial maps vs. messaging) is not an explicit column in the training dataset.
2. **Correlational vs. Causal**: As highlighted across all cards, disclaimers, and AI Co-Founder recommendations, these projections represent statistical associations conditioned on operational panel states rather than guaranteed causal intervention outcomes.
3. **Stage-0 Survival Risk**: Model 2 evaluates Day-0 macroeconomic and founder profile survival rates; for product feature launches post-launch, failure risk delta correctly reflects 0.0 unless operational burn is adjusted.
