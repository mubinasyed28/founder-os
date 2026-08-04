import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { kpiSeries } from "@/lib/company-data";
import { PageHeader, Panel, StatCard } from "@/components/os/primitives";

export const Route = createFileRoute("/app/metrics")({
  component: Page,
});

function Page() {
  return (
    <>
      <PageHeader
        eyebrow="Metrics"
        title="The numbers behind every score"
        subtitle="Seven months of actuals. These feed the health score, the forecast and every recommendation you see."
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <StatCard label="Users" value="3,860" delta={27} />
        <StatCard label="MRR" value="₹2.1L" delta={14} />
        <StatCard label="D30 retention" value="24.8%" delta={-3} />
        <StatCard label="Burn" value="₹3.4L" delta={-9} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Users">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={kpiSeries} margin={{ left: -20, right: 6, top: 6 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis tickLine={false} axisLine={false} stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip cursor={{ fill: "var(--muted)" }} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="users" name="Users" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Retention (D30 %)">
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={kpiSeries} margin={{ left: -20, right: 6, top: 6 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis domain={[20, 34]} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
                <Line dataKey="retention" name="D30 %" stroke="var(--chart-5)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </>
  );
}
