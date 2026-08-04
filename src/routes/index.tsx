import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Brain,
  Compass,
  Gauge,
  GitBranch,
  Lightbulb,
  Sparkles,
  Timer,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cofoundr OS — The AI Operating System for Founders" },
      {
        name: "description",
        content:
          "Not a chatbot. A multi-agent decision engine with persistent company memory: startup health scoring, opportunity detection, simulations and evidence-backed recommendations.",
      },
      { property: "og:title", content: "Cofoundr OS — The AI Operating System for Founders" },
      {
        property: "og:description",
        content:
          "Persistent company memory, ten specialist agents, and a decision engine that explains its reasoning.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const STAGES = ["Idea", "Validation", "Planning", "Building", "Launch", "Growth", "Fundraising", "Scaling"];

const PILLARS = [
  {
    icon: Gauge,
    title: "Startup Health Score",
    body: "Eight weighted dimensions, each with drivers, risks and a plain-English explanation of why the number moved.",
  },
  {
    icon: Brain,
    title: "Transparent reasoning",
    body: "Every answer shows its pipeline: intent, memory retrieval, graph traversal, search, agents, critic, evidence.",
  },
  {
    icon: Timer,
    title: "Persistent company memory",
    body: "Decisions, documents, meetings and metrics become a timeline and a knowledge graph — not a lost chat log.",
  },
  {
    icon: Compass,
    title: "Decision simulator",
    body: "Hire, price, raise, cut burn — see the effect on revenue, runway, growth, retention and risk instantly.",
  },
  {
    icon: Lightbulb,
    title: "Gap detection",
    body: "Competitor, market, feature, pricing and positioning gaps surfaced with confidence and evidence.",
  },
  {
    icon: GitBranch,
    title: "Ten specialist agents",
    body: "Research, strategy, finance, planning, writing, forecasting, critic, memory, browser and execution.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 glass">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-5 py-3.5">
          <span className="grid size-8 place-items-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">Cofoundr OS</span>
          <nav className="ml-8 hidden gap-6 text-[13px] text-muted-foreground md:flex">
            <a href="#loop" className="hover:text-foreground">
              The loop
            </a>
            <a href="#pillars" className="hover:text-foreground">
              Platform
            </a>
            <a href="#proof" className="hover:text-foreground">
              Why it&apos;s different
            </a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/auth" className="rounded-lg px-3 py-1.5 text-[13px] text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <Link
              to="/onboarding"
              className="rounded-lg bg-primary px-3.5 py-1.5 text-[13px] font-medium text-primary-foreground transition-transform hover:scale-[1.02]"
            >
              Meet your co-founder
            </Link>
          </div>
        </div>
      </header>

      <section className="aurora relative overflow-hidden">
        <div className="grid-lines absolute inset-0 opacity-40" />
        <div className="relative mx-auto max-w-6xl px-5 pb-24 pt-24 text-center">
          <div className="rise-in mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-[12px] text-muted-foreground">
            <span className="live-dot size-1.5 rounded-full bg-primary" />
            10 agents · persistent memory · evidence-grounded
          </div>
          <h1 className="rise-in mx-auto max-w-4xl text-balance text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            The AI <span className="text-gradient">operating system</span> for founders
          </h1>
          <p className="rise-in mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground">
            Cofoundr OS is not another chatbot. It is a decision engine with persistent company memory that
            researches your market, scores your health, simulates your choices and explains every recommendation.
          </p>
          <div className="rise-in mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/onboarding"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:scale-[1.02]"
            >
              Start conversational onboarding <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/app"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-3 text-sm font-medium hover:border-primary/40"
            >
              Open the live demo workspace
            </Link>
          </div>

          <div className="panel rise-in mx-auto mt-16 max-w-5xl overflow-hidden p-0 text-left">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
              <span className="size-2.5 rounded-full bg-destructive/60" />
              <span className="size-2.5 rounded-full bg-[var(--warning)]/60" />
              <span className="size-2.5 rounded-full bg-primary/60" />
              <span className="ml-3 text-[11px] text-muted-foreground">lumenlabs · morning briefing</span>
            </div>
            <div className="grid gap-4 p-6 md:grid-cols-3">
              {[
                { k: "Startup score", v: "69", d: "+4 this week", s: "Momentum leading, product lagging" },
                { k: "Runway", v: "11.8mo", d: "+1.6mo", s: "Burn down 9% after infra change" },
                { k: "Top decision", v: "Roll back onb v2", d: "86% conf.", s: "≈ +2.4pts D30 retention" },
              ].map((c) => (
                <div key={c.k} className="rounded-xl bg-surface-2 p-4">
                  <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{c.k}</div>
                  <div className="mt-1.5 text-2xl font-semibold tracking-tight">{c.v}</div>
                  <div className="mt-1 text-[11px] text-primary">{c.d}</div>
                  <div className="mt-2 text-xs text-muted-foreground">{c.s}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="loop" className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-center text-3xl font-semibold tracking-tight">One loop, eight stages, zero dead ends</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-muted-foreground">
          Every screen in the product serves a stage of the founder journey, and every action feeds back into
          company memory so the next recommendation is sharper than the last.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
          {STAGES.map((s, i) => (
            <span key={s} className="flex items-center gap-2">
              <span className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-[13px]">{s}</span>
              {i < STAGES.length - 1 ? <ArrowRight className="size-3.5 text-muted-foreground" /> : null}
            </span>
          ))}
        </div>
      </section>

      <section id="pillars" className="mx-auto max-w-6xl px-5 pb-20">
        <div className="grid gap-4 md:grid-cols-3">
          {PILLARS.map((p) => (
            <div key={p.title} className="panel p-6">
              <span className="grid size-9 place-items-center rounded-xl bg-primary/12 text-primary">
                <p.icon className="size-4" />
              </span>
              <h3 className="mt-4 text-base font-semibold tracking-tight">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="proof" className="mx-auto max-w-6xl px-5 pb-24">
        <div className="panel grid gap-8 p-8 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">What a chatbot cannot do</h2>
            <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
              {[
                "Remember the decision you made in March and hold you to it in August.",
                "Notice a competitor shipped your roadmap item — 11 days before you did.",
                "Show you the difference between what it predicted and what actually happened.",
                "Score your fundraising readiness against the documents in your data room.",
                "Simulate a ₹200 price change across 18 months of runway in one keystroke.",
              ].map((t) => (
                <li key={t} className="flex gap-2.5">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-surface-2 p-6">
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Learning log · sample</div>
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <div className="text-muted-foreground">Predicted</div>
                <div>Onboarding v2 raises activation to 48%</div>
              </div>
              <div>
                <div className="text-muted-foreground">Actual</div>
                <div className="text-destructive">Activation 41%, retention −3.1pts</div>
              </div>
              <div>
                <div className="text-muted-foreground">What the model learned</div>
                <div>
                  Structured-data collection was scored as an activation asset. It is an activation cost. Prior
                  inverted; confidence −6.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-10 text-center text-xs text-muted-foreground">
        Cofoundr OS · built to run on free-tier, self-hostable infrastructure.
      </footer>
    </div>
  );
}
