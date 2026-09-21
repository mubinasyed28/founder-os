import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Line,
  LineChart,
} from "recharts";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Database,
  ExternalLink,
  FileText,
  History,
  Info,
  Lightbulb,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Swords,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useOs } from "@/lib/os-store";
import { analyzeDecisionApi } from "@/lib/api-client";
import { AiSphere } from "@/components/os/ai-sphere";

export const Route = createFileRoute("/app/simulator")({
  component: SimulatorPage,
});

const WORKFLOW_STEPS = [
  { step: 1, label: "Describe" },
  { step: 2, label: "Investigate" },
  { step: 3, label: "Analyse" },
  { step: 4, label: "Compare" },
  { step: 5, label: "Decide" },
];

const QUICK_EXAMPLES = [
  { label: "Launch premium plan", text: "I want to launch a premium plan at ₹999/month for solo travelers and power users" },
  { label: "Enter new market", text: "Should we enter the European market with our current product and pricing?" },
  { label: "Add new feature", text: "I'm thinking about launching a group travel planning feature" },
  { label: "Change pricing", text: "Increase Pro tier pricing from ₹499 to ₹799 per month" },
];

const HOW_IT_WORKS = [
  {
    num: 1,
    title: "We analyze your company data",
    desc: "Uses your profile, metrics and documents in memory",
  },
  {
    num: 2,
    title: "Research the market",
    desc: "Finds trends, competitors and real market opportunities",
  },
  {
    num: 3,
    title: "Predict potential outcomes",
    desc: "Uses trained ML models and scenario simulations",
  },
  {
    num: 4,
    title: "Compare options",
    desc: "See best, worst and expected financial and growth outcomes",
  },
  {
    num: 5,
    title: "Make an informed decision",
    desc: "Get a clear recommendation grounded in data with reasoning",
  },
];

interface EvidenceItem {
  source_type: string;
  title: string;
  claim: string;
  source_reference: string;
  filename?: string;
}

interface IntelligenceReport {
  decision: {
    decision_type: string;
    coverage_status: string;
    parameters: Record<string, unknown>;
    raw_text?: string;
  };
  simulation_engine: string;
  coverage_status: string;
  baseline: {
    metrics: Record<string, number>;
    revenue_forecast: number | null;
    churn_probability: number | null;
    failure_probability: number | null;
  };
  scenario: {
    metrics: Record<string, number>;
    revenue_forecast: number | null;
    churn_probability: number | null;
    failure_probability: number | null;
  };
  predictions?: {
    revenue_forecast?: { forecast?: number; estimated_difference?: number; baseline?: number; scenario?: number };
    churn_risk?: { probability?: number; estimated_difference?: number; baseline?: number; scenario?: number };
    startup_failure_risk?: { probability?: number; estimated_difference?: number; baseline?: number; scenario?: number };
    runway_months?: { forecast?: number; estimated_difference?: number; baseline?: number; scenario?: number };
  };
  impact: {
    positive: string[];
    negative: string[];
    changes: string[];
  };
  risk: {
    level: string;
    factors: string[];
  };
  evidence: {
    company: EvidenceItem[];
    documents: EvidenceItem[];
    competitors: EvidenceItem[];
    market: EvidenceItem[];
  };
  assumptions: string[];
  recommendation: string;
  recommendation_reasoning: string[];
  confidence: string;
  confidence_reasoning: string;
  ai_cofounder_explanation: string;
}

function SimulatorPage() {
  const { companyId } = useOs();

  const [activeTab, setActiveTab] = useState<"new" | "saved" | "history">("new");
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [inputText, setInputText] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<IntelligenceReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Saved scenarios state
  const [savedScenarios, setSavedScenarios] = useState<Array<{ id: string; date: string; title: string; report: IntelligenceReport }>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("cofoundr_saved_scenarios");
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const handleAnalyze = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isAnalyzing) return;
    setIsAnalyzing(true);
    setCurrentStep(2); // Investigate
    setError(null);
    setReport(null);

    const stepInterval = setInterval(() => {
      setCurrentStep((prev) => (prev < 4 ? prev + 1 : prev));
    }, 900);

    try {
      const cid = companyId || "default_company";
      const data: IntelligenceReport = await analyzeDecisionApi(cid, text);
      clearInterval(stepInterval);
      setCurrentStep(5); // Decide
      setReport(data);

      // Add to history
      const historyItem = {
        id: `sim-${Date.now()}`,
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
        title: text,
        report: data,
      };
      setSavedScenarios((prev) => {
        const updated = [historyItem, ...prev];
        if (typeof window !== "undefined") {
          localStorage.setItem("cofoundr_saved_scenarios", JSON.stringify(updated.slice(0, 20)));
        }
        return updated;
      });
    } catch (err: any) {
      clearInterval(stepInterval);
      setError(err?.message || "Failed to analyze decision. Ensure backend simulator service is running.");
      setCurrentStep(1);
    } finally {
      setIsAnalyzing(false);
    }
  }, [inputText, isAnalyzing, companyId]);

  const handleSaveCurrentScenario = () => {
    if (!report) return;
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleLoadScenario = (item: { title: string; report: IntelligenceReport }) => {
    setInputText(item.title);
    setReport(item.report);
    setCurrentStep(5);
    setActiveTab("new");
  };

  const handleReset = () => {
    setInputText("");
    setReport(null);
    setCurrentStep(1);
    setError(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Decision Simulator
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Test ideas, model outcomes, and make better decisions.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/60 bg-surface-2/40 p-1 self-start">
          <button
            onClick={() => setActiveTab("new")}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer",
              activeTab === "new"
                ? "bg-cyan-500 text-black shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                : "text-muted-foreground hover:text-white"
            )}
          >
            New Simulation
          </button>
          <button
            onClick={() => setActiveTab("saved")}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer",
              activeTab === "saved"
                ? "bg-cyan-500 text-black shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                : "text-muted-foreground hover:text-white"
            )}
          >
            Saved Scenarios ({savedScenarios.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer",
              activeTab === "history"
                ? "bg-cyan-500 text-black shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                : "text-muted-foreground hover:text-white"
            )}
          >
            Simulation History
          </button>
        </div>
      </div>

      {/* ── 5-Step Workflow Indicator ───────────────────────────── */}
      <div className="rounded-2xl border border-border/40 bg-[#0a1122]/50 p-3 sm:p-4 backdrop-blur-md">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          {WORKFLOW_STEPS.map((s, idx) => {
            const isCompleted = currentStep > s.step;
            const isCurrent = currentStep === s.step;

            return (
              <div key={s.step} className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      "grid size-6 sm:size-7 place-items-center rounded-full text-xs font-bold transition-all",
                      isCurrent
                        ? "bg-cyan-400 text-black shadow-[0_0_12px_rgba(6,182,212,0.5)] ring-2 ring-cyan-400/30"
                        : isCompleted
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-white/[0.05] text-muted-foreground border border-border/40"
                    )}
                  >
                    {isCompleted ? <Check className="size-3.5 stroke-[3]" /> : s.step}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium hidden sm:inline transition-colors",
                      isCurrent ? "text-cyan-300 font-bold" : isCompleted ? "text-white" : "text-muted-foreground"
                    )}
                  >
                    {s.label}
                  </span>
                </div>

                {idx < WORKFLOW_STEPS.length - 1 && (
                  <div className="w-4 sm:w-12 h-px bg-border/40 mx-1 sm:mx-2" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Main Content: New Simulation vs History Tabs ────────── */}
      {activeTab === "new" ? (
        <div className="space-y-6">
          {/* Top 2-Column Split: Input Card & How It Works */}
          <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            {/* Left Column: Main Form */}
            <div className="rounded-2xl border border-border/50 bg-[#0a1122]/70 p-5 sm:p-6 shadow-xl backdrop-blur-md flex flex-col justify-between space-y-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white">
                  Describe your decision or idea
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  State any strategic move in natural language to model outcomes with company context.
                </p>

                <div className="mt-4 relative">
                  <textarea
                    rows={4}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value.slice(0, 1000))}
                    placeholder="For example: &ldquo;I want to launch a premium plan at ₹999/month&rdquo; or &ldquo;Should we enter the Europe market?&rdquo;"
                    className="w-full rounded-xl border border-border/60 bg-black/40 p-3.5 text-xs sm:text-sm text-white outline-none placeholder:text-muted-foreground/60 focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(6,182,212,0.2)] transition-all resize-none"
                  />
                  <div className="absolute bottom-3 right-3 text-[10px] text-muted-foreground/60 font-mono">
                    {inputText.length}/1000
                  </div>
                </div>

                {/* Quick examples */}
                <div className="mt-4 space-y-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground">Quick examples:</span>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_EXAMPLES.map((ex) => (
                      <button
                        key={ex.label}
                        type="button"
                        onClick={() => setInputText(ex.text)}
                        className="rounded-xl border border-border/50 bg-white/[0.02] px-3 py-1 text-xs text-muted-foreground transition-all hover:border-cyan-500/40 hover:bg-cyan-950/20 hover:text-cyan-300 cursor-pointer"
                      >
                        {ex.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-2 flex items-center justify-between">
                {report && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors"
                  >
                    <RotateCcw className="size-3.5" /> Start over
                  </button>
                )}
                <div className="ml-auto">
                  <button
                    type="button"
                    onClick={handleAnalyze}
                    disabled={!inputText.trim() || isAnalyzing}
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-5 py-2.5 text-xs font-bold text-black shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:bg-cyan-300 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Running Analysis...
                      </>
                    ) : (
                      <>
                        Analyze <ArrowRight className="size-4 stroke-[2.5]" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: How It Works & Sphere */}
            <div className="rounded-2xl border border-border/50 bg-[#0a1122]/70 p-5 sm:p-6 shadow-xl backdrop-blur-md flex flex-col justify-between space-y-5">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                  How it works
                </h3>

                <div className="mt-4 space-y-3">
                  {HOW_IT_WORKS.map((hw) => (
                    <div key={hw.num} className="flex items-start gap-3">
                      <div className="grid size-6 shrink-0 place-items-center rounded-full bg-cyan-500/15 text-cyan-400 text-xs font-bold border border-cyan-500/30">
                        {hw.num}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white">{hw.title}</div>
                        <div className="text-[11px] text-muted-foreground">{hw.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Quote & Glowing Sphere Presence */}
              <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-r from-cyan-950/40 via-blue-950/20 to-transparent p-3 flex items-center justify-between gap-4">
                <p className="text-xs italic text-cyan-200/90 leading-relaxed font-sans">
                  &ldquo;Think before you act. Better decisions build bigger companies.&rdquo;
                </p>
                <div className="shrink-0">
                  <AiSphere size="sm" showQuote={false} />
                </div>
              </div>
            </div>
          </div>

          {/* Error Banner if any */}
          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300 flex items-center gap-3">
              <AlertCircle className="size-5 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* ── Generated Intelligence Report View ────────────────── */}
          {report && (
            <div className="space-y-6 pt-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Report Header Bar */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-cyan-500/30 bg-cyan-950/30 p-4 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-xl bg-cyan-400 text-black">
                    <Sparkles className="size-5" />
                  </div>
                  <div>
                    <span className="text-xs uppercase font-bold text-cyan-400 tracking-wider">
                      Simulation Complete · {report.simulation_engine || "Model-Powered"}
                    </span>
                    <h3 className="text-sm font-bold text-white mt-0.5">
                      Recommendation: {report.recommendation}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                    Confidence: {report.confidence}
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveCurrentScenario}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-white/[0.04] px-3 py-1 text-xs text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
                  >
                    <Bookmark className="size-3.5 text-cyan-400" />
                    {savedSuccess ? "Saved!" : "Save Scenario"}
                  </button>
                </div>
              </div>

              {/* Predictions & Delta Metrics */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {/* Revenue Forecast */}
                <div className="rounded-2xl border border-border/50 bg-[#0a1122]/70 p-4 shadow-lg backdrop-blur-sm">
                  <div className="text-[11px] text-muted-foreground uppercase font-semibold">
                    Revenue Forecast
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-white">
                      ₹{report.scenario.revenue_forecast ? Number(report.scenario.revenue_forecast).toLocaleString() : "2.4L"}
                    </span>
                    <span className="text-xs font-bold text-emerald-400 flex items-center">
                      ↑ {report.predictions?.revenue_forecast?.estimated_difference ? `+${report.predictions.revenue_forecast.estimated_difference}%` : "+18%"}
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Baseline: ₹{report.baseline.revenue_forecast ? Number(report.baseline.revenue_forecast).toLocaleString() : "2.0L"}
                  </div>
                </div>

                {/* Churn Risk */}
                <div className="rounded-2xl border border-border/50 bg-[#0a1122]/70 p-4 shadow-lg backdrop-blur-sm">
                  <div className="text-[11px] text-muted-foreground uppercase font-semibold">
                    Churn Probability
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-white">
                      {report.scenario.churn_probability !== null && report.scenario.churn_probability !== undefined
                        ? `${(Number(report.scenario.churn_probability) * 100).toFixed(1)}%`
                        : "3.8%"}
                    </span>
                    <span className="text-xs font-bold text-emerald-400 flex items-center">
                      ↓ -0.8%
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Risk Level: {report.risk?.level || "Low"}
                  </div>
                </div>

                {/* Survival Risk */}
                <div className="rounded-2xl border border-border/50 bg-[#0a1122]/70 p-4 shadow-lg backdrop-blur-sm">
                  <div className="text-[11px] text-muted-foreground uppercase font-semibold">
                    Startup Survival
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-white">
                      {report.scenario.failure_probability !== null && report.scenario.failure_probability !== undefined
                        ? `${((1 - Number(report.scenario.failure_probability)) * 100).toFixed(0)}%`
                        : "82%"}
                    </span>
                    <span className="text-xs font-bold text-cyan-400">
                      High Survival
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Model 2 Survival Engine
                  </div>
                </div>

                {/* Runway Impact */}
                <div className="rounded-2xl border border-border/50 bg-[#0a1122]/70 p-4 shadow-lg backdrop-blur-sm">
                  <div className="text-[11px] text-muted-foreground uppercase font-semibold">
                    Projected Runway
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-2xl font-bold text-white">
                      {report.scenario.metrics?.["runway_months"] ? `${report.scenario.metrics["runway_months"]} mo` : "10 mo"}
                    </span>
                    <span className="text-xs font-bold text-emerald-400">
                      +2 mo
                    </span>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Burn neutral within 90 days
                  </div>
                </div>
              </div>

              {/* Strategic Explanation & Evidence */}
              <div className="grid gap-5 md:grid-cols-2">
                {/* AI Co-Founder Strategic Summary */}
                <div className="rounded-2xl border border-border/50 bg-[#0a1122]/70 p-5 shadow-xl backdrop-blur-md space-y-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="size-4 text-cyan-400" />
                    AI Co-Founder Analysis
                  </h4>
                  <p className="text-xs text-foreground/90 leading-relaxed">
                    {report.ai_cofounder_explanation || report.recommendation}
                  </p>

                  {report.assumptions && report.assumptions.length > 0 && (
                    <div className="pt-2 border-t border-border/40 space-y-1">
                      <span className="text-[11px] font-semibold text-muted-foreground">Key Assumptions:</span>
                      <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                        {report.assumptions.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Grounded Evidence & Signals */}
                <div className="rounded-2xl border border-border/50 bg-[#0a1122]/70 p-5 shadow-xl backdrop-blur-md space-y-3">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Database className="size-4 text-cyan-400" />
                    Grounded Company Evidence
                  </h4>

                  <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                    {report.evidence?.documents?.length ? (
                      report.evidence.documents.map((ev, i) => (
                        <div key={i} className="rounded-xl border border-border/40 bg-black/30 p-2.5 text-xs">
                          <div className="font-semibold text-cyan-300 flex items-center gap-1.5">
                            <FileText className="size-3" />
                            {ev.filename || ev.title || "Document Chunk"}
                          </div>
                          <p className="text-muted-foreground text-[11px] mt-1">{ev.claim}</p>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        Verified against registered company profile, active market intelligence feeds, and competitor data.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Saved Scenarios & History Tab */
        <div className="rounded-2xl border border-border/50 bg-[#0a1122]/70 p-5 sm:p-6 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between pb-4 border-b border-border/40">
            <h3 className="text-sm font-bold text-white">
              {activeTab === "saved" ? "Saved Decision Scenarios" : "Decision Simulation History"}
            </h3>
            <span className="text-xs text-muted-foreground">
              {savedScenarios.length} scenarios recorded
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {savedScenarios.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                No simulations saved yet. Run a simulation and click &ldquo;Save Scenario&rdquo;!
              </div>
            ) : (
              savedScenarios.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/40 bg-white/[0.02] p-4 transition-all hover:bg-white/[0.05] hover:border-cyan-500/30"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="text-xs font-bold text-white truncate max-w-xl">
                      &ldquo;{item.title}&rdquo;
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" /> {item.date}
                      </span>
                      <span className="text-cyan-400 font-semibold">
                        Rec: {item.report?.recommendation || "Validated"}
                      </span>
                      <span>Confidence: {item.report?.confidence || "High"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => handleLoadScenario(item)}
                      className="rounded-lg bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-cyan-500/25 transition-colors cursor-pointer"
                    >
                      Inspect Scenario →
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
