import { createFileRoute } from "@tanstack/react-router";
import { deckSlides } from "@/lib/company-data";
import { PageHeader, Panel, Tag } from "@/components/os/primitives";

export const Route = createFileRoute("/app/deck")({
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader
        eyebrow="Pitch Deck Builder"
        title="Ten slides, assembled from memory"
        subtitle="Content is pulled from your metrics, research and decisions. The Critic Agent flags any slide that a partner will challenge."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {deckSlides.map((s, i) => (
          <Panel key={s.title} className="p-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] tabular-nums text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="text-sm font-semibold tracking-tight">{s.title}</h3>
              <span className="ml-auto"><Tag tone={s.status === "Ready" ? "primary" : s.status === "Draft" ? "muted" : "warn"}>{s.status}</Tag></span>
            </div>
            <div className="mt-3 aspect-video rounded-lg border border-border bg-surface-2 p-3 text-[11px] leading-relaxed text-muted-foreground">
              {s.note}
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}
