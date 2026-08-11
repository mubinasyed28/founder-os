import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, ArrowUpRight, Sparkles, TrendingUp } from "lucide-react";
import { agents, company, kpiSeries, notifications, opportunities, recommendations } from "@/lib/company-data";
import { useOs } from "@/lib/os-store";
import { Delta, Meter, PageHeader, Panel, ScoreRing, Tag } from "@/components/os/primitives";
import { RecommendationCard } from "@/components/os/recommendation-card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

const chartAxis = { stroke: "var(--muted-foreground)", fontSize: 11 };

import { useAuth } from "@/lib/auth-context";

function Dashboard() {
  const { metrics, overall, activity, tasks } = useOs();
  const { user } = useAuth();
  const openTasks = tasks.filter((t) => !t.done).length;

  const displayName = user?.username
    ? user.username.charAt(0).toUpperCase() + user.username.slice(1)
    : "Founder";

  const companyName = useOs().profile["company_name"] || company.name;
  const companyStage = useOs().profile["current_stage"] || company.stage;

  return (
    <>
      <PageHeader
        eyebrow="Morning briefing · 04 Aug"
        title={`Good morning, ${displayName}`}
        subtitle={`${companyName} · ${companyStage}. Overnight your agents ran 14 jobs, verified 9 sources and found one decision that can't wait.`}
        actions={
          <Link
            to="/app/chat"
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-medium text-primary-foreground"
          >
            <Sparkles className="size-3.5" /> Brief me
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Panel className="flex flex-col items-center justify-center gap-4 text-center">
          <ScoreRing value={overall} label="Startup score" sub="+4 this week" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Momentum and growth are carrying the score. Product is the drag — retention regression is unresolved
            for 21 days.
          </p>
          <Link to="/app/health" className="text-[13px] text-primary hover:underline">
            Break down all 8 dimensions →
          </Link>
        </Panel>

        <div className="grid gap-4 sm:grid-cols-2">
          {metrics.slice(0, 4).map((m) => (
            <div key={m.key} className="panel rise-in p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{m.label}</span>
                <Delta value={m.delta} />
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums">{m.score}</span>
                <span className="text-[11px] text-muted-foreground">/100</span>
              </div>
              <div className="mt-2.5">
                <Meter value={m.score} tone={m.score < 60 ? "warning" : "primary"} />
              </div>
              <p className="mt-2.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{m.why}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <Panel
          title="Revenue & runway"
          hint="MRR in ₹thousands, runway in months — updated when the Financial Agent last ran"
          action={
            <Link to="/app/forecast" className="text-[12px] text-primary hover:underline">
              Forecast →
            </Link>
          }
        >
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={kpiSeries} margin={{ left: -22, right: 6, top: 6 }}>
                <defs>
                  <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} {...chartAxis} />
                <YAxis tickLine={false} axisLine={false} {...chartAxis} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Area dataKey="mrr" name="MRR (₹K)" stroke="var(--primary)" strokeWidth={2} fill="url(#mrrFill)" />
                <Area
                  dataKey="runway"
                  name="Runway (mo)"
                  stroke="var(--chart-2)"
                  strokeWidth={2}
                  fill="transparent"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Live agent activity" hint="Your co-founder never stops working">
          <div className="space-y-3">
            {activity.slice(0, 6).map((a) => (
              <div key={a.id} className="flex gap-2.5 text-xs">
                <span className="live-dot mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                <div>
                  <span className="font-medium">{a.agent}</span>{" "}
                  <span className="text-muted-foreground">{a.text}</span>
                </div>
              </div>
            ))}
          </div>
          <Link to="/app/agents" className="mt-4 block text-[12px] text-primary hover:underline">
            See all {agents.length} agents →
          </Link>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Signals needing you" hint="Proactive, not a dashboard you have to read" className="lg:col-span-2">
          <div className="space-y-2.5">
            {notifications.slice(0, 5).map((n) => (
              <div
                key={n.id}
                className={cn(
                  "flex items-start gap-2.5 rounded-xl border border-border bg-surface-2 p-3 text-[13px]",
                  n.tone === "warn" && "border-[color-mix(in_oklab,var(--warning)_35%,transparent)]",
                )}
              >
                {n.tone === "warn" ? (
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[var(--warning)]" />
                ) : (
                  <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-primary" />
                )}
                <span>{n.text}</span>
                <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{n.time}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Today" hint={`${openTasks} open tasks from accepted decisions`}>
          <div className="space-y-2.5">
            {tasks.slice(0, 5).map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-[13px]">
                <span
                  className={cn(
                    "size-3.5 shrink-0 rounded border",
                    t.done ? "border-primary bg-primary" : "border-border",
                  )}
                />
                <span className={cn("truncate", t.done && "text-muted-foreground line-through")}>{t.title}</span>
                <Tag tone={t.priority === "P0" ? "bad" : "muted"}>{t.priority}</Tag>
              </div>
            ))}
          </div>
          <Link to="/app/tasks" className="mt-4 block text-[12px] text-primary hover:underline">
            Open task board →
          </Link>
        </Panel>
      </div>

      <div className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Decisions on the table</h2>
            <p className="text-sm text-muted-foreground">
              Each one carries reasoning, evidence, confidence, risk, ROI and alternatives.
            </p>
          </div>
          <Link to="/app/simulator" className="text-[13px] text-primary hover:underline">
            Simulate before you commit →
          </Link>
        </div>
        <div className="space-y-4">
          {recommendations.map((r, i) => (
            <RecommendationCard key={r.id} rec={r} defaultOpen={i === 0} />
          ))}
        </div>
      </div>

      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Opportunities detected"
          hint="Gaps your competitors have left open"
          action={
            <Link to="/app/opportunities" className="text-[12px] text-primary hover:underline">
              All {opportunities.length} →
            </Link>
          }
        >
          <div className="space-y-3">
            {opportunities.slice(0, 3).map((o) => (
              <div key={o.id} className="rounded-xl border border-border bg-surface-2 p-3.5">
                <div className="flex items-center gap-2">
                  <Tag tone="primary">{o.type}</Tag>
                  <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                    {o.confidence}% confidence
                  </span>
                </div>
                <div className="mt-2 text-[13px] font-medium leading-snug">{o.title}</div>
                <div className="mt-1.5 text-[11px] text-muted-foreground">{o.signal}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="User growth" hint="Signups compounding 11.4% w/w, 78% organic">
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={kpiSeries} margin={{ left: -20, right: 6, top: 6 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} {...chartAxis} />
                <YAxis tickLine={false} axisLine={false} {...chartAxis} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Line dataKey="users" name="Users" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
                <Line dataKey="retention" name="D30 %" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
            <TrendingUp className="size-3 text-primary" /> Retention line is the one to watch — it has fallen every
            month since March.
          </div>
        </Panel>
      </div>
    </>
  );
}
