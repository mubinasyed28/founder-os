import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getCompetitorDetailApi, getCompetitorResultsApi } from "@/lib/api-client";
import { PageHeader, Panel, Tag, ScoreRing } from "@/components/os/primitives";
import { 
  ArrowLeft, Globe, ExternalLink, Calendar, 
  MapPin, ShieldCheck, Target, Layers, DollarSign,
  TrendingUp, Award, AlertCircle, FileText, ChevronRight
} from "lucide-react";

function renderSafeContent(val: any): React.ReactNode {
  if (val === null || val === undefined) return null;
  if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
    return String(val);
  }
  if (Array.isArray(val)) {
    return (
      <div className="space-y-0.5">
        {val.map((item, idx) => (
          <div key={idx}>{renderSafeContent(item)}</div>
        ))}
      </div>
    );
  }
  if (typeof val === "object") {
    return (
      <div className="mt-1 space-y-1 pl-2 border-l border-primary/30">
        {Object.entries(val).map(([k, v]) => (
          <div key={k} className="text-[11px]">
            <span className="font-semibold text-foreground">{k}: </span>
            <span className="text-muted-foreground">{renderSafeContent(v)}</span>
          </div>
        ))}
      </div>
    );
  }
  return String(val);
}

export const Route = createFileRoute("/app/competitors/$id")({
  component: CompetitorDetail,
});

function CompetitorDetail() {
  const { id } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [competitor, setCompetitor] = useState<any>(null);
  const [researchData, setResearchData] = useState<any>(null);

  useEffect(() => {
    const loadDetail = async () => {
      try {
        setLoading(true);
        const data = await getCompetitorDetailApi(id);
        setCompetitor(data);
        const results = await getCompetitorResultsApi();
        setResearchData(results);
      } catch (err) {
        console.error("Failed to load competitor details", err);
      } finally {
        setLoading(false);
      }
    };
    loadDetail();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center gap-3">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-xs text-muted-foreground">Retrieving competitor intelligence profiles...</p>
      </div>
    );
  }

  if (!competitor) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center gap-3">
        <p className="text-sm text-destructive font-medium">Competitor profile not found</p>
        <Link to="/app/competitors" className="text-xs text-primary hover:underline">
          Back to Competitors dashboard
        </Link>
      </div>
    );
  }

  const startupContext = researchData?.startup_context_used || {};

  return (
    <>
      <div className="mb-6">
        <Link
          to="/app/competitors"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Back to Competitor Intelligence
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px] items-start mb-8">
        <div>
          <PageHeader
            eyebrow="Competitor Deep-Dive"
            title={competitor.name}
            subtitle={competitor.description}
            actions={
              competitor.website ? (
                <a
                  href={competitor.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-4 text-xs font-semibold hover:bg-surface-2 transition-all"
                >
                  <Globe className="size-3.5" /> Visit Website
                </a>
              ) : null
            }
          />
        </div>

        <Panel className="flex flex-col items-center justify-center text-center p-5">
          <ScoreRing value={competitor.relevance_score || 50} size={110} label="Threat Score" />
          <p className="text-[10px] text-muted-foreground mt-3 max-w-[200px]">
            {competitor.relevance_reason || "Direct product competitor matching startup segments."}
          </p>
        </Panel>
      </div>

      {/* Metadata Panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { icon: Calendar, label: "Founded Year", val: competitor.founded_year || "Not found in search" },
          { icon: MapPin, label: "HQ Location", val: competitor.location || "Not found in search" },
          { icon: Layers, label: "Industry", val: competitor.industry || "General Startup" },
          { icon: DollarSign, label: "Pricing Model", val: competitor.pricing || "Pricing not publicly listed" },
        ].map((meta, idx) => (
          <Panel key={idx} className="p-4 flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <meta.icon className="size-4 text-primary" />
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{meta.label}</div>
              <div className="text-xs font-semibold mt-0.5 text-foreground truncate max-w-[150px]">{meta.val}</div>
            </div>
          </Panel>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left Hand: Core Profile */}
        <div className="space-y-6">
          <Panel title="Company Strategy">
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Target className="size-3.5 text-primary" /> Target Audience
                </h4>
                <p className="text-xs text-foreground mt-1.5 leading-relaxed">{competitor.target_customers || "Information not found."}</p>
              </div>

              <div className="border-t border-border/40 pt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                  <Award className="size-3.5 text-primary" /> Value Proposition
                </h4>
                <p className="text-xs text-foreground mt-1.5 leading-relaxed">{competitor.value_proposition || "Information not found."}</p>
              </div>

              {(competitor.mission || competitor.vision) && (
                <div className="border-t border-border/40 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {competitor.mission && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mission</h4>
                      <p className="text-xs text-muted-foreground mt-1.5 italic">"{competitor.mission}"</p>
                    </div>
                  )}
                  {competitor.vision && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vision</h4>
                      <p className="text-xs text-muted-foreground mt-1.5 italic">"{competitor.vision}"</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Products & Feature Breakdown">
            <div className="space-y-4">
              {competitor.products_services?.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2">Products/Services</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {competitor.products_services.map((p: string, i: number) => (
                      <Tag key={i}>{p}</Tag>
                    ))}
                  </div>
                </div>
              )}

              {competitor.key_features?.length > 0 && (
                <div className="border-t border-border/40 pt-4">
                  <h4 className="text-xs font-semibold text-muted-foreground mb-2">Core Technical Features</h4>
                  <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1.5">
                    {competitor.key_features.map((feat: string, i: number) => (
                      <li key={i}>{feat}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Panel>

          {/* Pricing & Funding details */}
          <Panel title="Financial Profile">
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground">Funding History</h4>
                <p className="text-xs font-medium text-foreground mt-1">{competitor.funding || "Funding information not found."}</p>
              </div>
              {competitor.investors && (
                <div className="border-t border-border/40 pt-4">
                  <h4 className="text-xs font-semibold text-muted-foreground">Key Investors</h4>
                  <p className="text-xs text-muted-foreground mt-1">{competitor.investors}</p>
                </div>
              )}
            </div>
          </Panel>
        </div>

        {/* Right Hand: SWOT, Activity, Relevance */}
        <div className="space-y-6">
          <Panel title="Competitor Health (SWOT)">
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-primary uppercase tracking-wider">Strengths</h4>
                {competitor.strengths?.length > 0 ? (
                  <ul className="list-disc pl-4 text-xs text-muted-foreground mt-2 space-y-1.5">
                    {competitor.strengths.map((str: string, i: number) => (
                      <li key={i}>{str}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1.5">No distinct strengths found in searches.</p>
                )}
              </div>

              <div className="border-t border-border/40 pt-4">
                <h4 className="text-xs font-semibold text-[var(--warning)] uppercase tracking-wider">Weaknesses & Gaps</h4>
                {competitor.weaknesses?.length > 0 ? (
                  <ul className="list-disc pl-4 text-xs text-muted-foreground mt-2 space-y-1.5">
                    {competitor.weaknesses.map((weak: string, i: number) => (
                      <li key={i}>{weak}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground mt-1.5">No distinct weaknesses found in searches.</p>
                )}
              </div>
            </div>
          </Panel>

          {/* Competitive Relevance Section (Comparison against Startup context) */}
          <Panel title="Strategic Relevance">
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Why they matter to your startup</h4>
                <p className="text-xs text-foreground mt-2 leading-relaxed bg-surface-2 p-3 rounded-lg border border-border/40">
                  {competitor.competitive_relevance || "Direct market alternative solving similar sector problems."}
                </p>
              </div>

              {/* Startup Side-by-Side Comparison */}
              <div className="border-t border-border/40 pt-4">
                <h4 className="text-xs font-semibold text-muted-foreground mb-3">Startup Side-by-Side comparison</h4>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 text-[11px] border-b border-border/30 pb-1.5">
                    <span className="text-muted-foreground font-medium">Dimension</span>
                    <span className="text-muted-foreground font-medium">{competitor.name} vs. You</span>
                  </div>
                  {[
                    ["Target Customer", competitor.target_customers, startupContext.target_customer],
                    ["Product Concept", competitor.value_proposition, startupContext.product],
                    ["Business Model", competitor.business_model, startupContext.business_model],
                  ].map(([label, compVal, startupVal], i) => (
                    <div key={i} className="grid grid-cols-2 text-[11px] gap-2 pt-1">
                      <span className="text-muted-foreground font-medium">{label}</span>
                      <div className="text-[10px] space-y-1">
                        <div><span className="text-muted-foreground font-medium">Them: </span>{renderSafeContent(compVal || "N/A")}</div>
                        <div><span className="text-primary font-medium">You: </span>{renderSafeContent(startupVal || "N/A")}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Panel>

          {/* Recent announcements */}
          {competitor.recent_activity?.length > 0 && (
            <Panel title="Recent Activity">
              <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-2">
                {competitor.recent_activity.map((act: string, i: number) => (
                  <li key={i}>{renderSafeContent(act)}</li>
                ))}
              </ul>
            </Panel>
          )}

          {/* Verification sources */}
          <Panel title="Verification Sources">
            {competitor.sources?.length > 0 ? (
              <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                {competitor.sources.map((src: any, i: number) => (
                  <div key={i} className="text-[11px] border-b border-border/30 pb-2 last:border-b-0">
                    <div className="font-semibold text-foreground flex items-center justify-between gap-1">
                      <span className="truncate max-w-[200px]">{src.title || "Source"}</span>
                      {src.url && (
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80 transition-colors shrink-0"
                        >
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </div>
                    <div className="text-muted-foreground text-[10px] mt-0.5 truncate">{src.domain}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No verification sources linked to this competitor.</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
