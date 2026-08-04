import { createFileRoute } from "@tanstack/react-router";
import { memoryTimeline } from "@/lib/company-data";
import { PageHeader, Panel, Tag } from "@/components/os/primitives";

export const Route = createFileRoute("/app/timeline")({
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader
        eyebrow="Memory Timeline"
        title="Your company's institutional memory"
        subtitle="Decisions, documents, meetings, milestones and metric shifts — permanently linked, permanently retrievable."
      />
      <Panel>
        <ol>
          {memoryTimeline.map((m, i) => (
            <li key={m.id} className="relative flex gap-4 pb-7 last:pb-0">
              <div className="flex flex-col items-center">
                <span className="mt-1 size-2.5 shrink-0 rounded-full bg-primary" />
                {i < memoryTimeline.length - 1 ? <span className="mt-1 w-px flex-1 bg-border" /> : null}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Tag tone="primary">{m.type}</Tag>
                  <span className="text-[11px] text-muted-foreground">{m.date} · {m.id}</span>
                </div>
                <h3 className="mt-1.5 text-sm font-semibold tracking-tight">{m.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{m.detail}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.links.map((l) => (<span key={l} className="rounded-md border border-border px-2 py-0.5 text-[10px] text-muted-foreground">↔ {l}</span>))}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Panel>
    </>
  );
}
