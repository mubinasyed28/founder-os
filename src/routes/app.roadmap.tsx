import { createFileRoute } from "@tanstack/react-router";
import { roadmap } from "@/lib/company-data";
import { PageHeader, Panel, Tag } from "@/components/os/primitives";

export const Route = createFileRoute("/app/roadmap")({
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader
        eyebrow="Roadmap"
        title="Sequenced by impact, not by enthusiasm"
        subtitle="The Planning Agent re-sequences this whenever a recommendation is accepted or a health dimension moves."
      />
      <div className="grid gap-4 lg:grid-cols-3">
        {roadmap.map((col) => (
          <Panel key={col.phase} title={col.phase} hint={`Stage · ${col.stage}`}>
            <div className="space-y-3">
              {col.items.map((i) => (
                <div key={i.title} className="rounded-xl bg-surface-2 p-3">
                  <div className="text-[13px] font-medium leading-snug">{i.title}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Tag tone={i.status === "In progress" ? "primary" : "muted"}>{i.status}</Tag>
                    <Tag>{i.owner}</Tag>
                    <span className="ml-auto text-[10px] text-muted-foreground">{i.impact}</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
