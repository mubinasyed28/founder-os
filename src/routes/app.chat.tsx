import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import { ArrowUp, Brain, Check, FileText, Paperclip, Sparkles } from "lucide-react";
import { PageHeader, Panel, Tag } from "@/components/os/primitives";
import { pipeline } from "@/lib/company-data";
import { useOs } from "@/lib/os-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/chat")({
  component: Chat,
});


type Msg = {
  role: "user" | "assistant";
  text: string;
  steps?: string[];
  sources?: string[];
};

const SUGGESTIONS = [
  "What is the single highest-leverage thing I can do this week?",
  "Should I raise prices to ₹699?",
  "Why did retention drop?",
  "Are we ready to talk to investors?",
  "What is StudyOS doing that we aren't?",
];

const ANSWERS: Record<string, Msg> = {
  default: {
    role: "assistant",
    text: "Here's what company memory says. The retention regression (Jun 14 onboarding rewrite) is the binding constraint: it suppresses Product score, taints the cohort charts investors will ask for, and makes any pricing test unreadable because you can't separate price churn from onboarding churn. Sequence: rollback test → clean two weeks of data → pricing test → investor conversations. That ordering raises expected 90-day MRR by roughly ₹78K versus running pricing first.",
    steps: ["Intent: strategic sequencing", "Retrieved 14 memory chunks", "Traversed 23 graph nodes", "Critic dropped 1 unsupported claim"],
    sources: ["Cohort table · internal", "Interview batch 3", "Financial model v6"],
  },
  price: {
    role: "assistant",
    text: "Yes, but not yet and not for everyone. Willingness-to-pay clusters at ₹690 across 214 respondents and your conversion curve is flat between ₹499 and ₹699, so the headline case is strong (73% confidence, ≈ +₹61K MRR in 90 days). Two conditions: grandfather every existing user, and wait until the onboarding rollback has produced two clean weeks of cohort data — otherwise you will attribute onboarding churn to price.",
    steps: ["Intent: pricing decision", "Financial + Forecasting agents in parallel", "Critic challenged elasticity assumption", "Confidence adjusted −9"],
    sources: ["Van Westendorp survey (n=214)", "Competitor pricing scan", "Stripe cohort export"],
  },
  retention: {
    role: "assistant",
    text: "D30 fell from 27.9% to 24.8% and the drop is entirely in the cohort that entered after Jun 14 — the day onboarding v2 shipped. The loss is concentrated in first-session completion (−14pts), not in later weeks, which rules out value decay. Session replays show 62% abandonment at the four-step goal wizard. Correlation with the deploy is 0.81 after removing exam-season seasonality.",
    steps: ["Intent: diagnostic", "Isolated cohort by deploy date", "Controlled for seasonality", "Verified with 40 session replays"],
    sources: ["Cohort retention export", "Session replay sample", "Deploy log Jun 14"],
  },
  investor: {
    role: "assistant",
    text: "Readiness is 54 and rising 9 points a month. Data room is 71% complete; the blockers are cohort retention charts, a costed hiring plan, and a DPDP note for student data. Your leverage is highest now at 11.8 months of runway. My recommendation: fix the retention story first — a partner will find it in diligence within ten minutes — then open with the four warm intros that have been sitting unactioned for 22 days.",
    steps: ["Intent: fundraising readiness", "Audited data room (8 items)", "Compared to 40 pre-seed benchmarks"],
    sources: ["Data room audit", "Investor CRM", "Runway model"],
  },
  competitor: {
    role: "assistant",
    text: "StudyOS shipped an AI planner 11 days ago and their threat score moved from 75 to 82. What they have that you don't: university distribution partnerships and $4M. What they don't have — and no tracked competitor has — is re-planning after a missed week, which 41% of your churn interviews describe as the moment they gave up. That's the wedge. It is copyable in about six weeks, so speed matters more than polish here.",
    steps: ["Browser Agent verified changelog", "Re-scored 6 competitors", "Mapped gap to churn interviews"],
    sources: ["StudyOS changelog", "Interview batch 3", "Competitor matrix"],
  },
};

function pick(q: string): Msg {
  const s = q.toLowerCase();
  if (s.includes("price") || s.includes("pricing") || s.includes("699")) return ANSWERS.price!;
  if (s.includes("retention") || s.includes("churn") || s.includes("drop")) return ANSWERS.retention!;
  if (s.includes("investor") || s.includes("raise") || s.includes("fund")) return ANSWERS.investor!;
  if (s.includes("studyos") || s.includes("competitor")) return ANSWERS.competitor!;
  return ANSWERS.default!;
}

function Chat() {
  const { pushActivity } = useOs();
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: "assistant",
      text: "Morning, Meera. Overnight I re-ran the retention diagnosis and verified StudyOS's planner launch. Two decisions need you today: the onboarding rollback (86% confidence) and whether we open the pre-seed conversation this month. Ask me anything — I have your full company memory loaded.",
      steps: ["Loaded 1,284 memory chunks", "Ran 14 overnight jobs", "3 recommendations queued"],
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState<number>(-1);
  const timers = useRef<number[]>([]);

  function ask(q: string) {
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setInput("");
    pushActivity("Memory Agent", "retrieved context for a founder question");
    setThinking(0);
    timers.current.forEach(clearTimeout);
    timers.current = [];
    for (let i = 1; i <= 4; i++) {
      timers.current.push(window.setTimeout(() => setThinking(i), 380 * i));
    }
    timers.current.push(
      window.setTimeout(() => {
        setThinking(-1);
        setMsgs((m) => [...m, pick(q)]);
      }, 380 * 5),
    );
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (input.trim()) ask(input.trim());
  }

  return (
    <>
      <PageHeader
        eyebrow="Co-Founder Chat"
        title="Ask the co-founder who remembers everything"
        subtitle="Grounded in 1,284 memory chunks, a knowledge graph of 12 entity types and live web verification. Every answer shows its work."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Panel className="flex h-[620px] flex-col p-0">
          <div className="flex-1 space-y-5 overflow-y-auto p-5">
            {msgs.map((m, i) => (
              <div key={i} className={cn("flex", m.role === "user" && "justify-end")}>
                <div className={cn("max-w-[85%]", m.role === "user" && "text-right")}>
                  {m.role === "assistant" ? (
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-primary">
                      <Sparkles className="size-3" /> Co-founder
                    </div>
                  ) : null}
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3 text-[14px] leading-relaxed",
                      m.role === "assistant" ? "bg-surface-2" : "bg-primary/12",
                    )}
                  >
                    {m.text}
                  </div>
                  {m.steps ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.steps.map((s) => (
                        <span key={s} className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted-foreground">
                          <Check className="mr-1 inline size-2.5 text-primary" />
                          {s}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {m.sources ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.sources.map((s) => (
                        <span key={s} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                          <FileText className="size-2.5" />
                          {s}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}

            {thinking >= 0 ? (
              <div className="max-w-[85%] rounded-2xl bg-surface-2 p-4">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-primary">
                  <Brain className="size-3" /> Reasoning
                </div>
                {pipeline.slice(0, 5).map((p, i) => (
                  <div
                    key={p.step}
                    className={cn(
                      "flex items-center gap-2 py-1 text-xs transition-opacity",
                      i <= thinking ? "opacity-100" : "opacity-30",
                    )}
                  >
                    {i < thinking ? (
                      <Check className="size-3 text-primary" />
                    ) : (
                      <span className="live-dot size-1.5 rounded-full bg-primary" />
                    )}
                    <span className="font-medium">{p.step}</span>
                    <span className="truncate text-muted-foreground">{p.detail}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="border-t border-border p-3">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
            <form onSubmit={onSubmit} className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2">
              <Paperclip className="size-4 shrink-0 text-muted-foreground" />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything — it answers from your company, not the internet's average startup"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <button type="submit" className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
                <ArrowUp className="size-4" />
              </button>
            </form>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Context in this thread" hint="What memory is being used">
            <div className="space-y-2 text-xs">
              {[
                ["Documents", "6 indexed"],
                ["Memory chunks", "1,284"],
                ["Graph nodes", "12 entities"],
                ["Live sources", "4 verified today"],
                ["Decisions logged", "118"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="tabular-nums">{v}</span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Agents on call">
            <div className="flex flex-wrap gap-1.5">
              {["Research", "Strategy", "Financial", "Critic", "Memory", "Browser"].map((a) => (
                <Tag key={a} tone="primary">
                  {a}
                </Tag>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              The Critic Agent reviews every answer before you see it and lowers confidence when evidence is thin.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
