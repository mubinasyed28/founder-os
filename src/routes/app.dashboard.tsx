import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
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
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  FileText,
  Flame,
  Globe,
  Lightbulb,
  Sparkles,
  Swords,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { useOs } from "@/lib/os-store";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/dashboard")({
  component: DashboardPage,
});

const GROWTH_TREND_DATA = [
  { date: "Aug 10", users: 45, revenue: 1.2, retention: 55 },
  { date: "Aug 17", users: 58, revenue: 1.5, retention: 60 },
  { date: "Aug 24", users: 65, revenue: 1.8, retention: 64 },
  { date: "Aug 31", users: 70, revenue: 2.1, retention: 70 },
  { date: "Sep 7", users: 76, revenue: 2.4, retention: 76 },
];

function DashboardPage() {
  const { metrics, overall, activity, tasks, toggleTask, profile } = useOs();
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState<"7D" | "30D" | "3M" | "1Y">("30D");

  // Health metric scores from store or standard calibration
  const growthScore = metrics.find((m) => m.key === "growth")?.score ?? 78;
  const retentionScore = metrics.find((m) => m.key === "product")?.score ?? 62;
  const marketFitScore = metrics.find((m) => m.key === "market")?.score ?? 80;
  const competitionScore = metrics.find((m) => m.key === "competition")?.score ?? 70;
  const financialScore = metrics.find((m) => m.key === "financial")?.score ?? 68;

  // Key metrics
  const totalUsers = profile["total_users"] ? Number(profile["total_users"]).toLocaleString() : "1,248";
  const monthlyRevenue = profile["monthly_revenue"] ? `₹${(Number(profile["monthly_revenue"]) / 1000).toFixed(1)}K` : "₹2.4L";
  const runwayMonths = profile["runway_months"] ? `${profile["runway_months"]} months` : "8 months";

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Company Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            A real-time view of your startup&apos;s health and progress.
          </p>
        </div>

        {/* Time Filters */}
        <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-surface-2/40 p-1 self-start sm:self-auto">
          {(["7D", "30D", "3M", "1Y"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-semibold transition-all cursor-pointer",
                timeRange === r
                  ? "bg-cyan-500 text-black shadow-[0_0_12px_rgba(6,182,212,0.4)]"
                  : "text-muted-foreground hover:text-white"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* ── Top Row: Health, Key Metrics, AI Insights ──────────── */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {/* 1. Startup Health */}
        <div className="rounded-2xl border border-border/50 bg-[#0a1122]/70 p-5 shadow-xl backdrop-blur-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Startup Health</span>
              <TrendingUp className="size-4 text-cyan-400" />
            </div>
            <Link to="/app/health" className="text-[11px] text-cyan-400 hover:underline">
              Details →
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-[110px_1fr] items-center gap-4">
            {/* Radial Gauge */}
            <div className="relative flex flex-col items-center justify-center">
              <svg viewBox="0 0 100 100" className="size-24 transform -rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-white/[0.08]"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]"
                  fill="transparent"
                  strokeDasharray={`${2 * Math.PI * 40}`}
                  strokeDashoffset={`${2 * Math.PI * 40 * (1 - overall / 100)}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-black tracking-tight text-white">{overall}</span>
                <span className="text-[9px] font-medium text-muted-foreground">Out of 100</span>
              </div>
            </div>

            {/* Health Dimensions Progress Bars */}
            <div className="space-y-2">
              {[
                { label: "Growth", score: growthScore },
                { label: "Retention", score: retentionScore },
                { label: "Market Fit", score: marketFitScore },
                { label: "Competition", score: competitionScore },
                { label: "Financial", score: financialScore },
              ].map((item) => (
                <div key={item.label} className="text-xs">
                  <div className="flex justify-between text-[11px] mb-0.5">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-semibold text-white/90">{item.score}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/[0.07] overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-500",
                        item.score >= 75 ? "bg-cyan-400" : item.score >= 60 ? "bg-emerald-400" : "bg-amber-400"
                      )}
                      style={{ width: `${item.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/40 flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
            <TrendingUp className="size-3.5" />
            <span>+4 this week</span>
          </div>
        </div>

        {/* 2. Key Metrics */}
        <div className="rounded-2xl border border-border/50 bg-[#0a1122]/70 p-5 shadow-xl backdrop-blur-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white">Key Metrics</span>
            <Link to="/app/metrics" className="text-[11px] text-cyan-400 hover:underline">
              View all →
            </Link>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 flex-1">
            {/* Users */}
            <div className="rounded-xl border border-border/40 bg-white/[0.02] p-3 flex flex-col justify-between">
              <span className="text-[11px] text-muted-foreground">Users</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold text-white">{totalUsers}</span>
                <span className="text-[11px] font-semibold text-emerald-400 flex items-center">
                  ↑ 12%
                </span>
              </div>
            </div>

            {/* Revenue */}
            <div className="rounded-xl border border-border/40 bg-white/[0.02] p-3 flex flex-col justify-between">
              <span className="text-[11px] text-muted-foreground">Revenue</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold text-white">{monthlyRevenue}</span>
                <span className="text-[11px] font-semibold text-emerald-400 flex items-center">
                  ↑ 18%
                </span>
              </div>
            </div>

            {/* Churn */}
            <div className="rounded-xl border border-border/40 bg-white/[0.02] p-3 flex flex-col justify-between">
              <span className="text-[11px] text-muted-foreground">Churn</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold text-white">4.2%</span>
                <span className="text-[11px] font-semibold text-emerald-400 flex items-center">
                  ↓ 1.3%
                </span>
              </div>
            </div>

            {/* Runway */}
            <div className="rounded-xl border border-border/40 bg-white/[0.02] p-3 flex flex-col justify-between">
              <span className="text-[11px] text-muted-foreground">Runway</span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xl font-bold text-white">{runwayMonths}</span>
                <span className="text-[11px] font-semibold text-muted-foreground">--</span>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2 text-[10px] text-muted-foreground/60 text-right">
            Synced with Stripe & Analytics
          </div>
        </div>

        {/* 3. AI Insights */}
        <div className="rounded-2xl border border-border/50 bg-[#0a1122]/70 p-5 shadow-xl backdrop-blur-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white">AI Insights</span>
            <Link to="/app/opportunities" className="text-[11px] text-cyan-400 hover:underline">
              View all →
            </Link>
          </div>

          <div className="mt-3 space-y-2.5 flex-1 overflow-hidden">
            {/* Insight 1 */}
            <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-2.5 transition-all hover:bg-amber-500/[0.08]">
              <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-amber-500/20 text-amber-400">
                <AlertTriangle className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-white">Retention dropping</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  Slight decrease in D7 retention detected
                </div>
              </div>
            </div>

            {/* Insight 2 */}
            <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-2.5 transition-all hover:bg-emerald-500/[0.08]">
              <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-emerald-500/20 text-emerald-400">
                <Lightbulb className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-white">New opportunity detected</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  Group travel planning (+22% lift)
                </div>
              </div>
            </div>

            {/* Insight 3 */}
            <div className="flex items-start gap-3 rounded-xl border border-purple-500/20 bg-purple-500/[0.05] p-2.5 transition-all hover:bg-purple-500/[0.08]">
              <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-purple-500/20 text-purple-400">
                <Swords className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-white">Competitor update</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  Roamio launched AI itinerary feature
                </div>
              </div>
            </div>

            {/* Insight 4 */}
            <div className="flex items-start gap-3 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.05] p-2.5 transition-all hover:bg-cyan-500/[0.08]">
              <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-cyan-500/20 text-cyan-400">
                <Globe className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-white">Market trend</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  AI travel tools trending +300%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Row: Growth Trend, Recent Activity, Today's Tasks ─ */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {/* 4. Growth Trend Chart */}
        <div className="rounded-2xl border border-border/50 bg-[#0a1122]/70 p-5 shadow-xl backdrop-blur-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-bold text-white">Growth Trend</span>
              <span className="ml-2 inline-flex items-center rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300 border border-cyan-500/30">
                {overall} now
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-cyan-400" /> Users
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-emerald-400" /> Revenue
              </span>
              <span className="flex items-center gap-1">
                <span className="size-2 rounded-full bg-purple-400" /> Retention
              </span>
            </div>
          </div>

          <div className="mt-4 h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={GROWTH_TREND_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#ffffff0d" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} stroke="#64748b" fontSize={10} />
                <YAxis tickLine={false} axisLine={false} stroke="#64748b" fontSize={10} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0a1122",
                    border: "1px solid rgba(6,182,212,0.3)",
                    borderRadius: "12px",
                    fontSize: "11px",
                  }}
                />
                <Line type="monotone" dataKey="users" stroke="#06b6d4" strokeWidth={2.5} dot={{ fill: "#06b6d4", r: 3 }} />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={{ fill: "#10b981", r: 3 }} />
                <Line type="monotone" dataKey="retention" stroke="#a855f7" strokeWidth={2} dot={{ fill: "#a855f7", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 5. Recent Activity */}
        <div className="rounded-2xl border border-border/50 bg-[#0a1122]/70 p-5 shadow-xl backdrop-blur-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white">Recent Activity</span>
            <Link to="/app/timeline" className="text-[11px] text-cyan-400 hover:underline">
              View all →
            </Link>
          </div>

          <div className="mt-4 space-y-3.5 flex-1">
            <div className="flex items-start gap-3 text-xs">
              <div className="grid size-7 shrink-0 place-items-center rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">
                <Users className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-white">Profile updated</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  Target audience: Students → Young Pros
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground/60 shrink-0">2 hrs ago</span>
            </div>

            <div className="flex items-start gap-3 text-xs">
              <div className="grid size-7 shrink-0 place-items-center rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25">
                <Lightbulb className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-white">Opportunity generated</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  &ldquo;Group travel planning&rdquo; (High potential)
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground/60 shrink-0">4 hrs ago</span>
            </div>

            <div className="flex items-start gap-3 text-xs">
              <div className="grid size-7 shrink-0 place-items-center rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/25">
                <Swords className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-white">Competitor update</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  Roamio launched AI itinerary feature
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground/60 shrink-0">6 hrs ago</span>
            </div>

            <div className="flex items-start gap-3 text-xs">
              <div className="grid size-7 shrink-0 place-items-center rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
                <FileText className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-white">New document added</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  Q3 Sales Report.pdf (12 chunks)
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground/60 shrink-0">8 hrs ago</span>
            </div>
          </div>
        </div>

        {/* 6. Today's Tasks */}
        <div className="rounded-2xl border border-border/50 bg-[#0a1122]/70 p-5 shadow-xl backdrop-blur-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white">Today&apos;s Tasks</span>
            <Link to="/app/tasks" className="text-[11px] text-cyan-400 hover:underline">
              View all →
            </Link>
          </div>

          <div className="mt-4 space-y-2.5 flex-1">
            {[
              { id: "task-1", title: "Review 3 new opportunities", priority: "High", priorityColor: "bg-red-500/20 text-red-400 border-red-500/30", done: false },
              { id: "task-2", title: "Run decision simulation for premium plan", priority: "Medium", priorityColor: "bg-amber-500/20 text-amber-400 border-amber-500/30", done: false },
              { id: "task-3", title: "Prepare investor update", priority: "Medium", priorityColor: "bg-amber-500/20 text-amber-400 border-amber-500/30", done: false },
              { id: "task-4", title: "Analyze Roamio&apos;s new feature", priority: "Low", priorityColor: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30", done: true },
            ].map((task) => (
              <div
                key={task.id}
                onClick={() => toggleTask(task.id)}
                className="group flex items-center justify-between rounded-xl border border-border/40 bg-white/[0.02] p-2.5 transition-all hover:bg-white/[0.05] cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={cn(
                      "size-4 rounded border flex items-center justify-center transition-colors",
                      task.done
                        ? "bg-cyan-500 border-cyan-500 text-black"
                        : "border-border group-hover:border-cyan-400"
                    )}
                  >
                    {task.done && <CheckCircle2 className="size-3.5 stroke-[3]" />}
                  </div>
                  <span
                    className={cn(
                      "text-xs truncate transition-colors",
                      task.done ? "line-through text-muted-foreground/60" : "text-white"
                    )}
                  >
                    {task.title}
                  </span>
                </div>
                <span
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[9px] font-bold shrink-0 uppercase tracking-wider",
                    task.priorityColor
                  )}
                >
                  {task.priority}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
