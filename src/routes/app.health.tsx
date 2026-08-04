import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle } from "lucide-react";
import { useOs } from "@/lib/os-store";
import { Confidence, Delta, Meter, PageHeader, Panel, ScoreRing } from "@/components/os/primitives";
import { overallConfidence } from "@/lib/company-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/health")({
  component: Health,
});

function Health() {
  const { metrics, overall } = useOs();
  const radar = metrics.map((m) => ({ label: m.label, score: m.score }));

  return (
    <>
      <PageHeader
        eyebrow="Startup Health"
        title="Eight dimensions, one honest number"
        subtitle="Every score is computed from live drivers and explained in plain language. Nothing here is a vanity metric."
      />

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Panel className="flex flex-col items-center gap-5 text-center">
          <ScoreRing value={overall} size={168} label="Overall" sub="+4 this week" />
          <Confidence value={overallConfidence} />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Weighted composite. Growth and momentum are pulling up; market position and fundraising readiness are
            the ceiling.
          </p>
          <div className="w-full rounded-xl border border-[color-mix(in_oklab,var(--warning)_35%,transparent)] bg-[color-mix(in_oklab,var(--warning)_8%,transparent)] p-3 text-left text-xs">
            <div className="flex items-center gap-1.5 font-medium text-[var(--warning)]">
              <AlertTriangle className="size-3.5" /> Top risk
            </div>
            <p className="mt-1.5 text-muted-foreground">
              Unresolved retention regression suppresses Product, Growth quality and diligence readiness at once.
            </p>
          </div>
        </Panel>

        <Panel title="Dimension profile" hint="Radar of all eight scored dimensions">
          <div className="h-[300px]">
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
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {metrics.map((m) => (
          <Panel key={m.key}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold tracking-tight">{m.label}</h3>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tabular-nums">{m.score}</span>
                  <Delta value={m.delta} />
                </div>
              </div>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px]",
                  m.trend === "up" && "bg-primary/12 text-primary",
                  m.trend === "down" && "bg-destructive/12 text-destructive",
                  m.trend === "flat" && "bg-muted text-muted-foreground",
                )}
              >
                {m.trend === "up" ? "Improving" : m.trend === "down" ? "Declining" : "Flat"}
              </span>
            </div>
            <div className="mt-3">
              <Meter value={m.score} tone={m.score < 60 ? "warning" : "primary"} />
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Why: </span>
              {m.why}
            </p>
            <div className="mt-3 space-y-1.5">
              {m.drivers.map((d) => (
                <div key={d.label} className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className={cn("tabular-nums font-medium", d.good ? "text-primary" : "text-[var(--warning)]")}>
                    {d.value}
                  </span>
                </div>
              ))}
            </div>
            {m.risk ? (
              <div className="mt-3 rounded-lg border border-border bg-surface-2 p-2.5 text-[11px] text-muted-foreground">
                <span className="font-medium text-[var(--warning)]">Risk · </span>
                {m.risk}
              </div>
            ) : null}
          </Panel>
        ))}
      </div>

      <Panel title="Score history" hint="Composite score by month" className="mt-4">
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[
                { m: "Feb", s: 48 },
                { m: "Mar", s: 52 },
                { m: "Apr", s: 55 },
                { m: "May", s: 61 },
                { m: "Jun", s: 63 },
                { m: "Jul", s: 65 },
                { m: "Aug", s: overall },
              ]}
              margin={{ left: -22, right: 6, top: 6 }}
            >
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="m" tickLine={false} axisLine={false} stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis tickLine={false} axisLine={false} stroke="var(--muted-foreground)" fontSize={11} />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
              />
              <Bar dataKey="s" name="Score" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </>
  );
}
