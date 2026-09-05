import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import {
  Lightbulb,
  ArrowRight,
  ChevronRight,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
  X,
  ExternalLink,
  MessageSquare,
  BarChart3,
  FlaskConical,
  ShieldAlert,
  Clock,
  TrendingUp,
  Check,
  Target,
  FileText,
  Filter,
  Bookmark,
  Ban,
  Brain,
  History,
  Info
} from "lucide-react";
import { Confidence, PageHeader, Panel, Tag, ScoreRing } from "@/components/os/primitives";
import { useOs } from "@/lib/os-store";
import { cn } from "@/lib/utils";
import type { Opportunity, OpportunityStatus } from "@/lib/company-data";

export const Route = createFileRoute("/app/opportunities")({
  component: OpportunitiesPage,
});

type FilterTab = "all" | "detected" | "validating" | "pursued" | "parked" | "rejected";
type DrawerTab = "understand" | "evaluate" | "validate" | "decide" | "memory";

function getStatusBadge(status: OpportunityStatus) {
  switch (status) {
    case "detected":
      return <Tag tone="muted">New · Detected</Tag>;
    case "evaluating":
      return <Tag tone="primary">Evaluating</Tag>;
    case "validating":
      return <Tag tone="warn">In Validation</Tag>;
    case "pursued":
      return <Tag tone="primary">Pursuing</Tag>;
    case "parked":
      return <Tag tone="muted">Parked</Tag>;
    case "rejected":
      return <Tag tone="bad">Rejected</Tag>;
    default:
      return <Tag tone="muted">{status}</Tag>;
  }
}

function OpportunitiesPage() {
  const { opportunities, decideOpportunity, updateValidationExperiment, pushActivity, profile, refreshOpportunities } = useOs();
  const navigate = useNavigate();

  const [selectedOppId, setSelectedOppId] = useState<string | null>(null);
  const [filterStage, setFilterStage] = useState<FilterTab>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("understand");
  const [isRescanning, setIsRescanning] = useState(false);

  // Decision formulation form state
  const [decisionChoice, setDecisionChoice] = useState<"pursue" | "validate" | "park" | "reject" | null>(null);
  const [decisionReasoning, setDecisionReasoning] = useState("");
  const [customActionTitle, setCustomActionTitle] = useState("");
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);

  const companyName = profile["company_name"] || profile["companyName"] || "Your Startup";
  const targetCustomer = profile["target_customer"] || profile["target_customers"] || "Target Customers";
  const industry = profile["industry"] || "Tech & SaaS";
  const hasCustomProfile = !!(profile["company_name"] || profile["target_customer"] || profile["product"]);

  const handleRescanAi = async () => {
    setIsRescanning(true);
    pushActivity("Strategy Agent", `Initiated AI opportunity rescan for ${companyName}...`);
    try {
      const { regenerateOpportunitiesApi } = await import("@/lib/api-client");
      await regenerateOpportunitiesApi();
      await refreshOpportunities();
      pushActivity("Strategy Agent", `Refreshed 5 strategic opportunities tailored to ${companyName}`);
    } catch (err) {
      console.warn("Error rescanning opportunities:", err);
    } finally {
      setIsRescanning(false);
    }
  };

  const selectedOpp = useMemo(() => {
    return opportunities.find((o) => o.id === selectedOppId) || null;
  }, [opportunities, selectedOppId]);

  // Reset decision form state when changing selected opportunity
  useEffect(() => {
    if (selectedOpp) {
      setDecisionChoice(
        selectedOpp.decisionRecord?.decision ||
          (selectedOpp.status === "pursued"
            ? "pursue"
            : selectedOpp.status === "validating"
            ? "validate"
            : selectedOpp.status === "parked"
            ? "park"
            : selectedOpp.status === "rejected"
            ? "reject"
            : selectedOpp.recommendedAction?.suggestedDecision || "validate")
      );
      setDecisionReasoning(selectedOpp.decisionRecord?.reasoning || "");
      setCustomActionTitle(selectedOpp.decisionRecord?.actionSummary || selectedOpp.recommendedAction?.label || "");
    }
  }, [selectedOpp]);

  // Telemetry counts
  const counts = useMemo(() => {
    return {
      all: opportunities.length,
      detected: opportunities.filter((o) => o.status === "detected" || o.status === "evaluating").length,
      validating: opportunities.filter((o) => o.status === "validating").length,
      pursued: opportunities.filter((o) => o.status === "pursued").length,
      parked: opportunities.filter((o) => o.status === "parked").length,
      rejected: opportunities.filter((o) => o.status === "rejected").length,
    };
  }, [opportunities]);

  // Filtered list
  const filteredOpportunities = useMemo(() => {
    return opportunities.filter((opp) => {
      // Stage filter
      if (filterStage === "detected" && opp.status !== "detected" && opp.status !== "evaluating") return false;
      if (filterStage === "validating" && opp.status !== "validating") return false;
      if (filterStage === "pursued" && opp.status !== "pursued") return false;
      if (filterStage === "parked" && opp.status !== "parked") return false;
      if (filterStage === "rejected" && opp.status !== "rejected") return false;

      // Type filter
      if (filterType !== "all" && opp.type !== filterType) return false;

      return true;
    });
  }, [opportunities, filterStage, filterType]);

  const handleOpenOpp = (opp: Opportunity) => {
    setSelectedOppId(opp.id);
    setDrawerTab("understand");
    pushActivity("Strategy Agent", `opened opportunity ${opp.id} for evaluation`);
  };

  const handleCloseDrawer = () => {
    setSelectedOppId(null);
  };

  const handleCommitDecision = async () => {
    if (!selectedOpp || !decisionChoice) return;
    setIsSubmittingDecision(true);
    try {
      await decideOpportunity(
        selectedOpp.id,
        decisionChoice,
        decisionReasoning,
        customActionTitle || selectedOpp.recommendedAction.label
      );
      // Automatically switch to memory or keep on decide tab
      setDrawerTab("memory");
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const handleDiscussInChat = (opp: Opportunity) => {
    const prompt = `Let's discuss opportunity ${opp.id}: "${opp.title}".
Cofoundr found this because: ${opp.whyFound}
The recommended move is: "${opp.recommendedAction?.label}".
What are the leanest validation steps, and how should we weigh the trade-offs vs our current sprint priorities?`;

    // Navigate to chat with seed query
    navigate({
      to: "/app/chat",
      search: { q: prompt } as any,
    });
  };

  return (
    <>
      <PageHeader
        eyebrow="Opportunity + Decision Intelligence"
        title="Opportunities & Decision Console"
        subtitle="Continuously detected across competitor changelogs, churn interviews, pricing audits, and market signals. Explore evidence, evaluate assumptions, test hypotheses, and make committed decisions that become permanent company memory."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-2 px-3 py-1.5 text-xs text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" />
              <span className="font-semibold text-foreground">{counts.all}</span> detected
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-2 px-3 py-1.5 text-xs text-muted-foreground">
              <FlaskConical className="size-3.5 text-[var(--warning)]" />
              <span className="font-semibold text-foreground">{counts.validating}</span> in validation
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs text-primary font-medium">
              <Check className="size-3.5" />
              <span className="font-semibold text-primary">{counts.pursued}</span> in execution
            </span>
          </div>
        }
      />

      {/* Active Startup Profile Context Banner */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Brain className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-foreground">
                Radar Tailored for <span className="font-bold text-primary">{companyName}</span>
              </h4>
              <Tag tone="primary">{industry}</Tag>
            </div>
            <p className="text-xs text-muted-foreground">
              Strategic Gaps & Opportunities aligned with target customer: <span className="font-medium text-foreground">{targetCustomer}</span>
            </p>
          </div>
        </div>
        <button
          onClick={handleRescanAi}
          disabled={isRescanning}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
        >
          <Sparkles className={cn("size-3.5", isRescanning && "animate-spin")} />
          {isRescanning ? "Rescanning Market Opportunities..." : "Rescan AI Opportunities ✨"}
        </button>
      </div>

      {/* Lifecycle Filter Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        {/* Stage Pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterStage("all")}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-all",
              filterStage === "all"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-surface-2 text-muted-foreground hover:bg-surface hover:text-foreground"
            )}
          >
            All Gaps ({counts.all})
          </button>
          <button
            onClick={() => setFilterStage("detected")}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-all",
              filterStage === "detected"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-surface-2 text-muted-foreground hover:bg-surface hover:text-foreground"
            )}
          >
            New ({counts.detected})
          </button>
          <button
            onClick={() => setFilterStage("validating")}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-all",
              filterStage === "validating"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-surface-2 text-muted-foreground hover:bg-surface hover:text-foreground"
            )}
          >
            In Validation ({counts.validating})
          </button>
          <button
            onClick={() => setFilterStage("pursued")}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-all",
              filterStage === "pursued"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-surface-2 text-muted-foreground hover:bg-surface hover:text-foreground"
            )}
          >
            Pursued ({counts.pursued})
          </button>
          <button
            onClick={() => setFilterStage("parked")}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-all",
              filterStage === "parked"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-surface-2 text-muted-foreground hover:bg-surface hover:text-foreground"
            )}
          >
            Parked ({counts.parked})
          </button>
          <button
            onClick={() => setFilterStage("rejected")}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-all",
              filterStage === "rejected"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-surface-2 text-muted-foreground hover:bg-surface hover:text-foreground"
            )}
          >
            Rejected ({counts.rejected})
          </button>
        </div>

        {/* Type Selector */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Filter className="size-3.5" />
          <span>Type:</span>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Types</option>
            <option value="Feature gap">Feature gap</option>
            <option value="Market gap">Market gap</option>
            <option value="Pricing gap">Pricing gap</option>
            <option value="Positioning gap">Positioning gap</option>
            <option value="Blue ocean">Blue ocean</option>
          </select>
        </div>
      </div>

      {/* Opportunities Card Grid */}
      {filteredOpportunities.length === 0 ? (
        <Panel className="flex flex-col items-center justify-center p-12 text-center">
          <Target className="size-10 text-muted-foreground mb-3" />
          <h3 className="text-base font-semibold">No opportunities match this filter</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            Try switching to "All Gaps" or clearing the type filter to view all detected market opportunities.
          </p>
          <button
            onClick={() => {
              setFilterStage("all");
              setFilterType("all");
            }}
            className="mt-4 rounded-xl border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold hover:bg-surface"
          >
            Reset Filters
          </button>
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredOpportunities.map((o) => {
            const isPursued = o.status === "pursued";
            const isValidating = o.status === "validating";
            const isParked = o.status === "parked";
            const isRejected = o.status === "rejected";

            return (
              <Panel
                key={o.id}
                className={cn(
                  "flex flex-col justify-between transition-all duration-200 hover:border-primary/40",
                  selectedOppId === o.id && "ring-2 ring-primary/60 border-primary"
                )}
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag tone="primary">{o.type}</Tag>
                    <Tag>{o.size} upside</Tag>
                    {getStatusBadge(o.status)}
                    <span className="ml-auto text-[11px] font-mono text-muted-foreground">{o.id}</span>
                  </div>

                  <h3 className="mt-3.5 flex gap-2 text-[15px] font-semibold leading-snug tracking-tight">
                    <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
                    {o.title}
                  </h3>

                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-2">{o.detail}</p>

                  <div className="mt-3 rounded-lg bg-surface-2 p-2.5 text-[11px] text-muted-foreground flex items-center justify-between">
                    <span>
                      <strong className="text-foreground/80">Signal:</strong> {o.signal}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{o.detectedAt}</span>
                  </div>

                  <div className="mt-3">
                    <Confidence value={o.confidence} />
                  </div>

                  {/* Decision status alert if decided */}
                  {o.decisionRecord ? (
                    <div
                      className={cn(
                        "mt-3 rounded-lg border p-2.5 text-xs flex items-start gap-2",
                        isPursued && "border-primary/30 bg-primary/8 text-primary",
                        isValidating && "border-[var(--warning)]/30 bg-[var(--warning)]/8 text-[var(--warning)]",
                        isParked && "border-border bg-surface-2 text-muted-foreground",
                        isRejected && "border-destructive/30 bg-destructive/8 text-destructive"
                      )}
                    >
                      {isPursued ? (
                        <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                      ) : isParked ? (
                        <Bookmark className="size-4 shrink-0 mt-0.5" />
                      ) : isRejected ? (
                        <Ban className="size-4 shrink-0 mt-0.5" />
                      ) : (
                        <FlaskConical className="size-4 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <span className="font-semibold capitalize">
                          Decision: {o.decisionRecord.decision} ({o.decisionRecord.decidedAt})
                        </span>
                        <p className="mt-0.5 text-[11px] line-clamp-1 opacity-90">{o.decisionRecord.reasoning}</p>
                      </div>
                    </div>
                  ) : null}

                  {/* Recommended Next Step Callout */}
                  {o.recommendedAction && !o.decisionRecord ? (
                    <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs text-foreground">
                      <span className="text-[10px] uppercase tracking-wider text-primary font-semibold block mb-0.5">
                        Recommended Next Move
                      </span>
                      <span className="font-medium">{o.recommendedAction.label}</span>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {o.validationExperiments && o.validationExperiments.length > 0 ? (
                      <span>
                        {o.validationExperiments.filter((e) => e.status === "passed").length}/
                        {o.validationExperiments.length} experiments passed
                      </span>
                    ) : (
                      <span>Ready for evaluation</span>
                    )}
                  </div>

                  <button
                    onClick={() => handleOpenOpp(o)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface hover:border-primary/40 transition-all"
                  >
                    <span>Explore & Decide</span>
                    <ChevronRight className="size-3.5 text-muted-foreground" />
                  </button>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {/* ── Slide-Over Decision Intelligence Drawer / Modal ────────────────── */}
      {selectedOpp ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm transition-opacity animate-in fade-in duration-200">
          <div className="relative flex h-full w-full max-w-2xl flex-col bg-surface border-l border-border shadow-2xl overflow-hidden animate-in slide-in-from-right duration-300">
            {/* Drawer Header */}
            <div className="border-b border-border p-5 pb-4 bg-surface-2/40">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Tag tone="primary">{selectedOpp.type}</Tag>
                  <Tag>{selectedOpp.size} upside</Tag>
                  {getStatusBadge(selectedOpp.status)}
                  <span className="font-mono text-xs text-muted-foreground">{selectedOpp.id}</span>
                </div>
                <button
                  onClick={handleCloseDrawer}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface hover:text-foreground transition-colors"
                >
                  <X className="size-5" />
                </button>
              </div>

              <h2 className="mt-3 text-lg font-semibold tracking-tight leading-snug">{selectedOpp.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{selectedOpp.detail}</p>

              <div className="mt-3 flex items-center justify-between">
                <Confidence value={selectedOpp.confidence} />
                <span className="text-[11px] text-muted-foreground">Detected on {selectedOpp.detectedAt}</span>
              </div>

              {/* Navigation Tabs */}
              <div className="mt-4 flex flex-wrap gap-1 border-t border-border pt-3">
                <button
                  onClick={() => setDrawerTab("understand")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                    drawerTab === "understand"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground"
                  )}
                >
                  <Info className="size-3.5" /> 1. Understand
                </button>
                <button
                  onClick={() => setDrawerTab("evaluate")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                    drawerTab === "evaluate"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground"
                  )}
                >
                  <BarChart3 className="size-3.5" /> 2. Evaluate
                </button>
                <button
                  onClick={() => setDrawerTab("validate")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                    drawerTab === "validate"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground"
                  )}
                >
                  <FlaskConical className="size-3.5" /> 3. Validate
                </button>
                <button
                  onClick={() => setDrawerTab("decide")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                    drawerTab === "decide"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground"
                  )}
                >
                  <Target className="size-3.5" /> 4. Decide & Act
                </button>
                {selectedOpp.decisionRecord ? (
                  <button
                    onClick={() => setDrawerTab("memory")}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                      drawerTab === "memory"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-surface hover:text-foreground"
                    )}
                  >
                    <History className="size-3.5" /> Memory
                  </button>
                ) : null}
              </div>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {/* TAB 1: UNDERSTAND */}
              {drawerTab === "understand" && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  {/* Why Cofoundr Found It */}
                  <Panel title="Why Cofoundr Surfaced This Opportunity">
                    <p className="text-xs text-muted-foreground leading-relaxed">{selectedOpp.whyFound}</p>
                    <div className="mt-3 rounded-lg bg-surface-2 p-2.5 text-[11px] text-muted-foreground">
                      <strong className="text-foreground">Trigger Signal:</strong> {selectedOpp.signal}
                    </div>
                  </Panel>

                  {/* Why It Matters to Startup */}
                  <Panel title="Relevance to Your Startup Context">
                    <p className="text-xs text-muted-foreground leading-relaxed">{selectedOpp.startupFit}</p>
                  </Panel>

                  {/* Epistemic Breakdown (Facts vs Inferences vs Assumptions) */}
                  <Panel title="Epistemic Clarity Breakdown" hint="Separating verified ground truth from speculative assumptions">
                    <div className="space-y-4">
                      {/* Verified Facts */}
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                          <CheckCircle2 className="size-4" />
                          <span>Verified Facts ({selectedOpp.epistemic?.facts?.length || 0})</span>
                        </div>
                        <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                          {selectedOpp.epistemic?.facts?.map((fact, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-primary mt-0.5">•</span>
                              <span className="leading-relaxed">{fact}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Inferences */}
                      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-500">
                          <Sparkles className="size-4" />
                          <span>Algorithmic Inferences ({selectedOpp.epistemic?.inferences?.length || 0})</span>
                        </div>
                        <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                          {selectedOpp.epistemic?.inferences?.map((inf, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-blue-500 mt-0.5">•</span>
                              <span className="leading-relaxed">{inf}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Untested Assumptions */}
                      <div className="rounded-xl border border-[var(--warning)]/20 bg-[var(--warning)]/5 p-3.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--warning)]">
                          <AlertTriangle className="size-4" />
                          <span>Untested Assumptions to Validate ({selectedOpp.epistemic?.assumptions?.length || 0})</span>
                        </div>
                        <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                          {selectedOpp.epistemic?.assumptions?.map((assump, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-[var(--warning)] mt-0.5">•</span>
                              <span className="leading-relaxed">{assump}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </Panel>

                  {/* Evidence & Competitor Links */}
                  <Panel title="Supporting Evidence Citations">
                    <div className="space-y-2.5">
                      {selectedOpp.evidence?.map((ev, idx) => (
                        <div key={idx} className="rounded-lg border border-border bg-surface-2 p-3 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-foreground">{ev.claim}</span>
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-medium",
                                ev.verified ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                              )}
                            >
                              {ev.verified ? "Verified Citation" : "Unverified Inference"}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                            <FileText className="size-3" />
                            <span>Source: {ev.source}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Linked Competitors */}
                    {selectedOpp.linkedCompetitors && selectedOpp.linkedCompetitors.length > 0 ? (
                      <div className="mt-4 pt-3 border-t border-border">
                        <span className="text-xs text-muted-foreground block mb-2 font-medium">
                          Competitors directly related to this gap:
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {selectedOpp.linkedCompetitors.map((comp) => (
                            <Link
                              key={comp}
                              to="/app/competitors"
                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-foreground hover:border-primary/40 hover:text-primary transition-all"
                            >
                              <span>{comp}</span>
                              <ExternalLink className="size-3" />
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </Panel>
                </div>
              )}

              {/* TAB 2: EVALUATE */}
              {drawerTab === "evaluate" && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  {/* Startup Health Impact Matrix */}
                  <Panel
                    title="Startup Health Impact Simulation"
                    hint="Projected metric shifts if this opportunity is executed successfully"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      {selectedOpp.healthImpacts?.map((h, idx) => (
                        <div key={idx} className="rounded-xl border border-border bg-surface-2 p-3.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground">{h.label}</span>
                            <span
                              className={cn(
                                "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold",
                                h.expectedDelta > 0
                                  ? "bg-primary/15 text-primary"
                                  : "bg-destructive/15 text-destructive"
                              )}
                            >
                              {h.expectedDelta > 0 ? `+${h.expectedDelta}` : h.expectedDelta} pts
                            </span>
                          </div>
                          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{h.reason}</p>
                        </div>
                      ))}
                    </div>
                  </Panel>

                  {/* Execution Velocity & Downside Risks */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Panel title="Implementation Profile">
                      <div className="space-y-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Engineering Effort:</span>
                          <span className="font-semibold">{selectedOpp.effort}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Time to First Impact:</span>
                          <span className="font-semibold">{selectedOpp.timeToImpact}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">Upside Magnitude:</span>
                          <Tag>{selectedOpp.size}</Tag>
                        </div>
                      </div>
                    </Panel>

                    <Panel title="Decision Simulator Hook">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Test financial, churn, and runway trade-offs with custom assumptions before deciding.
                      </p>
                      <Link
                        to="/app/simulator"
                        className="mt-4 inline-flex items-center justify-center gap-2 w-full rounded-xl border border-primary/30 bg-primary/10 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-all"
                      >
                        <TrendingUp className="size-3.5" />
                        <span>Simulate in Decision Simulator</span>
                      </Link>
                    </Panel>
                  </div>

                  {/* Downside Risks Flagged by Critic Agent */}
                  <Panel title="Adversarial Review & Risks" hint="Identified by the Critic Agent">
                    <div className="space-y-2">
                      {selectedOpp.risks?.map((risk, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs text-muted-foreground"
                        >
                          <ShieldAlert className="size-4 shrink-0 text-destructive mt-0.5" />
                          <span className="leading-relaxed">{risk}</span>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>
              )}

              {/* TAB 3: VALIDATE */}
              {drawerTab === "validate" && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <Panel title="Key Uncertainties to Resolve" hint="What must be validated before investing capital & sprints">
                    <ul className="space-y-2 text-xs text-muted-foreground">
                      {selectedOpp.uncertainties?.map((u, idx) => (
                        <li key={idx} className="flex items-start gap-2 rounded-lg bg-surface-2 p-2.5">
                          <span className="text-primary font-bold">?</span>
                          <span className="leading-relaxed">{u}</span>
                        </li>
                      ))}
                    </ul>
                  </Panel>

                  {/* Micro-Validation Experiments */}
                  <Panel
                    title="Micro-Validation Experiments"
                    hint="Low-cost tests that convert assumptions into verified facts"
                  >
                    <div className="space-y-3.5">
                      {selectedOpp.validationExperiments?.map((exp) => {
                        const isPassed = exp.status === "passed";
                        const isFailed = exp.status === "failed";
                        const isPending = exp.status === "pending";

                        return (
                          <div
                            key={exp.id}
                            className={cn(
                              "rounded-xl border p-4 transition-all",
                              isPassed && "border-primary/40 bg-primary/5",
                              isFailed && "border-destructive/40 bg-destructive/5",
                              isPending && "border-border bg-surface-2"
                            )}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold text-xs text-foreground font-mono">{exp.id}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-muted-foreground">Effort: {exp.effort}</span>
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                                    isPassed && "bg-primary/20 text-primary",
                                    isFailed && "bg-destructive/20 text-destructive",
                                    isPending && "bg-muted text-muted-foreground"
                                  )}
                                >
                                  {exp.status}
                                </span>
                              </div>
                            </div>

                            <p className="mt-2 text-xs font-medium text-foreground">{exp.hypothesis}</p>

                            <div className="mt-2 text-xs text-muted-foreground space-y-1">
                              <div>
                                <strong className="text-foreground/80">Test:</strong> {exp.test}
                              </div>
                              <div>
                                <strong className="text-foreground/80">Target Metric:</strong> {exp.metric}
                              </div>
                            </div>

                            {/* Experiment Status Controls */}
                            <div className="mt-3.5 pt-2.5 border-t border-border flex items-center justify-between">
                              <span className="text-[10px] text-muted-foreground">Update experiment status:</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => updateValidationExperiment(selectedOpp.id, exp.id, "passed")}
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
                                    isPassed
                                      ? "bg-primary text-primary-foreground shadow"
                                      : "border border-border bg-surface text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  <Check className="size-3" /> Passed
                                </button>
                                <button
                                  onClick={() => updateValidationExperiment(selectedOpp.id, exp.id, "failed")}
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
                                    isFailed
                                      ? "bg-destructive text-destructive-foreground shadow"
                                      : "border border-border bg-surface text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  <X className="size-3" /> Failed
                                </button>
                                <button
                                  onClick={() => updateValidationExperiment(selectedOpp.id, exp.id, "pending")}
                                  className={cn(
                                    "inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all",
                                    isPending
                                      ? "bg-surface-2 border border-border text-foreground font-bold"
                                      : "border border-border bg-surface text-muted-foreground hover:text-foreground"
                                  )}
                                >
                                  Pending
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Panel>
                </div>
              )}

              {/* TAB 4: DECIDE & ACT */}
              {drawerTab === "decide" && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <Panel
                    title="Founder Decision Console"
                    hint="Commit a decision to record why you are pursuing, validating, parking, or rejecting this opportunity"
                  >
                    {/* The 4 Decision Pathways */}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        onClick={() => setDecisionChoice("pursue")}
                        className={cn(
                          "flex flex-col items-start rounded-xl border p-4 text-left transition-all",
                          decisionChoice === "pursue"
                            ? "border-primary bg-primary/10 ring-2 ring-primary"
                            : "border-border bg-surface-2 hover:border-primary/40"
                        )}
                      >
                        <div className="flex items-center gap-2 text-primary font-semibold text-xs">
                          <CheckCircle2 className="size-4" />
                          <span>Pursue & Build</span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                          Commit to executing this opportunity. Automatically adds tasks to your sprint roadmap and updates
                          timeline memory.
                        </p>
                      </button>

                      <button
                        onClick={() => setDecisionChoice("validate")}
                        className={cn(
                          "flex flex-col items-start rounded-xl border p-4 text-left transition-all",
                          decisionChoice === "validate"
                            ? "border-[var(--warning)] bg-[var(--warning)]/10 ring-2 ring-[var(--warning)]"
                            : "border-border bg-surface-2 hover:border-[var(--warning)]/40"
                        )}
                      >
                        <div className="flex items-center gap-2 text-[var(--warning)] font-semibold text-xs">
                          <FlaskConical className="size-4" />
                          <span>Validate First</span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                          Run micro-experiments to verify customer demand and willingness-to-pay before allocating dev capacity.
                        </p>
                      </button>

                      <button
                        onClick={() => setDecisionChoice("park")}
                        className={cn(
                          "flex flex-col items-start rounded-xl border p-4 text-left transition-all",
                          decisionChoice === "park"
                            ? "border-muted-foreground bg-muted/20 ring-2 ring-muted-foreground"
                            : "border-border bg-surface-2 hover:border-muted-foreground/40"
                        )}
                      >
                        <div className="flex items-center gap-2 text-foreground font-semibold text-xs">
                          <Bookmark className="size-4" />
                          <span>Park for Later</span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                          Recognize the opportunity but shelf for a later quarter. Keep in backlog without cluttering active sprint.
                        </p>
                      </button>

                      <button
                        onClick={() => setDecisionChoice("reject")}
                        className={cn(
                          "flex flex-col items-start rounded-xl border p-4 text-left transition-all",
                          decisionChoice === "reject"
                            ? "border-destructive bg-destructive/10 ring-2 ring-destructive"
                            : "border-border bg-surface-2 hover:border-destructive/40"
                        )}
                      >
                        <div className="flex items-center gap-2 text-destructive font-semibold text-xs">
                          <Ban className="size-4" />
                          <span>Reject & Dismiss</span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                          Intentionally pass on this opportunity. Your reasoning teaches Cofoundr what strategic angles to avoid.
                        </p>
                      </button>
                    </div>

                    {/* Founder Reasoning Input */}
                    <div className="mt-5 space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-foreground block mb-1">
                          Founder Reasoning & Context (Saved to Permanent Company Memory)
                        </label>
                        <textarea
                          rows={3}
                          value={decisionReasoning}
                          onChange={(e) => setDecisionReasoning(e.target.value)}
                          placeholder="e.g. Validated with 12 customer interviews. We will ship auto re-plan as our primary wedge to unseat StudyOS before their Series A."
                          className="w-full rounded-xl border border-border bg-surface p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      {decisionChoice === "pursue" ? (
                        <div>
                          <label className="text-xs font-semibold text-foreground block mb-1">
                            Action / Task to Generate in Execution Roadmap
                          </label>
                          <input
                            type="text"
                            value={customActionTitle}
                            onChange={(e) => setCustomActionTitle(e.target.value)}
                            placeholder="e.g. Draft auto re-plan spec and feature flag"
                            className="w-full rounded-xl border border-border bg-surface p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      ) : null}

                      <button
                        onClick={handleCommitDecision}
                        disabled={!decisionChoice || isSubmittingDecision}
                        className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all shadow-sm"
                      >
                        {isSubmittingDecision ? (
                          <span>Committing to Company Memory...</span>
                        ) : (
                          <>
                            <Brain className="size-4" />
                            <span>Commit Decision to Company Memory</span>
                          </>
                        )}
                      </button>
                    </div>
                  </Panel>

                  {/* Discuss with Co-Founder Chat */}
                  <Panel title="Collaborative Sparring with AI Co-Founder">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Want to bounce hypotheses or pressure-test execution risks? Jump straight into Co-Founder Chat with this
                      opportunity pre-loaded.
                    </p>
                    <button
                      onClick={() => handleDiscussInChat(selectedOpp)}
                      className="mt-3.5 inline-flex items-center justify-center gap-2 w-full rounded-xl border border-border bg-surface-2 py-2 text-xs font-semibold text-foreground hover:bg-surface hover:border-primary/40 transition-all"
                    >
                      <MessageSquare className="size-3.5 text-primary" />
                      <span>Discuss with Co-Founder in Chat</span>
                      <ArrowRight className="size-3.5 text-muted-foreground" />
                    </button>
                  </Panel>
                </div>
              )}

              {/* TAB 5: MEMORY (If Decided) */}
              {drawerTab === "memory" && selectedOpp.decisionRecord && (
                <div className="space-y-5 animate-in fade-in duration-150">
                  <Panel title="Permanent Decision Record">
                    <div className="space-y-3 text-xs">
                      <div className="flex items-center justify-between border-b border-border pb-2.5">
                        <span className="text-muted-foreground">Decision:</span>
                        <Tag tone={selectedOpp.decisionRecord.decision === "pursue" ? "primary" : "muted"}>
                          {selectedOpp.decisionRecord.decision.toUpperCase()}
                        </Tag>
                      </div>

                      <div className="flex items-center justify-between border-b border-border pb-2.5">
                        <span className="text-muted-foreground">Decided At:</span>
                        <span className="font-semibold">{selectedOpp.decisionRecord.decidedAt}</span>
                      </div>

                      <div className="flex items-center justify-between border-b border-border pb-2.5">
                        <span className="text-muted-foreground">Memory Node ID:</span>
                        <span className="font-mono text-primary font-semibold">
                          {selectedOpp.decisionRecord.memoryEventId || "M-Active"}
                        </span>
                      </div>

                      <div>
                        <span className="text-muted-foreground block mb-1">Founder Reasoning:</span>
                        <p className="rounded-lg bg-surface-2 p-3 leading-relaxed text-foreground font-medium">
                          "{selectedOpp.decisionRecord.reasoning}"
                        </p>
                      </div>

                      {selectedOpp.decisionRecord.actionSummary ? (
                        <div>
                          <span className="text-muted-foreground block mb-1">Action Committed:</span>
                          <div className="flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-primary font-semibold">
                            <Check className="size-3.5" />
                            <span>{selectedOpp.decisionRecord.actionSummary}</span>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-5 pt-3 border-t border-border flex flex-wrap gap-2">
                      <Link
                        to="/app/timeline"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold hover:bg-surface"
                      >
                        <History className="size-3.5" />
                        <span>View in Company Timeline</span>
                      </Link>

                      <button
                        onClick={() => setDrawerTab("decide")}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-2 px-3 py-1.5 text-xs font-semibold hover:bg-surface text-muted-foreground hover:text-foreground"
                      >
                        <span>Change Decision</span>
                      </button>
                    </div>
                  </Panel>
                </div>
              )}
            </div>

            {/* Drawer Footer Navigation */}
            <div className="border-t border-border p-4 bg-surface-2/60 flex items-center justify-between">
              <button
                onClick={() => handleDiscussInChat(selectedOpp)}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                <MessageSquare className="size-3.5" />
                <span>Chat with Co-Founder</span>
              </button>

              <div className="flex items-center gap-2">
                {selectedOpp.linkedCompetitors && selectedOpp.linkedCompetitors.length > 0 ? (
                  <Link
                    to="/app/competitors"
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <span>Competitor Intel</span>
                    <ExternalLink className="size-3" />
                  </Link>
                ) : null}

                <button
                  onClick={handleCloseDrawer}
                  className="rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-surface-2"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
