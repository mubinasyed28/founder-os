# Cofoundr OS: Opportunity & Decision Intelligence Feature
## Technical Development Documentation, Pipeline Architecture, and Render Deployment Guide

---

## Executive Summary

The **Opportunity & Decision Intelligence Engine** is a core strategic module of **Cofoundr OS**. Unlike conventional startup tools that merely report metrics or provide unstructured chat responses, the Opportunity Engine functions as a **scientific decision-making copilot**. 

It continuously ingests startup profile data, analyzes competitive intelligence and customer friction, structures opportunities into an **Epistemic Breakdown** (distinguishing hard facts from inferences and assumptions), projects quantifiable **health score impacts**, formats **validation micro-experiments**, and enables founders to commit high-conviction decisions (`pursue`, `validate`, `park`, `reject`). Every decision automatically converts into actionable execution tasks and writes permanent memory nodes into the company's institutional timeline.

---

## Table of Contents

1. [High-Level System Architecture](#1-high-level-system-architecture)
2. [End-to-End Opportunity Pipeline](#2-end-to-end-opportunity-pipeline)
   - [Phase 1: Profile & Signal Ingestion](#phase-1-profile--signal-ingestion)
   - [Phase 2: Strategic Synthesis & AI Generation](#phase-2-strategic-synthesis--ai-generation)
   - [Phase 3: Epistemic Reasoning Framework](#phase-3-epistemic-reasoning-framework)
   - [Phase 4: Multi-Dimensional Health Impact Modeling](#phase-4-multi-dimensional-health-impact-modeling)
   - [Phase 5: Micro-Experiment Formulation](#phase-5-micro-experiment-formulation)
   - [Phase 6: Founder Decision Protocol & State Persistence](#phase-6-founder-decision-protocol--state-persistence)
   - [Phase 7: Cross-Module Institutional Propagation](#phase-7-cross-module-institutional-propagation)
3. [Technology Stack](#3-technology-stack)
4. [In-Depth Implementation Details](#4-in-depth-implementation-details)
   - [Backend API Router (`backend/routers/opportunities.py`)](#backend-api-router)
   - [Generator Service & Fallback Engine (`backend/services/opportunities_generator_service.py`)](#generator-service--fallback-engine)
   - [Frontend Interactive Drawer & Filtering (`src/routes/app.opportunities.tsx`)](#frontend-interactive-drawer--filtering)
   - [State Synchronization & Cross-Linking (`src/lib/os-store.tsx`)](#state-synchronization--cross-linking)
   - [Type System & Schemas (`src/lib/company-data.ts`)](#type-system--schemas)
5. [How It Adds Value to the Whole Project (System Synergy)](#5-how-it-adds-value-to-the-whole-project-system-synergy)
6. [Alternative Use Cases & Future Potential](#6-alternative-use-cases--future-potential)
7. [Deploying Backend on Render & Connecting Frontend](#7-deploying-backend-on-render--connecting-frontend)
   - [Step 1: Backend Pre-Flight & CORS Configuration](#step-1-backend-pre-flight--cors-configuration)
   - [Step 2: Deploying to Render via Web Service / Blueprint](#step-2-deploying-to-render-via-web-service--blueprint)
   - [Step 3: Render Environment Variables](#step-3-render-environment-variables)
   - [Step 4: Verifying the Live Backend Link](#step-4-verifying-the-live-backend-link)
   - [Step 5: Pointing the Frontend to the Render Backend Link](#step-5-pointing-the-frontend-to-the-render-backend-link)
   - [Step 6: Testing Endpoints via cURL and Swagger UI](#step-6-testing-endpoints-via-curl-and-swagger-ui)

---

## 1. High-Level System Architecture

The Opportunity Engine bridges the **Analysis Layer** (Competitor Intelligence, Health Engine, Document Memory) with the **Execution Layer** (Tasks, Roadmaps, Company Timeline).

```
┌────────────────────────────────────────────────────────────────────────┐
│                          FOUNDER PROFILE & DNA                         │
│   Company Name • ICP • One-Line Pitch • Industry • Competitors • Stage │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               OPPORTUNITY GENERATOR & REASONING ENGINE                 │
│         (FastAPI Service + Mistral Large LLM / Domain Heuristic)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
       ┌────────────────────────────┼───────────────────────────┐
       ▼                            ▼                           ▼
┌──────────────┐            ┌──────────────┐            ┌──────────────┐
│  Epistemic   │            │ Health Score │            │  Validation  │
│  Breakdown   │            │ Impact Delta │            │  Experiments │
│ Facts/Infers/│            │ Product/Mkt/ │            │ Hypoth/Test/ │
│ Assumptions  │            │ Fin/Growth   │            │ Metric/Status│
└──────┬───────┘            └──────┬───────┘            └──────┬───────┘
       └────────────────────────────┼───────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        FOUNDER DECISION PROTOCOL                       │
│              [PURSUE]    ·    [VALIDATE]    ·    [PARK]    ·    [REJECT]   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
       ┌────────────────────────────┴───────────────────────────┐
       ▼                                                        ▼
┌──────────────────────────────────────┐     ┌─────────────────────────────────┐
│     COMPANY TIMELINE MEMORY          │     │        TASK ENGINE DISPATCH     │
│  `timeline_events` in MongoDB        │     │  Auto-creates execution tasks   │
│  Immutable strategic decision record │     │  Links task directly to opp ID  │
└──────────────────────────────────────┘     └─────────────────────────────────┘
```

---

## 2. End-to-End Opportunity Pipeline

```
  1. INGESTION       2. SYNTHESIS         3. EPISTEMIC         4. IMPACT EVAL
[Profile & ICP] ──> [LLM Scan Engine] ──> [F / I / A Split] ──> [Health Deltas]
                                                                      │
  7. PROPAGATION     6. FOUNDER DECISION   5. EXPERIMENTATION         │
[Tasks & Memory]<── [Pursue/Validate/...] <── [Hypothesis & Test] <───┘
```

### Phase 1: Profile & Signal Ingestion
1. The user profile is retrieved from the MongoDB `profiles` collection (or the active session store).
2. Key strategic inputs extracted:
   - `company_name`: Identity and branding.
   - `target_customer` (ICP): Who the buyer and end-user are.
   - `product` / `one_line_pitch`: Core value proposition.
   - `industry`: Market vertical (e.g., EdTech, DevTools, FinTech, HealthTech).
   - `competitors`: Named incumbents and direct rivals.
   - `current_stage` & `business_model`: e.g., Pre-seed SaaS, Seed Marketplace.

### Phase 2: Strategic Synthesis & AI Generation
1. The backend triggers `generate_opportunities_for_profile(profile)` in `backend/services/opportunities_generator_service.py`.
2. **Primary Route**: Makes an asynchronous JSON-mode completion call to `mistral-large-latest` (or Gemini) acting as an elite YC Partner / Startup Strategist.
3. **Fallback Route**: If an API key is missing or an external rate-limit occurs, the system switches to `generate_fallback_opportunities()`, an intelligent domain heuristic that dynamically personalizes high-yield opportunities specifically for the startup's name, competitors, and ICP.
4. Generates 5 strategic categories:
   - **Feature Gap**: High-friction user workflows abandoned by legacy competitors.
   - **Pricing Gap**: Uncaptured revenue tiers (e.g., team seats, usage billing).
   - **Market Gap**: Under-served buyer segments (e.g., mid-market API access, compliance).
   - **Positioning Gap**: Category narrative shift (e.g., reactive dashboard to predictive OS).
   - **Blue Ocean**: Novel network effects or community-driven defensible moats.

### Phase 3: Epistemic Reasoning Framework
Rather than accepting AI ideas blindly, each opportunity is dissected into three epistemic levels:
- **Facts**: Verifiable, objective realities (e.g., *"78% of interviewed users cite setup friction as their primary complaint"*, *"Competitor X does not offer RBAC"*).
- **Inferences**: Logical deductions drawn from facts (e.g., *"Introducing 1-click onboarding could increase week-1 retention by 25-35%"*).
- **Assumptions**: Critical unproven hypotheses that could invalidate the thesis (e.g., *"Users will grant OAuth read permissions to sync initial data"*).
- **Evidence Verification**: Individual citations flagged as `fact` or `inference` with a `verified` boolean and source attribution.

### Phase 4: Multi-Dimensional Health Impact Modeling
Each opportunity calculates projected score deltas across Cofoundr OS's 4 health dimensions:
- **Product Health** ($\Delta$ +6 to +18): Impact on activation, core engagement, and time-to-value.
- **Market Position** ($\Delta$ +8 to +20): Impact on differentiation, brand moats, and competitor displacement.
- **Financial Health** ($\Delta$ +10 to +24): Impact on ACV (Average Contract Value), NRR, and pricing power.
- **Growth Score** ($\Delta$ +8 to +16): Impact on viral loops, referral velocity, and CAC reduction.

### Phase 5: Micro-Experiment Formulation
Strategy is operationalized before large engineering hours are burned:
- Every opportunity includes a concrete `ValidationExperiment`:
  - `hypothesis`: The testable statement.
  - `test`: Low-cost execution method (landing page smoke test, pricing toggle, waitlist).
  - `metric`: Quantitative success threshold (e.g., *>15% demo conversion*, *20+ signups in 7 days*).
  - `effort`: Rapid turnaround classification (`Hours`, `1-2 days`, `1 week`).
  - `status`: Interactive state (`pending`, `passed`, `failed`).

### Phase 6: Founder Decision Protocol & State Persistence
The founder reviews the opportunity in the slide-over drawer and selects one of four strategic actions:
1. **Pursue**: High conviction. Immediately queues execution.
2. **Validate**: Needs de-risking. Directs team focus to running the micro-experiment.
3. **Park**: Sound concept, but deferred to avoid distraction from current sprint.
4. **Reject**: Incompatible with core vision or poor unit economics.
- The founder documents their rationale and custom action summary.
- The decision is persisted to MongoDB collection `opportunity_decisions` via `POST /api/opportunities/{id}/decide`.

### Phase 7: Cross-Module Institutional Propagation
When an opportunity is decided:
1. **Memory Node Creation**: A permanent decision event is inserted into MongoDB `timeline_events` with tags and links to the opportunity ID and competitors.
2. **Task Generation**: If marked **Pursue**, a new actionable task is created in `tasks`, with `linkedOpportunityId` tracking back to the source opportunity.
3. **Agent Notification Feed**: Pushes live audit logs to both the `Strategy Agent` and `Memory Agent` feeds.
4. **Experiment Updates**: Validation status toggles (`pending` $\rightarrow$ `passed` / `failed`) are saved to `opportunity_experiments` via `POST /api/opportunities/{id}/validate`.

---

## 3. Technology Stack

| Layer | Component / Package | Purpose |
|---|---|---|
| **Backend Framework** | `FastAPI 0.110+` (Python 3.11+) | Async REST API, OpenAPI/Swagger docs, dependency injection |
| **Server Engine** | `Uvicorn[standard] 0.28+` | High-performance ASGI production server |
| **Data Validation** | `Pydantic v2` | Request/response schema enforcement (`DecisionRequest`, `ValidationUpdateRequest`) |
| **Database Driver** | `Motor 3.3+` / `PyMongo 4.6+` | Non-blocking asynchronous MongoDB client |
| **Primary LLM** | `Mistral AI API` (`mistral-large-latest`) | Deep strategic opportunity extraction & JSON schema generation |
| **Authentication** | `PyJWT 2.8+` & `passlib[bcrypt]` | Bearer JWT token authentication with graceful guest fallback |
| **Frontend Framework** | `React 19` + `TypeScript 5.x` | UI rendering, type-safe components |
| **Routing** | `@tanstack/react-router` | File-based client-side routing (`src/routes/app.opportunities.tsx`) |
| **Global State** | `React Context` (`useOs`) | Centralized state store (`src/lib/os-store.tsx`) with optimistic updates |
| **Styling & UI** | `Tailwind CSS v4` + `Lucide React` | Responsive layout, dark/light theme, interactive drawer animations |
| **Deployment / Cloud** | `Render` (Web Service) + `MongoDB Atlas` | Cloud hosting, environment variables, continuous deployment from GitHub |

---

## 4. In-Depth Implementation Details

### Backend API Router

**File:** [backend/routers/opportunities.py](file:///c:/Users/YOCKET-271/Documents/GitHub/founder-os/backend/routers/opportunities.py)

The router exposes four key endpoints under `/api/opportunities`:

```python
router = APIRouter(prefix="/api/opportunities", tags=["Opportunities & Decision Intelligence"])
```

#### 1. `GET /api/opportunities`
- Authenticates the current user (or assigns `guest_session_user` for guest browsing).
- Queries `db.opportunity_decisions` to fetch previously saved founder decisions.
- Queries `db.opportunity_experiments` to load experiment status overrides (`passed`, `failed`, `pending`).
- Retrieves active startup DNA from `db.profiles`.
- Calls `generate_opportunities_for_profile(profile_doc)`.
- Returns an aggregated payload:
  ```json
  {
    "opportunities": [...],
    "decisions": { "O-51": { "decision": "pursue", "decidedAt": "Jul 28, 2026", ... } },
    "experiments": { "O-51_exp-1": "passed" },
    "companyName": "PrepTrack",
    "targetCustomer": "Medical & Bar Exam Students"
  }
  ```

#### 2. `POST /api/opportunities/generate`
- Forces an on-demand AI re-scan and opportunity generation, updating profile-tailored opportunities.

#### 3. `POST /api/opportunities/{opportunity_id}/decide`
- Accepts `DecisionRequest`:
  ```python
  class DecisionRequest(BaseModel):
      decision: str  # "pursue", "park", "reject", "validate"
      reasoning: Optional[str] = ""
      action_summary: Optional[str] = ""
  ```
- Upserts the decision document in `db.opportunity_decisions` by `{"user_id": user_id, "opportunity_id": opportunity_id}`.
- Generates a `memory_event_id` and writes a permanent decision event to `db.timeline_events` for institutional auditability.

#### 4. `POST /api/opportunities/{opportunity_id}/validate`
- Accepts `ValidationUpdateRequest`:
  ```python
  class ValidationUpdateRequest(BaseModel):
      experiment_id: str
      status: str  # "pending", "passed", "failed"
  ```
- Upserts the experiment state into `db.opportunity_experiments`.

---

### Generator Service & Fallback Engine

**File:** [backend/services/opportunities_generator_service.py](file:///c:/Users/YOCKET-271/Documents/GitHub/founder-os/backend/services/opportunities_generator_service.py)

The service implements a two-tier generation architecture:

1. **LLM Structured Generation**:
   Constructs a targeted prompt injecting the startup's name, ICP, one-line pitch, competitors, and challenges. Enforces JSON formatting to return structured opportunity objects conforming to the `Opportunity` schema.
2. **Domain Heuristic Generator (`generate_fallback_opportunities`)**:
   Guarantees that the feature is **100% resilient** even when offline, running with zero API credits, or encountering rate limits. It programmatically generates 5 deeply structured opportunities populated with dynamic variables (`c_name`, `c_icp`, `c_product`, `c_industry`, `comp_1`, `comp_2`).

---

### Frontend Interactive Drawer & Filtering

**File:** [src/routes/app.opportunities.tsx](file:///c:/Users/YOCKET-271/Documents/GitHub/founder-os/src/routes/app.opportunities.tsx)

The user interface is built around high-density decision workflows:
- **Telemetry Banner**: Displays total detected opportunities, in validation, pursued, parked, and rejected counts, alongside average confidence score.
- **Bi-Directional Filtering**:
  - Stage filters: `All`, `Detected`, `In Validation`, `Pursued`, `Parked`, `Rejected`.
  - Type filters: `All Types`, `Feature gap`, `Market gap`, `Pricing gap`, `Positioning gap`, `Blue ocean`.
- **Slide-Over Deep Dive Drawer (5 Distinct Tabs)**:
  1. **Understand Tab**: Visualizes the epistemic breakdown (Facts, Inferences, Assumptions) with color-coded badges and citations.
  2. **Evaluate Tab**: Visualizes Health score deltas (+Product, +Market, +Financial, +Growth), risk analysis, and time-to-impact.
  3. **Validate Tab**: Shows the validation experiment card with status toggles (`pending`, `passed`, `failed`).
  4. **Decide Tab**: 4-way decision buttons (`Pursue`, `Validate`, `Park`, `Reject`), rationale input field, and action summary.
  5. **Memory Tab**: Historical audit view of previous decisions, timestamps, and linked memory event IDs.

---

### State Synchronization & Cross-Linking

**File:** [src/lib/os-store.tsx](file:///c:/Users/YOCKET-271/Documents/GitHub/founder-os/src/lib/os-store.tsx)

- **`refreshOpportunities()`**: Fetches opportunities, user decisions, and experiment overrides from the backend API and merges them into the active React state.
- **`decideOpportunity()`**:
  - Performs **optimistic UI updates** so that UI state changes immediately without latency.
  - Automatically creates a new execution task in `tasks` when `decision === "pursue"`.
  - Appends a memory event to `timeline`.
  - Triggers activity logs on the `Strategy Agent` and `Memory Agent`.
  - Calls `decideOpportunityApi(id, data)` to sync to MongoDB.
  - Caches to `localStorage` for offline session recovery.
- **`updateValidationExperiment()`**:
  - Updates the local experiment status immediately.
  - Calls `updateValidationApi(oppId, { experiment_id, status })`.

---

### Type System & Schemas

**File:** [src/lib/company-data.ts](file:///c:/Users/YOCKET-271/Documents/GitHub/founder-os/src/lib/company-data.ts)

```typescript
export type OpportunityStatus = "detected" | "evaluating" | "validating" | "pursued" | "parked" | "rejected";

export type EpistemicBreakdown = {
  facts: string[];
  inferences: string[];
  assumptions: string[];
};

export type ValidationExperiment = {
  id: string;
  hypothesis: string;
  test: string;
  metric: string;
  effort: "Hours" | "1-2 days" | "1 week";
  status: "pending" | "passed" | "failed";
};

export type HealthImpact = {
  metricKey: string;
  label: string;
  expectedDelta: number;
  reason: string;
};

export type Opportunity = {
  id: string;
  title: string;
  type: "Feature gap" | "Market gap" | "Pricing gap" | "Positioning gap" | "Blue ocean";
  status: OpportunityStatus;
  confidence: number;
  size: "Low" | "Medium" | "High" | "Very high" | "Speculative";
  detail: string;
  signal: string;
  detectedAt: string;
  whyFound: string;
  startupFit: string;
  epistemic: EpistemicBreakdown;
  evidence: OpportunityEvidence[];
  healthImpacts: HealthImpact[];
  risks: string[];
  effort: "Low" | "Medium" | "High";
  timeToImpact: string;
  uncertainties: string[];
  validationExperiments: ValidationExperiment[];
  recommendedAction: {
    label: string;
    description: string;
    suggestedDecision: "pursue" | "validate" | "park";
  };
  linkedCompetitors: string[];
  decisionRecord?: OpportunityDecision;
};
```

---

## 5. How It Adds Value to the Whole Project (System Synergy)

The Opportunity Feature transforms Founder OS from a passive dashboard into an **active strategic operating system**:

1. **Closes the Strategic Loop**:
   - Onboarding (`backend/routers/onboarding.py`) captures who you are.
   - Competitor Discovery (`backend/routers/competitors.py`) scans rival moves.
   - Startup Health Engine (`backend/routers/health.py`) flags operational vulnerabilities.
   - **The Opportunity Engine converts those raw signals into concrete, prioritized bets.**
2. **Defeats Founder Decision Paralysis**:
   Early-stage founders are constantly bombarded with conflicting ideas. The Opportunity Engine forces a scientific evaluation: *What are the facts? What are our assumptions? How do we test this in 48 hours without writing thousands of lines of code?*
3. **Institutional Memory Flywheel**:
   Months into building a startup, founders often forget *why* they chose not to build a feature or *why* they pivoted pricing. Because decisions write to `timeline_events`, the AI Co-Founder Chatbot can cite past opportunity decisions:
   > *"We evaluated a Team Subscription tier in July 2026 (Opportunity O-49) and parked it because 80% of our active users were solo practitioners."*
4. **Direct Bridge to Execution**:
   Decisions do not stay abstract notes—clicking "Pursue" immediately registers a task in the Task Board, directly connecting high-level strategy to sprint execution.

---

## 6. Alternative Use Cases & Future Potential

The Opportunity Engine's architecture can be extended into several high-value workflows:

### 1. Autonomous Agent Execution (Self-Driving Validation)
Currently, validation experiments are executed manually by founders (e.g., launching an A/B test or posting a waitlist). An autonomous subagent integration could:
- Automatically generate a landing page variant using the opportunity's hypothesis.
- Spin up a Google Ads or Meta Ads campaign targeting the specific ICP.
- Scrape customer feedback from Reddit, G2, or Twitter and update the experiment status (`passed` / `failed`) automatically.

### 2. Automated Investor Pitch Deck & Due Diligence Room
Investors evaluate founders on market insight and execution rigor. The Opportunity Engine can export an **Epistemic Deal Memo**:
- Shows prospective VCs that the team has mapped out every competitor gap with verified evidence.
- Demonstrates structured validation discipline rather than guesswork.

### 3. Dynamic Health-Driven Strategic Alerts
When the Startup Health Engine detects a decline in a specific metric (e.g., **Financial Health drops below 50** due to low gross margins or high churn):
- The system automatically triggers an urgent opportunity scan specifically filtered for `Pricing gap` or `Enterprise API monetization`.
- Proactively recommends counter-measures directly in the founder's daily briefing.

### 4. Competitive Counter-Offensive Engine
When competitor scrapers detect that a rival has launched a new feature or altered pricing:
- The system immediately runs a counter-analysis: *What did the competitor miss? What customer segment will be alienated by their price hike?*
- Surfaces counter-opportunities within minutes of the competitor's release.

### 5. Accelerator / Venture Studio Cohort Platform
Accelerators like Y Combinator, Techstars, or Antler can deploy the Opportunity Engine across hundreds of portfolio companies to:
- Benchmark cohort PMF velocity.
- Identify common market friction points across industries.
- Audit whether founders are testing assumptions before building expensive products.

---

## 7. Deploying Backend on Render & Connecting Frontend

This guide covers deploying the FastAPI backend on **Render** (as a Web Service) and connecting your local or deployed frontend to that backend link.

### Step 1: Backend Pre-Flight & CORS Configuration

Your backend has been prepared for cloud deployment:
1. **Dynamic CORS Support** in [backend/main.py](file:///c:/Users/YOCKET-271/Documents/GitHub/founder-os/backend/main.py):
   It automatically supports origins defined in `CORS_ORIGINS` and uses regex matching (`https?://.*`) so requests from Render, Vercel, or localhost are accepted without CORS blocking.
2. **Dynamic Frontend API Base URL** in [src/lib/api-client.ts](file:///c:/Users/YOCKET-271/Documents/GitHub/founder-os/src/lib/api-client.ts):
   It automatically detects `VITE_API_URL`. If set, it routes all API calls to your Render backend link; if unset, it falls back to `/api` for local proxying.
3. **Render Blueprint** in [render.yaml](file:///c:/Users/YOCKET-271/Documents/GitHub/founder-os/render.yaml):
   Pre-configured with start command, build command, and required environment variables.

---

### Step 2: Deploying to Render via Web Service

You can deploy using either the **Render Dashboard UI** or the **Render Blueprint (`render.yaml`)**.

#### Option A: Manual Web Service Setup (Recommended)
1. Push your repository changes to GitHub.
2. Log in to [Render Dashboard](https://dashboard.render.com/).
3. Click **New +** $\rightarrow$ **Web Service**.
4. Connect your GitHub repository (`founder-os`).
5. Fill in the service configuration:
   - **Name**: `founder-os-backend` (or any preferred name)
   - **Region**: Choose closest to you (e.g., `Oregon (US West)` or `Frankfurt (EU Central)`)
   - **Branch**: `main` (or your active working branch)
   - **Root Directory**: Leave blank (repository root)
   - **Runtime**: `Python 3`
   - **Build Command**:
     ```bash
     pip install -r backend/requirements.txt
     ```
   - **Start Command**:
     ```bash
     uvicorn backend.main:app --host 0.0.0.0 --port $PORT
     ```
   - **Instance Type**: `Free`

---

### Step 3: Render Environment Variables

In the **Environment Variables** section of your Render Web Service, add:

| Key | Value Description | Example / Notes |
|---|---|---|
| `PYTHON_VERSION` | `3.11.8` | Ensures modern Python 3.11 runtime |
| `MONGODB_URI` | MongoDB Atlas Connection String | `mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority` |
| `MONGODB_DB_NAME` | Database name | `cofoundr_os` |
| `MISTRAL_API_KEY` | Mistral API key for AI generation | From [console.mistral.ai](https://console.mistral.ai/) |
| `TAVILY_API_KEY` | Tavily Web Search API key | From [tavily.com](https://tavily.com) |
| `JWT_SECRET` | Secret key for JWT auth signing | Any 32+ character random string |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:5173,https://your-frontend.vercel.app` |

> [!IMPORTANT]
> **MongoDB Atlas Network Access**:
> Ensure your MongoDB Atlas cluster has IP Access List set to **Allow Access from Anywhere (`0.0.0.0/0`)**, because Render free services use dynamic outbound IP addresses.

Click **Deploy Web Service**. Render will install dependencies and start Uvicorn.

---

### Step 4: Verifying the Live Backend Link

Once deployment completes, Render will provide your public service URL:
```
https://founder-os-backend.onrender.com
```

#### Verification Steps:
1. **Health Check**: Open in your browser:
   ```
   https://founder-os-backend.onrender.com/api/health
   ```
   Expected response:
   ```json
   {"status": "ok", "service": "Cofoundr OS FastAPI Backend"}
   ```
2. **Interactive OpenAPI / Swagger Documentation**:
   ```
   https://founder-os-backend.onrender.com/docs
   ```
   You can explore and test all `/api/opportunities` routes interactively.

---

### Step 5: Pointing the Frontend to the Render Backend Link

Now you can run your frontend (locally or deployed to Vercel/Netlify) and connect it directly to your Render backend:

#### For Local Frontend Development:
In your project root `.env` file, set `VITE_API_URL`:

```env
# Point directly to your Render backend
VITE_API_URL=https://founder-os-backend.onrender.com
```

Restart your Vite dev server:
```bash
npm run dev
```

The frontend API client will now make all requests (such as `getOpportunitiesApi`, `decideOpportunityApi`, `regenerateOpportunitiesApi`) to `https://founder-os-backend.onrender.com/api/...`.

#### For Deployed Frontend (e.g. Vercel / Netlify):
Add the environment variable in the Vercel/Netlify Project Settings:
- `VITE_API_URL`: `https://founder-os-backend.onrender.com`

---

### Step 6: Testing Endpoints via cURL and Swagger UI

You can test the Opportunity endpoints against your Render backend link using cURL:

#### 1. Fetch All Tailored Opportunities & Decisions
```bash
curl -X GET "https://founder-os-backend.onrender.com/api/opportunities" \
     -H "Content-Type: application/json"
```

#### 2. Trigger AI Opportunity Re-Scan
```bash
curl -X POST "https://founder-os-backend.onrender.com/api/opportunities/generate" \
     -H "Content-Type: application/json"
```

#### 3. Commit a Founder Decision (`pursue`)
```bash
curl -X POST "https://founder-os-backend.onrender.com/api/opportunities/O-51/decide" \
     -H "Content-Type: application/json" \
     -d '{
       "decision": "pursue",
       "reasoning": "Highest leverage feature wedge to differentiate from legacy competitors.",
       "action_summary": "Build MVP Auto-Setup Wizard for Medical Exam Takers"
     }'
```

#### 4. Update a Validation Experiment Status (`passed`)
```bash
curl -X POST "https://founder-os-backend.onrender.com/api/opportunities/O-51/validate" \
     -H "Content-Type: application/json" \
     -d '{
       "experiment_id": "exp-1",
       "status": "passed"
     }'
```

---

## 8. Summary of Created & Modified Artifacts

- **[OPPORTUNITY_FEATURE_DOCUMENTATION.md](file:///c:/Users/YOCKET-271/Documents/GitHub/founder-os/OPPORTUNITY_FEATURE_DOCUMENTATION.md)**: This complete technical architecture, pipeline, and deployment guide.
- **[backend/routers/opportunities.py](file:///c:/Users/YOCKET-271/Documents/GitHub/founder-os/backend/routers/opportunities.py)**: FastAPI router providing 4 opportunity endpoints.
- **[backend/services/opportunities_generator_service.py](file:///c:/Users/YOCKET-271/Documents/GitHub/founder-os/backend/services/opportunities_generator_service.py)**: LLM & heuristic generation engine.
- **[src/routes/app.opportunities.tsx](file:///c:/Users/YOCKET-271/Documents/GitHub/founder-os/src/routes/app.opportunities.tsx)**: React UI with 5-tab deep dive drawer.
- **[src/lib/os-store.tsx](file:///c:/Users/YOCKET-271/Documents/GitHub/founder-os/src/lib/os-store.tsx)**: Global store managing bi-directional links (decisions, tasks, timeline).
- **[backend/main.py](file:///c:/Users/YOCKET-271/Documents/GitHub/founder-os/backend/main.py)**: Configured with dynamic CORS origins for Render deployment.
- **[src/lib/api-client.ts](file:///c:/Users/YOCKET-271/Documents/GitHub/founder-os/src/lib/api-client.ts)**: Configured to support `VITE_API_URL` targeting Render.
- **[render.yaml](file:///c:/Users/YOCKET-271/Documents/GitHub/founder-os/render.yaml)**: Ready-to-use Render Blueprint specification.
