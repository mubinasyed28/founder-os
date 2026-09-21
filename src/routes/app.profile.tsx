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
  Database, Layers, ChevronRight, Camera, Upload, Sparkles, Link2
} from "lucide-react";
import {
  listDocumentsApi,
  uploadDocumentApi,
  deleteDocumentApi,
  renameDocumentApi,
  reclassifyDocumentApi,
  replaceDocumentApi,
  getDocumentStatsApi,
  uploadAvatarApi,
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

const AVATAR_PRESETS = [
  { id: "1", label: "Executive", url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=256&h=256&fit=crop&crop=face" },
  { id: "2", label: "Builder", url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=256&h=256&fit=crop&crop=face" },
  { id: "3", label: "Innovator", url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=256&h=256&fit=crop&crop=face" },
  { id: "4", label: "Visionary", url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=256&h=256&fit=crop&crop=face" },
];

/* ─── Page ───────────────────────────────────────────── */
function Page() {
  const { user } = useAuth();
  const { profile, updateProfile, pushActivity, refreshHealth } = useOs();

  const rawFounders = profile["founders"];
  const firstFounder = Array.isArray(rawFounders)
    ? rawFounders[0]
    : typeof rawFounders === "string"
      ? rawFounders.split(",")[0]?.trim()
      : "";

  const founderName =
    profile["founder_name"] ||
    firstFounder ||
    (user?.username ? user.username.charAt(0).toUpperCase() + user.username.slice(1) : "") ||
    "Maya Kapoor";

  const founderInitials = (() => {
    if (!founderName || !founderName.trim()) return "MK";
    const parts = founderName.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
    return parts[0].slice(0, 1).toUpperCase();
  })();

  const avatarUrl =
    profile["avatar_url"] ||
    profile["founder_image"] ||
    profile["profile_image"] ||
    (user as any)?.avatar_url ||
    "";

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
    ["Founder Name", founderName],
    ["Role", "Co-founder & CEO"],
    ["Location", profile["location"] || "Remote"],
    ["Industry", profile["industry"] || "Technology"],
    ["Business Model", profile["business_model"] || "SaaS"],
    ["Target Customer", profile["target_customer"] || "B2B"],
    ["Quarterly Focus", shortTermGoals || "Define short-term goals in onboarding"],
    ["Key Challenges", challenges || "Identify startup challenges in onboarding"],
  ];

  /* ── Avatar Management State ── */
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(founderName);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState("");

  async function handleAvatarFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    setUploadingAvatar(true);

    try {
      // First try backend upload endpoint
      try {
        const res = await uploadAvatarApi(file);
        if (res && res.avatar_url) {
          await updateProfile({ avatar_url: res.avatar_url });
          pushActivity("Memory Agent", "uploaded and synced founder profile picture");
          setUploadingAvatar(false);
          return;
        }
      } catch (backendErr) {
        console.warn("Backend avatar endpoint failed, falling back to client canvas:", backendErr);
      }

      // Fallback to client-side canvas compression for local / offline resilience
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const img = new window.Image();
          img.onload = async () => {
            const canvas = document.createElement("canvas");
            const MAX_DIM = 400;
            let width = img.width;
            let height = img.height;
            if (width > height) {
              if (width > MAX_DIM) {
                height = Math.round((height * MAX_DIM) / width);
                width = MAX_DIM;
              }
            } else {
              if (height > MAX_DIM) {
                width = Math.round((width * MAX_DIM) / height);
                height = MAX_DIM;
              }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
              await updateProfile({ avatar_url: dataUrl });
              pushActivity("Memory Agent", "updated founder profile avatar");
            }
            setUploadingAvatar(false);
          };
          img.onerror = () => {
            setAvatarError("Could not process image file.");
            setUploadingAvatar(false);
          };
          img.src = event.target?.result as string;
        } catch {
          setAvatarError("Failed to process image.");
          setUploadingAvatar(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setAvatarError(err.message || "Failed to upload avatar");
      setUploadingAvatar(false);
    } finally {
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  async function handleRemoveAvatar() {
    setAvatarError(null);
    await updateProfile({ avatar_url: "" });
    pushActivity("Memory Agent", "removed founder avatar, restored initials fallback");
  }

  async function handleSaveCustomUrl() {
    if (!customUrlInput.trim()) return;
    setAvatarError(null);
    await updateProfile({ avatar_url: customUrlInput.trim() });
    pushActivity("Memory Agent", "set founder profile image from URL");
    setCustomUrlInput("");
    setShowUrlInput(false);
  }

  async function handleSelectPreset(url: string) {
    setAvatarError(null);
    await updateProfile({ avatar_url: url });
    pushActivity("Memory Agent", "selected founder avatar preset");
  }

  async function handleSaveFounderName() {
    if (!nameInput.trim()) return;
    await updateProfile({ founder_name: nameInput.trim() });
    pushActivity("Memory Agent", `updated founder name to "${nameInput.trim()}"`);
    setIsEditingName(false);
  }

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
      {/* ── Founder Identity & Avatar Card ── */}
      <div className="mb-8 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface-1 via-surface-2 to-surface-1 p-6 glass shadow-xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            {/* Avatar preview container */}
            <div className="relative group shrink-0">
              <div className="relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-primary/30 bg-surface-3 shadow-lg transition-all duration-300 group-hover:border-primary/60 group-hover:shadow-primary/20">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={founderName}
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="grid size-full place-items-center bg-primary/15 text-3xl font-bold tracking-tight text-primary">
                    {founderInitials}
                  </div>
                )}
                {uploadingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-xs">
                    <Loader2 className="size-6 animate-spin text-primary" />
                  </div>
                )}
              </div>

              {/* Quick overlay change button */}
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1.5 -right-1.5 flex size-8 items-center justify-center rounded-xl border border-border bg-surface-2 text-foreground shadow-md transition-transform hover:scale-110 hover:border-primary/50 hover:bg-primary hover:text-primary-foreground cursor-pointer"
                title="Change photo"
              >
                <Camera className="size-4" />
              </button>
            </div>

            {/* Founder details */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                  Founder Profile
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                  {avatarUrl ? "Photo Active in Topbar" : "Initials Active in Topbar"}
                </span>
              </div>

              {isEditingName ? (
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="Enter founder name"
                    className="rounded-lg border border-primary/40 bg-surface-3 px-3 py-1 text-lg font-bold text-foreground outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveFounderName();
                      if (e.key === "Escape") setIsEditingName(false);
                    }}
                  />
                  <button
                    onClick={handleSaveFounderName}
                    className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                    title="Save name"
                  >
                    <Check className="size-4" />
                  </button>
                  <button
                    onClick={() => setIsEditingName(false)}
                    className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface-2 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Cancel"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <div className="mt-1 flex items-center gap-2.5">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {founderName}
                  </h1>
                  <button
                    onClick={() => {
                      setNameInput(founderName);
                      setIsEditingName(true);
                    }}
                    className="flex size-7 items-center justify-center rounded-lg border border-border bg-surface-2 text-muted-foreground hover:border-primary/40 hover:text-foreground cursor-pointer"
                    title="Edit founder name"
                  >
                    <Edit3 className="size-3.5" />
                  </button>
                </div>
              )}

              <p className="mt-1 text-xs text-muted-foreground">
                Co-founder & CEO · <span className="text-foreground font-medium">{companyName}</span>
                {user?.email ? ` · ${user.email}` : ""}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="file"
              ref={avatarInputRef}
              onChange={handleAvatarFileSelect}
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
            />
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-primary/20 cursor-pointer"
            >
              {uploadingAvatar ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
              {avatarUrl ? "Change Photo" : "Upload Photo"}
            </button>

            {avatarUrl ? (
              <button
                onClick={handleRemoveAvatar}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20 cursor-pointer"
                title="Remove photo and revert to initials"
              >
                <Trash2 className="size-3.5" />
                Remove
              </button>
            ) : (
              <button
                onClick={() => setShowUrlInput((v) => !v)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface-2 px-3.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground cursor-pointer"
              >
                <Link2 className="size-3.5" />
                Image URL
              </button>
            )}
          </div>
        </div>

        {/* Error message if any */}
        {avatarError && (
          <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {avatarError}
          </div>
        )}

        {/* Image URL input drawer / toggle */}
        {showUrlInput && (
          <div className="mt-4 flex flex-col sm:flex-row items-center gap-2 pt-4 border-t border-border/60">
            <input
              type="url"
              placeholder="Paste direct image link (e.g. https://images.unsplash.com/...)"
              value={customUrlInput}
              onChange={(e) => setCustomUrlInput(e.target.value)}
              className="w-full sm:flex-1 rounded-xl border border-border bg-surface-3 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
            />
            <div className="flex w-full sm:w-auto items-center gap-2">
              <button
                onClick={handleSaveCustomUrl}
                disabled={!customUrlInput.trim()}
                className="flex-1 sm:flex-initial rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50 cursor-pointer hover:bg-primary/90"
              >
                Apply URL
              </button>
              <button
                onClick={() => setShowUrlInput(false)}
                className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Quick avatar presets */}
        <div className="mt-4 flex flex-wrap items-center gap-2 pt-4 border-t border-border/50 text-[11px] text-muted-foreground">
          <span className="font-medium text-muted-foreground flex items-center gap-1">
            <Sparkles className="size-3 text-primary" /> Curated presets:
          </span>
          {AVATAR_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => handleSelectPreset(p.url)}
              className="group flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] font-medium transition-all hover:border-primary/40 hover:bg-surface-3 cursor-pointer"
            >
              <img src={p.url} alt={p.label} className="size-4 rounded-full object-cover" />
              <span>{p.label}</span>
            </button>
          ))}
          {avatarUrl && (
            <button
              onClick={handleRemoveAvatar}
              className="ml-auto text-[11px] text-primary hover:underline cursor-pointer"
            >
              Reset to initials ({founderInitials})
            </button>
          )}
        </div>
      </div>

      {/* ── Top cards ── */}
      <div className="grid gap-4 lg:grid-cols-2 mb-8">
        <Panel title="Founder profile">
          <div className="space-y-3.5 text-[13px]">
            {profileRows.map(([k, v]) => (
              <div key={k} className="flex flex-col sm:flex-row sm:gap-4 gap-0.5">
                <span className="w-36 shrink-0 text-xs text-muted-foreground">{k}</span>
                <span className="text-foreground font-medium break-words min-w-0">{v}</span>
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
      <div className="mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
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
