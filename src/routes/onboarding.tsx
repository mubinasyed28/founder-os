import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { useOs } from "@/lib/os-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Conversational onboarding — Cofoundr OS" },
      {
        name: "description",
        content: "Answer five questions and your AI co-founder builds a company profile, researches the market and drafts a roadmap.",
      },
      { property: "og:title", content: "Conversational onboarding — Cofoundr OS" },
      { property: "og:description", content: "Your AI co-founder learns the company before it advises it." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Onboarding,
});

const QUESTIONS = [
  { key: "idea", q: "In one sentence — what are you building, and for whom?", ph: "An AI study-planning OS for university students" },
  { key: "stage", q: "Where are you today?", ph: "Pre-seed, 3,800 users, ₹2.1L MRR" },
  { key: "problem", q: "What problem are you certain about, and what are you still guessing at?", ph: "Certain: students fall behind. Guessing: pricing." },
  { key: "goal", q: "What has to be true 90 days from now for this quarter to be a win?", ph: "₹4L MRR and a pre-seed term sheet" },
  { key: "constraint", q: "What is your hardest constraint — money, time, people or knowledge?", ph: "Money and time, we're all still studying" },
];

const BUILD_STEPS = [
  "Creating company profile",
  "Researching market & competitors",
  "Validating the business against 7 criteria",
  "Generating a stage-aware roadmap",
  "Building the 18-month financial model",
  "Seeding company memory & knowledge graph",
];

function Onboarding() {
  const navigate = useNavigate();
  const { completeOnboarding } = useOs();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState("");
  const [building, setBuilding] = useState(false);
  const [doneSteps, setDoneSteps] = useState(0);

  const current = QUESTIONS[step];

  function submit() {
    if (!current) return;
    const value = draft.trim() || current.ph;
    const next = { ...answers, [current.key]: value };
    setAnswers(next);
    setDraft("");
    if (step === QUESTIONS.length - 1) {
      setBuilding(true);
      completeOnboarding(next);
      BUILD_STEPS.forEach((_, i) => {
        setTimeout(() => setDoneSteps(i + 1), 700 * (i + 1));
      });
      setTimeout(() => navigate({ to: "/app" }), 700 * BUILD_STEPS.length + 900);
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <div className="aurora min-h-screen px-5 py-14">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center gap-2 text-sm font-semibold">
          <span className="grid size-8 place-items-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="size-4" />
          </span>
          Cofoundr OS
          <span className="ml-auto text-xs font-normal text-muted-foreground">
            {building ? "Building your company" : `Question ${step + 1} of ${QUESTIONS.length}`}
          </span>
        </div>

        <div className="mb-8 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${building ? 100 : (step / QUESTIONS.length) * 100}%` }}
          />
        </div>

        {!building ? (
          <div className="space-y-4">
            {QUESTIONS.slice(0, step).map((q) => (
              <div key={q.key} className="space-y-2 opacity-60">
                <div className="panel max-w-[85%] p-4 text-sm">{q.q}</div>
                <div className="ml-auto max-w-[85%] rounded-xl bg-primary/12 p-4 text-sm">{answers[q.key]}</div>
              </div>
            ))}
            {current ? (
              <div key={current.key} className="rise-in space-y-4">
                <div className="panel max-w-[85%] p-5">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-primary">
                    <span className="live-dot size-1.5 rounded-full bg-primary" /> Co-founder
                  </div>
                  <p className="text-[15px] leading-relaxed">{current.q}</p>
                </div>
                <div className="panel p-3">
                  <textarea
                    autoFocus
                    rows={3}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        submit();
                      }
                    }}
                    placeholder={current.ph}
                    className="w-full resize-none bg-transparent p-2 text-sm outline-none placeholder:text-muted-foreground"
                  />
                  <div className="flex items-center justify-between px-2 pb-1">
                    <span className="text-[11px] text-muted-foreground">
                      Enter to continue · everything is written to company memory
                    </span>
                    <button
                      onClick={submit}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground"
                    >
                      Continue <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="panel p-7">
            <h2 className="text-lg font-semibold tracking-tight">Your co-founder is getting to work</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Six agents are running in parallel. This is the last time you will have to explain your company.
            </p>
            <div className="mt-6 space-y-3">
              {BUILD_STEPS.map((s, i) => {
                const done = i < doneSteps;
                const active = i === doneSteps;
                return (
                  <div
                    key={s}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm transition-colors",
                      done && "border-primary/30 bg-primary/5",
                      active && "shimmer",
                    )}
                  >
                    {done ? (
                      <Check className="size-4 text-primary" />
                    ) : active ? (
                      <Loader2 className="size-4 animate-spin text-primary" />
                    ) : (
                      <span className="size-4 rounded-full border border-border" />
                    )}
                    <span className={cn(!done && !active && "text-muted-foreground")}>{s}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
