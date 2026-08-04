import { createFileRoute } from "@tanstack/react-router";
import { agents } from "@/lib/company-data";
import { useOs } from "@/lib/os-store";
import { Meter, PageHeader, Panel, Tag } from "@/components/os/primitives";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/agents")({
  component: Page,
});

function Page() {
  const { activity } = useOs();
  return (
    <>
      <PageHeader
        eyebrow="Multi-Agent System"
        title="Ten specialists, one company"
        subtitle="Work is delegated, not funnelled through a single prompt. Each agent has its own tools, memory scope and measured accuracy."
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="grid gap-3 sm:grid-cols-2">
          {agents.map((a) => (
            <Panel key={a.id} className="p-4">
              <div className="flex items-center gap-2">
                <span className={cn("size-1.5 rounded-full", a.status === "working" ? "live-dot bg-primary" : a.status === "queued" ? "bg-[var(--warning)]" : "bg-muted-foreground")} />
                <h3 className="text-sm font-semibold tracking-tight">{a.name}</h3>
                <Tag tone={a.status === "working" ? "primary" : "muted"}>{a.status}</Tag>
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">{a.role}</p>
              <p className="mt-2 text-xs leading-relaxed">{a.task}</p>
              <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{a.runs} runs · {a.model}</span>
                <span className="tabular-nums">{a.accuracy}% accurate</span>
              </div>
              <div className="mt-1.5"><Meter value={a.accuracy} /></div>
            </Panel>
          ))}
        </div>
        <Panel title="Live activity stream">
          <div className="space-y-3">
            {activity.map((a) => (
              <div key={a.id} className="flex gap-2 text-xs">
                <span className="live-dot mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                <div><span className="font-medium">{a.agent}</span> <span className="text-muted-foreground">{a.text}</span></div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
