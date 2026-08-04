import { createFileRoute } from "@tanstack/react-router";
import { UploadCloud } from "lucide-react";
import { documents } from "@/lib/company-data";
import { PageHeader, Panel, StatCard, Tag } from "@/components/os/primitives";

export const Route = createFileRoute("/app/knowledge")({
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader
        eyebrow="Knowledge Base"
        title="Everything you upload becomes company memory"
        subtitle="Documents are chunked, embedded and linked into the knowledge graph. Every AI answer cites the chunk it used."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <StatCard label="Documents" value="6" />
        <StatCard label="Chunks embedded" value="1,284" />
        <StatCard label="Entities extracted" value="34" />
        <StatCard label="Relationships" value="61" />
      </div>
      <Panel className="mb-4 border-dashed p-8 text-center">
        <UploadCloud className="mx-auto size-6 text-primary" />
        <p className="mt-3 text-sm font-medium">Drop a pitch deck, model, transcript or export</p>
        <p className="mt-1 text-xs text-muted-foreground">The Memory Agent indexes it and updates the knowledge graph within a minute.</p>
      </Panel>
      <Panel title="Indexed documents">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-widest text-muted-foreground">
              <tr>{["Name", "Type", "Size", "Chunks", "Added", "Status"].map((h) => (<th key={h} className="pb-2 pr-4 font-medium">{h}</th>))}</tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.name} className="border-t border-border">
                  <td className="py-2.5 pr-4">{d.name}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{d.type}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{d.size}</td>
                  <td className="py-2.5 pr-4 tabular-nums text-muted-foreground">{d.chunks}</td>
                  <td className="py-2.5 pr-4 text-muted-foreground">{d.added}</td>
                  <td className="py-2.5 pr-4"><Tag tone={d.status === "Indexed" ? "primary" : "warn"}>{d.status}</Tag></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
