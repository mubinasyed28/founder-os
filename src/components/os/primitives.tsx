import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="rise-in mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? (
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-primary">{eyebrow}</div>
        ) : null}
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  className,
  children,
  title,
  hint,
  action,
}: {
  className?: string;
  children: ReactNode;
  title?: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <section className={cn("panel rise-in p-5", className)}>
      {title ? (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
            {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Delta({ value, suffix = "" }: { value: number; suffix?: string }) {
  const up = value > 0;
  const flat = value === 0;
  const Icon = flat ? ArrowRight : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium",
        flat && "bg-muted text-muted-foreground",
        up && "bg-primary/12 text-primary",
        !up && !flat && "bg-destructive/12 text-destructive",
      )}
    >
      <Icon className="size-3" />
      {up ? "+" : ""}
      {value}
      {suffix}
    </span>
  );
}

export function ScoreRing({
  value,
  size = 132,
  label,
  sub,
}: {
  value: number;
  size?: number;
  label?: string;
  sub?: string;
}) {
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth={8} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * value) / 100}
          style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.16,1,.3,1)" }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
        {label ? <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{label}</div> : null}
        {sub ? <div className="mt-0.5 text-[11px] text-primary">{sub}</div> : null}
      </div>
    </div>
  );
}

export function Meter({ value, tone = "primary" }: { value: number; tone?: "primary" | "warning" | "destructive" }) {
  const color = tone === "primary" ? "var(--primary)" : tone === "warning" ? "var(--warning)" : "var(--destructive)";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full transition-[width] duration-700"
        style={{ width: `${value}%`, background: color }}
      />
    </div>
  );
}

export function Confidence({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className={cn("h-3 w-1 rounded-full", i * 10 < value ? "bg-primary" : "bg-muted")}
          />
        ))}
      </div>
      <span className="text-xs font-medium tabular-nums text-muted-foreground">{value}% confidence</span>
    </div>
  );
}

export function Tag({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "primary" | "warn" | "bad" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        tone === "muted" && "bg-muted text-muted-foreground",
        tone === "primary" && "bg-primary/12 text-primary",
        tone === "warn" && "bg-[color-mix(in_oklab,var(--warning)_16%,transparent)] text-[var(--warning)]",
        tone === "bad" && "bg-destructive/12 text-destructive",
      )}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: string;
  delta?: number;
  hint?: string;
}) {
  return (
    <div className="panel rise-in p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        {delta !== undefined ? <Delta value={delta} suffix="%" /> : null}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div> : null}
    </div>
  );
}
