# Stage 5: Frontend Integration Report — AI Co-Founder Decision Simulator

**Date:** September 2026  
**Status:** Complete  
**Author:** Cofoundr OS Engineering

---

## 1. Frontend Architecture

The Decision Simulator is a single-page component at `/app/simulator` built with:

- **Framework:** TanStack Router + React 19
- **Charts:** Recharts (AreaChart with ML vs rule-based annotations)
- **UI Primitives:** `Panel`, `Tag`, `PageHeader` from `@/components/os/primitives`
- **State:** React `useState` + `useOs()` context for company ID
- **API:** Centralized `apiRequest()` from `@/lib/api-client` with auth token injection
- **Styling:** Tailwind CSS v4 with dark-first premium palette (oklch-based)

### Key Components (all within `app.simulator.tsx`)

| Component | Purpose |
|---|---|
| `Page` | Main page orchestrator with NL input, loading, results, sliders |
| `EvidenceSection` | Tabbed evidence viewer (Company, Documents, Competitors, Market) |
| `EvidenceCard` | Individual evidence item with source links |
| `MetricCompare` | Current vs Proposed metric card with delta display |
| `ConfidenceBadge` | HIGH / MEDIUM / LOW confidence indicator |
| `Slider` | Range input for Advanced Scenario Controls |
| `SliderStat` | Read-only metric card for slider projections |

---

## 2. API Integration

### Endpoint

```
POST /api/simulator/intelligence
```

### Request Payload

```json
{
  "company_id": "<dynamic from useOs().companyId>",
  "decision": "<user natural language text>"
}
```

### API Client Function

```typescript
// src/lib/api-client.ts
export async function analyzeDecisionApi(companyId: string, decision: string): Promise<any> {
  return apiRequest("/simulator/intelligence", {
    method: "POST",
    body: JSON.stringify({ company_id: companyId, decision }),
  });
}
```

This uses the centralized `apiRequest()` which:
- Automatically attaches the `Authorization: Bearer <token>` header
- Respects `VITE_API_URL` for remote deployments
- Handles error extraction from JSON responses

### Response Schema

The backend returns an `IntelligenceReport` containing:
- `decision` — parsed decision type, coverage status, parameters
- `simulation_engine` — `MODEL_POWERED` or `RULE_BASED`
- `coverage_status` — `SUPPORTED`, `PARTIALLY_SUPPORTED`, `UNSUPPORTED`
- `baseline` / `scenario` — revenue forecast, churn probability, failure probability, metrics
- `impact` — positive effects, negative risks, key changes
- `risk` — level and factors
- `evidence` — company, documents, competitors, market arrays
- `assumptions` / `limitations` — transparency arrays
- `recommendation` / `confidence` — synthesized verdict with reasoning
- `ai_cofounder_explanation` — narrative analysis
- `model_metadata` — drivers, model version, causal disclaimer

---

## 3. Natural-Language Decision Flow

```
User types decision text
       ↓
"Analyze Decision" button (or Ctrl+Enter)
       ↓
Intelligent loading state (5-step progress)
       ↓
POST /api/simulator/intelligence
       ↓
Backend: Parser → Context → Scenario Engine → ML → Evidence Synthesis
       ↓
Frontend renders: Recommendation → Impact → Chart → Drivers → Evidence → Assumptions → Limitations
       ↓
Sliders sync from parsed parameters (e.g., hiring count → hires slider)
```

### Example Decisions Supported

| Decision | Backend Type | Coverage |
|---|---|---|
| "Raise $500K" | `fundraising` | MODEL_POWERED |
| "Increase pricing" | `pricing_change` | PARTIALLY_SUPPORTED |
| "Hire 2 engineers" | `hiring` | PARTIALLY_SUPPORTED |
| "Launch a new feature" | `feature_launch` | PARTIALLY_SUPPORTED |
| "Expand into Germany" | `market_expansion` | UNSUPPORTED (Rule-based) |

---

## 4. Scenario Controls

### Advanced Scenario Controls (Preserved)

The existing slider-based controls are preserved as "Advanced Scenario Controls" with clear "Rule-based projection" labeling:

- Pro price (₹/mo): 299–1299
- New engineering hires: 0–5
- Marketing spend (₹K/mo): 0–200
- Raise amount (₹L): 0–300
- Burn reduction (%): 0–50

### Slider Sync from NL Analysis

When the NL analysis returns parsed parameters, sliders automatically update:
- `hiring` → sets hires slider to parsed count
- `fundraising` → sets raise slider proportionally
- `pricing_change` → sets price slider to new price
- `burn_adjustment` → sets burn slider to reduction percentage

---

## 5. ML-Powered vs Rule-Based States

### Visual Distinction

- **ML-powered estimates:** Shown with `bg-primary/12 text-primary` badge ("ML-powered")
- **Rule-based estimates:** Shown with `bg-muted text-muted-foreground` badge ("Rule-based")

### Where Badges Appear

1. **Example decision chips** — each preset shows ML or Rule badge
2. **Model coverage sidebar** — Revenue Forecast, Churn Risk, Failure Risk individually flagged
3. **Decision header** — coverage status tags (Partially Supported, Rule-Based)
4. **Metric compare cards** — "Rule" label when engine is not MODEL_POWERED
5. **Chart annotation** — ML reference line for month 1, disclaimer text differentiates
6. **Chart panel hint** — "Point 1 = ML estimate" vs "Rule-based projection"

---

## 6. Evidence Display

### Tabbed Categories

Evidence is organized into tabs that only appear when populated:
- **Company** — profile metrics, financial data
- **Documents** — RAG results from uploaded company documents
- **Competitors** — competitive intelligence findings
- **Market** — external market research signals

### Evidence Card Structure

Each evidence item displays:
- Title (bold)
- Source type badge (capitalized)
- Claim/snippet text
- Source reference (clickable if URL, plain text otherwise)

---

## 7. Error Handling

| Error Type | User Experience |
|---|---|
| Backend unavailable | "Analysis failed" + error message detail |
| Invalid input | Button disabled when input empty |
| API HTTP error | Extracted `detail` from JSON response |
| Network timeout | Standard fetch error message |
| Auth token missing | Request sent without auth (graceful degradation) |

All errors display in a destructive-toned alert card with icon.

---

## 8. Testing Results

### Backend Tests
- `test_decision_intelligence.py` — Stage 4 intelligence pipeline tests
- `test_ml_serving.py` — ML model serving tests

### Frontend Build
- TypeScript compilation verified
- No new dependencies added

### Manual Test Matrix

| Test | Decision Text | Expected Engine | Key Verification |
|---|---|---|---|
| TEST 1 | "I'm considering raising $500k" | MODEL_POWERED | Runway extension, failure risk reduction |
| TEST 2 | "Increase our Pro price from $99 to $129" | MODEL_POWERED (partial) | MRR delta, churn risk check |
| TEST 3 | "Hiring two engineers" | MODEL_POWERED (partial) | Burn increase, slider sync to 2 |
| TEST 4 | "Launch an AI financial forecasting feature" | MODEL_POWERED (partial) | Beta feature flag |
| TEST 5 | "Expand into Germany" | RULE_BASED | Rule-based badges visible, no fake ML |

---

## 9. Files Modified

| File | Change |
|---|---|
| `src/lib/api-client.ts` | Added `analyzeDecisionApi()` function |
| `src/routes/app.simulator.tsx` | Dynamic company ID, intelligent loading, slider sync, preset badges, API client integration |
| `ml/reports/stage5_frontend_integration.md` | This report (new file) |

---

## 10. Regression Safety

No changes were made to:
- Dashboard (`app.index.tsx`)
- Startup Health (`app.health.tsx`)
- Documents / Knowledge Base (`app.documents.tsx`, `app.knowledge.tsx`)
- Competitor Intelligence (`app.competitors.tsx`)
- AI Co-Founder Chat (`app.chat.tsx`)
- Authentication (`auth.tsx`)
- Navigation (`app-shell.tsx`)
- Backend routers or services
- ML models or training pipeline
