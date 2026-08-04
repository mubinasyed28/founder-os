import { createFileRoute } from "@tanstack/react-router";
import { Lightbulb } from "lucide-react";
import { opportunities } from "@/lib/company-data";
import { Confidence, PageHeader, Panel, Tag } from "@/components/os/primitives";

export const Route = createFileRoute("/app/opportunities")({
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader
        eyebrow="Gap Detection"
        title="Opportunities your competitors left open"
        subtitle="Continuously scanned across competitor changelogs, market data, churn interviews and pricing pages. Each carries a confidence score and the signal that triggered it."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {opportunities.map((o) => (
          <Panel key={o.id}>
            <div className="flex items-center gap-2">
              <Tag tone="primary">{o.type}</Tag>
              <Tag>{o.size} upside</Tag>
              <span className="ml-auto text-[11px] text-muted-foreground">{o.id}</span>
            </div>
            <h3 className="mt-3 flex gap-2 text-[15px] font-semibold leading-snug tracking-tight">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
              {o.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{o.detail}</p>
            <div className="mt-3 rounded-lg bg-surface-2 p-2.5 text-[11px] text-muted-foreground">
              Signal · {o.signal}
            </div>
            <div className="mt-3"><Confidence value={o.confidence} /></div>
          </Panel>
        ))}
      </div>
    </>
  );
}
