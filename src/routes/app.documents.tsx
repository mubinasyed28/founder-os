import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileText, Loader2, Sparkles } from "lucide-react";
import { docTemplates } from "@/lib/company-data";
import { useOs } from "@/lib/os-store";
import { PageHeader, Panel } from "@/components/os/primitives";

export const Route = createFileRoute("/app/documents")({
  component: Page,
});

function Page() {
  const { pushActivity } = useOs();
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  function generate(name: string) {
    setBusy(name);
    setDone(null);
    pushActivity("Writing Agent", `drafting "${name}" from company memory`);
    setTimeout(() => { setBusy(null); setDone(name); }, 1600);
  }

  return (
    <>
      <PageHeader
        eyebrow="Document Generator"
        title="Drafts written from your company, not from a template"
        subtitle="Every document is grounded in indexed memory: real metrics, real interviews, real decisions — with citations attached."
      />
      <div className="grid gap-3 md:grid-cols-3">
        {docTemplates.map((t) => (
          <Panel key={t.name} className="p-4">
            <FileText className="size-4 text-primary" />
            <h3 className="mt-3 text-sm font-semibold tracking-tight">{t.name}</h3>
            <p className="mt-1.5 text-xs text-muted-foreground">{t.desc}</p>
            <button onClick={() => generate(t.name)} disabled={busy === t.name}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground disabled:opacity-70">
              {busy === t.name ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
              {busy === t.name ? "Writing…" : `Generate · ~${t.time}`}
            </button>
          </Panel>
        ))}
      </div>
      {done ? (
        <Panel title={`${done} · draft v1`} hint="Grounded in 14 memory chunks · 6 citations" className="mt-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Lumen Labs closed July at ₹2.1L MRR, up 14% month-on-month, with 3,860 registered students and 78% of new
            signups arriving organically through the campus ambassador loop. Net burn fell 9% to ₹3.4L after we moved
            inference to a cheaper model tier, extending runway to 11.8 months. The open issue this month is D30
            retention, which fell 3.1 points in the cohort that entered after our June 14 onboarding change; a rollback
            test ships this week and we expect to recover 2.4 points by the end of Q3…
          </p>
        </Panel>
      ) : null}
    </>
  );
}
