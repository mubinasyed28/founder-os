import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, Panel, Tag } from "@/components/os/primitives";

export const Route = createFileRoute("/app/settings")({
  component: Page,
});

function Page() {
  const rows = [
    ["Autonomy level", "Recommend, then ask — no action taken without approval"],
    ["Proactive nudges", "On · max 3 per day, before 10am"],
    ["Confidence floor", "60% — lower-confidence items are batched weekly"],
    ["Memory retention", "Indefinite · exportable, deletable per document"],
    ["Model routing", "Cost-optimised free tier with self-hosted fallback"],
    ["Data residency", "India · DPDP-aligned handling for student data"],
  ];
  return (
    <>
      <PageHeader eyebrow="Settings" title="How much of the company do you delegate?" subtitle="Your co-founder can advise, draft or act. You decide where the line sits." />
      <Panel>
        <div className="divide-y divide-border">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center gap-4 py-3.5">
              <div className="w-48 shrink-0 text-[13px] font-medium">{k}</div>
              <div className="text-xs text-muted-foreground">{v}</div>
              <span className="ml-auto"><Tag tone="primary">Configured</Tag></span>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
