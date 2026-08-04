// Canonical demo company + all cross-linked entities for the AI Co-Founder OS.
export type Trend = "up" | "down" | "flat";

export const company = {
  name: "Lumen Labs",
  tagline: "AI study-planning OS for university students",
  stage: "Pre-seed · Validation → Building",
  founded: "Jan 2026",
  location: "Bangalore, IN",
  team: 3,
  website: "lumenlabs.ai",
  icp: "STEM undergraduates at tier-1 universities preparing for high-stakes exams",
  model: "Freemium SaaS · ₹499/mo Pro",
};

export type HealthMetric = {
  key: string;
  label: string;
  score: number;
  delta: number;
  trend: Trend;
  why: string;
  drivers: { label: string; value: string; good: boolean }[];
  risk?: string;
};

export const healthMetrics: HealthMetric[] = [
  {
    key: "growth",
    label: "Growth",
    score: 74,
    delta: +6,
    trend: "up",
    why: "Weekly signups compounding at 11.4% w/w for 5 straight weeks, driven by campus ambassador loop rather than paid spend.",
    drivers: [
      { label: "WoW signup growth", value: "+11.4%", good: true },
      { label: "Organic share of new users", value: "78%", good: true },
      { label: "Activation rate", value: "41%", good: false },
    ],
    risk: "Activation lags acquisition — top-of-funnel growth may mask a weak first-session experience.",
  },
  {
    key: "execution",
    label: "Execution",
    score: 68,
    delta: +3,
    trend: "up",
    why: "Roadmap velocity recovered after the Q1 slip; 8 of 11 committed milestones shipped within the planned sprint window.",
    drivers: [
      { label: "Milestones on time", value: "8/11", good: true },
      { label: "Median cycle time", value: "4.2 days", good: true },
      { label: "Open blockers", value: "3", good: false },
    ],
  },
  {
    key: "product",
    label: "Product",
    score: 71,
    delta: -2,
    trend: "down",
    why: "Feature depth improved but D30 retention slipped 3.1pts after the onboarding rewrite shipped on Jun 14.",
    drivers: [
      { label: "D30 retention", value: "24.8%", good: false },
      { label: "Weekly active / signups", value: "38%", good: true },
      { label: "NPS", value: "41", good: true },
    ],
    risk: "Retention regression correlates 0.81 with the onboarding rewrite — needs an A/B rollback test.",
  },
  {
    key: "financial",
    label: "Financial Health",
    score: 62,
    delta: +4,
    trend: "up",
    why: "Burn fell 9% after moving inference to a cheaper tier while MRR grew 14%, extending runway by 1.6 months.",
    drivers: [
      { label: "Net burn", value: "₹3.4L/mo", good: true },
      { label: "MRR", value: "₹2.1L", good: true },
      { label: "Gross margin", value: "63%", good: false },
    ],
  },
  {
    key: "market",
    label: "Market Position",
    score: 58,
    delta: +1,
    trend: "flat",
    why: "You hold a defensible niche in exam-cycle planning, but two funded incumbents are moving adjacent into scheduling.",
    drivers: [
      { label: "Category share (est.)", value: "1.2%", good: false },
      { label: "Branded search volume", value: "+22%", good: true },
      { label: "Direct competitors", value: "6", good: false },
    ],
    risk: "StudyOS raised $4M and shipped a planner in 11 days — window to differentiate is narrowing.",
  },
  {
    key: "fundraising",
    label: "Fundraising Readiness",
    score: 54,
    delta: +9,
    trend: "up",
    why: "Data room is 71% complete and traction now clears the pre-seed bar, but cohort retention charts are still missing.",
    drivers: [
      { label: "Data room complete", value: "71%", good: true },
      { label: "Months of traction", value: "7", good: true },
      { label: "Warm investor intros", value: "4", good: false },
    ],
  },
  {
    key: "momentum",
    label: "Momentum",
    score: 81,
    delta: +12,
    trend: "up",
    why: "Compound of shipping cadence, user growth and revenue acceleration over a trailing 30-day window.",
    drivers: [
      { label: "Shipping cadence", value: "3.1 /wk", good: true },
      { label: "Revenue acceleration", value: "+14%", good: true },
      { label: "Founder streak", value: "26 days", good: true },
    ],
  },
];

export const overallScore = 69;
export const overallConfidence = 84;

export const kpiSeries = [
  { month: "Jan", mrr: 18, users: 210, burn: 380, runway: 14.2, retention: 31 },
  { month: "Feb", mrr: 34, users: 480, burn: 372, runway: 13.4, retention: 30 },
  { month: "Mar", mrr: 61, users: 890, burn: 391, runway: 12.1, retention: 29 },
  { month: "Apr", mrr: 96, users: 1420, burn: 404, runway: 11.0, retention: 28 },
  { month: "May", mrr: 141, users: 2180, burn: 372, runway: 10.4, retention: 26 },
  { month: "Jun", mrr: 184, users: 3040, burn: 351, runway: 10.9, retention: 25 },
  { month: "Jul", mrr: 210, users: 3860, burn: 340, runway: 11.8, retention: 24.8 },
];

export type Agent = {
  id: string;
  name: string;
  role: string;
  status: "working" | "idle" | "queued";
  task: string;
  model: string;
  runs: number;
  accuracy: number;
};

export const agents: Agent[] = [
  {
    id: "research",
    name: "Research Agent",
    role: "Market & evidence gathering",
    status: "working",
    task: "Crawling 14 sources on Indian edtech pricing elasticity",
    model: "gemini-3.6-flash",
    runs: 412,
    accuracy: 91,
  },
  {
    id: "strategy",
    name: "Strategy Agent",
    role: "Positioning & GTM",
    status: "working",
    task: "Re-scoring wedge defensibility vs StudyOS launch",
    model: "gemini-3.6-flash",
    runs: 188,
    accuracy: 87,
  },
  {
    id: "financial",
    name: "Financial Agent",
    role: "Modeling & runway",
    status: "idle",
    task: "Last run: recomputed 18-month forecast",
    model: "gemini-3.6-flash",
    runs: 264,
    accuracy: 94,
  },
  {
    id: "planning",
    name: "Planning Agent",
    role: "Roadmap & sequencing",
    status: "queued",
    task: "Waiting on retention diagnosis before re-sequencing Q3",
    model: "gemini-3.6-flash",
    runs: 143,
    accuracy: 85,
  },
  {
    id: "writing",
    name: "Writing Agent",
    role: "Docs & narrative",
    status: "idle",
    task: "Last run: drafted pre-seed one-pager v3",
    model: "gemini-3.6-flash",
    runs: 97,
    accuracy: 89,
  },
  {
    id: "forecasting",
    name: "Forecasting Agent",
    role: "Predictive simulation",
    status: "working",
    task: "Simulating 3 pricing scenarios × 18 months",
    model: "gemini-3.6-flash",
    runs: 205,
    accuracy: 82,
  },
  {
    id: "critic",
    name: "Critic Agent",
    role: "Adversarial review",
    status: "working",
    task: "Challenging assumptions in the ₹699 pricing recommendation",
    model: "gemini-3.6-flash",
    runs: 331,
    accuracy: 93,
  },
  {
    id: "memory",
    name: "Memory Agent",
    role: "Knowledge graph upkeep",
    status: "idle",
    task: "Last run: linked 3 interview notes to 'activation' node",
    model: "embeddings",
    runs: 1284,
    accuracy: 96,
  },
  {
    id: "browser",
    name: "Browser Agent",
    role: "Live web verification",
    status: "working",
    task: "Verifying StudyOS changelog and pricing page",
    model: "headless",
    runs: 76,
    accuracy: 88,
  },
  {
    id: "execution",
    name: "Execution Agent",
    role: "Task creation & follow-through",
    status: "idle",
    task: "Last run: created 4 tasks from decision D-118",
    model: "tools",
    runs: 158,
    accuracy: 90,
  },
];

export type Recommendation = {
  id: string;
  title: string;
  category: string;
  stage: string;
  reasoning: string;
  evidence: { source: string; note: string }[];
  confidence: number;
  impact: string;
  impactScore: number;
  risk: string;
  roi: string;
  alternatives: { label: string; note: string }[];
  nextAction: string;
  agents: string[];
};

export const recommendations: Recommendation[] = [
  {
    id: "R-241",
    title: "Roll back the June onboarding rewrite behind a 50/50 test",
    category: "Product",
    stage: "Building",
    reasoning:
      "D30 retention fell 3.1pts in the exact cohort that entered after Jun 14. No other change shipped in that window, and the drop is concentrated in first-session completion (−14pts), not later weeks. That pattern points at onboarding friction, not product value decay.",
    evidence: [
      { source: "Cohort table · internal", note: "Jun 14+ cohort D30 24.8% vs 27.9% prior" },
      { source: "Session replay sample (n=40)", note: "62% drop off at the 4-step goal wizard" },
      { source: "Interview: Priya M., 3rd yr CS", note: "\"It asked too much before showing me anything\"" },
    ],
    confidence: 86,
    impact: "+2.4pts D30 retention, ≈ +₹34K MRR by Q4",
    impactScore: 78,
    risk: "Rollback loses the structured-goal data the planner uses; mitigate by deferring the wizard to session two.",
    roi: "≈ 9× on 6 engineering days",
    alternatives: [
      { label: "Ship a 1-step wizard", note: "Lower ceiling, keeps some structured data" },
      { label: "Do nothing, wait 2 more weeks", note: "Costs ~₹28K MRR of compounding churn" },
    ],
    nextAction: "Create task: A/B rollback behind feature flag `onb_v2`",
    agents: ["research", "critic", "planning"],
  },
  {
    id: "R-238",
    title: "Raise Pro pricing to ₹699 for new users only",
    category: "Pricing",
    stage: "Growth",
    reasoning:
      "Willingness-to-pay research across 3 comparable Indian student tools clusters at ₹650–₹850. Your conversion curve is flat between ₹499 and ₹699 in the survey sample, implying you are leaving ~29% of revenue on the table without measurable conversion loss.",
    evidence: [
      { source: "Van Westendorp survey (n=214)", note: "Optimal price point ₹690" },
      { source: "Competitor scan", note: "StudyOS ₹749, Cramly ₹599, Notely ₹899" },
      { source: "Stripe cohort data", note: "Price sensitivity flat below ₹700" },
    ],
    confidence: 73,
    impact: "+₹61K MRR in 90 days at current volume",
    impactScore: 84,
    risk: "Student segment is price-sensitive during exam off-season; grandfather all existing users to avoid churn spike.",
    roi: "≈ 22× on 2 days of work",
    alternatives: [
      { label: "₹599 intermediate step", note: "Safer, captures ~55% of upside" },
      { label: "Annual plan at ₹5,990", note: "Improves cash but not headline MRR" },
    ],
    nextAction: "Simulate in Decision Simulator, then ship price test",
    agents: ["financial", "forecasting", "critic"],
  },
  {
    id: "R-236",
    title: "Open a pre-seed conversation now, close in 8 weeks",
    category: "Fundraising",
    stage: "Fundraising",
    reasoning:
      "Runway is 11.8 months and improving, which is the strongest negotiating position you will have. Fundraising readiness rose 9 points this month; waiting past 9 months of runway historically compresses valuation in comparable pre-seed rounds.",
    evidence: [
      { source: "Runway model", note: "11.8 months at current burn" },
      { source: "Data room audit", note: "71% complete, 4 items missing" },
      { source: "Investor CRM", note: "4 warm intros unactioned for 22 days" },
    ],
    confidence: 68,
    impact: "₹1.5–2.5Cr at ₹12–16Cr post",
    impactScore: 71,
    risk: "Retention regression is visible in diligence; fix or frame it before the first partner meeting.",
    roi: "Extends runway to 26+ months",
    alternatives: [
      { label: "Wait one quarter", note: "Better metrics, thinner runway leverage" },
      { label: "Revenue-based financing", note: "No dilution, tighter cash constraints" },
    ],
    nextAction: "Complete data room items, then send 4 warm intros",
    agents: ["strategy", "financial", "writing"],
  },
];

export type Opportunity = {
  id: string;
  title: string;
  type: string;
  confidence: number;
  size: string;
  detail: string;
  signal: string;
};

export const opportunities: Opportunity[] = [
  {
    id: "O-51",
    title: "No competitor handles exam-cycle re-planning after a missed week",
    type: "Feature gap",
    confidence: 88,
    size: "High",
    detail:
      "All six tracked competitors treat plans as static. 41% of your churn interviews cite 'fell behind and gave up'. An automatic re-plan is a wedge nobody occupies.",
    signal: "6/6 competitors lack it · 41% of churn reasons",
  },
  {
    id: "O-49",
    title: "Tier-2 university market is entirely unserved in regional languages",
    type: "Market gap",
    confidence: 74,
    size: "Very high",
    detail:
      "4.1M STEM students outside tier-1 cities. Zero tracked competitor ships Hindi or Tamil interfaces. CAC in this segment is estimated 62% lower.",
    signal: "0 competitors · 4.1M TAM",
  },
  {
    id: "O-47",
    title: "Group/cohort pricing is missing across the category",
    type: "Pricing gap",
    confidence: 81,
    size: "Medium",
    detail:
      "Students buy in study groups. A 4-seat plan at ₹1,799 raises ARPU while lowering per-seat cost — no tracked competitor offers seats.",
    signal: "0/6 competitors · 3 inbound requests",
  },
  {
    id: "O-44",
    title: "Positioning as 'planner' undersells the outcome",
    type: "Positioning gap",
    confidence: 66,
    size: "Medium",
    detail:
      "Landing page A/B suggests 'get your grade back on track' outperforms 'plan your study time' by 31% on signup intent.",
    signal: "+31% intent in copy test",
  },
  {
    id: "O-40",
    title: "Blue ocean: employer-verified skill transcripts",
    type: "Blue ocean",
    confidence: 52,
    size: "Speculative",
    detail:
      "Your data already proves consistent study behaviour. Nobody converts that into a credential recruiters trust. Long horizon, high defensibility.",
    signal: "No category incumbent",
  },
];

export const competitors = [
  {
    name: "StudyOS",
    funding: "$4.0M Seed",
    users: "180K",
    price: "₹749",
    threat: 82,
    strength: "Distribution via university partnerships",
    weakness: "Static plans, no adaptation",
    latest: "Shipped an AI planner 11 days ago",
  },
  {
    name: "Cramly",
    funding: "Bootstrapped",
    users: "60K",
    price: "₹599",
    threat: 54,
    strength: "Strong brand with exam-cram audience",
    weakness: "No long-horizon planning, high churn",
    latest: "Raised prices 20% last month",
  },
  {
    name: "Notely",
    funding: "$12M Series A",
    users: "1.1M",
    price: "₹899",
    threat: 61,
    strength: "Note-taking network effects",
    weakness: "Planning is a bolt-on afterthought",
    latest: "Hiring for 'scheduling' roles",
  },
  {
    name: "PlanPal",
    funding: "Pre-seed",
    users: "12K",
    price: "Free",
    threat: 28,
    strength: "Fast iteration, loved UI",
    weakness: "No revenue model",
    latest: "Quiet for 6 weeks",
  },
  {
    name: "Chalk",
    funding: "$1.8M",
    users: "45K",
    price: "₹450",
    threat: 44,
    strength: "Cheapest credible option",
    weakness: "Weak retention, thin AI",
    latest: "Launched Android app",
  },
  {
    name: "Generic LLM chat",
    funding: "n/a",
    users: "—",
    price: "₹0–₹1,900",
    threat: 70,
    strength: "Ubiquitous, free-tier",
    weakness: "No memory, no structure, no accountability",
    latest: "Ongoing baseline threat",
  },
];

export type MemoryEvent = {
  id: string;
  date: string;
  type: "decision" | "document" | "meeting" | "milestone" | "metric" | "insight";
  title: string;
  detail: string;
  links: string[];
};

export const memoryTimeline: MemoryEvent[] = [
  {
    id: "M-118",
    date: "Jul 28, 2026",
    type: "insight",
    title: "Retention regression traced to onboarding rewrite",
    detail: "Critic Agent confirmed correlation 0.81 with the Jun 14 deploy after ruling out seasonality.",
    links: ["Product score", "R-241", "Task T-88"],
  },
  {
    id: "M-116",
    date: "Jul 22, 2026",
    type: "decision",
    title: "Moved inference to cheaper model tier",
    detail: "Cut burn 9% with no measurable quality regression on the eval set.",
    links: ["Financial health", "Runway", "Burn model"],
  },
  {
    id: "M-113",
    date: "Jul 14, 2026",
    type: "document",
    title: "Uploaded: 12 customer interview transcripts",
    detail: "Memory Agent extracted 34 entities and 61 relationships; 'fell behind' emerged as top churn theme.",
    links: ["Knowledge graph", "O-51", "Idea validation"],
  },
  {
    id: "M-110",
    date: "Jul 9, 2026",
    type: "meeting",
    title: "Advisor sync — Ravi K. (ex-Unacademy)",
    detail: "Advised grandfathering price increases and pushing on group plans.",
    links: ["R-238", "O-47"],
  },
  {
    id: "M-107",
    date: "Jul 1, 2026",
    type: "milestone",
    title: "Crossed ₹2L MRR",
    detail: "Seven months from first paying user. Momentum score jumped 12 points.",
    links: ["Momentum", "Fundraising readiness"],
  },
  {
    id: "M-104",
    date: "Jun 14, 2026",
    type: "metric",
    title: "Onboarding v2 shipped",
    detail: "Four-step goal wizard replaced the single-question start. Flagged retroactively as the regression origin.",
    links: ["M-118", "Product score"],
  },
];

export const graphNodes = [
  { id: "company", label: "Lumen Labs", kind: "company", x: 50, y: 50, size: 26 },
  { id: "icp", label: "STEM undergrads", kind: "customer", x: 22, y: 26, size: 17 },
  { id: "churn", label: "Churn: fell behind", kind: "insight", x: 20, y: 66, size: 16 },
  { id: "onb", label: "Onboarding v2", kind: "decision", x: 44, y: 80, size: 15 },
  { id: "retention", label: "D30 retention", kind: "metric", x: 62, y: 74, size: 18 },
  { id: "pricing", label: "Pricing ₹499", kind: "decision", x: 76, y: 30, size: 16 },
  { id: "studyos", label: "StudyOS", kind: "competitor", x: 84, y: 58, size: 17 },
  { id: "runway", label: "Runway 11.8mo", kind: "metric", x: 50, y: 16, size: 16 },
  { id: "ravi", label: "Ravi K. (advisor)", kind: "person", x: 14, y: 46, size: 14 },
  { id: "interviews", label: "12 interviews", kind: "document", x: 33, y: 62, size: 14 },
  { id: "replan", label: "Auto re-plan wedge", kind: "opportunity", x: 68, y: 88, size: 15 },
  { id: "preseed", label: "Pre-seed round", kind: "investor", x: 76, y: 12, size: 15 },
];

export const graphEdges: [string, string][] = [
  ["company", "icp"],
  ["company", "retention"],
  ["company", "runway"],
  ["company", "pricing"],
  ["company", "studyos"],
  ["icp", "churn"],
  ["churn", "interviews"],
  ["interviews", "replan"],
  ["onb", "retention"],
  ["retention", "replan"],
  ["pricing", "preseed"],
  ["runway", "preseed"],
  ["ravi", "icp"],
  ["ravi", "pricing"],
  ["studyos", "replan"],
  ["company", "onb"],
];

export const documents = [
  { name: "Customer interviews — batch 3.pdf", type: "Research", size: "1.2 MB", chunks: 148, added: "Jul 14", status: "Indexed" },
  { name: "Financial model v6.xlsx", type: "Finance", size: "340 KB", chunks: 62, added: "Jul 22", status: "Indexed" },
  { name: "Pre-seed one-pager v3.docx", type: "Fundraising", size: "88 KB", chunks: 14, added: "Jul 25", status: "Indexed" },
  { name: "Competitor teardown — StudyOS.md", type: "Research", size: "42 KB", chunks: 21, added: "Jul 27", status: "Indexed" },
  { name: "Advisor call notes — Ravi K.txt", type: "Meeting", size: "12 KB", chunks: 6, added: "Jul 9", status: "Indexed" },
  { name: "Cohort retention export.csv", type: "Analytics", size: "2.4 MB", chunks: 0, added: "Jul 28", status: "Embedding" },
];

export const roadmap = [
  {
    phase: "Now · Aug",
    stage: "Building",
    items: [
      { title: "Onboarding rollback A/B", owner: "Aarav", status: "In progress", impact: "Retention" },
      { title: "Auto re-plan v1 (wedge)", owner: "Aarav", status: "In progress", impact: "Differentiation" },
      { title: "Data room completion", owner: "Meera", status: "Todo", impact: "Fundraising" },
    ],
  },
  {
    phase: "Next · Sep–Oct",
    stage: "Launch",
    items: [
      { title: "Pricing test ₹699 (new users)", owner: "Meera", status: "Planned", impact: "Revenue" },
      { title: "Group plan (4 seats)", owner: "Meera", status: "Planned", impact: "ARPU" },
      { title: "Campus ambassador v2", owner: "Kabir", status: "Planned", impact: "Growth" },
    ],
  },
  {
    phase: "Later · Q4",
    stage: "Scaling",
    items: [
      { title: "Hindi + Tamil interface", owner: "Kabir", status: "Backlog", impact: "New market" },
      { title: "Employer skill transcript pilot", owner: "Aarav", status: "Backlog", impact: "Moat" },
      { title: "Close pre-seed", owner: "Meera", status: "Backlog", impact: "Capital" },
    ],
  },
];

export const tasks = [
  { id: "T-88", title: "Ship `onb_v2` rollback flag", from: "R-241", priority: "P0", due: "Aug 6", done: false },
  { id: "T-89", title: "Instrument first-session funnel events", from: "R-241", priority: "P0", due: "Aug 7", done: false },
  { id: "T-90", title: "Run pricing simulation at ₹599 / ₹699 / ₹799", from: "R-238", priority: "P1", due: "Aug 9", done: true },
  { id: "T-91", title: "Add cohort retention chart to data room", from: "R-236", priority: "P1", due: "Aug 12", done: false },
  { id: "T-92", title: "Send 4 warm investor intros", from: "R-236", priority: "P1", due: "Aug 14", done: false },
  { id: "T-93", title: "Draft auto re-plan spec", from: "O-51", priority: "P2", due: "Aug 18", done: false },
];

export const learningLog = [
  {
    id: "L-31",
    date: "Jul 26",
    prediction: "Cheaper inference tier cuts burn 6%",
    actual: "Burn fell 9%",
    delta: "+3pts better",
    lesson: "Model under-weights fixed-cost leverage on infra changes. Financial Agent prior adjusted.",
    confidenceShift: +4,
  },
  {
    id: "L-29",
    date: "Jul 18",
    prediction: "Onboarding v2 raises activation to 48%",
    actual: "Activation 41%, retention −3.1pts",
    delta: "−7pts worse",
    lesson: "Structured-data collection was scored as an activation asset; it is an activation cost. Prior inverted.",
    confidenceShift: -6,
  },
  {
    id: "L-27",
    date: "Jul 5",
    prediction: "₹2L MRR reached by Jul 20",
    actual: "₹2L MRR reached Jul 1",
    delta: "19 days early",
    lesson: "Ambassador-driven growth compounds faster than the linear channel model assumed.",
    confidenceShift: +5,
  },
  {
    id: "L-24",
    date: "Jun 22",
    prediction: "StudyOS will not ship a planner this quarter",
    actual: "Shipped in 11 days",
    delta: "Wrong",
    lesson: "Funded competitors ship adjacent features far faster than headcount implies. Threat model recalibrated.",
    confidenceShift: -8,
  },
];

export const pipeline = [
  { step: "Intent detection", detail: "Classified as: strategic decision · pricing", ms: 120 },
  { step: "Memory retrieval", detail: "14 chunks from 6 documents, recency-weighted", ms: 340 },
  { step: "Knowledge graph", detail: "Traversed pricing → ICP → competitor subgraph (23 nodes)", ms: 180 },
  { step: "Web search", detail: "9 live sources, 4 passed the credibility filter", ms: 1420 },
  { step: "Planning", detail: "Decomposed into 3 sub-tasks across 3 agents", ms: 210 },
  { step: "Specialized agents", detail: "Financial + Forecasting + Strategy executed in parallel", ms: 2980 },
  { step: "Critic agent", detail: "Challenged 2 assumptions, 1 survived, confidence adjusted −9", ms: 860 },
  { step: "Evidence verification", detail: "Every claim mapped to a citation; 1 unsupported claim dropped", ms: 440 },
  { step: "Recommendation", detail: "Synthesized with confidence 73% and 2 alternatives", ms: 620 },
  { step: "Memory update", detail: "Wrote decision node D-241 + 5 relationships", ms: 150 },
];

export const investorChecklist = [
  { item: "Incorporation & cap table", done: true, note: "Clean, 3 founders, no SAFEs outstanding" },
  { item: "12-month financial model", done: true, note: "v6, reviewed by Financial Agent" },
  { item: "Traction dashboard", done: true, note: "7 months of MRR + user growth" },
  { item: "Cohort retention charts", done: false, note: "Missing — blocks diligence" },
  { item: "Customer references (3)", done: true, note: "Priya, Arjun, Sneha confirmed" },
  { item: "Competitive landscape memo", done: true, note: "Auto-generated, 6 competitors" },
  { item: "Hiring plan post-raise", done: false, note: "Draft exists, not costed" },
  { item: "Data protection / DPDP note", done: false, note: "Required for Indian student data" },
];

export const deckSlides = [
  { title: "Problem", status: "Ready", note: "41% of students abandon plans after one missed week" },
  { title: "Solution", status: "Ready", note: "A planner that re-plans itself" },
  { title: "Why now", status: "Ready", note: "Cheap inference + exam-cycle digitisation" },
  { title: "Market", status: "Ready", note: "4.1M tier-2 TAM, 1.2M SAM" },
  { title: "Product", status: "Ready", note: "3 screenshots, auto-pulled" },
  { title: "Traction", status: "Needs data", note: "Add cohort retention chart" },
  { title: "Business model", status: "Ready", note: "Freemium → ₹699 Pro" },
  { title: "Competition", status: "Ready", note: "2×2 vs 6 tracked players" },
  { title: "Team", status: "Draft", note: "Add advisor Ravi K." },
  { title: "Ask", status: "Draft", note: "₹2Cr for 18 months + 4 hires" },
];

export const docTemplates = [
  { name: "Investor update", desc: "Monthly narrative + metrics, pulled from memory", time: "40s" },
  { name: "Pre-seed one-pager", desc: "Problem, wedge, traction, ask", time: "35s" },
  { name: "Customer interview guide", desc: "Tailored to current open questions", time: "20s" },
  { name: "Product spec", desc: "From an opportunity or recommendation", time: "55s" },
  { name: "Pricing memo", desc: "Evidence-backed pricing rationale", time: "45s" },
  { name: "Founder agreement (draft)", desc: "Template with your cap table filled in", time: "30s" },
];

export const validationCriteria = [
  { label: "Problem severity", score: 84, note: "41% churn cite the exact pain; interviews rate it 8.2/10" },
  { label: "Market size", score: 71, note: "₹1,900Cr SAM in India; growing 18% YoY" },
  { label: "Willingness to pay", score: 66, note: "Optimal price ₹690, but student budgets are seasonal" },
  { label: "Founder-market fit", score: 92, note: "All 3 founders are 2 years out of the target segment" },
  { label: "Defensibility", score: 48, note: "Wedge is copyable in ~6 weeks by a funded team" },
  { label: "Distribution", score: 77, note: "Ambassador loop works: 78% of signups are organic" },
  { label: "Timing", score: 74, note: "Inference cost drop makes unit economics viable now" },
];

export const notifications = [
  { id: "n1", tone: "warn", text: "D30 retention dropped 3.1pts in the post-Jun-14 cohort.", time: "2h ago" },
  { id: "n2", tone: "info", text: "StudyOS launched an AI planner yesterday — threat score +7.", time: "6h ago" },
  { id: "n3", tone: "good", text: "Runway extended to 11.8 months after the infra change.", time: "1d ago" },
  { id: "n4", tone: "warn", text: "You haven't updated revenue actuals for July.", time: "1d ago" },
  { id: "n5", tone: "good", text: "Fundraising readiness improved 9 points this month.", time: "2d ago" },
  { id: "n6", tone: "good", text: "High-confidence opportunity detected: exam-cycle re-planning.", time: "3d ago" },
];

export const chatSeed = [
  {
    role: "assistant" as const,
    text: "Morning, Meera. Overnight I re-ran the retention diagnosis and verified StudyOS's planner launch. Two things need a decision today: the onboarding rollback (86% confidence) and whether we open the pre-seed conversation this month.",
  },
];
