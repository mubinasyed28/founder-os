import { createFileRoute } from "@tanstack/react-router";
import { pipeline } from "@/lib/company-data";
import { PageHeader, Panel } from "@/components/os/primitives";

export const Route = createFileRoute("/app/reasoning")({
  component: Page,
});

function Page() {
  const total = pipeline.reduce((a, p) => a + p.ms, 0);
  return (
    <>
      <PageHeader
        eyebrow="AI Reasoning Pipeline"
        title="You can see exactly how it thinks"
        subtitle={`Trace of the most recent decision (R-238, pricing). End-to-end ${(total / 1000).toFixed(1)}s across 10 stages, with the Critic Agent lowering confidence by 9 points.`}
      />
      <Panel>
        <ol className="relative space-y-0">
          {pipeline.map((p, i) => (
            <li key={p.step} className="relative flex gap-4 pb-6 last:pb-0">
              <div className="flex flex-col items-center">
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 text-[11px] font-medium text-primary">
                  {i + 1}
                </span>
                {i < pipeline.length - 1 ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
              </div>
              <div className="flex-1 pb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{p.step}</span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">{p.ms}ms</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{p.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </Panel>
    </>
  );
}
