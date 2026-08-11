import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { 
  FileText, Loader2, Trash2, UploadCloud, Search, 
  Tag as TagIcon, Calendar, HardDrive, Edit3, Check, X, ArrowUpCircle
} from "lucide-react";
import { PageHeader, Panel, StatCard, Tag } from "@/components/os/primitives";
import { useOs } from "@/lib/os-store";
import { cn } from "@/lib/utils";
import {
  listDocumentsApi,
  uploadDocumentApi,
  deleteDocumentApi,
  renameDocumentApi,
  reclassifyDocumentApi,
  replaceDocumentApi,
  getDocumentStatsApi
} from "@/lib/api-client";

export const Route = createFileRoute("/app/knowledge")({
  component: Page,
});

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
  { key: "all", label: "All Documents" },
  { key: "business_plan", label: "Business Plans" },
  { key: "financial_report", label: "Financials" },
  { key: "pitch_deck", label: "Pitch Decks" },
  { key: "research", label: "User & Market Research" },
  { key: "blueprint", label: "Blueprints & Specs" },
  { key: "other", label: "Other" }
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMonthYearString(dateInput: string | Date): string {
  const d = new Date(dateInput);
  return d.toLocaleString("default", { month: "long", year: "numeric" });
}

function Page() {
  const { pushActivity, refreshHealth } = useOs();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  const [docs, setDocs] = useState<DocItem[]>([]);
  const [stats, setStats] = useState({ totalDocs: 0, totalChunks: 0 });
  const [uploading, setUploading] = useState(false);
  const [replacingDocId, setReplacingDocId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Filters and actions state
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState("");

  const loadData = useCallback(async () => {
    try {
      const activeCat = selectedCategory === "all" ? undefined : selectedCategory;
      const activeSearch = searchQuery.trim() ? searchQuery : undefined;
      
      const fetchedDocs = await listDocumentsApi(activeCat, activeSearch);
      const fetchedStats = await getDocumentStatsApi();

      setDocs(fetchedDocs);
      setStats({
        totalDocs: fetchedStats.totalDocuments,
        totalChunks: fetchedStats.totalChunks,
      });
    } catch (err) {
      console.warn("Error loading document list:", err);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleFiles(files: FileList | File[]) {
    if (!files.length) return;
    setErrorMsg(null);
    setUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      pushActivity("Memory Agent", `indexing "${file.name}" into vector memory`);

      try {
        const uploadCat = selectedCategory !== "all" ? selectedCategory : undefined;
        await uploadDocumentApi(file, uploadCat);
        pushActivity("Memory Agent", `successfully embedded and indexed "${file.name}"`);
      } catch (err) {
        console.error("Upload error:", err);
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
    pushActivity("Memory Agent", `updating memory: replacing document with "${file.name}"`);

    try {
      await replaceDocumentApi(replacingDocId, file);
      pushActivity("Memory Agent", `successfully re-indexed replaced document to persistent memory`);
    } catch (err) {
      console.error("Replace document error:", err);
      setErrorMsg(`Failed to replace document: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setUploading(false);
      setReplacingDocId(null);
      if (replaceFileInputRef.current) replaceFileInputRef.current.value = "";
      await loadData();
      await refreshHealth();
    }
  }

  async function handleDelete(docId: string, filename: string) {
    if (!confirm(`Are you sure you want to delete "${filename}"? This will delete all its vector memory chunks.`)) {
      return;
    }
    
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
      pushActivity("Memory Agent", `renamed document to "${editNameValue}"`);
      setEditingDocId(null);
      await loadData();
    } catch (err) {
      console.error("Rename error:", err);
    }
  }

  async function handleReclassify(docId: string, newCat: string) {
    try {
      await reclassifyDocumentApi(docId, newCat);
      pushActivity("Memory Agent", `reclassified document category to "${newCat}"`);
      await loadData();
      await refreshHealth();
    } catch (err) {
      console.error("Reclassification error:", err);
    }
  }

  // Group documents month-wise
  const groupedDocs: Record<string, DocItem[]> = {};
  docs.forEach((d) => {
    const monthYear = getMonthYearString(d.uploadedAt);
    if (!groupedDocs[monthYear]) {
      groupedDocs[monthYear] = [];
    }
    groupedDocs[monthYear].push(d);
  });

  return (
    <>
      <PageHeader
        eyebrow="Persistent Company Memory"
        title="Editable Document Library"
        subtitle="Manage the documents that ground your AI co-founder and health dashboard. Renames or updates sync vectors in real time."
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <StatCard label="Total Documents" value={stats.totalDocs.toString()} />
        <StatCard label="Total Vector Chunks" value={stats.totalChunks.toLocaleString()} />
        <StatCard label="Memory Sync Status" value="Online & Synced" />
        <StatCard label="Supported Files" value="PDF, DOCX, PPTX, TXT, Images" />
      </div>

      {/* Drag & Drop Upload Panel */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "panel mb-6 cursor-pointer border-dashed p-8 text-center transition-colors hover:border-primary/50",
          dragOver && "border-primary bg-primary/5"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.md,.png,.jpeg,.jpg"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
          className="hidden"
        />
        
        {/* Hidden replacement file input */}
        <input
          ref={replaceFileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.md,.png,.jpeg,.jpg"
          onChange={handleReplaceFile}
          className="hidden"
        />

        {uploading ? (
          <div className="flex flex-col items-center">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="mt-3 text-sm font-semibold">Processing, chunking & embedding document...</p>
            <p className="mt-1 text-xs text-muted-foreground">Generating 1024-dim vector chunks via Mistral Embeddings</p>
          </div>
        ) : (
          <>
            <UploadCloud className="mx-auto size-8 text-primary" />
            <p className="mt-3 text-sm font-semibold">
              Click or drag files here to upload into company memory
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Upload Business plans, financial statements, pitch decks, specs, surveys or interview transcripts
            </p>
          </>
        )}
      </div>

      {errorMsg ? (
        <div className="mb-6 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {errorMsg}
        </div>
      ) : null}

      {/* Filter and Search Panel */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents by filename..."
            className="w-full rounded-xl border border-border bg-surface pl-10 pr-4 py-2 text-sm outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
          />
        </div>
        
        {/* Category Filters */}
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={cn(
                "rounded-full border border-border px-3.5 py-1 text-xs transition-all",
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

      {/* Document Group List */}
      <div className="space-y-6">
        {Object.keys(groupedDocs).length > 0 ? (
          Object.keys(groupedDocs)
            .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
            .map((monthStr) => (
              <Panel key={monthStr} className="p-0 overflow-hidden">
                {/* Month Group Header */}
                <div className="border-b border-border/60 px-5 py-3 bg-surface/50 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <Calendar className="size-3.5 text-primary" />
                  {monthStr}
                </div>
                
                {/* Table list */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border/40 text-muted-foreground font-medium bg-surface/30">
                        <th className="py-2.5 px-5">Document Name</th>
                        <th className="py-2.5 px-4">Size</th>
                        <th className="py-2.5 px-4">Category</th>
                        <th className="py-2.5 px-4">Chunks</th>
                        <th className="py-2.5 px-4">Status</th>
                        <th className="py-2.5 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {(groupedDocs[monthStr] || []).map((d) => (
                        <tr key={d.id} className="hover:bg-surface-2/40 transition-colors">
                          {/* Name / Rename Input */}
                          <td className="py-3 px-5 font-medium max-w-[280px]">
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
                                <button onClick={() => handleRename(d.id)} title="Save name" className="text-primary hover:scale-105">
                                  <Check className="size-4" />
                                </button>
                                <button onClick={() => setEditingDocId(null)} title="Cancel" className="text-muted-foreground hover:scale-105">
                                  <X className="size-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 group">
                                <FileText className="size-4 text-primary shrink-0" />
                                <span className="truncate" title={d.filename}>{d.filename}</span>
                                <button
                                  onClick={() => {
                                    setEditingDocId(d.id);
                                    setEditNameValue(d.filename);
                                  }}
                                  className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                                >
                                  <Edit3 className="size-3" />
                                </button>
                              </div>
                            )}
                          </td>
                          
                          {/* Size */}
                          <td className="py-3 px-4 text-muted-foreground font-mono">{formatBytes(d.fileSizeBytes)}</td>
                          
                          {/* Category select dropdown */}
                          <td className="py-3 px-4">
                            <select
                              value={d.category}
                              onChange={(e) => handleReclassify(d.id, e.target.value)}
                              className="rounded border border-border bg-surface text-[11px] font-medium text-foreground py-0.5 px-1.5 focus:border-primary/50 outline-none"
                            >
                              <option value="business_plan">Business Plan</option>
                              <option value="financial_report">Financial</option>
                              <option value="pitch_deck">Pitch Deck</option>
                              <option value="research">Research</option>
                              <option value="blueprint">Blueprint/PRD</option>
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
                          
                          {/* Action Buttons */}
                          <td className="py-3 px-5 text-right space-x-1.5 shrink-0">
                            <button
                              onClick={() => {
                                setReplacingDocId(d.id);
                                replaceFileInputRef.current?.click();
                              }}
                              className="inline-flex items-center gap-1 text-[10px] border border-border rounded px-1.5 py-0.5 font-medium hover:bg-surface transition-all text-muted-foreground hover:text-foreground"
                              title="Upload new file content to replace this memory chunk"
                            >
                              <ArrowUpCircle className="size-3 text-primary" />
                              Replace
                            </button>
                            <button
                              onClick={() => handleDelete(d.id, d.filename)}
                              className="text-muted-foreground hover:text-destructive transition-colors p-1"
                              title="Delete document memory"
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
            No matching documents found in company memory. Search filters or upload new startup documents to begin.
          </div>
        )}
      </div>
    </>
  );
}
