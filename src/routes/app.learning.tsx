import { createFileRoute } from "@tanstack/react-router";
import { learningLog } from "@/lib/company-data";
import { Delta, PageHeader, Panel, StatCard } from "@/components/os/primitives";

export const Route = createFileRoute("/app/learning")({
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader
        eyebrow="Continuous Learning"
        title="It grades its own predictions"
        subtitle="Every forecast is compared to what actually happened, and the model priors are adjusted. This is why month six is better advice than month one."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <StatCard label="Predictions scored" value="87" hint="since Jan 2026" />
        <StatCard label="Directional accuracy" value="78%" delta={6} hint="+6pts in 90 days" />
        <StatCard label="Mean absolute error" value="11.4%" hint="down from 19.2%" />
        <StatCard label="Priors updated" value="23" hint="4 this month" />
      </div>
      <div className="space-y-4">
        {learningLog.map((l) => (
          <Panel key={l.id}>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{l.date}</span><span>·</span><span>{l.id}</span>
              <span className="ml-auto"><Delta value={l.confidenceShift} /></span>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-surface-2 p-3">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Predicted</div>
                <div className="mt-1 text-xs">{l.prediction}</div>
              </div>
              <div className="rounded-xl bg-surface-2 p-3">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Actual</div>
                <div className="mt-1 text-xs">{l.actual}</div>
              </div>
              <div className="rounded-xl bg-surface-2 p-3">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">Difference</div>
                <div className="mt-1 text-xs">{l.delta}</div>
              </div>
            </div>
            <p className="mt-3 rounded-xl border border-primary/25 bg-primary/5 p-3 text-xs leading-relaxed">
              <span className="font-medium text-primary">Model improvement · </span>{l.lesson}
            </p>
          </Panel>
        ))}
      </div>
    </>
  );
}
