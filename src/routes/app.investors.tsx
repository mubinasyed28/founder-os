import { createFileRoute } from "@tanstack/react-router";
import { investorChecklist } from "@/lib/company-data";
import { PageHeader, Panel, ScoreRing, Tag } from "@/components/os/primitives";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/investors")({
  component: Page,
});

function Page() {
  const done = investorChecklist.filter((i) => i.done).length;
  return (
    <>
      <PageHeader
        eyebrow="Investor Readiness"
        title="What a partner will ask, before they ask it"
        subtitle="Readiness is scored against 40 comparable pre-seed rounds. Three gaps stand between you and a clean diligence process."
      />
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Panel className="flex flex-col items-center gap-4 text-center">
          <ScoreRing value={54} label="Readiness" sub="+9 this month" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            {done}/{investorChecklist.length} data room items complete. Your leverage peaks now at 11.8 months of
            runway — waiting past 9 months historically compresses valuation.
          </p>
        </Panel>
        <Panel title="Data room checklist">
          <div className="space-y-2">
            {investorChecklist.map((i) => (
              <div key={i.item} className="flex items-start gap-3 rounded-xl bg-surface-2 p-3">
                <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full text-[10px]", i.done ? "bg-primary text-primary-foreground" : "border border-[var(--warning)] text-[var(--warning)]")}>
                  {i.done ? "✓" : "!"}
                </span>
                <div>
                  <div className="text-[13px] font-medium">{i.item}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{i.note}</div>
                </div>
                {!i.done ? <span className="ml-auto"><Tag tone="warn">Blocker</Tag></span> : null}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
