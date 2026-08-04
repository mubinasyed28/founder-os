import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Search } from "lucide-react";
import { PageHeader, Panel, Tag, Confidence } from "@/components/os/primitives";

const findings = [
  { q: "Indian student willingness-to-pay for study tools", conf: 78, sources: 9, summary: "Clusters at ₹650–₹850/mo for tier-1 students, drops to ₹250–₹400 in tier-2. Seasonality is severe: WTP falls ~40% outside exam windows.", cites: ["Redseer edtech report 2026", "Van Westendorp n=214", "3 competitor pricing pages"] },
  { q: "Is exam-cycle re-planning served by any incumbent?", conf: 88, sources: 6, summary: "No tracked competitor adapts a plan after a missed week. All six treat the plan as static after generation.", cites: ["StudyOS changelog", "Notely docs", "Cramly onboarding teardown"] },
  { q: "Tier-2 regional-language demand", conf: 66, sources: 7, summary: "4.1M STEM students outside tier-1 cities; zero tracked competitors ship Hindi or Tamil interfaces. Estimated CAC 62% lower.", cites: ["AISHE 2025", "Google Trends", "2 founder interviews"] },
];

export const Route = createFileRoute("/app/research")({
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader
        eyebrow="Research Center"
        title="Every claim traced to a source"
        subtitle="The Research and Browser agents run continuous market queries, filter for credibility, and write results straight into company memory."
        actions={<span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] text-muted-foreground"><Search className="size-3.5" /> 3 queries running</span>}
      />
      <div className="space-y-4">
        {findings.map((f) => (
          <Panel key={f.q}>
            <div className="flex flex-wrap items-center gap-2">
              <Tag tone="primary">Verified</Tag>
              <Tag>{f.sources} sources</Tag>
              <div className="ml-auto"><Confidence value={f.conf} /></div>
            </div>
            <h3 className="mt-3 text-[15px] font-semibold tracking-tight">{f.q}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {f.cites.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground">
                  <ExternalLink className="size-3" />{c}
                </span>
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
