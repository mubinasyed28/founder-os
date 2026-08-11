import { createFileRoute, Link } from "@tanstack/react-router";
import { company } from "@/lib/company-data";
import { PageHeader, Panel, Tag } from "@/components/os/primitives";
import { useAuth } from "@/lib/auth-context";
import { useOs } from "@/lib/os-store";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileText, Loader2, Trash2, UploadCloud, Search,
  Calendar, Edit3, Check, X, ArrowUpCircle, BookOpen,
  Database, Layers, ChevronRight
} from "lucide-react";
import {
  listDocumentsApi,
  uploadDocumentApi,
  deleteDocumentApi,
  renameDocumentApi,
  reclassifyDocumentApi,
  replaceDocumentApi,
  getDocumentStatsApi,
} from "@/lib/api-client";

export const Route = createFileRoute("/app/profile")({
  component: Page,
});

/* ─── Types ─────────────────────────────────────────── */
type DocItem = {
  id: string;
  filename: string;
  category: string;
  mimeType?: string;
  fileSizeBytes: number;
  chunkCount: number;
  status: string;
  uploadedAt: string | Date;
};

const CATEGORIES = [
  { key: "all", label: "All" },
  { key: "business_plan", label: "Business Plan" },
  { key: "financial_report", label: "Financials" },
  { key: "pitch_deck", label: "Pitch Deck" },
  { key: "research", label: "Research" },
  { key: "blueprint", label: "Blueprint" },
  { key: "other", label: "Other" },
];

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMonthYear(d: string | Date) {
  return new Date(d).toLocaleString("default", { month: "long", year: "numeric" });
}

/* ─── Page ───────────────────────────────────────────── */
function Page() {
  const { user } = useAuth();
  const { profile, pushActivity, refreshHealth } = useOs();

  const displayName = user?.username
    ? user.username.charAt(0).toUpperCase() + user.username.slice(1)
    : "Founder";

  const companyName = profile["company_name"] || company.name;

  const shortTermGoals = Array.isArray(profile["short_term_goals"])
    ? profile["short_term_goals"].join(", ")
    : typeof profile["short_term_goals"] === "string"
      ? profile["short_term_goals"]
      : "";

  const challenges = Array.isArray(profile["current_challenges"])
    ? profile["current_challenges"].join(", ")
    : typeof profile["current_challenges"] === "string"
      ? profile["current_challenges"]
      : "";

  const profileRows = [
    ["Role", "Co-founder & CEO"],
    ["Location", profile["location"] || "Remote"],
    ["Industry", profile["industry"] || "Technology"],
    ["Business Model", profile["business_model"] || "SaaS"],
    ["Target Customer", profile["target_customer"] || "B2B"],
    ["Quarterly Focus", shortTermGoals || "Define short-term goals in onboarding"],
    ["Key Challenges", challenges || "Identify startup challenges in onboarding"],
  ];

  /* ── Document Library State ── */
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  const [docs, setDocs] = useState<DocItem[]>([]);
  const [stats, setStats] = useState({ totalDocs: 0, totalChunks: 0, indexed: 0 });
  const [uploading, setUploading] = useState(false);
  const [replacingDocId, setReplacingDocId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");

  const loadData = useCallback(async () => {
    try {
      const cat = selectedCategory === "all" ? undefined : selectedCategory;
      const q = searchQuery.trim() ? searchQuery : undefined;
      const [fetchedDocs, fetchedStats] = await Promise.all([
        listDocumentsApi(cat, q),
        getDocumentStatsApi(),
      ]);
      setDocs(fetchedDocs);
      setStats({
        totalDocs: fetchedStats.totalDocuments,
        totalChunks: fetchedStats.totalChunks,
        indexed: fetchedStats.indexedDocuments ?? 0,
      });
    } catch (err) {
      console.warn("Error loading docs:", err);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleFiles(files: FileList | File[]) {
    if (!files.length) return;
    setErrorMsg(null);
    setUploading(true);
    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      pushActivity("Memory Agent", `indexing "${file.name}" into vector memory`);
      try {
        const cat = selectedCategory !== "all" ? selectedCategory : undefined;
        await uploadDocumentApi(file, cat);
        pushActivity("Memory Agent", `successfully embedded "${file.name}"`);
      } catch (err) {
        setErrorMsg(`Failed to index ${file.name}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }
    setUploading(false);
    await loadData();
    await refreshHealth();
  }

  async function handleReplaceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !replacingDocId) return;
    setUploading(true);
    pushActivity("Memory Agent", `replacing document with "${file.name}"`);
    try {
      await replaceDocumentApi(replacingDocId, file);
      pushActivity("Memory Agent", `re-indexed replaced document`);
    } catch (err) {
      setErrorMsg(`Failed to replace: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setUploading(false);
      setReplacingDocId(null);
      if (replaceFileInputRef.current) replaceFileInputRef.current.value = "";
      await loadData();
      await refreshHealth();
    }
  }

  async function handleDelete(docId: string, filename: string) {
    if (!confirm(`Delete "${filename}"? This removes all its vector memory chunks.`)) return;
    try {
      await deleteDocumentApi(docId);
      pushActivity("Memory Agent", `removed "${filename}" from company memory`);
      await loadData();
      await refreshHealth();
    } catch (err) {
      console.error("Delete error:", err);
    }
  }

  async function handleRename(docId: string) {
    if (!editNameValue.trim()) return;
    try {
      await renameDocumentApi(docId, editNameValue.trim());
      setEditingDocId(null);
      await loadData();
    } catch (err) {
      console.error("Rename error:", err);
    }
  }

  async function handleReclassify(docId: string, newCat: string) {
    try {
      await reclassifyDocumentApi(docId, newCat);
      await loadData();
    } catch (err) {
      console.error("Reclassify error:", err);
    }
  }

  // Group by month
  const grouped: Record<string, DocItem[]> = {};
  docs.forEach((d) => {
    const key = getMonthYear(d.uploadedAt);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(d);
  });

  return (
    <>
      <PageHeader
        eyebrow="Profile"
        title={displayName}
        subtitle={`Co-founder & CEO · ${companyName}`}
      />

      {/* ── Top cards ── */}
      <div className="grid gap-4 lg:grid-cols-2 mb-8">
        <Panel title="Founder profile">
          <div className="space-y-3.5 text-[13px]">
            {profileRows.map(([k, v]) => (
              <div key={k} className="flex gap-4">
                <span className="w-36 shrink-0 text-xs text-muted-foreground">{k}</span>
                <span className="text-foreground font-medium">{v}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="How your co-founder adapts to you" hint="Learned from 118 interactions">
          <ul className="space-y-2.5 text-xs text-muted-foreground">
            <li>· You accept recommendations faster when alternatives are shown — they are now always included.</li>
            <li>· You act on financial items in the morning; nudges are scheduled before 10am.</li>
            <li>· You dismiss anything below 60% confidence, so low-confidence items are batched weekly instead.</li>
          </ul>
          <div className="mt-4 flex gap-1.5">
            <Tag tone="primary">Direct</Tag>
            <Tag tone="primary">Evidence-first</Tag>
            <Tag tone="primary">Morning founder</Tag>
          </div>
        </Panel>
      </div>

      {/* ── Document Library ── */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.18em] text-primary">Company Memory</div>
          <h2 className="text-xl font-semibold tracking-tight">Document Library</h2>
          <p className="mt-1 text-xs text-muted-foreground max-w-xl">
            Upload, rename, reclassify or remove documents that ground your AI co-founder. Changes sync to vector memory in real time.
          </p>
        </div>
        <Link
          to="/app/knowledge"
          className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
        >
          Full library <ChevronRight className="size-3.5" />
        </Link>
      </div>

      {/* Stats row */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        {[
          { icon: BookOpen, label: "Total Documents", val: stats.totalDocs },
          { icon: Database, label: "Indexed", val: stats.indexed },
          { icon: Layers, label: "Vector Chunks", val: stats.totalChunks.toLocaleString() },
        ].map(({ icon: Icon, label, val }) => (
          <div key={label} className="panel rise-in flex items-center gap-3 p-4">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="size-4 text-primary" />
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
              <div className="text-lg font-semibold">{val}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files) handleFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "panel mb-5 cursor-pointer border-dashed p-7 text-center transition-colors hover:border-primary/50",
          dragOver && "border-primary bg-primary/5"
        )}
      >
        <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.md,.png,.jpeg,.jpg" onChange={(e) => e.target.files && handleFiles(e.target.files)} className="hidden" />
        <input ref={replaceFileInputRef} type="file" accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.md,.png,.jpeg,.jpg" onChange={handleReplaceFile} className="hidden" />

        {uploading ? (
          <div className="flex flex-col items-center">
            <Loader2 className="size-7 animate-spin text-primary" />
            <p className="mt-2 text-sm font-semibold">Processing & embedding…</p>
            <p className="mt-1 text-xs text-muted-foreground">Generating vector chunks via Mistral Embeddings</p>
          </div>
        ) : (
          <>
            <UploadCloud className="mx-auto size-7 text-primary" />
            <p className="mt-2 text-sm font-semibold">Click or drag files to upload</p>
            <p className="mt-1 text-xs text-muted-foreground">PDF, DOCX, PPTX, TXT, Images — stored as searchable vector memory</p>
          </>
        )}
      </div>

      {errorMsg && (
        <div className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{errorMsg}</div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents…"
            className="w-full rounded-xl border border-border bg-surface pl-9 pr-4 py-2 text-xs outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={cn(
                "rounded-full border border-border px-3 py-1 text-[11px] transition-all",
                selectedCategory === cat.key
                  ? "bg-primary text-primary-foreground border-primary font-medium"
                  : "bg-surface text-muted-foreground hover:border-primary/30"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Document list */}
      <div className="space-y-5">
        {Object.keys(grouped).length > 0 ? (
          Object.keys(grouped)
            .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
            .map((month) => (
              <Panel key={month} className="p-0 overflow-hidden">
                <div className="border-b border-border/60 px-5 py-3 bg-surface/50 flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                  <Calendar className="size-3.5 text-primary" />
                  {month}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border/40 text-muted-foreground font-medium bg-surface/30">
                        <th className="py-2.5 px-5">Document</th>
                        <th className="py-2.5 px-4">Size</th>
                        <th className="py-2.5 px-4">Category</th>
                        <th className="py-2.5 px-4">Chunks</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {(grouped[month] || []).map((d) => (
                        <tr key={d.id} className="hover:bg-surface-2/40 transition-colors">
                          {/* Name / rename */}
                          <td className="py-3 px-5 font-medium max-w-[260px]">
                            {editingDocId === d.id ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={editNameValue}
                                  onChange={(e) => setEditNameValue(e.target.value)}
                                  className="rounded border border-primary/50 bg-surface px-2 py-0.5 text-xs outline-none w-full"
                                  autoFocus
                                  onKeyDown={(e) => e.key === "Enter" && handleRename(d.id)}
                                />
                                <button onClick={() => handleRename(d.id)} className="text-primary hover:scale-105"><Check className="size-4" /></button>
                                <button onClick={() => setEditingDocId(null)} className="text-muted-foreground hover:scale-105"><X className="size-4" /></button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 group">
                                <FileText className="size-4 text-primary shrink-0" />
                                <span className="truncate" title={d.filename}>{d.filename}</span>
                                <button
                                  onClick={() => { setEditingDocId(d.id); setEditNameValue(d.filename); }}
                                  className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                                >
                                  <Edit3 className="size-3" />
                                </button>
                              </div>
                            )}
                          </td>

                          {/* Size */}
                          <td className="py-3 px-4 text-muted-foreground font-mono">{formatBytes(d.fileSizeBytes)}</td>

                          {/* Category */}
                          <td className="py-3 px-4">
                            <select
                              value={d.category}
                              onChange={(e) => handleReclassify(d.id, e.target.value)}
                              className="rounded border border-border bg-surface text-[11px] font-medium py-0.5 px-1.5 focus:border-primary/50 outline-none"
                            >
                              <option value="business_plan">Business Plan</option>
                              <option value="financial_report">Financial</option>
                              <option value="pitch_deck">Pitch Deck</option>
                              <option value="research">Research</option>
                              <option value="blueprint">Blueprint</option>
                              <option value="other">Other</option>
                            </select>
                          </td>

                          {/* Chunks */}
                          <td className="py-3 px-4 font-mono text-muted-foreground">{d.chunkCount}</td>

                          {/* Status */}
                          <td className="py-3 px-4">
                            <Tag tone={d.status === "indexed" ? "primary" : d.status === "failed" ? "warn" : "muted"}>
                              {d.status}
                            </Tag>
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-5 text-right space-x-1.5 shrink-0">
                            <button
                              onClick={() => { setReplacingDocId(d.id); replaceFileInputRef.current?.click(); }}
                              className="inline-flex items-center gap-1 text-[10px] border border-border rounded px-1.5 py-0.5 font-medium hover:bg-surface transition-all text-muted-foreground hover:text-foreground"
                              title="Replace file"
                            >
                              <ArrowUpCircle className="size-3 text-primary" /> Replace
                            </button>
                            <button
                              onClick={() => handleDelete(d.id, d.filename)}
                              className="text-muted-foreground hover:text-destructive transition-colors p-1"
                              title="Delete"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            ))
        ) : (
          <div className="panel p-8 text-center text-sm text-muted-foreground border-dashed">
            No documents found. Upload your first startup document above to begin building company memory.
          </div>
        )}
      </div>
    </>
  );
}
