import { createFileRoute } from "@tanstack/react-router";
import { validationCriteria } from "@/lib/company-data";
import { Meter, PageHeader, Panel, ScoreRing } from "@/components/os/primitives";

export const Route = createFileRoute("/app/validation")({
  component: Page,
});

function Page() {
  const avg = Math.round(validationCriteria.reduce((a, c) => a + c.score, 0) / validationCriteria.length);
  return (
    <>
      <PageHeader
        eyebrow="Idea Validation"
        title="Is this business worth your next two years?"
        subtitle="Seven criteria scored against evidence in company memory, not vibes. Defensibility is the weak link — and it is fixable."
      />
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Panel className="flex flex-col items-center gap-4 text-center">
          <ScoreRing value={avg} label="Validation" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Strong problem severity and founder-market fit. The verdict: build, but win on speed — the wedge is
            copyable in roughly six weeks.
          </p>
        </Panel>
        <Panel title="Criteria breakdown">
          <div className="space-y-4">
            {validationCriteria.map((c) => (
              <div key={c.label}>
                <div className="flex items-center justify-between text-sm">
                  <span>{c.label}</span>
                  <span className="tabular-nums font-medium">{c.score}</span>
                </div>
                <div className="mt-1.5"><Meter value={c.score} tone={c.score < 60 ? "warning" : "primary"} /></div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">{c.note}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
