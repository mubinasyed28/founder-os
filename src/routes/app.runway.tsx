import { createFileRoute } from "@tanstack/react-router";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { kpiSeries } from "@/lib/company-data";
import { PageHeader, Panel, StatCard, Meter } from "@/components/os/primitives";

export const Route = createFileRoute("/app/runway")({
  component: Page,
});

function Page() {
  const costs = [
    { label: "Inference & infra", value: 96, pct: 28 },
    { label: "Founder stipends", value: 150, pct: 44 },
    { label: "Marketing", value: 54, pct: 16 },
    { label: "Tools & compliance", value: 40, pct: 12 },
  ];
  return (
    <>
      <PageHeader
        eyebrow="Runway"
        title="11.8 months, and improving"
        subtitle="Burn fell 9% after moving inference to a cheaper tier. At the current trajectory you hit the 6-month danger line in February 2027."
      />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Cash in bank" value="₹40.1L" />
        <StatCard label="Net burn" value="₹3.4L/mo" delta={-9} />
        <StatCard label="Runway" value="11.8 mo" delta={16} />
        <StatCard label="Default alive?" value="Not yet" hint="at 63% gross margin" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Panel title="Runway trend">
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={kpiSeries} margin={{ left: -20, right: 6, top: 6 }}>
                <defs>
                  <linearGradient id="rw" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis tickLine={false} axisLine={false} stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
                <Area dataKey="runway" name="Runway (months)" stroke="var(--chart-2)" strokeWidth={2} fill="url(#rw)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Where the money goes" hint="₹K per month">
          <div className="space-y-4">
            {costs.map((c) => (
              <div key={c.label}>
                <div className="flex justify-between text-xs"><span>{c.label}</span><span className="tabular-nums text-muted-foreground">₹{c.value}K</span></div>
                <div className="mt-1.5"><Meter value={c.pct * 2} /></div>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-xl bg-surface-2 p-3 text-[11px] leading-relaxed text-muted-foreground">
            Inference is now your second-largest controllable cost. A further 20% cut is available by caching
            repeated retrieval calls — the Financial Agent estimates +0.4 months of runway.
          </p>
        </Panel>
      </div>
    </>
  );
}
