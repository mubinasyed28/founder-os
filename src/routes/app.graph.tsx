import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { graphEdges, graphNodes } from "@/lib/company-data";
import { PageHeader, Panel, Tag } from "@/components/os/primitives";

export const Route = createFileRoute("/app/graph")({
  component: Page,
});

function Page() {
  const [active, setActive] = useState<string | null>("retention");
  const node = graphNodes.find((n) => n.id === active);
  const connected = graphEdges.filter((e) => e.includes(active ?? "")).flat().filter((id) => id !== active);
  return (
    <>
      <PageHeader
        eyebrow="Knowledge Graph"
        title="How everything in your company connects"
        subtitle="Click any node. Entities, decisions, metrics, people and competitors are linked so the AI can reason across them instead of guessing."
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Panel className="p-0">
          <div className="relative h-[520px] w-full grid-lines overflow-hidden rounded-xl">
            <svg className="absolute inset-0 size-full">
              {graphEdges.map(([a, b]) => {
                const na = graphNodes.find((n) => n.id === a)!;
                const nb = graphNodes.find((n) => n.id === b)!;
                const hot = active === a || active === b;
                return (
                  <line key={a + b} x1={`${na.x}%`} y1={`${na.y}%`} x2={`${nb.x}%`} y2={`${nb.y}%`}
                    stroke={hot ? "var(--primary)" : "var(--border)"} strokeWidth={hot ? 1.6 : 1} />
                );
              })}
            </svg>
            {graphNodes.map((n) => (
              <button key={n.id} onClick={() => setActive(n.id)}
                className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-2.5 py-1 text-[11px] transition-all"
                style={{
                  left: `${n.x}%`, top: `${n.y}%`,
                  background: active === n.id ? "var(--primary)" : "var(--surface-2)",
                  color: active === n.id ? "var(--primary-foreground)" : "var(--foreground)",
                  borderColor: active === n.id ? "var(--primary)" : "var(--border)",
                  fontSize: Math.max(10, n.size / 1.7),
                }}>
                {n.label}
              </button>
            ))}
          </div>
        </Panel>
        <Panel title="Node inspector">
          {node ? (
            <>
              <Tag tone="primary">{node.kind}</Tag>
              <h3 className="mt-2 text-sm font-semibold">{node.label}</h3>
              <p className="mt-2 text-xs text-muted-foreground">
                {connected.length} direct relationships. The AI traverses this subgraph before answering anything
                about {node.label.toLowerCase()}.
              </p>
              <div className="mt-3 space-y-1.5">
                {connected.map((c) => (
                  <button key={c} onClick={() => setActive(c)} className="block w-full rounded-lg bg-surface-2 px-2.5 py-1.5 text-left text-xs hover:text-primary">
                    ↔ {graphNodes.find((n) => n.id === c)?.label}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </Panel>
      </div>
    </>
  );
}
