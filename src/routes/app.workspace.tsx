import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { company, documents, memoryTimeline, roadmap } from "@/lib/company-data";
import { useOs } from "@/lib/os-store";
import { PageHeader, Panel, StatCard, Tag } from "@/components/os/primitives";

export const Route = createFileRoute("/app/workspace")({
  component: Page,
});

function Page() {
  const { overall, tasks } = useOs();
  return (
    <>
      <PageHeader
        eyebrow="Company Workspace"
        title={company.name}
        subtitle={`${company.tagline} · ${company.stage}`}
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <StatCard label="Startup score" value={String(overall)} delta={4} />
        <StatCard label="MRR" value="₹2.1L" delta={14} />
        <StatCard label="Runway" value="11.8 mo" delta={16} />
        <StatCard label="Open tasks" value={String(tasks.filter((t) => !t.done).length)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Company profile" hint="Built during onboarding, kept current by the Memory Agent">
          <dl className="space-y-2.5 text-sm">
            {[["Founded", company.founded], ["Location", company.location], ["Team", `${company.team} founders`], ["ICP", company.icp], ["Model", company.model], ["Website", company.website]].map(([k, v]) => (
              <div key={k} className="flex gap-4">
                <dt className="w-28 shrink-0 text-xs text-muted-foreground">{k}</dt>
                <dd className="text-[13px]">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel title="Recent memory" action={<Link to="/app/timeline" className="text-[12px] text-primary hover:underline">Timeline →</Link>}>
          <div className="space-y-3">
            {memoryTimeline.slice(0, 4).map((m) => (
              <div key={m.id} className="rounded-xl bg-surface-2 p-3">
                <div className="flex items-center gap-2"><Tag tone="primary">{m.type}</Tag><span className="text-[11px] text-muted-foreground">{m.date}</span></div>
                <div className="mt-1.5 text-[13px] font-medium">{m.title}</div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Current phase" action={<Link to="/app/roadmap" className="text-[12px] text-primary hover:underline">Roadmap →</Link>}>
          <div className="space-y-2">
            {roadmap[0]!.items.map((i) => (
              <div key={i.title} className="flex items-center gap-2 text-[13px]">
                <span className="size-1.5 rounded-full bg-primary" />{i.title}
                <Tag>{i.status}</Tag>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Knowledge" action={<Link to="/app/knowledge" className="text-[12px] text-primary hover:underline">Knowledge base →</Link>}>
          <div className="space-y-2 text-[13px]">
            {documents.slice(0, 4).map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <span className="truncate">{d.name}</span>
                <Tag tone={d.status === "Indexed" ? "primary" : "warn"}>{d.status}</Tag>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
