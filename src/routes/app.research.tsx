import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef, useMemo } from "react";
import { 
  PageHeader, 
  Panel, 
  Tag, 
  Confidence, 
  StatCard, 
  Meter 
} from "@/components/os/primitives";
import {
  triggerResearchApi,
  getResearchCenterStatusApi,
  getResearchInsightsApi,
  getResearchEvidenceApi,
  getResearchEntitiesApi,
  getResearchEventsApi,
  getResearchStatsApi,
  submitInsightFeedbackApi,
} from "@/lib/api-client";
import { useOs } from "@/lib/os-store";
import {
  Search,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Building2,
  Calendar,
  Sparkles,
  Database,
  Layers,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Zap,
  Globe,
  Radio,
  CheckCircle2,
  Clock,
  Filter,
} from "lucide-react";

export const Route = createFileRoute("/app/research")({
  component: Page,
});

type TabType = "insights" | "evidence" | "entities" | "events";

function Page() {
  const { pushActivity } = useOs();

  // Navigation State
  const [activeTab, setActiveTab] = useState<TabType>("insights");

  // Core Data States
  const [stats, setStats] = useState<any>(null);
  const [insights, setInsights] = useState<any[]>([]);
  const [evidenceList, setEvidenceList] = useState<any[]>([]);
  const [evidenceTotal, setEvidenceTotal] = useState<number>(0);
  const [entities, setEntities] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  // Pipeline Status State
  const [pipelineStatus, setPipelineStatus] = useState<string>("idle");
  const [statusInfo, setStatusInfo] = useState<any>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [impactFilter, setImpactFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState<string>("");

  // UI Interactive States
  const [expandedInsightEvidence, setExpandedInsightEvidence] = useState<Record<string, boolean>>({});
  const [feedbackState, setFeedbackState] = useState<Record<string, string>>({});

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initial Data Fetch
  const loadAllData = async () => {
    try {
      const [statsRes, insightsRes, evidenceRes, entitiesRes, eventsRes, statusRes] = await Promise.all([
        getResearchStatsApi().catch(() => null),
        getResearchInsightsApi().catch(() => []),
        getResearchEvidenceApi("all", 0, 50).catch(() => ({ total: 0, items: [] })),
        getResearchEntitiesApi().catch(() => []),
        getResearchEventsApi().catch(() => []),
        getResearchCenterStatusApi().catch(() => null),
      ]);

      if (statsRes) setStats(statsRes);
      if (insightsRes) setInsights(insightsRes);
      if (evidenceRes) {
        setEvidenceList(evidenceRes.items || []);
        setEvidenceTotal(evidenceRes.total || 0);
      }
      if (entitiesRes) setEntities(entitiesRes);
      if (eventsRes) setEvents(eventsRes);

      if (statusRes) {
        setStatusInfo(statusRes);
        setPipelineStatus(statusRes.status || "idle");
        if (["planning", "searching", "processing", "analyzing"].includes(statusRes.status)) {
          startPolling();
        }
      }
    } catch (err) {
      console.error("[Research Center] Error loading data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const startPolling = () => {
    if (pollIntervalRef.current) return;
    pollIntervalRef.current = setInterval(async () => {
      try {
        const statusRes = await getResearchCenterStatusApi();
        setStatusInfo(statusRes);
        setPipelineStatus(statusRes.status || "idle");

        if (statusRes.status === "completed") {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
          pushActivity("Research Agent", "persistent intelligence pipeline finished successfully");
          // Refresh data
          await loadAllData();
        } else if (statusRes.status === "failed") {
          clearInterval(pollIntervalRef.current!);
          pollIntervalRef.current = null;
          pushActivity("Critic Agent", `research pipeline failed: ${statusRes.error_message || "unknown error"}`);
        }
      } catch (err) {
        console.error("[Research Center] Polling error:", err);
      }
    }, 3500);
  };

  useEffect(() => {
    loadAllData();
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Trigger Research Pipeline
  const handleRunPipeline = async () => {
    setIsTriggering(true);
    pushActivity("Research Planner", "synthesizing targeted query matrix");
    try {
      const res = await triggerResearchApi();
      if (res.success) {
        setPipelineStatus("planning");
        startPolling();
      }
    } catch (err) {
      console.error("[Research Center] Failed to trigger research:", err);
    } finally {
      setIsTriggering(false);
    }
  };

  // Handle Feedback
  const handleFeedback = async (insightId: string, type: "useful" | "not_useful") => {
    setFeedbackState((prev) => ({ ...prev, [insightId]: type }));
    try {
      await submitInsightFeedbackApi(insightId, type);
      pushActivity("Founder Feedback", `marked insight as ${type === "useful" ? "valuable signal" : "not relevant"}`);
    } catch (err) {
      console.error("[Research Center] Feedback error:", err);
    }
  };

  // Filtered Insights
  const filteredInsights = useMemo(() => {
    return insights.filter((i) => {
      if (impactFilter !== "all" && i.impact_area !== impactFilter) return false;
      if (searchFilter) {
        const q = searchFilter.toLowerCase();
        return (
          i.what_happened?.toLowerCase().includes(q) ||
          i.why_it_matters?.toLowerCase().includes(q) ||
          i.what_to_do?.toLowerCase().includes(q) ||
          i.evidence_summary?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [insights, impactFilter, searchFilter]);

  // Filtered Evidence
  const filteredEvidence = useMemo(() => {
    return evidenceList.filter((e) => {
      if (sourceFilter !== "all" && e.source_type !== sourceFilter) return false;
      if (searchFilter) {
        const q = searchFilter.toLowerCase();
        return (
          e.title?.toLowerCase().includes(q) ||
          e.snippet?.toLowerCase().includes(q) ||
          e.domain?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [evidenceList, sourceFilter, searchFilter]);

  // Filtered Entities
  const filteredEntities = useMemo(() => {
    return entities.filter((ent) => {
      if (entityTypeFilter !== "all" && ent.entity_type !== entityTypeFilter) return false;
      if (searchFilter) {
        const q = searchFilter.toLowerCase();
        return ent.canonical_name?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [entities, entityTypeFilter, searchFilter]);

  const isPipelineActive = ["planning", "searching", "processing", "analyzing"].includes(pipelineStatus);

  // Evidence lookup map
  const evidenceMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const ev of evidenceList) {
      if (ev.id) map.set(ev.id, ev);
    }
    return map;
  }, [evidenceList]);

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <PageHeader
        eyebrow="Research Center"
        title="Every claim traced to a source"
        subtitle="The Research and Browser agents run continuous market queries, filter for credibility, and write results straight into company memory."
        actions={
          <div className="flex items-center gap-2.5">
            {isPipelineActive ? (
              <span className="inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2 text-xs font-medium text-primary animate-pulse shadow-sm">
                <Radio className="size-3.5 animate-spin" />
                Pipeline Active ({pipelineStatus}...)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-2/80 px-3 py-1.5 text-xs text-muted-foreground">
                <Database className="size-3.5 text-primary" />
                Persistent Knowledge Store
              </span>
            )}

            <button
              onClick={handleRunPipeline}
              disabled={isPipelineActive || isTriggering}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`size-3.5 ${isPipelineActive || isTriggering ? "animate-spin" : ""}`} />
              {isPipelineActive ? "Running Pipeline..." : "Run Research Pipeline"}
            </button>
          </div>
        }
      />

      {/* ── Active Pipeline Progress Banner ── */}
      {isPipelineActive && (
        <Panel className="border-primary/30 bg-primary/[0.04] p-5 shadow-sm">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="live-dot text-primary text-xs font-semibold uppercase tracking-wider">
                  Pipeline In Progress
                </span>
                <Tag tone="primary">{pipelineStatus}</Tag>
              </div>
              <p className="text-xs text-muted-foreground">
                Synthesizing targeted queries via Mistral, scouring NewsData.io & Tavily, deduplicating records, and deriving actionable startup strategy.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono bg-surface-2 px-3 py-1.5 rounded-lg border border-border">
              <Clock className="size-3.5 text-primary animate-spin" />
              Real-time synchronization
            </div>
          </div>

          {/* Stepper breakdown */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 pt-3 border-t border-border/50">
            <div className={`p-2.5 rounded-lg border text-xs ${pipelineStatus === "planning" ? "border-primary/40 bg-primary/10 text-primary font-medium" : "border-border bg-surface-2/50 text-muted-foreground"}`}>
              1. Query Planning
            </div>
            <div className={`p-2.5 rounded-lg border text-xs ${pipelineStatus === "searching" ? "border-primary/40 bg-primary/10 text-primary font-medium" : "border-border bg-surface-2/50 text-muted-foreground"}`}>
              2. Multi-Source Search
            </div>
            <div className={`p-2.5 rounded-lg border text-xs ${pipelineStatus === "processing" ? "border-primary/40 bg-primary/10 text-primary font-medium" : "border-border bg-surface-2/50 text-muted-foreground"}`}>
              3. Dedup & Entity Merging
            </div>
            <div className={`p-2.5 rounded-lg border text-xs ${pipelineStatus === "analyzing" ? "border-primary/40 bg-primary/10 text-primary font-medium" : "border-border bg-surface-2/50 text-muted-foreground"}`}>
              4. Strategic Reasoning
            </div>
          </div>
        </Panel>
      )}

      {/* ── Metrics / Stats Overview ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <StatCard
          label="Tracked Sources"
          value={stats ? stats.evidence_count.toString() : evidenceTotal.toString()}
          hint="Verified URLs & articles in memory"
        />
        <StatCard
          label="Market Entities"
          value={stats ? stats.entity_count.toString() : entities.length.toString()}
          hint="Competitors, technologies, key actors"
        />
        <StatCard
          label="Discrete Events"
          value={stats ? stats.event_count.toString() : events.length.toString()}
          hint="Funding, launches, partnerships"
        />
        <StatCard
          label="Strategic Insights"
          value={stats ? stats.insight_count.toString() : insights.length.toString()}
          hint="Startup-tailored action items"
        />
      </div>

      {/* ── Navigation Tabs & Global Search ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-2 border border-border max-w-full overflow-x-auto">
          <button
            onClick={() => setActiveTab("insights")}
            className={`flex shrink-0 items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "insights"
                ? "bg-surface text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="size-3.5 text-primary" />
            Strategic Insights ({insights.length})
          </button>
          <button
            onClick={() => setActiveTab("evidence")}
            className={`flex shrink-0 items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "evidence"
                ? "bg-surface text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Database className="size-3.5 text-primary" />
            Evidence Sources ({evidenceTotal || evidenceList.length})
          </button>
          <button
            onClick={() => setActiveTab("entities")}
            className={`flex shrink-0 items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "entities"
                ? "bg-surface text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="size-3.5 text-primary" />
            Entities ({entities.length})
          </button>
          <button
            onClick={() => setActiveTab("events")}
            className={`flex shrink-0 items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "events"
                ? "bg-surface text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calendar className="size-3.5 text-primary" />
            Events ({events.length})
          </button>
        </div>

        {/* Search filter */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search intelligence..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-border bg-surface-2 focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* ── TAB 1: STRATEGIC INSIGHTS ── */}
      {activeTab === "insights" && (
        <div className="space-y-4">
          {/* Sub-filter by impact area */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground flex items-center gap-1">
              <Filter className="size-3" /> Impact Area:
            </span>
            {["all", "competitive", "market", "customer", "product", "regulatory", "technology"].map((area) => (
              <button
                key={area}
                onClick={() => setImpactFilter(area)}
                className={`px-2.5 py-1 rounded-lg capitalize transition-all text-[11px] font-medium ${
                  impactFilter === area
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-surface-2 text-muted-foreground hover:text-foreground border border-transparent"
                }`}
              >
                {area}
              </button>
            ))}
          </div>

          {/* Empty state */}
          {filteredInsights.length === 0 && !isLoading && (
            <Panel className="p-12 text-center flex flex-col items-center justify-center">
              <div className="size-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3">
                <Sparkles className="size-6" />
              </div>
              <h3 className="text-sm font-semibold">No Research Insights Yet</h3>
              <p className="mt-1.5 text-xs text-muted-foreground max-w-sm">
                Run the research pipeline to scan external news and web search results, deduplicate sources, and synthesize startup-specific recommendations.
              </p>
              <button
                onClick={handleRunPipeline}
                disabled={isPipelineActive || isTriggering}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
              >
                <RefreshCw className="size-3.5" />
                Initialize First Research Sweep
              </button>
            </Panel>
          )}

          {/* Insights Cards */}
          <div className="space-y-4">
            {filteredInsights.map((insight) => {
              const isEvidenceExpanded = expandedInsightEvidence[insight.id] || false;
              const feedback = feedbackState[insight.id];

              // Resolve linked evidence records
              const linkedEvidences = (insight.evidence_ids || [])
                .map((eid: string) => evidenceMap.get(eid))
                .filter(Boolean);

              return (
                <Panel key={insight.id} className="p-5 hover:border-border/80 transition-all">
                  {/* Top Bar: Badges & Confidence */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <Tag tone="primary">{insight.impact_area || "strategic"}</Tag>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                        <Database className="size-3 text-primary" />
                        {insight.source_count || linkedEvidences.length || 1} cited sources
                      </span>
                      {insight.entity_names && insight.entity_names.length > 0 && (
                        <div className="hidden sm:flex items-center gap-1">
                          {insight.entity_names.slice(0, 3).map((name: string) => (
                            <span key={name} className="px-1.5 py-0.5 rounded bg-surface-2 text-[10px] text-muted-foreground border border-border">
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <Confidence value={insight.confidence || 75} />
                      {insight.relevance_score && (
                        <span className="text-[11px] font-semibold text-primary tabular-nums">
                          {insight.relevance_score} Relevance
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 1. What Happened? */}
                  <div className="mt-3.5">
                    <h3 className="text-[15px] font-semibold tracking-tight text-foreground flex items-start gap-2">
                      <span className="text-primary mt-0.5">▪</span>
                      {insight.what_happened}
                    </h3>
                  </div>

                  {/* 2. Evidence Summary */}
                  {insight.evidence_summary && (
                    <div className="mt-2.5 text-xs text-muted-foreground leading-relaxed pl-4 border-l-2 border-border">
                      <span className="font-medium text-foreground/80">Underlying Evidence: </span>
                      {insight.evidence_summary}
                    </div>
                  )}

                  {/* 3. Why It Matters to THIS Startup */}
                  <div className="mt-3.5 p-3.5 rounded-xl bg-primary/[0.04] border border-primary/15 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                      <TrendingUp className="size-3.5" />
                      Why This Matters To Your Startup
                    </div>
                    <p className="text-xs leading-relaxed text-foreground/90">
                      {insight.why_it_matters}
                    </p>
                  </div>

                  {/* 4. What Founder Could Do */}
                  {insight.what_to_do && (
                    <div className="mt-3 p-3.5 rounded-xl bg-surface-2/60 border border-border space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <Zap className="size-3.5 text-primary" />
                        Recommended Tactical Move
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {insight.what_to_do}
                      </p>
                    </div>
                  )}

                  {/* Actions & Feedback Row */}
                  <div className="mt-4 pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border/50 text-xs">
                    {/* Trace Evidence Button */}
                    <button
                      onClick={() =>
                        setExpandedInsightEvidence((prev) => ({
                          ...prev,
                          [insight.id]: !prev[insight.id],
                        }))
                      }
                      className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
                    >
                      {isEvidenceExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                      {isEvidenceExpanded ? "Hide source citations" : `Trace to ${linkedEvidences.length || insight.evidence_ids?.length || 1} source citations`}
                    </button>

                    {/* Feedback Rating */}
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">Is this actionable?</span>
                      <button
                        onClick={() => handleFeedback(insight.id, "useful")}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
                          feedback === "useful"
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border bg-surface hover:bg-surface-2 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <ThumbsUp className="size-3" />
                        Useful
                      </button>
                      <button
                        onClick={() => handleFeedback(insight.id, "not_useful")}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-all ${
                          feedback === "not_useful"
                            ? "border-destructive bg-destructive/15 text-destructive"
                            : "border-border bg-surface hover:bg-surface-2 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <ThumbsDown className="size-3" />
                        Not Relevant
                      </button>
                    </div>
                  </div>

                  {/* Expandable Evidence Drawer */}
                  {isEvidenceExpanded && (
                    <div className="mt-3.5 pt-3 border-t border-border space-y-2.5 bg-surface-2/40 rounded-xl p-3.5">
                      <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Direct External Evidence Citations
                      </div>
                      {linkedEvidences.length > 0 ? (
                        linkedEvidences.map((ev: any, idx: number) => (
                          <div key={idx} className="p-2.5 rounded-lg border border-border bg-surface text-xs space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-foreground truncate">{ev.title}</span>
                              <Tag tone="primary">{ev.source_type || "web"}</Tag>
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-2">{ev.snippet}</p>
                            {ev.url && (
                              <a
                                href={ev.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline pt-1"
                              >
                                <ExternalLink className="size-3" />
                                {ev.domain || ev.url}
                              </a>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          Sources verified from ongoing web search discovery.
                        </p>
                      )}
                    </div>
                  )}
                </Panel>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 2: EVIDENCE SOURCES ── */}
      {activeTab === "evidence" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Source Type:</span>
              {["all", "newsdata", "tavily"].map((type) => (
                <button
                  key={type}
                  onClick={() => setSourceFilter(type)}
                  className={`px-2.5 py-1 rounded-lg capitalize transition-all text-[11px] font-medium ${
                    sourceFilter === type
                      ? "bg-primary/15 text-primary border border-primary/30"
                      : "bg-surface-2 text-muted-foreground hover:text-foreground border border-transparent"
                  }`}
                >
                  {type === "all" ? "All Sources" : type === "newsdata" ? "NewsData.io" : "Tavily Web Search"}
                </button>
              ))}
            </div>
            <span className="text-muted-foreground text-[11px]">
              Showing {filteredEvidence.length} of {evidenceTotal} stored evidence records
            </span>
          </div>

          <div className="space-y-2.5">
            {filteredEvidence.map((ev, idx) => (
              <Panel key={ev.id || idx} className="p-4 hover:border-border/80 transition-all">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Tag tone="primary">{ev.source_type || "web"}</Tag>
                      <span className="text-xs font-semibold text-foreground">{ev.title}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 max-w-3xl">
                      {ev.snippet || ev.full_text}
                    </p>
                  </div>
                  {ev.url && (
                    <a
                      href={ev.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-primary font-medium hover:underline self-start sm:self-auto shrink-0 bg-primary/10 px-2.5 py-1.5 rounded-lg border border-primary/20"
                    >
                      <ExternalLink className="size-3" />
                      {ev.domain || "View Source"}
                    </a>
                  )}
                </div>
                <div className="mt-2.5 pt-2 border-t border-border/40 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground font-mono">
                  <span>Retrieved: {new Date(ev.retrieved_at).toLocaleDateString()}</span>
                  {ev.query_intent && <span>Intent: {ev.query_intent}</span>}
                  {ev.content_hash && <span className="text-[10px]">Hash: {ev.content_hash.slice(0, 10)}...</span>}
                </div>
              </Panel>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: PERSISTENT ENTITIES ── */}
      {activeTab === "entities" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Entity Type:</span>
            {["all", "company", "product", "technology", "person"].map((type) => (
              <button
                key={type}
                onClick={() => setEntityTypeFilter(type)}
                className={`px-2.5 py-1 rounded-lg capitalize transition-all text-[11px] font-medium ${
                  entityTypeFilter === type
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-surface-2 text-muted-foreground hover:text-foreground border border-transparent"
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredEntities.map((ent, idx) => (
              <Panel key={ent.id || idx} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold tracking-tight text-foreground">
                      {ent.canonical_name}
                    </h4>
                    <Tag tone="primary">{ent.entity_type || "company"}</Tag>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-muted-foreground bg-surface-2 px-2 py-0.5 rounded border border-border">
                    {ent.mention_count || 1} mentions
                  </span>
                </div>

                {/* Relevance meter */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Relevance to Startup</span>
                    <span className="font-semibold text-primary">{ent.relevance_score || 70}%</span>
                  </div>
                  <Meter value={ent.relevance_score || 70} />
                </div>

                {/* Attributes */}
                {ent.attributes && Object.keys(ent.attributes).length > 0 && (
                  <div className="pt-2 border-t border-border/50 text-[11px] space-y-1">
                    {Object.entries(ent.attributes).slice(0, 3).map(([k, v]: [string, any]) => (
                      <div key={k} className="flex justify-between text-muted-foreground">
                        <span className="capitalize">{k}:</span>
                        <span className="font-medium text-foreground truncate max-w-[150px]">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 4: DISCRETE MARKET EVENTS ── */}
      {activeTab === "events" && (
        <div className="space-y-3">
          {events.map((ev, idx) => (
            <Panel key={ev.id || idx} className="p-4 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Tag tone="primary">{ev.event_type || "market_event"}</Tag>
                  <h4 className="text-sm font-semibold text-foreground">{ev.title}</h4>
                </div>
                <span className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                  <Calendar className="size-3 text-primary" />
                  {ev.event_date || new Date(ev.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {ev.description}
              </p>
              {ev.entities_involved && ev.entities_involved.length > 0 && (
                <div className="flex items-center gap-1.5 pt-2 border-t border-border/40 text-[11px]">
                  <span className="text-muted-foreground">Entities involved:</span>
                  {ev.entities_involved.map((e: string) => (
                    <span key={e} className="px-2 py-0.5 rounded bg-surface-2 text-foreground font-medium border border-border">
                      {e}
                    </span>
                  ))}
                </div>
              )}
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
