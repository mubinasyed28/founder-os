import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Confidence, PageHeader, Panel, StatCard } from "@/components/os/primitives";

const SCENARIOS = [
  { id: "hire", label: "Hire an engineer" },
  { id: "price", label: "Increase pricing" },
  { id: "raise", label: "Raise funding" },
  { id: "burn", label: "Reduce burn" },
  { id: "feature", label: "Launch feature" },
  { id: "country", label: "Expand country" },
  { id: "marketing", label: "Increase marketing" },
];

export const Route = createFileRoute("/app/simulator")({
  component: Page,
});

function Page() {
  const [scenario, setScenario] = useState("price");
  const [price, setPrice] = useState(699);
  const [hires, setHires] = useState(1);
  const [marketing, setMarketing] = useState(40);
  const [raise, setRaise] = useState(0);

  const priceLift = (price - 499) / 499;
  const churnPenalty = Math.max(0, priceLift) * 0.28;
  const mrrMultiplier = 1 + priceLift - churnPenalty + marketing / 400;
  const burn = 340 + hires * 95 + marketing * 1.4;
  const cash = 4000 + raise * 100;

  const series = Array.from({ length: 12 }).map((_, i) => {
    const mrr = 210 * Math.pow(1 + 0.11 * mrrMultiplier, i);
    return {
      month: `M${i + 1}`,
      mrr: Math.round(mrr),
      burn: Math.round(burn),
      cash: Math.max(0, Math.round(cash - (burn - mrr * 0.63) * (i + 1))),
    };
  });

  const runway = (() => {
    const net = burn - 210 * 0.63;
    return net <= 0 ? 36 : Math.min(36, cash / net);
  })();

  const growth = Math.round(11 * mrrMultiplier * 10) / 10;
  const retention = Math.round((24.8 - Math.max(0, priceLift) * 4 + (hires > 0 ? 0.8 * hires : 0)) * 10) / 10;
  const risk = Math.min(95, Math.round(28 + Math.max(0, priceLift) * 60 + hires * 8 - (raise > 0 ? 15 : 0)));
  const confidence = Math.max(45, 88 - Math.round(Math.max(0, priceLift) * 40) - hires * 3);

  return (
    <>
      <PageHeader
        eyebrow="Decision Simulator"
        title="What if?"
        subtitle="Change an assumption and watch revenue, runway, growth, retention and risk respond instantly. Nothing is committed until you accept it."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {SCENARIOS.map((s) => (
          <button key={s.id} onClick={() => setScenario(s.id)}
            className={"rounded-full border px-3.5 py-1.5 text-[13px] transition-colors " + (scenario === s.id ? "border-primary bg-primary/12 text-primary" : "border-border bg-surface-2 text-muted-foreground hover:text-foreground")}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Panel title="Assumptions" hint="Everything here is editable">
          <div className="space-y-5">
            <Slider label="Pro price (₹/mo)" value={price} min={299} max={1299} step={50} onChange={setPrice} />
            <Slider label="New engineering hires" value={hires} min={0} max={5} step={1} onChange={setHires} />
            <Slider label="Marketing spend (₹K/mo)" value={marketing} min={0} max={200} step={10} onChange={setMarketing} />
            <Slider label="Raise amount (₹L)" value={raise} min={0} max={300} step={25} onChange={setRaise} />
          </div>
          <div className="mt-5"><Confidence value={confidence} /></div>
        </Panel>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatCard label="MRR @ M12" value={`₹${series[11]!.mrr}K`} />
            <StatCard label="Runway" value={`${runway.toFixed(1)} mo`} />
            <StatCard label="Growth w/w" value={`${growth}%`} />
            <StatCard label="D30 retention" value={`${retention}%`} />
            <StatCard label="Monthly burn" value={`₹${Math.round(burn)}K`} />
            <StatCard label="Risk index" value={`${risk}`} />
          </div>
          <Panel title="Projected trajectory" hint="12 months under the current assumptions">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ left: -20, right: 6, top: 6 }}>
                  <defs>
                    <linearGradient id="simFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis tickLine={false} axisLine={false} stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }} />
                  <Area dataKey="mrr" name="MRR (₹K)" stroke="var(--primary)" strokeWidth={2} fill="url(#simFill)" />
                  <Area dataKey="cash" name="Cash (₹K)" stroke="var(--chart-2)" strokeWidth={2} fill="transparent" />
                  <Area dataKey="burn" name="Burn (₹K)" stroke="var(--chart-3)" strokeWidth={2} fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-muted-foreground">
              <span className="font-medium text-primary">Co-founder read · </span>
              At ₹{price} with {hires} hire{hires === 1 ? "" : "s"}, you reach ₹{series[11]!.mrr}K MRR in 12 months with
              {" "}{runway.toFixed(1)} months of runway. Risk index {risk}: {risk > 60 ? "aggressive — I would stage this in two steps." : "acceptable given current cash."}
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Slider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums font-medium">{value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[var(--primary)]" />
    </div>
  );
}
