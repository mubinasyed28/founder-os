
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { company, documents, memoryTimeline, roadmap } from "@/lib/company-data";
import { useOs } from "@/lib/os-store";
import { PageHeader, Panel, StatCard, Tag } from "@/components/os/primitives";
import { Edit3, Check, X } from "lucide-react";

export const Route = createFileRoute("/app/workspace")({
  component: Page,
});

function Page() {
  const { overall, tasks, profile, updateProfile } = useOs();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    company_name: "",
    one_line_pitch: "",
    current_stage: "",
    location: "",
    team_size: "",
    target_customer: "",
    business_model: "",
    website: "",
  });

  const companyName = profile["company_name"] || company.name;
  const companyTagline = profile["one_line_pitch"] || profile["startup_description"] || company.tagline;
  const companyStage = profile["current_stage"] || company.stage;

  const handleEditClick = () => {
    setEditForm({
      company_name: profile["company_name"] || company.name,
      one_line_pitch: profile["one_line_pitch"] || profile["startup_description"] || company.tagline,
      current_stage: profile["current_stage"] || company.stage,
      location: profile["location"] || company.location,
      team_size: profile["team_size"] || String(company.team),
      target_customer: profile["target_customer"] || profile["target_customers"] || company.icp,
      business_model: profile["business_model"] || company.model,
      website: profile["website"] || company.website,
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    await updateProfile(editForm);
    setIsEditing(false);
  };

  const profileRows = [
    ["Location", profile["location"] || company.location, "location"],
    ["Team Size", profile["team_size"] || `${company.team} founders`, "team_size"],
    ["Target Customer (ICP)", profile["target_customer"] || profile["target_customers"] || company.icp, "target_customer"],
    ["Business Model", profile["business_model"] || company.model, "business_model"],
    ["Website", profile["website"] || company.website, "website"],
  ];

  return (
    <>
      <PageHeader
        eyebrow="Company Workspace"
        title={companyName}
        subtitle={`${companyTagline} · ${companyStage}`}
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <StatCard label="Startup score" value={String(overall)} delta={4} />
        <StatCard label="MRR" value="₹2.1L" delta={14} />
        <StatCard label="Runway" value="11.8 mo" delta={16} />
        <StatCard label="Open tasks" value={String(tasks.filter((t) => !t.done).length)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel 
          title="Company profile" 
          hint="Built during onboarding, kept current by the Memory Agent"
          action={
            !isEditing ? (
              <button 
                onClick={handleEditClick}
                className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
              >
                <Edit3 className="size-3" /> Edit Profile
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleSave}
                  className="flex items-center gap-0.5 text-[11px] font-semibold text-emerald-500 hover:underline"
                >
                  <Check className="size-3" /> Save
                </button>
                <button 
                  onClick={() => setIsEditing(false)}
                  className="flex items-center gap-0.5 text-[11px] font-semibold text-red-500 hover:underline"
                >
                  <X className="size-3" /> Cancel
                </button>
              </div>
            )
          }
        >
          {isEditing ? (
            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-muted-foreground font-medium mb-0.5">Company Name</label>
                  <input
                    value={editForm.company_name}
                    onChange={(e) => setEditForm({ ...editForm, company_name: e.target.value })}
                    className="w-full rounded border border-border bg-surface-2 px-2 py-1 text-xs outline-none focus:border-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground font-medium mb-0.5">Current Stage</label>
                  <input
                    value={editForm.current_stage}
                    onChange={(e) => setEditForm({ ...editForm, current_stage: e.target.value })}
                    className="w-full rounded border border-border bg-surface-2 px-2 py-1 text-xs outline-none focus:border-primary/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-muted-foreground font-medium mb-0.5">Tagline / Pitch</label>
                <input
                  value={editForm.one_line_pitch}
                  onChange={(e) => setEditForm({ ...editForm, one_line_pitch: e.target.value })}
                  className="w-full rounded border border-border bg-surface-2 px-2 py-1 text-xs outline-none focus:border-primary/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-muted-foreground font-medium mb-0.5">Location</label>
                  <input
                    value={editForm.location}
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    className="w-full rounded border border-border bg-surface-2 px-2 py-1 text-xs outline-none focus:border-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground font-medium mb-0.5">Team Size</label>
                  <input
                    value={editForm.team_size}
                    onChange={(e) => setEditForm({ ...editForm, team_size: e.target.value })}
                    className="w-full rounded border border-border bg-surface-2 px-2 py-1 text-xs outline-none focus:border-primary/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-muted-foreground font-medium mb-0.5">Target Customer (ICP)</label>
                <input
                  value={editForm.target_customer}
                  onChange={(e) => setEditForm({ ...editForm, target_customer: e.target.value })}
                  className="w-full rounded border border-border bg-surface-2 px-2 py-1 text-xs outline-none focus:border-primary/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-muted-foreground font-medium mb-0.5">Business Model</label>
                  <input
                    value={editForm.business_model}
                    onChange={(e) => setEditForm({ ...editForm, business_model: e.target.value })}
                    className="w-full rounded border border-border bg-surface-2 px-2 py-1 text-xs outline-none focus:border-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground font-medium mb-0.5">Website</label>
                  <input
                    value={editForm.website}
                    onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                    className="w-full rounded border border-border bg-surface-2 px-2 py-1 text-xs outline-none focus:border-primary/50"
                  />
                </div>
              </div>
            </div>
          ) : (
            <dl className="space-y-2.5 text-sm">
              {profileRows.map(([k, v]) => (
                <div key={k} className="flex gap-4">
                  <dt className="w-28 shrink-0 text-xs text-muted-foreground">{k}</dt>
                  <dd className="text-[13px]">{v || "N/A"}</dd>
                </div>
              ))}
            </dl>
          )}
        </Panel>
        <Panel title="Recent memory" action={<Link to="/app/timeline" className="text-[12px] text-primary hover:underline">Timeline →</Link>}>
          <div className="space-y-3">
            {memoryTimeline.slice(0, 4).map((m) => (
              <div key={m.id} className="rounded-xl bg-surface-2 p-3">
                <div className="flex items-center gap-2"><Tag tone="primary">{m.type}</Tag><span className="text-[11px] text-muted-foreground">{m.date}</span></div>
                <div className="mt-1.5 text-[13px] font-medium">{m.title}</div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Current phase" action={<Link to="/app/roadmap" className="text-[12px] text-primary hover:underline">Roadmap →</Link>}>
          <div className="space-y-2">
            {roadmap[0]!.items.map((i) => (
              <div key={i.title} className="flex items-center gap-2 text-[13px]">
                <span className="size-1.5 rounded-full bg-primary" />{i.title}
                <Tag>{i.status}</Tag>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Knowledge" action={<Link to="/app/knowledge" className="text-[12px] text-primary hover:underline">Knowledge base →</Link>}>
          <div className="space-y-2 text-[13px]">
            {documents.slice(0, 4).map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <span className="truncate">{d.name}</span>
                <Tag tone={d.status === "Indexed" ? "primary" : "warn"}>{d.status}</Tag>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
