import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { kpiSeries } from "@/lib/company-data";
import { PageHeader, Panel, StatCard } from "@/components/os/primitives";

const forecast = Array.from({ length: 12 }).map((_, i) => ({
  month: `M${i + 1}`,
  base: Math.round(210 * Math.pow(1.09, i)),
  bull: Math.round(210 * Math.pow(1.14, i)),
  bear: Math.round(210 * Math.pow(1.04, i)),
}));

export const Route = createFileRoute("/app/forecast")({
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader
        eyebrow="Financial Forecasting"
        title="Three futures, one model"
        subtitle="Base, bull and bear cases derived from your actuals — not a spreadsheet template. The Forecasting Agent re-runs this whenever an assumption changes."
      />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="MRR today" value="₹2.1L" delta={14} />
        <StatCard label="Base case M12" value={`₹${forecast[11]!.base}K`} />
        <StatCard label="Gross margin" value="63%" delta={4} />
        <StatCard label="CAC payback" value="3.1 mo" delta={-8} />
      </div>
      <Panel title="MRR scenarios" hint="₹thousands">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={forecast} margin={{ left: -20, right: 6, top: 6 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis tickLine={false} axisLine={false} stroke="var(--muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line dataKey="bull" name="Bull" stroke="var(--chart-2)" strokeWidth={2} dot={false} />
              <Line dataKey="base" name="Base" stroke="var(--primary)" strokeWidth={2.5} dot={false} />
              <Line dataKey="bear" name="Bear" stroke="var(--chart-5)" strokeWidth={2} strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel title="Historic burn vs revenue" className="mt-4">
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={kpiSeries} margin={{ left: -20, right: 6, top: 6 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis tickLine={false} axisLine={false} stroke="var(--muted-foreground)" fontSize={11} />
              <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="burn" name="Burn (₹K)" fill="var(--chart-3)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="mrr" name="MRR (₹K)" fill="var(--primary)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </>
  );
}
