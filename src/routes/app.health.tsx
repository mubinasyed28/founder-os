import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, CheckCircle, RefreshCw } from "lucide-react";
import { useOs } from "@/lib/os-store";
import { Confidence, Meter, PageHeader, Panel, ScoreRing } from "@/components/os/primitives";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { recalculateHealthApi } from "@/lib/api-client";

export const Route = createFileRoute("/app/health")({
  component: Health,
});

function Health() {
  const { metrics, overall, healthReport, refreshHealth, pushActivity } = useOs();
  const [recalculating, setRecalculating] = useState(false);

  // Radar data only uses active, valid scores (score >= 0)
  const radar = metrics
    .filter((m) => m.score >= 0)
    .map((m) => ({ label: m.label, score: m.score }));

  async function handleRecalculate() {
    setRecalculating(true);
    pushActivity("Financial Agent", "initiating recalculation of startup health score");
    try {
      await recalculateHealthApi();
      await refreshHealth();
      pushActivity("Critic Agent", "health report successfully updated");
    } catch (err) {
      console.warn("Failed to recalculate health report:", err);
    } finally {
      setRecalculating(false);
    }
  }

  // Count missing areas across all metrics
  const missingAreasCount = healthReport?.missing_areas?.length || 0;
  const healthStatus = healthReport?.status || (overall >= 75 ? "Excellent" : overall >= 55 ? "Good" : "Needs attention");

  return (
    <>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <PageHeader
          eyebrow="Startup Health"
          title="Rule-Based Startup Health Dashboard"
          subtitle="Every score is computed live from your structured profile and document library. Explainable checks only."
        />
        <button
          onClick={handleRecalculate}
          disabled={recalculating}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-4 text-xs font-semibold text-foreground hover:bg-surface-2 transition-all disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3.5", recalculating && "animate-spin")} />
          {recalculating ? "Recalculating…" : "Recalculate Health"}
        </button>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[340px_1fr]">
        <Panel className="flex flex-col items-center gap-5 text-center">
          <ScoreRing value={overall} size={168} label="Overall Score" sub={healthStatus} />
          <Confidence value={overall} />
          
          <p className="text-xs leading-relaxed text-muted-foreground">
            Composite health calculated from {metrics.filter(m => m.score >= 0).length} active dimensions. 
            {missingAreasCount > 0 ? ` There are ${missingAreasCount} missing profile fields detected.` : " All core information categories are populated!"}
          </p>
          
          {healthReport?.recommendations?.length > 0 ? (
            <div className="w-full rounded-xl border border-[color-mix(in_oklab,var(--warning)_35%,transparent)] bg-[color-mix(in_oklab,var(--warning)_8%,transparent)] p-3 text-left text-xs">
              <div className="flex items-center gap-1.5 font-medium text-[var(--warning)]">
                <AlertTriangle className="size-3.5" /> High Priority Gap
              </div>
              <p className="mt-1.5 text-muted-foreground leading-normal">
                {healthReport.recommendations[0]}
              </p>
            </div>
          ) : (
            <div className="w-full rounded-xl border border-primary/20 bg-primary/5 p-3 text-left text-xs">
              <div className="flex items-center gap-1.5 font-medium text-primary">
                <CheckCircle className="size-3.5" /> All checks green
              </div>
              <p className="mt-1.5 text-muted-foreground leading-normal">
                No major document or profile gaps detected. Continue updating your traction metrics weekly!
              </p>
            </div>
          )}
        </Panel>

        <Panel title="Dimension profile" hint="Radar profile of all computed health areas">
          <div className="h-[300px]">
            {radar.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radar} outerRadius="76%">
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="label" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                  <Radar dataKey="score" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.22} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Insufficient data to render dimension radar chart. Populate your company profile to unlock.
              </div>
            )}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {metrics.map((m) => {
          const isInsufficient = m.score < 0;
          return (
            <Panel key={m.key}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold tracking-tight">{m.label}</h3>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className={cn("text-3xl font-semibold tabular-nums", isInsufficient && "text-muted-foreground text-xl")}>
                      {isInsufficient ? "Insufficient data" : m.score}
                    </span>
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    isInsufficient 
                      ? "bg-muted text-muted-foreground"
                      : m.score >= 80 
                        ? "bg-primary/12 text-primary" 
                        : m.score >= 50 
                          ? "bg-amber-500/12 text-amber-500" 
                          : "bg-destructive/12 text-destructive",
                  )}
                >
                  {isInsufficient ? "Missing Info" : m.score >= 80 ? "Healthy" : m.score >= 50 ? "Average" : "Weak"}
                </span>
              </div>
              
              <div className="mt-3">
                <Meter value={isInsufficient ? 0 : m.score} tone={isInsufficient ? "warning" : m.score < 60 ? "warning" : "primary"} />
              </div>
              
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">{isInsufficient ? "Assessment Details: " : "Why: "}</span>
                {m.why}
              </p>
              
              <div className="mt-4 space-y-2">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
                  Rule-based check parameters
                </div>
                <div className="space-y-1.5">
                  {m.drivers.map((d: any) => (
                    <div key={d.label} className="flex items-center justify-between text-[11px] border-b border-border/20 pb-1">
                      <span className="text-muted-foreground">{d.label}</span>
                      <span className={cn("font-medium", d.good ? "text-primary" : "text-amber-500")}>
                        {d.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              
              {m.risk && !isInsufficient ? (
                <div className="mt-3 rounded-lg border border-border bg-surface-2 p-2.5 text-[11px] text-muted-foreground">
                  <span className="font-medium text-[var(--warning)]">Risk · </span>
                  {m.risk}
                </div>
              ) : null}
            </Panel>
          );
        })}
      </div>

      <Panel title="Startup health scoring rules" hint="Explainable Assessment Parameters" className="mt-4">
        <div className="text-xs text-muted-foreground space-y-2 leading-relaxed">
          <p>
            Cofoundr OS startup assessments are transparent and check for objective items.
          </p>
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Business Health:</strong> Verifies core values (pitch, stage, names) and rewards MRR / financial forecast document indexing (+20pts).</li>
            <li><strong>Product Health:</strong> Validates target solution descriptions and scans for PRDs or product spec documents.</li>
            <li><strong>Customer Health:</strong> Scans for target ICP clarity and rewards raw Customer Interview transcripts or customer survey sheets (+25pts).</li>
            <li><strong>Market Health:</strong> Analyzes pitch deck uploads and strategic long-term goals.</li>
            <li><strong>Competition Health:</strong> Tracks listed competitors and checks for competitor teardown research documents.</li>
          </ul>
        </div>
      </Panel>
    </>
  );
}
