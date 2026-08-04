import { createFileRoute } from "@tanstack/react-router";
import { competitors } from "@/lib/company-data";
import { Meter, PageHeader, Panel, Tag } from "@/components/os/primitives";

export const Route = createFileRoute("/app/competitors")({
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader
        eyebrow="Competitor Intelligence"
        title="Six players, tracked daily"
        subtitle="The Browser Agent re-checks pricing pages, changelogs and hiring signals every night and updates threat scores automatically."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {competitors.map((c) => (
          <Panel key={c.name}>
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-semibold tracking-tight">{c.name}</h3>
              <Tag tone={c.threat > 65 ? "bad" : c.threat > 45 ? "warn" : "muted"}>Threat {c.threat}</Tag>
            </div>
            <div className="mt-2"><Meter value={c.threat} tone={c.threat > 65 ? "destructive" : "warning"} /></div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
              {[["Funding", c.funding], ["Users", c.users], ["Price", c.price]].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-surface-2 p-2">
                  <div className="text-muted-foreground">{k}</div>
                  <div className="mt-0.5 font-medium">{v}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs"><span className="text-primary">Strength · </span><span className="text-muted-foreground">{c.strength}</span></p>
            <p className="mt-1 text-xs"><span className="text-[var(--warning)]">Weakness · </span><span className="text-muted-foreground">{c.weakness}</span></p>
            <p className="mt-2 rounded-lg bg-surface-2 p-2 text-[11px] text-muted-foreground">Latest · {c.latest}</p>
          </Panel>
        ))}
      </div>
    </>
  );
}
