import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent, type ChangeEvent } from "react";
import {
  ArrowUp,
  Brain,
  Check,
  FileText,
  Loader2,
  Sparkles,
  RefreshCw,
  Plus,
  Trash2,
  Paperclip,
  Database,
  MessageSquare,
  X
} from "lucide-react";
import { PageHeader, Panel, Tag } from "@/components/os/primitives";
import { useOs } from "@/lib/os-store";
import { cn } from "@/lib/utils";
import {
  sendChatMessageApi,
  getChatHistoryApi,
  getDocumentStatsApi,
  listConversationsApi,
  deleteConversationApi,
  uploadChatAttachmentApi,
  saveChatAttachmentApi,
  type RagMessage,
  type ChatAttachment
} from "@/lib/api-client";

export const Route = createFileRoute("/app/chat")({
  component: Chat,
});

const SUGGESTIONS = [
  "What is our current pricing strategy?",
  "Based on our business plan, what are our biggest risks?",
  "Summarize our target market and core problem from company memory",
  "Are we ready to talk to investors?",
  "What competitor threats should we be watching?",
];

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

function Chat() {
  const { pushActivity, profile } = useOs();

  const welcomeMsg = (companyName: string): RagMessage => ({
    role: "assistant",
    text: `Hello founder! I have loaded your company memory ${
      companyName ? `for ${companyName}` : ""
    }. Ask me anything about your product, business plan, financial model, pitch deck, or customer insights — I will retrieve the relevant chunks and cite the exact source files.`,
    steps: ["Company memory loaded", "Atlas Vector Search active", "Mistral RAG pipeline ready"],
  });

  const [msgs, setMsgs] = useState<RagMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [stats, setStats] = useState({ totalDocs: 0, totalChunks: 0 });
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Conversations history state
  const [conversations, setConversations] = useState<{ id: string; title: string; updatedAt: string }[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);

  // Attachment state
  const [pendingAttachment, setPendingAttachment] = useState<ChatAttachment | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [savingAttachmentIndex, setSavingAttachmentIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading]);

  const loadConversationsList = async () => {
    setLoadingConversations(true);
    try {
      const res = await listConversationsApi();
      if (res) {
        setConversations(res);
      }
    } catch (err) {
      console.warn("Could not load conversations list:", err);
    } finally {
      setLoadingConversations(false);
    }
  };

  const loadStatsAndHistory = async (targetId?: string) => {
    try {
      const statsRes = await getDocumentStatsApi();
      if (statsRes) {
        setStats({
          totalDocs: statsRes.totalDocuments,
          totalChunks: statsRes.totalChunks,
        });
      }

      const historyRes = await getChatHistoryApi(targetId);
      if (historyRes && historyRes.messages && historyRes.messages.length > 0) {
        setMsgs(historyRes.messages);
        setConversationId(historyRes.conversationId);
      } else {
        const companyName = profile["company_name"] || "";
        setMsgs([welcomeMsg(companyName)]);
        setConversationId(undefined);
      }
    } catch (err) {
      console.warn("Could not fetch chat history/stats from server:", err);
      const companyName = profile["company_name"] || "";
      setMsgs([welcomeMsg(companyName)]);
    }
  };

  useEffect(() => {
    loadConversationsList();
    loadStatsAndHistory();
  }, []);

  const selectConversation = async (id: string) => {
    if (loading) return;
    setConversationId(id);
    await loadStatsAndHistory(id);
  };

  const startNewChat = () => {
    if (loading) return;
    setConversationId(undefined);
    setPendingAttachment(null);
    const companyName = profile["company_name"] || "";
    setMsgs([welcomeMsg(companyName)]);
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await deleteConversationApi(id);
      if (res.success) {
        pushActivity("Memory Agent", "deleted a co-founder chat conversation");

        // Refresh conversations list
        const updatedList = conversations.filter((c) => c.id !== id);
        setConversations(updatedList);

        // If active conversation was deleted, switch to the next latest or start a new chat
        if (conversationId === id) {
          const first = updatedList[0];
          if (first) {
            selectConversation(first.id);
          } else {
            startNewChat();
          }
        }
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!file) return;

    setUploadingFile(true);
    try {
      const res = await uploadChatAttachmentApi(file);
      setPendingAttachment(res);
      pushActivity("Memory Agent", `uploaded temporary file in chat: ${file.name}`);
    } catch (err) {
      console.error("Attachment upload failed:", err);
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removePendingAttachment = () => {
    setPendingAttachment(null);
  };

  const handleSaveAttachment = async (msgIndex: number) => {
    if (!conversationId) return;
    setSavingAttachmentIndex(msgIndex);
    try {
      const res = await saveChatAttachmentApi(conversationId, msgIndex);
      if (res.success) {
        pushActivity("Memory Agent", `permanently saved chat document to workspace library`);

        // Update messages state
        setMsgs((prev) =>
          prev.map((m, idx) => {
            if (idx === msgIndex) {
              return {
                ...m,
                attachment: res.attachment,
              };
            }
            return m;
          })
        );

        // Refresh stats
        const statsRes = await getDocumentStatsApi();
        if (statsRes) {
          setStats({
            totalDocs: statsRes.totalDocuments,
            totalChunks: statsRes.totalChunks,
          });
        }
      }
    } catch (err) {
      console.error("Failed to save attachment to workspace:", err);
    } finally {
      setSavingAttachmentIndex(null);
    }
  };

  async function ask(q: string) {
    if ((!q.trim() && !pendingAttachment) || loading) return;
    const userQuestion = q.trim();
    setInput("");

    const newMsg: RagMessage = { role: "user", text: userQuestion };
    if (pendingAttachment) {
      newMsg.attachment = pendingAttachment;
    }

    const newMsgs: RagMessage[] = [...msgs, newMsg];
    setMsgs(newMsgs);
    setPendingAttachment(null);
    setLoading(true);
    pushActivity("Memory Agent", "retrieved vector context for a founder question");

    try {
      const res = await sendChatMessageApi(newMsgs, conversationId);

      // If it was a new conversation, update state and reload conversations list
      if (!conversationId) {
        setConversationId(res.conversationId);
        loadConversationsList();
      }

      setMsgs([
        ...newMsgs,
        {
          role: "assistant",
          text: res.text,
          steps: res.steps,
          sources: res.sources,
        },
      ]);
    } catch (err) {
      console.error("RAG chat error:", err);
      setMsgs([
        ...newMsgs,
        {
          role: "assistant",
          text: "I searched your company memory, but encountered an error processing the request. Make sure your MISTRAL_API_KEY is configured in the backend .env.",
          steps: ["Vector retrieval attempted", "API call failed"],
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (input.trim() || pendingAttachment) ask(input.trim());
  }

  const companyName = profile["company_name"] || "Configured";

  return (
    <>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <PageHeader
          eyebrow="RAG-Powered Co-Founder Chat"
          title="Ask the co-founder who remembers everything"
          subtitle="Grounded in your company profile and vector search embeddings of your uploaded pitch decks, business plans, financials, and research docs."
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[240px_1fr_300px]">
        {/* Chat History Sidebar */}
        <Panel className="flex h-[620px] flex-col p-3 bg-surface-2/30 border border-border/40 overflow-hidden">
          <button
            onClick={startNewChat}
            className="flex items-center justify-center gap-2 w-full h-9 rounded-xl bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/95 transition-all shadow-[var(--shadow-glow)]"
          >
            <Plus className="size-3.5" />
            New Chat
          </button>

          <div className="mt-4 flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60 px-2 py-1">
              Conversations
            </div>
            {loadingConversations ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-primary/60" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-xs text-muted-foreground/50 text-center py-8 px-2">
                No chats yet. Start talking to your co-founder!
              </div>
            ) : (
              conversations.map((c) => {
                const isActive = conversationId === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => selectConversation(c.id)}
                    className={cn(
                      "group relative flex items-center justify-between rounded-lg px-2.5 py-2 text-xs cursor-pointer transition-all",
                      isActive
                        ? "bg-primary/10 text-primary font-medium border border-primary/20"
                        : "text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-2 overflow-hidden mr-5">
                      <MessageSquare className={cn("size-3.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground/60")} />
                      <span className="truncate">{c.title}</span>
                    </div>
                    <button
                      onClick={(e) => handleDeleteConversation(c.id, e)}
                      className="absolute right-1.5 opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive rounded transition-all hover:bg-surface-3"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </Panel>

        {/* Chat Pane */}
        <Panel className="flex h-[620px] flex-col p-0">
          <div className="flex-1 space-y-5 overflow-y-auto p-5 custom-scrollbar">
            {msgs.map((m, i) => (
              <div key={i} className={cn("flex flex-col", m.role === "user" ? "items-end" : "items-start")}>
                <div className={cn("max-w-[85%]", m.role === "user" && "text-right")}>
                  {m.role === "assistant" ? (
                    <div className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-primary font-medium">
                      <Sparkles className="size-3" /> AI Co-founder
                    </div>
                  ) : null}
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-3 text-[14px] leading-relaxed whitespace-pre-wrap text-left",
                      m.role === "assistant"
                        ? "bg-surface-2 text-foreground border border-border/40"
                        : "bg-primary text-primary-foreground font-medium ml-auto"
                    )}
                  >
                    {m.text}
                  </div>

                  {/* Render Message Attachment if present */}
                  {m.attachment ? (
                    <div className={cn("my-2 flex", m.role === "user" ? "justify-end" : "justify-start")}>
                      <div className="rounded-xl border border-border bg-surface px-3 py-2.5 flex flex-col gap-2 shadow-sm w-[280px] text-left">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div className="size-8 rounded bg-primary/10 grid place-items-center shrink-0">
                            <FileText className="size-4 text-primary" />
                          </div>
                          <div className="overflow-hidden min-w-0">
                            <div className="text-xs font-semibold text-foreground truncate" title={m.attachment.filename}>
                              {m.attachment.filename}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              {formatBytes(m.attachment.fileSizeBytes)}
                            </div>
                          </div>
                        </div>

                        {m.attachment.mimeType.startsWith("image/") && m.attachment.base64 ? (
                          <div className="rounded-lg overflow-hidden border border-border/50 max-h-[140px] flex items-center justify-center bg-black/20">
                            <img
                              src={`data:${m.attachment.mimeType};base64,${m.attachment.base64}`}
                              alt={m.attachment.filename}
                              className="max-h-[140px] w-auto object-contain"
                            />
                          </div>
                        ) : null}

                        {/* Save to Workspace button */}
                        {conversationId ? (
                          <div className="pt-1.5 border-t border-border/50 flex justify-end">
                            {m.attachment.isSaved ? (
                              <div className="inline-flex items-center gap-1 text-[10px] text-emerald-500 font-semibold">
                                <Check className="size-3 text-emerald-500" />
                                Saved to Workspace
                              </div>
                            ) : (
                              <button
                                onClick={() => handleSaveAttachment(i)}
                                disabled={savingAttachmentIndex === i}
                                className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-primary/10 hover:bg-primary/15 active:bg-primary/20 text-primary font-semibold text-[10px] transition-colors"
                              >
                                {savingAttachmentIndex === i ? (
                                  <Loader2 className="size-3 animate-spin" />
                                ) : (
                                  <Database className="size-3" />
                                )}
                                Save to Workspace Memory
                              </button>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {m.steps && m.steps.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5 justify-start">
                      {m.steps.map((s) => (
                        <span
                          key={s}
                          className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] text-muted-foreground border border-border/40"
                        >
                          <Check className="mr-1 inline size-2.5 text-primary" />
                          {s}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {m.sources && m.sources.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5 justify-start">
                      {m.sources.map((s) => (
                        <span
                          key={s}
                          className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] text-primary font-medium"
                        >
                          <FileText className="size-2.5" />
                          Source: {s}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}

            {loading ? (
              <div className="max-w-[85%] rounded-2xl bg-surface-2 p-4 border border-border/40">
                <div className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-primary font-medium">
                  <Brain className="size-3 animate-pulse" /> RAG Pipeline Running
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin text-primary" />
                  Generating query embedding & searching vector chunks in MongoDB…
                </div>
              </div>
            ) : null}
            <div ref={chatEndRef} />
          </div>

          <div className="border-t border-border p-3 bg-surface-2/10">
            {pendingAttachment ? (
              <div className="mb-2 p-2 rounded-xl border border-border bg-surface flex items-center justify-between gap-3 max-w-[320px] transition-all animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="size-8 rounded bg-primary/10 grid place-items-center shrink-0">
                    <FileText className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0 overflow-hidden text-left">
                    <div className="text-xs font-semibold text-foreground truncate" title={pendingAttachment.filename}>
                      {pendingAttachment.filename}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {formatBytes(pendingAttachment.fileSizeBytes)}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={removePendingAttachment}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-3 transition-colors"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : null}

            {uploadingFile ? (
              <div className="mb-2 p-2 rounded-xl border border-border bg-surface flex items-center gap-2 max-w-[280px] animate-in fade-in slide-in-from-bottom-2 duration-200">
                <Loader2 className="size-4 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground font-medium">Extracting file contents...</span>
              </div>
            ) : null}

            <div className="mb-2 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => ask(s)}
                  className="rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>

            <form onSubmit={onSubmit} className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || uploadingFile || !!pendingAttachment}
                className="grid size-7 shrink-0 place-items-center rounded-lg border border-border bg-surface hover:bg-surface-3 text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                title="Attach document/image"
              >
                <Paperclip className="size-4" />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept=".pdf,.docx,.doc,.pptx,.ppt,.txt,.md,.markdown,.csv,.json,.png,.jpg,.jpeg,.webp"
              />
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything about your company, pricing strategy, or risk profiles…"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                disabled={(!input.trim() && !pendingAttachment) || loading}
                className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
              >
                <ArrowUp className="size-4" />
              </button>
            </form>
          </div>
        </Panel>

        {/* Context Pane */}
        <div className="space-y-4">
          <Panel title="Context in this workspace" hint="MongoDB Vector Memory">
            <div className="space-y-2 text-xs">
              {[
                ["Company profile", companyName],
                ["Indexed Documents", `${stats.totalDocs} docs`],
                ["Vector Chunks", `${stats.totalChunks.toLocaleString()} embedded`],
                ["Embedding Model", "mistral-embed"],
                ["LLM Engine", "Mistral Large"],
                ["Vector Database", "MongoDB Atlas"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium tabular-nums">{v}</span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel title="Agents on call">
            <div className="flex flex-wrap gap-1.5">
              {["Research", "Strategy", "Financial", "Critic", "Memory"].map((a) => (
                <Tag key={a} tone="primary">
                  {a}
                </Tag>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              Every answer performs live vector search over your uploaded documents and cites exact file sources.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
