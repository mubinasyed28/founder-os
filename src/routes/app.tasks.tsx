import { createFileRoute } from "@tanstack/react-router";
import { useOs } from "@/lib/os-store";
import { PageHeader, Panel, Tag } from "@/components/os/primitives";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/tasks")({
  component: Page,
});

function Page() {
  const { tasks, toggleTask } = useOs();
  return (
    <>
      <PageHeader
        eyebrow="Tasks"
        title="Every task traces back to a decision"
        subtitle="Nothing here was invented. Each item was created by the Execution Agent when you accepted a recommendation or opportunity."
      />
      <Panel>
        <div className="space-y-1">
          {tasks.map((t) => (
            <button key={t.id} onClick={() => toggleTask(t.id)}
              className="flex w-full flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-lg px-2.5 py-2.5 text-left hover:bg-accent/50 transition-colors">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className={cn("grid size-4 shrink-0 place-items-center rounded border text-[10px]", t.done ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                  {t.done ? "✓" : ""}
                </span>
                <span className={cn("text-[13px] leading-snug", t.done && "text-muted-foreground line-through")}>{t.title}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2 pl-7 sm:pl-0 sm:ml-auto">
                <Tag tone={t.priority === "P0" ? "bad" : t.priority === "P1" ? "warn" : "muted"}>{t.priority}</Tag>
                <span className="text-[11px] text-muted-foreground">from {t.from}</span>
                <span className="text-[11px] text-muted-foreground">{t.due}</span>
              </div>
            </button>
          ))}
        </div>
      </Panel>
    </>
  );
}
