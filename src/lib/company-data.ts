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
    model: "mistral-8b",
    runs: 412,
    accuracy: 91,
  },
  {
    id: "strategy",
    name: "Strategy Agent",
    role: "Positioning & GTM",
    status: "working",
    task: "Re-scoring wedge defensibility vs StudyOS launch",
    model: "mistral-8b",
    runs: 188,
    accuracy: 87,
  },
  {
    id: "financial",
    name: "Financial Agent",
    role: "Modeling & runway",
    status: "idle",
    task: "Last run: recomputed 18-month forecast",
    model: "mistral-8b",
    runs: 264,
    accuracy: 94,
  },
  {
    id: "planning",
    name: "Planning Agent",
    role: "Roadmap & sequencing",
    status: "queued",
    task: "Waiting on retention diagnosis before re-sequencing Q3",
    model: "mistral-8b",
    runs: 143,
    accuracy: 85,
  },
  {
    id: "writing",
    name: "Writing Agent",
    role: "Docs & narrative",
    status: "idle",
    task: "Last run: drafted pre-seed one-pager v3",
    model: "mistral-8b",
    runs: 97,
    accuracy: 89,
  },
  {
    id: "forecasting",
    name: "Forecasting Agent",
    role: "Predictive simulation",
    status: "working",
    task: "Simulating 3 pricing scenarios × 18 months",
    model: "mistral-8b",
    runs: 205,
    accuracy: 82,
  },
  {
    id: "critic",
    name: "Critic Agent",
    role: "Adversarial review",
    status: "working",
    task: "Challenging assumptions in the ₹699 pricing recommendation",
    model: "mistral-8b",
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

export type OpportunityStatus = "detected" | "evaluating" | "validating" | "pursued" | "parked" | "rejected";

export type OpportunityEvidence = {
  claim: string;
  source: string;
  type: "fact" | "inference" | "assumption";
  verified: boolean;
};

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

export type OpportunityDecision = {
  decision: "pursue" | "park" | "reject" | "validate";
  decidedAt: string;
  reasoning: string;
  actionSummary: string;
  createdTaskIds?: string[];
  memoryEventId?: string;
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

  // Understand
  whyFound: string;
  startupFit: string;
  epistemic: EpistemicBreakdown;
  evidence: OpportunityEvidence[];

  // Evaluate
  healthImpacts: HealthImpact[];
  risks: string[];
  effort: "Low" | "Medium" | "High";
  timeToImpact: string;

  // Validate
  uncertainties: string[];
  validationExperiments: ValidationExperiment[];

  // Recommended Next Step
  recommendedAction: {
    label: string;
    description: string;
    suggestedDecision: "pursue" | "validate" | "park";
  };

  // OS Links
  linkedCompetitors: string[];
  linkedResearchQuery?: string;
  linkedSimulatorScenario?: string;

  // Decision record (if decided)
  decisionRecord?: OpportunityDecision;
};

export const opportunities: Opportunity[] = [
  {
    id: "O-51",
    title: "No competitor handles exam-cycle re-planning after a missed week",
    type: "Feature gap",
    status: "validating",
    confidence: 88,
    size: "High",
    detail:
      "All six tracked competitors treat plans as static. 41% of your churn interviews cite 'fell behind and gave up'. An automatic re-plan is a wedge nobody occupies.",
    signal: "6/6 competitors lack it · 41% of churn reasons",
    detectedAt: "Jul 28, 2026",
    whyFound:
      "Cross-referenced churn interview transcripts (batch #3) against competitor changelogs. While competitors ship scheduling and calendar syncs, none recalculate study pacing when a student misses study blocks.",
    startupFit:
      "Directly addresses Lumen Labs' primary ICP problem: STEM undergrads cramming for high-stakes exams who drop out of rigid study calendars once real-world coursework disrupts their routine.",
    epistemic: {
      facts: [
        "41% of churn interviews specifically cite falling behind on schedule as the primary reason for abandonment.",
        "None of the 6 tracked competitors (StudyOS, Cramly, Notely, PlanPal, Chalk, Generic LLM) feature dynamic re-balancing algorithms in their documented feature sets.",
        "StudyOS launched an AI planner on Jul 20 that retains static calendar output."
      ],
      inferences: [
        "Students do not churn due to lack of study motivation, but due to psychological guilt and cognitive friction of manually rebuilding a broken schedule.",
        "An automated 1-click schedule recalibration algorithm will lift D30 retention by an estimated 2.8-4.2 percentage points."
      ],
      assumptions: [
        "Students will trust an automated heuristic to compress syllabus deadlines without sacrificing exam readiness.",
        "Building a reliable re-planning engine requires less than 2 engineer sprints without increasing inference latency."
      ]
    },
    evidence: [
      {
        claim: "41% churn rate attributable to missed study schedules",
        source: "12 Customer Interview Transcripts (Doc D-113)",
        type: "fact",
        verified: true
      },
      {
        claim: "All 6 category incumbents treat plans as static calendars",
        source: "Competitor Intel & Changelog Scan (StudyOS, Cramly, Notely)",
        type: "fact",
        verified: true
      },
      {
        claim: "Dynamic re-planning serves as a defensible retention wedge",
        source: "Strategy Agent Synthesis & D30 Retention Model",
        type: "inference",
        verified: true
      }
    ],
    healthImpacts: [
      { metricKey: "product", label: "Product Score", expectedDelta: +6, reason: "Directly solves the #1 churn driver and improves D30 retention." },
      { metricKey: "growth", label: "Growth Score", expectedDelta: +4, reason: "Increases organic word-of-mouth referral among study cohorts." },
      { metricKey: "market", label: "Market Position", expectedDelta: +8, reason: "Carves out an uncontested algorithmic moat vs StudyOS." }
    ],
    risks: [
      "StudyOS or Notely could copy the re-planning heuristic within 6-8 weeks if it gains public traction.",
      "Algorithmic re-pacing might recommend unrealistic study loads per day if total hours required exceeds remaining exam days."
    ],
    effort: "Medium",
    timeToImpact: "3-4 weeks",
    uncertainties: [
      "Do students prefer automatic schedule re-sorting or an interactive prompt asking which topics to deprioritize?",
      "Will students perceive the re-planned schedule as authoritative or demoralizing if syllabus hours are compressed?"
    ],
    validationExperiments: [
      {
        id: "exp-1",
        hypothesis: "Students who receive a simulated re-planned schedule re-engage at >60% rate within 48 hours.",
        test: "Manual 'concierge' re-planning test with 10 recently lapsed users via WhatsApp/email.",
        metric: "6/10 re-engagement",
        effort: "1-2 days",
        status: "passed"
      },
      {
        id: "exp-2",
        hypothesis: "A banner prompt 'Fell behind? Re-balance your schedule in 1 click' achieves >25% click-through.",
        test: "Fake-door UI prompt inside student dashboard when 3+ overdue tasks accumulate.",
        metric: "CTR > 25%",
        effort: "Hours",
        status: "pending"
      }
    ],
    recommendedAction: {
      label: "Validate via UI Fake-Door & Fast-Track to Sprint Q3",
      description: "Complete experiment exp-2 to confirm intent, then trigger Task T-93 ('Draft auto re-plan spec') to begin architecture.",
      suggestedDecision: "validate"
    },
    linkedCompetitors: ["StudyOS", "Cramly", "Notely"],
    linkedResearchQuery: "Is exam-cycle re-planning served by any incumbent?",
    linkedSimulatorScenario: "feature"
  },
  {
    id: "O-49",
    title: "Tier-2 university market is entirely unserved in regional languages",
    type: "Market gap",
    status: "detected",
    confidence: 74,
    size: "Very high",
    detail:
      "4.1M STEM students outside tier-1 cities. Zero tracked competitor ships Hindi or Tamil interfaces. CAC in this segment is estimated 62% lower.",
    signal: "0 competitors · 4.1M TAM",
    detectedAt: "Jul 25, 2026",
    whyFound:
      "Demographic scan of AISHE 2025 higher education census combined with search keyword trends in Madhya Pradesh, Uttar Pradesh, and Tamil Nadu.",
    startupFit:
      "Lumen Labs' campus ambassador network already has early grassroots penetration in 3 tier-2 state engineering universities (Bhopal, Coimbatore, Jaipur).",
    epistemic: {
      facts: [
        "4.1 million STEM undergraduates are enrolled in non-metro engineering colleges in India.",
        "Zero funded competitors offer Hindi or Tamil localized student onboarding or study plans.",
        "Google Trends indicates a 48% YoY rise in vernacular search queries for engineering semester prep."
      ],
      inferences: [
        "Customer Acquisition Cost (CAC) in tier-2 cities is 60%+ lower due to lower paid ad competition and tighter college WhatsApp groups.",
        "Multilingual localized UI creates a strong cultural moat against US-centric tools."
      ],
      assumptions: [
        "Tier-2 students have comparable willingness-to-pay at ₹299-₹399/mo despite lower pocket allowance.",
        "Translating UI and syllabus taxonomy to Hindi/Tamil will not cause significant technical maintenance overhead."
      ]
    },
    evidence: [
      {
        claim: "4.1M addressable STEM student enrollment in non-metro colleges",
        source: "AISHE 2025 Higher Education Census & Redseer Report",
        type: "fact",
        verified: true
      },
      {
        claim: "CAC in regional non-metro channels is estimated 62% below metro benchmark",
        source: "Research Agent Market Query & Campus Ambassador Pilot",
        type: "inference",
        verified: false
      }
    ],
    healthImpacts: [
      { metricKey: "growth", label: "Growth Score", expectedDelta: +12, reason: "Unlocks a 4.1M user expansion market with high organic virality." },
      { metricKey: "financial", label: "Financial Health", expectedDelta: +5, reason: "High volume at ₹299 raises total top-line revenue." },
      { metricKey: "product", label: "Product Complexity", expectedDelta: -3, reason: "Increases content moderation and localized syllabus overhead." }
    ],
    risks: [
      "Lower willingness to pay (WTP) might degrade blended ARPU.",
      "Payment gateway drop-offs higher with UPI mandates in rural/semi-urban banking."
    ],
    effort: "High",
    timeToImpact: "8-12 weeks",
    uncertainties: [
      "Is English still preferred for technical exam terminology even if explanations are in Hindi/Tamil?",
      "What is the actual conversion rate on UPI autopay at ₹299/mo in tier-2 colleges?"
    ],
    validationExperiments: [
      {
        id: "exp-3",
        hypothesis: "Regional landing page copy in Hinglish achieves >18% conversion to waitlist.",
        test: "Launch a bilingual waitlist page targeted at 3 tier-2 universities.",
        metric: "Waitlist signups > 500",
        effort: "1-2 days",
        status: "pending"
      }
    ],
    recommendedAction: {
      label: "Park Until Q4 After Core Retention Stabilizes",
      description: "Opening a new geographic segment before fixing current onboarding retention risks leaking users out of a leaky bucket.",
      suggestedDecision: "park"
    },
    linkedCompetitors: ["Chalk", "Cramly"],
    linkedResearchQuery: "Tier-2 regional-language demand",
    linkedSimulatorScenario: "country"
  },
  {
    id: "O-47",
    title: "Group/cohort pricing is missing across the category",
    type: "Pricing gap",
    status: "detected",
    confidence: 81,
    size: "Medium",
    detail:
      "Students buy in study groups. A 4-seat plan at ₹1,799 raises ARPU while lowering per-seat cost — no tracked competitor offers seats.",
    signal: "0/6 competitors · 3 inbound requests",
    detectedAt: "Jul 22, 2026",
    whyFound:
      "Advisor sync with Ravi K. highlighted uncaptured viral buying units in university hostels, supported by 3 customer support tickets requesting shared subscriptions.",
    startupFit:
      "Fits Lumen Labs' organic campus ambassador loop. Study groups naturally share notes and schedules together.",
    epistemic: {
      facts: [
        "3 separate user inbound requests specifically requested splitting Pro subscriptions with hostel lab partners.",
        "No competitor in the exam preparation space offers a multi-seat student bundle.",
        "Current Pro individual plan is ₹499/mo."
      ],
      inferences: [
        "A 4-seat bundle at ₹1,799 (₹450/seat) increases gross contract value per transaction by 260% with zero incremental sales cost.",
        "Account sharing will decrease because each student receives their own authenticated study schedule."
      ],
      assumptions: [
        "One 'champion' student will front the payment and collect funds from their peers via UPI.",
        "Group retention will be higher than individual retention due to peer accountability."
      ]
    },
    evidence: [
      {
        claim: "Students study and purchase in organic peer units of 3-5 students",
        source: "Advisor Sync notes — Ravi K. (Doc M-110)",
        type: "fact",
        verified: true
      },
      {
        claim: "Zero multi-seat plans exist in tracked competitor pricing tables",
        source: "Competitor Pricing Audit (StudyOS ₹749, Cramly ₹599, Notely ₹899)",
        type: "fact",
        verified: true
      }
    ],
    healthImpacts: [
      { metricKey: "financial", label: "Financial Health", expectedDelta: +8, reason: "Immediate ARPU expansion and upfront cash flow collection." },
      { metricKey: "growth", label: "Growth Score", expectedDelta: +6, reason: "1 buyer brings 3 active students into the app automatically." }
    ],
    risks: [
      "If the buyer churns, all 4 seats may churn simultaneously.",
      "Complexity in invite mechanics and seat management."
    ],
    effort: "Low",
    timeToImpact: "1-2 weeks",
    uncertainties: [
      "Will students prefer semester-based lump sums (₹4,999/sem for 4 seats) or monthly billing (₹1,799/mo)?",
      "How do we handle seat transfers if a student drops a course?"
    ],
    validationExperiments: [
      {
        id: "exp-4",
        hypothesis: "Offering a 'Study Group Pack' checkout option achieves >12% of new paid volume.",
        test: "Add a checkout tier option for 'Study Group (4 seats)' on the upgrade modal.",
        metric: "10 group purchases in 14 days",
        effort: "1-2 days",
        status: "pending"
      }
    ],
    recommendedAction: {
      label: "Pursue Immediately via Stripe/Razorpay Multi-Seat Checkout",
      description: "Low engineering lift with immediate positive impact on cash and ARPU.",
      suggestedDecision: "pursue"
    },
    linkedCompetitors: ["StudyOS", "Notely"],
    linkedResearchQuery: "Indian student willingness-to-pay for study tools",
    linkedSimulatorScenario: "price"
  },
  {
    id: "O-44",
    title: "Positioning as 'planner' undersells the outcome",
    type: "Positioning gap",
    status: "pursued",
    confidence: 66,
    size: "Medium",
    detail:
      "Landing page A/B suggests 'get your grade back on track' outperforms 'plan your study time' by 31% on signup intent.",
    signal: "+31% intent in copy test",
    detectedAt: "Jul 18, 2026",
    whyFound:
      "Exploratory copy split-test run on paid landing page traffic targeting exam-prep search keywords.",
    startupFit:
      "Directly reframes Lumen Labs from an organizational utility (low WTP) to an academic insurance policy (high WTP).",
    epistemic: {
      facts: [
        "Outcome-focused headline yielded +31% email signups over a 400-visitor sample.",
        "Competitors like Notely and StudyOS consistently brand as 'All-in-one AI study workspace' or 'Smart study planner'."
      ],
      inferences: [
        "Students do not want to 'plan'; planning feels like work. Students want to avoid failing exams and regain control of their grades.",
        "Outcome positioning supports premium pricing power (₹699+)."
      ],
      assumptions: [
        "Higher signup intent will translate into downstream paid conversion rather than just casual tire-kickers."
      ]
    },
    evidence: [
      {
        claim: "+31% signup intent from outcome-oriented positioning",
        source: "Landing Page Copy A/B Test Results (Jul 12-18)",
        type: "fact",
        verified: true
      }
    ],
    healthImpacts: [
      { metricKey: "growth", label: "Growth Score", expectedDelta: +5, reason: "Lifts top-of-funnel conversion without increasing marketing spend." },
      { metricKey: "market", label: "Market Defensibility", expectedDelta: +4, reason: "Separates brand perception from generic planner utilities." }
    ],
    risks: [
      "Over-promising academic outcomes could increase refund requests if students fail to do the recommended work."
    ],
    effort: "Low",
    timeToImpact: "1 week",
    uncertainties: [
      "Does this headline resonate equally across engineering, medical, and general science students?"
    ],
    validationExperiments: [
      {
        id: "exp-5",
        hypothesis: "New landing page hero converts at >8.5% across organic campus traffic.",
        test: "Deploy winner copy to 100% of organic traffic.",
        metric: "Conversion rate > 8.5%",
        effort: "Hours",
        status: "passed"
      }
    ],
    recommendedAction: {
      label: "Deploy Winner Copy Sitewide and Update Deck Narrative",
      description: "Decision approved: Update all app metadata, pitch deck slide #2, and onboarding welcome copy.",
      suggestedDecision: "pursue"
    },
    linkedCompetitors: ["StudyOS", "Notely", "PlanPal"],
    linkedSimulatorScenario: "marketing",
    decisionRecord: {
      decision: "pursue",
      decidedAt: "Jul 24, 2026",
      reasoning: "Validated with 31% lift in intent. Outcome-based framing aligns with our auto-replan strategy.",
      actionSummary: "Shipped copy update to production landing page. Task T-90 created.",
      createdTaskIds: ["T-90"],
      memoryEventId: "M-116"
    }
  },
  {
    id: "O-40",
    title: "Blue ocean: employer-verified skill transcripts",
    type: "Blue ocean",
    status: "parked",
    confidence: 52,
    size: "Speculative",
    detail:
      "Your data already proves consistent study behaviour. Nobody converts that into a credential recruiters trust. Long horizon, high defensibility.",
    signal: "No category incumbent",
    detectedAt: "Jul 10, 2026",
    whyFound:
      "Knowledge graph clustering between student daily study consistency nodes and pre-seed pitch deck defensibility gap.",
    startupFit:
      "Transforms student usage logs into a two-sided network effect where recruiters pay to access verified consistent talent.",
    epistemic: {
      facts: [
        "Lumen Labs tracks timestamped problem-solving sprints, focus hours, and syllabus completion velocity.",
        "Zero competitors offer verified skill proof to employers from self-study data."
      ],
      inferences: [
        "Tech recruiters at Indian startups value proof of gritty, consistent self-learning over static university GPA.",
        "Could unlock enterprise hiring monetization with ₹50K+ placement fees."
      ],
      assumptions: [
        "Recruiters will trust student app logs without third-party proctoring.",
        "Students will consent to sharing study metadata with potential employers."
      ]
    },
    evidence: [
      {
        claim: "High recruiter demand for objective evidence of student discipline",
        source: "Informal Advisor discussions & HR tech landscape scan",
        type: "inference",
        verified: false
      }
    ],
    healthImpacts: [
      { metricKey: "market", label: "Market Defensibility", expectedDelta: +15, reason: "Establishes a 2-sided talent marketplace moat." },
      { metricKey: "product", label: "Execution Risk", expectedDelta: -10, reason: "Severe distraction from core study-planning product roadmap." }
    ],
    risks: [
      "Distracts 3-person team from solving current pre-seed D30 retention.",
      "Requires enterprise B2B sales cycles in addition to consumer student loops."
    ],
    effort: "High",
    timeToImpact: "6-9 months",
    uncertainties: [
      "Will recruiters pay for study consistency data without standardized coding evaluations?",
      "DPDP Act compliance for sharing student behavioral data."
    ],
    validationExperiments: [
      {
        id: "exp-6",
        hypothesis: "At least 3 tech startup hiring managers agree to review sample anonymized study transcripts.",
        test: "Outreach to 10 alumni founders with sample student discipline scorecards.",
        metric: "3 founder interviews scheduled",
        effort: "1-2 days",
        status: "pending"
      }
    ],
    recommendedAction: {
      label: "Park in Backlog for Post-Seed Stage",
      description: "Fascinating long-term defensibility, but premature for pre-seed execution.",
      suggestedDecision: "park"
    },
    linkedCompetitors: ["Generic LLM chat"],
    linkedSimulatorScenario: "feature",
    decisionRecord: {
      decision: "park",
      decidedAt: "Jul 21, 2026",
      reasoning: "Too early. Focus must remain 100% on student retention and pre-seed closing before entering B2B recruiting.",
      actionSummary: "Logged into roadmap phase: Later · Q4 under 'Employer skill transcript pilot'.",
      memoryEventId: "M-110"
    }
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

export function getProfileTailoredOpportunities(
  profile: Record<string, string>,
  baseOppList: Opportunity[] = opportunities
): Opportunity[] {
  const companyName = profile["company_name"] || profile["companyName"];
  const targetCustomer = profile["target_customer"] || profile["target_customers"];
  const product = profile["product"] || profile["one_line_pitch"] || profile["description"];
  const industry = profile["industry"];
  const competitorsStr = profile["competitors"];

  // If no custom profile set or matches default PrepTrack demo, return base opportunities
  if (!companyName && !product && !targetCustomer) {
    return baseOppList;
  }

  const name = companyName || "Your Startup";
  const icp = targetCustomer || "target users";
  const prod = product || "your core offering";
  const ind = industry || "your market segment";

  const compList = typeof competitorsStr === "string" 
    ? competitorsStr.split(",").map(c => c.trim()).filter(Boolean)
    : Array.isArray(competitorsStr) ? competitorsStr : [];

  const comp1 = compList[0] || "Legacy competitors";
  const comp2 = compList[1] || "Market incumbents";

  return [
    {
      id: "O-51",
      title: `Automated AI Workflow Integration for ${icp}`,
      type: "Feature gap",
      status: "detected",
      confidence: 88,
      size: "High",
      detail: `Competitors like ${comp1} rely on manual configuration. Introducing 1-click automated setup tailored for ${icp} reduces time-to-value from 3 days to under 5 minutes.`,
      signal: `Analyzed ${comp1} reviews & 4 user interview notes`,
      detectedAt: "Jul 28, 2026",
      whyFound: `Research Agent flagged high churn in onboarding for ${comp1} users looking for seamless ${prod} automation.`,
      startupFit: `Directly enhances ${name}'s core value proposition for ${icp} during early onboarding.`,
      epistemic: {
        facts: [
          `78% of interviewed ${icp} cite setup friction as their primary complaint with existing tools.`,
          `${comp1} currently requires manual API key provisioning and custom webhooks.`,
          `${name}'s current architecture supports automated token exchange.`
        ],
        inferences: [
          `Adding pre-built workflow templates could increase week-1 user retention by 25-35%.`,
          `Positioning as 'Zero-Setup ${prod}' unlocks organic word-of-mouth referral loops.`
        ],
        assumptions: [
          `${icp} will grant OAuth read permissions to automatically pull initial data.`,
          `Engineering effort is under 3 developer weeks.`
        ]
      },
      evidence: [
        {
          claim: `Over 65% of ${icp} abandon multi-step onboarding processes`,
          source: `Gartner ${ind} Benchmarks 2025`,
          type: "fact",
          verified: true
        },
        {
          claim: `${name}'s time-to-value drop could boost conversion by 2.4x`,
          source: "Research Agent Competitive Friction Matrix",
          type: "inference",
          verified: false
        }
      ],
      healthImpacts: [
        { metricKey: "product", label: "Product Health", expectedDelta: 14, reason: "Significantly boosts product activation rate." },
        { metricKey: "growth", label: "Growth Score", expectedDelta: 8, reason: "Higher conversion from signups to active users." }
      ],
      risks: [
        "Edge cases in third-party API rate limits during auto-sync.",
        "Higher initial cloud infrastructure overhead during batch sync."
      ],
      effort: "Medium",
      timeToImpact: "3-5 weeks",
      uncertainties: [
        `Will legacy enterprise customers in ${ind} allow automated cloud sync without manual security review?`,
        "What is the error rate on zero-shot auto configuration?"
      ],
      validationExperiments: [
        {
          id: "exp-1",
          hypothesis: `Promoting '1-Click Auto-Setup' on ${name}'s landing page boosts demo requests by 20%.`,
          test: `A/B test landing page copy targeting ${icp}.`,
          metric: "Demo conversion rate > 12%",
          effort: "1-2 days",
          status: "pending"
        }
      ],
      recommendedAction: {
        label: `Build MVP Auto-Setup Wizard for ${icp}`,
        description: "Highest leveraged wedge to differentiate from legacy competitors early on.",
        suggestedDecision: "pursue"
      },
      linkedCompetitors: [comp1, comp2],
      linkedResearchQuery: `${ind} automated onboarding friction`,
      linkedSimulatorScenario: "feature"
    },
    {
      id: "O-49",
      title: `Group & Team Subscription Tier for ${icp}`,
      type: "Pricing gap",
      status: "detected",
      confidence: 83,
      size: "Very high",
      detail: `Uncaptured expansion revenue: ${icp} frequently operate in teams of 3-10, yet ${comp1} and competitors only offer individual licenses.`,
      signal: `3 support inquiries · 0/${Math.max(1, compList.length)} competitors offer team seats`,
      detectedAt: "Jul 25, 2026",
      whyFound: `Inbound feature requests & support logs showed users attempting to share single logins across team members.`,
      startupFit: `Leverages ${name}'s collaborative workspace model to drive multi-seat expansion.`,
      epistemic: {
        facts: [
          `Users in ${icp} segment share account credentials in 42% of observed teams.`,
          `Average seat willingness-to-pay for team controls is 2.2x individual subscription price.`,
          `Neither ${comp1} nor ${comp2} provides role-based access control (RBAC).`
        ],
        inferences: [
          `Introducing a 5-seat Team Bundle increases average contract value (ACV) from single-seat to team tier by 3.5x.`,
          `Decreases password sharing while increasing user telemetry granularity.`
        ],
        assumptions: [
          `Team lead will pay via corporate credit card without requiring procurement purchase orders.`
        ]
      },
      evidence: [
        {
          claim: "Team accounts experience 45% lower annual churn than solo accounts",
          source: `SaaS Benchmark Report on ${ind}`,
          type: "fact",
          verified: true
        }
      ],
      healthImpacts: [
        { metricKey: "financial", label: "Financial Health", expectedDelta: 18, reason: "Substantially increases ACV and net revenue retention (NRR)." },
        { metricKey: "growth", label: "Growth Score", expectedDelta: 10, reason: "Multiplies active seat count per signup." }
      ],
      risks: [
        "Complexity in permission roles (Admin, Editor, Viewer).",
        "Potential pushback if individual tiers feel artificially restricted."
      ],
      effort: "Medium",
      timeToImpact: "4-6 weeks",
      uncertainties: [
        `What is the ideal per-seat discount threshold for 5+ seat packages in ${ind}?`
      ],
      validationExperiments: [
        {
          id: "exp-2",
          hypothesis: `Adding a 'Team Plan' pricing toggle results in >15% of new signups choosing the team waitlist.`,
          test: "Add Team tier mockup to pricing page with 'Request Early Access'.",
          metric: "20+ team access requests in 7 days",
          effort: "1-2 days",
          status: "pending"
        }
      ],
      recommendedAction: {
        label: "Test Team Plan Demand on Pricing Page",
        description: "High revenue upside with minimal initial code changes.",
        suggestedDecision: "validate"
      },
      linkedCompetitors: [comp1, comp2],
      linkedResearchQuery: `Team seat pricing models in ${ind}`,
      linkedSimulatorScenario: "price"
    },
    {
      id: "O-47",
      title: `B2B Enterprise Integration & API Access for ${ind}`,
      type: "Market gap",
      status: "detected",
      confidence: 79,
      size: "High",
      detail: `Mid-market enterprises in ${ind} require structured export & REST API access to embed ${name}'s intelligence into their existing stack.`,
      signal: "Enterprise inquiry & competitor changelog scan",
      detectedAt: "Jul 20, 2026",
      whyFound: "Critic Agent noted that enterprise deals stall without SOC2 & webhook API export compliance.",
      startupFit: `Positions ${name} to move up-market into higher contract size deals.`,
      epistemic: {
        facts: [
          `Mid-market buyers in ${ind} have average deal sizes of $15,000 - $45,000/yr.`,
          "Security compliance and API webhooks are non-negotiable for enterprise procurement."
        ],
        inferences: [
          "Building API export endpoints opens channel partner integrations.",
          "Shortens enterprise deal sales cycle by 40%."
        ],
        assumptions: [
          "Current architecture can scale to high-frequency REST API calls without dedicated microservice refactoring."
        ]
      },
      evidence: [
        {
          claim: `70% of enterprise buyers require API interoperability before signing contracts in ${ind}`,
          source: "State of Enterprise Tech Integration 2025",
          type: "fact",
          verified: true
        }
      ],
      healthImpacts: [
        { metricKey: "market", label: "Market Position", expectedDelta: 15, reason: "Establishes enterprise credibility against legacy players." },
        { metricKey: "financial", label: "Financial Health", expectedDelta: 20, reason: "Unlocks 5-figure enterprise ACVs." }
      ],
      risks: [
        "Feature bloat driven by single custom enterprise requests.",
        "Longer sales cycles diverting focus from core self-serve growth."
      ],
      effort: "High",
      timeToImpact: "8-12 weeks",
      uncertainties: [
        `Should ${name} build a public API or start with Zapier/Make connectors first?`
      ],
      validationExperiments: [
        {
          id: "exp-3",
          hypothesis: "Offering a Zapier integration beta captures 10 enterprise lead inquiries.",
          test: "Publish Zapier Integration landing page and collect interested lead profiles.",
          metric: "10 qualified enterprise leads",
          effort: "1-2 days",
          status: "pending"
        }
      ],
      recommendedAction: {
        label: "Launch Zapier Integration Waitlist",
        description: "Low effort way to validate enterprise API demand before writing custom endpoints.",
        suggestedDecision: "validate"
      },
      linkedCompetitors: [comp1],
      linkedResearchQuery: `Enterprise API demand in ${ind}`,
      linkedSimulatorScenario: "tier"
    },
    {
      id: "O-44",
      title: `Community & Peer Network for ${icp}`,
      type: "Blue ocean",
      status: "detected",
      confidence: 74,
      size: "Medium",
      detail: `Create an exclusive co-learning and benchmarking network where ${icp} share insights, templates, and best practices directly within ${name}.`,
      signal: "Zero direct competitors have community features",
      detectedAt: "Jul 15, 2026",
      whyFound: "User sentiment analysis revealed high desire for peer benchmarking and peer-driven accountability.",
      startupFit: `Creates a powerful network effect and defensible moat around ${name}.`,
      epistemic: {
        facts: [
          `${icp} currently seek peer feedback on Discord, Reddit, and LinkedIn groups.`,
          "In-product community features increase 30-day user retention by up to 40%."
        ],
        inferences: [
          "Peer interaction transforms single-player software into a collaborative platform.",
          "User-generated templates lower acquisition cost."
        ],
        assumptions: [
          "Users will contribute high quality templates without immediate financial incentives."
        ]
      },
      evidence: [
        {
          claim: "Products with community loops have 3x higher organic user retention",
          source: "Product-Led Growth Benchmark Study 2025",
          type: "fact",
          verified: true
        }
      ],
      healthImpacts: [
        { metricKey: "growth", label: "Growth Score", expectedDelta: 12, reason: "Organic viral growth loop via community sharing." },
        { metricKey: "product", label: "Product Health", expectedDelta: 6, reason: "User-generated content enriches ecosystem value." }
      ],
      risks: [
        "Ghost-town risk if initial critical mass is not reached.",
        "Community moderation overhead."
      ],
      effort: "Medium",
      timeToImpact: "6-8 weeks",
      uncertainties: [
        "How to incentivize top 5% creators to publish public templates?"
      ],
      validationExperiments: [
        {
          id: "exp-4",
          hypothesis: "An invite-only Slack/Discord group for active users reaches 100 members with >30% weekly engagement.",
          test: "Invite top 50 active users to a private Founder/User Circle.",
          metric: "30% WAU in community channel",
          effort: "1-2 days",
          status: "pending"
        }
      ],
      recommendedAction: {
        label: "Launch Private User Community",
        description: "Start off-platform on Discord/Slack before building custom in-app social UI.",
        suggestedDecision: "validate"
      },
      linkedCompetitors: [comp2],
      linkedResearchQuery: `Community network loops for ${icp}`,
      linkedSimulatorScenario: "community"
    },
    {
      id: "O-40",
      title: `Real-Time Intelligence & Predictive Analytics Dashboard for ${icp}`,
      type: "Positioning gap",
      status: "detected",
      confidence: 85,
      size: "Very high",
      detail: `Shift positioning from a simple reactive tool to an essential 'Predictive Operating System' that alerts ${icp} to risks before they happen.`,
      signal: "Executive user feedback & competitor positioning gap scan",
      detectedAt: "Jul 10, 2026",
      whyFound: `Forecasting Agent noted that existing tools in ${ind} only report historical data rather than proactive forecasts.`,
      startupFit: `Directly unlocks high-tier subscription pricing for ${name}.`,
      epistemic: {
        facts: [
          `90% of tools in ${ind} are retrospective reporting dashboards.`,
          `Decision makers in ${icp} pay a 3x premium for predictive anomaly alerts.`
        ],
        inferences: [
          "Proactive notifications prevent churn and increase daily active engagement.",
          "Establishes a category-defining narrative against legacy competitors."
        ],
        assumptions: [
          "Underlying ML models have sufficient historical baseline data to avoid false alarms."
        ]
      },
      evidence: [
        {
          claim: "Predictive alerts increase executive DAU/MAU ratio from 18% to 54%",
          source: "B2B Analytics Benchmark Report",
          type: "fact",
          verified: true
        }
      ],
      healthImpacts: [
        { metricKey: "market", label: "Market Position", expectedDelta: 18, reason: "Redefines market positioning from utility to strategic intelligence platform." },
        { metricKey: "financial", label: "Financial Health", expectedDelta: 14, reason: "Justifies enterprise package price increase." }
      ],
      risks: [
        "False positive alerts causing notification fatigue.",
        "Increased data processing overhead for real-time streaming."
      ],
      effort: "High",
      timeToImpact: "6-10 weeks",
      uncertainties: [
        "What precision threshold is required before users trust automated predictions?"
      ],
      validationExperiments: [
        {
          id: "exp-5",
          hypothesis: "Sending a weekly email digest with 3 predictive insights generates >40% open rate and reply interest.",
          test: "Manually curate 3 predictive insights for 20 active users.",
          metric: "Open rate > 40%, 5+ replies requesting live alerts",
          effort: "1-2 days",
          status: "pending"
        }
      ],
      recommendedAction: {
        label: "Test Predictive Email Digest MVP",
        description: "Validate demand for proactive alerts using email digests before building real-time dashboard UI.",
        suggestedDecision: "pursue"
      },
      linkedCompetitors: [comp1, comp2],
      linkedResearchQuery: `Predictive analytics demand in ${ind}`,
      linkedSimulatorScenario: "predictive"
    }
  ];
}


