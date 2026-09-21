# Decision Simulator Evidence Layer Fix: Technical Report

## 1. Executive Summary

This report documents the focused fix to the **Decision Simulator Evidence Layer**, addressing:
1. **Document Evidence:** Semantic retrieval over document content and factual summaries, strict thresholding, document deduplication, and honest empty states (`documents: []`).
2. **Competitor Evidence:** Real-time, decision-tailored external search via Tavily, strict cache isolation via research fingerprinting, contextual relevance filtering, and prevention of cross-decision competitor leakage.
3. **Market / News Evidence:** Dynamic, decision-specific query generation via NewsData.io (with <= 90 char length limit) and Tavily, relevance filtering against current decision targets and recency, and empty state enforcement (`market: []`).
4. **Training Dataset Separation:** Complete boundary separation ensuring ML training datasets (RavenStack, Startup Survival) are used strictly for statistical model inference and never appear as external evidence.

All ML models (revenue projection, churn risk, startup failure risk), ML training pipelines, model registries, and MRR/runway formulas were preserved 100% without modification.

---

## 2. Root Cause Analysis

| Evidence Layer Component | Previous Defect / Failure Mode | Root Cause in Codebase |
|---|---|---|
| **Document Evidence** | Displayed essentially all uploaded company documents (e.g. Tesla Q2 2026 reports appearing for "Launch maps feature" or "Expand into Germany"). Duplicate cards for every chunk. | In `retrieve_relevant_documents`, database chunks were returned without document-level deduplication or relevance cut-off. Documents lacked persistent summaries and topics. |
| **Competitor Evidence** | Results from an earlier decision leaked into subsequent decisions (e.g. running "Expand into Germany" and then "Launch maps feature" still showed German competitors). | In `build_full_context`, `saved_competitors = await self.retrieve_competitor_context(company_id, profile)` unconditionally queried `db.competitor_research.find_one({"company_id": company_id})` and prepended historical competitors without checking decision alignment. Furthermore, cache keys did not include `company_id`, normalized decision text, or targets. |
| **Market / News Evidence** | Market queries were static or generic (e.g. `f"{industry} startup"[:40]`), returning generic industry articles regardless of the specific decision. | In `perform_decision_research`, the query builder lacked decision parameter extraction (feature name, target country, hiring role, pricing tier). The fallback classifier appended all non-competitor items to `market_evidence` without relevance thresholding. |
| **Training Data Separation** | Potential risk of training dataset entity names (RavenStack synthetic accounts, BLS cohorts) surfacing as competitors or market signals. | Absence of an explicit entity-level filter in the evidence classification pipeline. |

---

## 3. Files Changed

1. **[`backend/services/company_context_service.py`](file:///c:/Users/YOCKET-271/Documents/GitHub/founder-os/backend/services/company_context_service.py)**
   - Extended `EvidenceItem` with `reason`, `published_at`, and backward-compatible properties.
   - Added `is_training_dataset_entity` blacklist check for `ravenstack`, `startupsurvival`, `bls_survival`, `synthetic_saas`, etc.
   - Implemented `generate_research_fingerprint(company_id, raw_text, decision_type, feature_action, geography, product, industry)`.
   - Implemented `_extract_decision_keywords_and_targets`: extracts countries (e.g. Germany, UK, France), features (e.g. maps, AI chat), and hiring roles.
   - Implemented `_build_competitor_queries`: dynamically synthesizes decision-tailored search strings (e.g. "travel apps with maps", "travel apps operating in Germany").
   - Implemented `_build_market_news_queries`: synthesizes news queries adhering to NewsData.io strict 90-character limit.
   - Implemented `_filter_and_rank_competitors`: verifies candidate domains, filters out generic informational sites (Wikipedia, Reddit, Quora, generic listicles), requires geographic/feature alignment, and discards training dataset entities.
   - Implemented `_filter_and_rank_market_news`: requires geographic or feature alignment, excludes training entities, and discards off-topic fluff.
   - Updated `perform_decision_research` to enforce cache isolation keyed on `f"{company_id}:{fingerprint}"` and record retrieval audit stats.
   - Updated `build_full_context` to avoid prepending stale historical competitors from unrelated runs (`all_competitors = live_competitors`).

2. **[`backend/services/decision_intelligence_service.py`](file:///c:/Users/YOCKET-271/Documents/GitHub/founder-os/backend/services/decision_intelligence_service.py)**
   - Extended structured logging (`[DECISION_SIMULATOR]`) with:
     - `research_fingerprint`
     - `competitor_queries`
     - `selected_competitors`
     - `market_queries`
     - `selected_market`
     - `cache_hit`
     - `relevance_filtering_counts`

3. **[`src/routes/app.simulator.tsx`](file:///c:/Users/YOCKET-271/Documents/GitHub/founder-os/src/routes/app.simulator.tsx)**
   - Updated `EvidenceSection` empty state messages to match required text:
     - Documents: `"No relevant company documents found for this decision."`
     - Competitors: `"No highly relevant competitors found for this decision."`
     - Market: `"No relevant market/news signals found for this decision."`

4. **[`backend/tests/test_evidence_layer_isolation.py`](file:///c:/Users/YOCKET-271/Documents/GitHub/founder-os/backend/tests/test_evidence_layer_isolation.py)**
   - Created comprehensive unit test suite covering Tests A through H.

---

## 4. Implementation Details

### 4.1 Research Fingerprint & Cache Isolation
The cache key incorporates all relevant dimensions:
```python
def generate_research_fingerprint(
    company_id: str,
    raw_text: str,
    decision_type: str,
    feature_action: str = "",
    geography: str = "",
    product: str = "",
    industry: str = ""
) -> str:
    norm_text = re.sub(r"[^a-zA-Z0-9\s]", "", raw_text.lower()).strip()
    norm_text = " ".join(norm_text.split())
    raw = (
        f"{company_id}|{norm_text}|{decision_type.lower()}|"
        f"{feature_action.lower()}|{geography.lower()}|"
        f"{product.lower()}|{industry.lower()}"
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]
```
Cache key: `f"{company_id}:{fingerprint}"`.
When a founder switches from "Expand into Germany" to "Launch maps feature", the fingerprint changes completely (`fp_germany != fp_maps`). This guarantees that:
- Germany competitor cache is never read during a maps analysis.
- Maps competitor cache is never read during a Germany analysis.
- Company A's research cache is isolated from Company B's research cache.

### 4.2 Dynamic Query Formulation
Queries are generated dynamically based on actual company profile and decision targets:

#### Case 1: Feature Decision ("Launch maps feature" + Travel Startup)
- **Competitor Queries:**
  - `travel apps with maps`
  - `AI travel itinerary planner with maps alternatives competitors`
  - `travel navigation apps`
  - `AI travel apps with maps`
- **Market News Queries (NewsData.io):**
  - `travel maps technology`
  - `travel navigation apps`
  - `location based travel technology`

#### Case 2: Geographic Expansion ("Expand into Germany" + Travel Startup)
- **Competitor Queries:**
  - `travel apps operating in Germany`
  - `AI travel itinerary planner platforms serving Germany`
  - `travel technology companies in Germany`
  - `local competitors travel Germany`
- **Market News Queries (NewsData.io):**
  - `Germany travel technology`
  - `Germany travel apps`
  - `Germany travel startups market`

### 4.3 Relevance Filtering & Empty States
- **Competitor Filter:**
  - Excludes Wikipedia, YouTube, Reddit, Quora, Forbes, and editorial listicles.
  - Requires target geographic presence for expansion decisions (e.g. must mention Germany, German market, Berlin, etc.).
  - Requires feature presence for feature launches (e.g. must mention maps, navigation, routing, location).
  - If no candidate passes: returns `competitors: []`. UI displays: *"No highly relevant competitors found for this decision."*
- **Market Filter:**
  - Excludes off-topic fluff, sports news, generic national headlines.
  - Requires geographic or feature topical overlap.
  - If no candidate passes: returns `market: []`. UI displays: *"No relevant market/news signals found for this decision."*
- **Training Data Filter:**
  - Strictly rejects any item mentioning RavenStack, Startup Survival, BLS cohorts, or synthetic SaaS entities.

---

## 5. Verification & Test Results

### 5.1 Evidence Layer Isolation Tests (`backend/tests/test_evidence_layer_isolation.py`)
| Test ID | Scenario | Verification Criteria | Result |
|---|---|---|---|
| **Test A** | Unrelated Document | Company has `TSLA-Q2-2026-Update.pdf`; Decision is "Launch maps feature". | `documents: []` (Tesla doc excluded) — **PASS** |
| **Test B** | Different Decision | Company has `TSLA-Q2-2026-Update.pdf`; Decision is "Expand into Germany". | `documents: []` (Tesla doc excluded) — **PASS** |
| **Test C & D** | Cross-Decision Competitor Isolation | Run "Expand into Germany" then "Launch maps feature", and reverse order. | Fingerprints differ; German hotel/booking apps without maps excluded from maps; maps competitors excluded from Germany — **PASS** |
| **Test E** | Real-Time Market Queries | Decision "Launch maps feature" vs "Expand into Germany". | News queries change dynamically (maps vs Germany); zero overlap in query targets — **PASS** |
| **Test F** | Sub-Threshold Market Evidence | Candidate news consists of unrelated local sports / general articles. | `market: []` returned without polluting evidence section — **PASS** |
| **Test G** | Training Data Separation | Candidate items containing RavenStack / Startup Survival entities. | Rejected from competitors and market evidence — **PASS** |
| **Test H** | Multi-Company Isolation | Company A queries documents; Company B has confidential files. | Company A cannot retrieve Company B's documents — **PASS** |

**Command:** `python -m unittest backend/tests/test_evidence_layer_isolation.py`
**Output:** `Ran 7 tests in 0.649s - OK`

### 5.2 Document Evidence & Intelligence Tests
- `python -m unittest backend/tests/test_document_evidence.py backend/tests/test_decision_intelligence.py`
**Output:** `Ran 20 tests in 26.471s - OK`

### 5.3 Full Backend Test Suite
- `python -m unittest discover backend/tests`
**Output:** `Ran 44 tests in 34.659s - OK`

### 5.4 Frontend Production Build
- `npm run build`
**Output:** `vite building ssr environment for production... ✓ built in 3.02s` (0 TypeScript or bundling errors)

---

## 6. Preserved Invariants & Safeguards

1. **ML Architecture Intact:**
   - Ridge regression revenue forecasting, churn classification, and XGBoost/logistic startup risk models remain identical.
   - Model registries (`ml/model_registry.json`) and evaluation metrics remain untouched.
2. **MRR Math Intact:**
   - Multi-month runway, burn reduction, headcount compensation calculations, and revenue deltas remain identical.
3. **UI Layout Preserved:**
   - Existing 4 tabs (`Company`, `Documents`, `Competitors`, `Market`) and layout hierarchy remain identical.
4. **Clean State Replacement:**
   - In `app.simulator.tsx`, `setReport(null)` clears old state before new analysis completes, preventing old evidence from lingering in the UI.

---

## 7. Remaining Limitations

1. **External API Rate Limits:** Free tier NewsData.io (200 requests/day) and Tavily rate limits are mitigated by in-memory fingerprint-based caching (30-minute TTL per exact decision context).
2. **Third-Party Coverage for Niche Geographies:** If external search providers return zero results for an obscure region or feature, the system honestly displays the empty state (`competitors: []`, `market: []`) rather than inventing placeholder data.
