import { useState } from "react";
import { Check, ChevronDown, Shield, Sparkles, Target, TrendingUp } from "lucide-react";
import type { Recommendation } from "@/lib/company-data";
import { agents } from "@/lib/company-data";
import { useOs } from "@/lib/os-store";
import { cn } from "@/lib/utils";
import { Confidence, Tag } from "./primitives";

export function RecommendationCard({ rec, defaultOpen = false }: { rec: Recommendation; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const { acceptRec, acceptedRecs } = useOs();
  const accepted = acceptedRecs.includes(rec.id);

  return (
    <article className="panel rise-in overflow-hidden p-0">
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone="primary">{rec.category}</Tag>
          <Tag>{rec.stage}</Tag>
          <span className="text-[11px] text-muted-foreground">{rec.id}</span>
          <div className="ml-auto">
            <Confidence value={rec.confidence} />
          </div>
        </div>
        <h3 className="mt-3 text-[17px] font-semibold leading-snug tracking-tight">{rec.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{rec.reasoning}</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <MiniStat icon={TrendingUp} label="Potential impact" value={rec.impact} />
          <MiniStat icon={Target} label="Expected ROI" value={rec.roi} />
          <MiniStat icon={Shield} label="Risk" value={rec.risk} tone="warn" />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-[13px] hover:border-primary/40"
          >
            <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
            {open ? "Hide reasoning" : "Show evidence & alternatives"}
          </button>
          <button
            disabled={accepted}
            onClick={() => acceptRec(rec.id, rec.nextAction.replace(/^Create task: /, ""))}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors",
              accepted
                ? "bg-primary/15 text-primary"
                : "bg-primary text-primary-foreground hover:opacity-90",
            )}
          >
            {accepted ? <Check className="size-3.5" /> : <Sparkles className="size-3.5" />}
            {accepted ? "Accepted · task created" : rec.nextAction}
          </button>
          <div className="ml-auto flex items-center gap-1">
            {rec.agents.map((a) => (
              <span
                key={a}
                title={agents.find((x) => x.id === a)?.name}
                className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                {agents.find((x) => x.id === a)?.name.replace(" Agent", "")}
              </span>
            ))}
          </div>
        </div>
      </div>

      {open ? (
        <div className="grid gap-5 border-t border-border bg-surface-2/40 p-5 md:grid-cols-2">
          <div>
            <h4 className="text-[11px] uppercase tracking-widest text-muted-foreground">Evidence</h4>
            <ul className="mt-3 space-y-2.5">
              {rec.evidence.map((e) => (
                <li key={e.source} className="rounded-lg border border-border bg-surface p-3 text-xs">
                  <div className="font-medium">{e.source}</div>
                  <div className="mt-1 text-muted-foreground">{e.note}</div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-[11px] uppercase tracking-widest text-muted-foreground">Alternatives considered</h4>
            <ul className="mt-3 space-y-2.5">
              {rec.alternatives.map((a) => (
                <li key={a.label} className="rounded-lg border border-border bg-surface p-3 text-xs">
                  <div className="font-medium">{a.label}</div>
                  <div className="mt-1 text-muted-foreground">{a.note}</div>
                </li>
              ))}
            </ul>
            <div className="mt-3 rounded-lg border border-primary/25 bg-primary/5 p-3 text-xs">
              <span className="font-medium text-primary">Next action · </span>
              {rec.nextAction}
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  tone?: "warn";
}) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">
        <Icon className={cn("size-3", tone === "warn" ? "text-[var(--warning)]" : "text-primary")} />
        {label}
      </div>
      <div className="mt-1.5 text-xs leading-relaxed">{value}</div>
    </div>
  );
}
