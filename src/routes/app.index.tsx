import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent, useRef } from "react";
import {
  Activity,
  ArrowRight,
  Brain,
  CheckCircle2,
  ChevronRight,
  FileText,
  Globe,
  HeartHandshake,
  Lightbulb,
  Mic,
  MicOff,
  Paperclip,
  ShieldCheck,
  Sparkles,
  Swords,
  TrendingUp,
  Users,
} from "lucide-react";
import { useOs } from "@/lib/os-store";
import { useAuth } from "@/lib/auth-context";
import { AiSphere } from "@/components/os/ai-sphere";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/")({
  component: HomePage,
});

const SUGGESTED_PROMPTS = [
  "What should I focus on this week?",
  "Validate my new idea",
  "Analyze my competitors",
  "Prepare for an investor meeting",
];

function HomePage() {
  const { profile, overall, activity, tasks, toggleTask } = useOs();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [prompt, setPrompt] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const rawFounders = profile["founders"];
  const firstFounder = Array.isArray(rawFounders)
    ? rawFounders[0]
    : typeof rawFounders === "string"
      ? rawFounders.split(",")[0]?.trim()
      : "";

  const founderName =
    profile["founder_name"] ||
    firstFounder ||
    (user?.username ? user.username.charAt(0).toUpperCase() + user.username.slice(1) : "") ||
    "Alex";

  // Dynamic greeting based on user's current hour
  const hour = new Date().getHours();
  const timeGreeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Forward prompt to the real Co-Founder Chat route
  const handleAskCoFounder = (textToSubmit?: string) => {
    const query = (textToSubmit !== undefined ? textToSubmit : prompt).trim();
    if (!query) return;
    navigate({
      to: "/app/chat",
      search: { prompt: query } as any,
    });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleAskCoFounder();
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* ── Hero Section ────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-[#081226]/90 via-[#0a162e]/80 to-[#050b17]/95 p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
        {/* Ambient background glows */}
        <div className="absolute -top-24 -left-24 size-96 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 size-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col-reverse md:flex-row items-center justify-between gap-8">
          {/* Left Hero Content */}
          <div className="max-w-xl text-left">
            <div className="inline-flex items-center gap-2 text-sm text-cyan-300 font-medium mb-3">
              <span>{timeGreeting}, {founderName}</span>
              <span className="text-base">👋</span>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-white leading-[1.15]">
              Your AI Co-Founder
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-sky-400">
                is here to build with you.
              </span>
            </h1>

            <p className="mt-4 text-sm sm:text-base text-muted-foreground/90 leading-relaxed font-normal max-w-lg">
              Real insights. Smarter decisions. A bigger tomorrow.
            </p>
          </div>

          {/* Right AI Sphere Presence */}
          <div className="shrink-0">
            <AiSphere
              size="md"
              showQuote={true}
              quote="Ideas are easy. Execution is hard. That's why I'm here."
              className="md:hidden"
            />
            <AiSphere
              size="lg"
              showQuote={true}
              quote="Ideas are easy. Execution is hard. That's why I'm here."
              className="hidden md:flex"
            />
          </div>
        </div>
      </div>

      {/* ── 4 Quick Stat / Signal Cards ─────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Market Signals */}
        <Link
          to="/app/research"
          className="group rounded-2xl border border-border/50 bg-[#0a1122]/60 p-4 shadow-lg backdrop-blur-sm transition-all hover:border-cyan-500/40 hover:bg-[#0c152a]/80 cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 group-hover:scale-105 transition-transform">
              <TrendingUp className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors">
                2 new market signals
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                AI travel tools trending +300%
              </div>
            </div>
          </div>
        </Link>

        {/* 2. Opportunities */}
        <Link
          to="/app/opportunities"
          className="group rounded-2xl border border-border/50 bg-[#0a1122]/60 p-4 shadow-lg backdrop-blur-sm transition-all hover:border-cyan-500/40 hover:bg-[#0c152a]/80 cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/25 group-hover:scale-105 transition-transform">
              <Lightbulb className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors">
                3 opportunities to explore
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                1 high potential
              </div>
            </div>
          </div>
        </Link>

        {/* 3. Startup Health */}
        <Link
          to="/app/health"
          className="group rounded-2xl border border-border/50 bg-[#0a1122]/60 p-4 shadow-lg backdrop-blur-sm transition-all hover:border-cyan-500/40 hover:bg-[#0c152a]/80 cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 group-hover:scale-105 transition-transform">
              <ShieldCheck className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors">
                Startup health is stable
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                {overall} / 100
              </div>
            </div>
          </div>
        </Link>

        {/* 4. Competitor Updates */}
        <Link
          to="/app/competitors"
          className="group rounded-2xl border border-border/50 bg-[#0a1122]/60 p-4 shadow-lg backdrop-blur-sm transition-all hover:border-cyan-500/40 hover:bg-[#0c152a]/80 cursor-pointer"
        >
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/25 group-hover:scale-105 transition-transform">
              <Swords className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors">
                1 competitor update
              </div>
              <div className="text-[11px] text-muted-foreground truncate">
                Roamio launched a new feature
              </div>
            </div>
          </div>
        </Link>
      </div>

      {/* ── Main Co-Founder AI Input Bar ────────────────────────── */}
      <div className="space-y-3">
        <form
          onSubmit={onSubmit}
          className="relative flex items-center rounded-2xl border border-cyan-500/30 bg-[#0a1224]/80 p-2.5 shadow-[0_0_25px_rgba(6,182,212,0.15)] backdrop-blur-xl transition-all focus-within:border-cyan-400 focus-within:shadow-[0_0_30px_rgba(6,182,212,0.25)]"
        >
          <div className="pl-3 pr-2 text-cyan-400 shrink-0">
            <Sparkles className="size-5" />
          </div>

          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask your co-founder anything..."
            className="w-full bg-transparent text-sm sm:text-base text-white outline-none placeholder:text-muted-foreground/70 px-2"
          />

          <div className="flex items-center gap-1.5 shrink-0 pr-1">
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={() => {
                // Navigate to chat where document handling is already connected
                navigate({ to: "/app/chat" });
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:text-white hover:bg-white/[0.06] transition-colors"
              title="Attach document or context"
            >
              <Paperclip className="size-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsRecording(!isRecording)}
              className={cn(
                "grid size-9 place-items-center rounded-xl transition-colors",
                isRecording
                  ? "bg-red-500/20 text-red-400 animate-pulse"
                  : "text-muted-foreground hover:text-white hover:bg-white/[0.06]"
              )}
              title={isRecording ? "Listening..." : "Voice input"}
            >
              <Mic className="size-4" />
            </button>

            {/* Cyan Send Arrow Button */}
            <button
              type="submit"
              disabled={!prompt.trim()}
              className="grid size-9 place-items-center rounded-full bg-cyan-400 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:bg-cyan-300 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
              title="Send to Co-Founder"
            >
              <ArrowRight className="size-4 stroke-[2.5]" />
            </button>
          </div>
        </form>

        {/* Suggested Quick Prompts */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {SUGGESTED_PROMPTS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => handleAskCoFounder(item)}
              className="rounded-xl border border-border/60 bg-white/[0.02] px-3.5 py-1.5 text-xs text-muted-foreground transition-all hover:border-cyan-500/40 hover:bg-cyan-950/30 hover:text-cyan-300 cursor-pointer"
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* ── Today's Focus & Live Signals ────────────────────────── */}
      <div className="grid gap-5 md:grid-cols-2">
        {/* Today's Focus & Tasks */}
        <div className="rounded-2xl border border-border/50 bg-[#0a1122]/60 p-5 shadow-xl backdrop-blur-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white">Today&apos;s Focus</span>
            <Link to="/app/tasks" className="text-[11px] text-cyan-400 hover:underline">
              View all →
            </Link>
          </div>

          <div className="mt-4 space-y-2.5">
            {tasks.slice(0, 3).map((task) => (
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
                <span className="text-[10px] font-semibold text-muted-foreground uppercase px-2 py-0.5 rounded bg-white/[0.03]">
                  {task.from || "Priority"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Company Activity */}
        <div className="rounded-2xl border border-border/50 bg-[#0a1122]/60 p-5 shadow-xl backdrop-blur-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white">Recent Activity</span>
            <Link to="/app/timeline" className="text-[11px] text-cyan-400 hover:underline">
              View all →
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {activity.slice(0, 3).map((item) => (
              <div key={item.id} className="flex items-start gap-3 text-xs">
                <span className="live-dot mt-1.5 size-1.5 shrink-0 rounded-full bg-cyan-400" />
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-white">{item.agent}:</span>{" "}
                  <span className="text-muted-foreground">{item.text}</span>
                </div>
                <span className="text-[10px] text-muted-foreground/60 shrink-0">{item.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
