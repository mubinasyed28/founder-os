import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { Meter, PageHeader, Panel, Tag, Confidence } from "@/components/os/primitives";
import { 
  startCompetitorResearchApi, 
  getResearchStatusApi, 
  getCompetitorResultsApi 
} from "@/lib/api-client";
import { useOs } from "@/lib/os-store";
import { 
  Swords, Loader2, RefreshCw, AlertTriangle, 
  ExternalLink, Search, Globe, ChevronRight, HelpCircle
} from "lucide-react";

export const Route = createFileRoute("/app/competitors")({
  component: Page,
});

function Page() {
  const { pushActivity } = useOs();
  const [loading, setLoading] = useState(true);
  const [researchState, setResearchState] = useState<string>("none"); // none, running, completed, failed
  const [statusInfo, setStatusInfo] = useState<any>(null);
  const [results, setResults] = useState<any>(null);
  const [recomputing, setRecomputing] = useState(false);
  const statusPollRef = useRef<NodeJS.Timeout | null>(null);

  // Load results and check active status
  const loadResearchData = async (isPoll = false) => {
    try {
      if (!isPoll) setLoading(true);
      const statusRes = await getResearchStatusApi();
      setStatusInfo(statusRes);
      setResearchState(statusRes.status);

      if (statusRes.status === "completed") {
        const resultsRes = await getCompetitorResultsApi();
        setResults(resultsRes);
      } else if (statusRes.status === "running") {
        // Start polling if not already started
        startPolling();
      }
    } catch (err) {
      console.error("Error loading research data", err);
    } finally {
      if (!isPoll) setLoading(false);
    }
  };

  const startPolling = () => {
    if (statusPollRef.current) return;
    statusPollRef.current = setInterval(async () => {
      try {
        const statusRes = await getResearchStatusApi();
        setStatusInfo(statusRes);
        setResearchState(statusRes.status);
        if (statusRes.status === "completed") {
          clearInterval(statusPollRef.current!);
          statusPollRef.current = null;
          const resultsRes = await getCompetitorResultsApi();
          setResults(resultsRes);
          pushActivity("Browser Agent", "competitor research completed successfully");
        } else if (statusRes.status === "failed") {
          clearInterval(statusPollRef.current!);
          statusPollRef.current = null;
          pushActivity("Critic Agent", "competitor research pipeline failed");
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    }, 4000);
  };

  // Run on mount
  useEffect(() => {
    loadResearchData();
    return () => {
      if (statusPollRef.current) clearInterval(statusPollRef.current);
    };
  }, []);

  // Auto-run if first visit and status is none
  useEffect(() => {
    if (!loading && researchState === "none") {
      handleTriggerResearch();
    }
  }, [loading, researchState]);

  const handleTriggerResearch = async () => {
    setRecomputing(true);
    pushActivity("Browser Agent", "generating search queries for discovery");
    try {
      await startCompetitorResearchApi();
      setResearchState("running");
      startPolling();
    } catch (err) {
      console.error("Failed to start research", err);
    } finally {
      setRecomputing(false);
    }
  };

  // Empty/Error/Loading helper render states
  if (loading) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Initializing research landscape...</p>
      </div>
    );
  }

  // 1. Research Running / Pipeline Active
  if (researchState === "running") {
    return (
      <>
        <PageHeader
          eyebrow="Competitor Intelligence"
          title="Searching the Web..."
          subtitle="Autonomous agents are generating queries, scouring DuckDuckGo and Tavily, and extracting company profiles."
        />
        <Panel className="flex flex-col items-center justify-center p-12 text-center">
          <div className="shimmer relative flex size-20 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 glow-ring mb-6">
            <Swords className="size-8 text-primary animate-pulse" />
          </div>
          <h3 className="text-base font-semibold">Web Discovery Engine Active</h3>
          <p className="mt-2 text-xs text-muted-foreground max-w-md leading-relaxed">
            CoFoundr agents are gathering data. This process maps company websites, structures feature-sets, extracts pricing data and verifies recent launches.
          </p>

          {/* Progress lifecycle track */}
          <div className="mt-8 w-full max-w-sm space-y-3.5 text-left border border-border bg-surface-2/40 rounded-xl p-5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">1. Query Generation</span>
              <Tag tone="primary">Completed</Tag>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">2. DuckDuckGo + Tavily Search</span>
              <span className="live-dot text-primary text-[11px] font-medium">Active</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">3. Competitor Deduplication</span>
              <span className="text-muted-foreground/60">Waiting</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">4. AI Profile Structuring</span>
              <span className="text-muted-foreground/60">Waiting</span>
            </div>
          </div>
        </Panel>
      </>
    );
  }

  // 2. Pipeline Failed
  if (researchState === "failed") {
    return (
      <>
        <PageHeader eyebrow="Competitor Intelligence" title="Research Failed" />
        <Panel className="flex flex-col items-center justify-center p-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10 border border-destructive/20 mb-4">
            <AlertTriangle className="size-6 text-destructive" />
          </div>
          <h3 className="text-sm font-semibold">Research Pipeline Encountered an Error</h3>
          <p className="mt-2 text-xs text-muted-foreground max-w-md">
            {statusInfo?.error_message || "The research agents could not complete the discovery. Please ensure you have set your API keys correctly."}
          </p>
          <button
            onClick={handleTriggerResearch}
            disabled={recomputing}
            className="mt-5 inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2 text-xs font-semibold hover:bg-surface-2 transition-all"
          >
            <RefreshCw className="size-3.5" />
            Retry Competitor Research
          </button>
        </Panel>
      </>
    );
  }

  // 3. Completed Results Page
  const competitorsList = results?.competitors || [];
  const gaps = results?.gaps || [];

  return (
    <>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <PageHeader
          eyebrow="Competitor Intelligence"
          title={`${competitorsList.length} Players Found`}
          subtitle="Competitor matrix compiled from live DuckDuckGo and Tavily web research. Not monitored daily."
        />
        <button
          onClick={handleTriggerResearch}
          disabled={recomputing || researchState === "running"}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-4 text-xs font-semibold text-foreground hover:bg-surface-2 transition-all disabled:opacity-50"
        >
          <RefreshCw className="size-3.5" />
          Re-run Web Research
        </button>
      </div>

      {/* Summary Row */}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Competitors Discovered", value: competitorsList.length },
          { label: "Total Web Sources", value: competitorsList.reduce((acc: number, c: any) => acc + (c.sources?.length || 0), 0) },
          { label: "Top Strategic Threat", value: competitorsList.length > 0 ? competitorsList[0].name : "None" },
          { label: "Opportunity Gaps", value: gaps.length },
        ].map((stat, i) => (
          <div key={i} className="panel p-4 flex flex-col justify-center">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{stat.label}</div>
            <div className="text-lg font-semibold mt-1">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Grid of cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {competitorsList.map((c: any) => (
          <Panel key={c.id} className="flex flex-col">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[15px] font-semibold tracking-tight flex items-center gap-1.5">
                  {c.name}
                  {c.website && (
                    <a 
                      href={c.website} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Globe className="size-3.5" />
                    </a>
                  )}
                </h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">{c.industry || "General Startup"}</p>
              </div>
              <Tag tone={c.relevance_score > 75 ? "bad" : c.relevance_score > 45 ? "warn" : "muted"}>
                Threat {c.relevance_score}
              </Tag>
            </div>
            
            <div className="mt-3"><Meter value={c.relevance_score} tone={c.relevance_score > 75 ? "destructive" : "warning"} /></div>

            {/* Quick specifications grid */}
            <div className="mt-4 grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg bg-surface-2 p-2.5">
                <div className="text-muted-foreground font-medium">Target Market</div>
                <div className="mt-1 font-semibold truncate" title={c.target_customers}>{c.target_customers || "N/A"}</div>
              </div>
              <div className="rounded-lg bg-surface-2 p-2.5">
                <div className="text-muted-foreground font-medium">Business Model</div>
                <div className="mt-1 font-semibold truncate" title={c.business_model}>{c.business_model || "N/A"}</div>
              </div>
            </div>

            {/* Highlights bullet list */}
            <div className="mt-4 space-y-2 text-xs flex-1">
              {c.strengths?.length > 0 && (
                <p><span className="text-primary font-semibold">Strength · </span><span className="text-muted-foreground">{c.strengths[0]}</span></p>
              )}
              {c.weaknesses?.length > 0 ? (
                <p><span className="text-[var(--warning)] font-semibold">Weakness · </span><span className="text-muted-foreground">{c.weaknesses[0]}</span></p>
              ) : (
                <p><span className="text-muted-foreground font-semibold">Differentiator · </span><span className="text-muted-foreground">No clear gaps listed in search.</span></p>
              )}
              {c.recent_activity?.length > 0 && (
                <p className="mt-3 rounded-lg bg-surface-2 p-2 text.5 text-muted-foreground truncate">
                  <span className="font-semibold text-foreground">Latest · </span>{c.recent_activity[0]}
                </p>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-border flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{c.sources?.length || 0} verification sources</span>
              <Link
                to="/app/competitors/$id"
                params={{ id: c.id }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                Detailed Analysis <ChevronRight className="size-3.5" />
              </Link>
            </div>
          </Panel>
        ))}
      </div>

      {/* Discovered opportunities / Gaps Section */}
      {gaps.length > 0 && (
        <div className="mt-8">
          <div className="mb-4">
            <h2 className="text-lg font-semibold tracking-tight">Opportunities & Competitive Gaps</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Opportunities inferred from current competitor research evidence.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {gaps.map((o: any, idx: number) => (
              <Panel key={idx}>
                <div className="flex items-center gap-2">
                  <Tag tone="primary">{o.gap_type}</Tag>
                  <span className="ml-auto text-[11px] text-muted-foreground">Inferred</span>
                </div>
                <h3 className="mt-3 flex gap-2 text-[15px] font-semibold leading-snug tracking-tight text-foreground">
                  {o.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{o.description}</p>
                <div className="mt-3 rounded-lg bg-surface-2 p-2.5 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">Evidence · </span>{o.evidence}
                </div>
                <div className="mt-3"><Confidence value={o.confidence || 75} /></div>
              </Panel>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
