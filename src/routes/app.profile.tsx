import { createFileRoute } from "@tanstack/react-router";
import { company } from "@/lib/company-data";
import { PageHeader, Panel, Tag } from "@/components/os/primitives";

export const Route = createFileRoute("/app/profile")({
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader eyebrow="Profile" title="Meera Kapoor" subtitle={`Co-founder & CEO · ${company.name}`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Founder profile">
          <div className="space-y-2.5 text-[13px]">
            {[["Role", "CEO · GTM, fundraising"], ["Working style", "Prefers direct recommendations with the reasoning attached"], ["Focus this quarter", "Retention recovery, then pre-seed"], ["Streak", "26 days active"]].map(([k, v]) => (
              <div key={k} className="flex gap-4">
                <span className="w-32 shrink-0 text-xs text-muted-foreground">{k}</span>
                <span>{v}</span>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="How your co-founder adapts to you" hint="Learned from 118 interactions">
          <ul className="space-y-2.5 text-xs text-muted-foreground">
            <li>· You accept recommendations faster when alternatives are shown — they are now always included.</li>
            <li>· You act on financial items in the morning; nudges are scheduled before 10am.</li>
            <li>· You dismiss anything below 60% confidence, so low-confidence items are batched weekly instead.</li>
          </ul>
          <div className="mt-4 flex gap-1.5"><Tag tone="primary">Direct</Tag><Tag tone="primary">Evidence-first</Tag><Tag tone="primary">Morning founder</Tag></div>
        </Panel>
      </div>
    </>
  );
}
