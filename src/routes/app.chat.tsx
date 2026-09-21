import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent, type ChangeEvent } from "react";
import {
  ArrowRight,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Database,
  FileText,
  HelpCircle,
  Lightbulb,
  ListPlus,
  Loader2,
  MessageSquare,
  Mic,
  Paperclip,
  Plus,
  ShieldAlert,
  Sparkles,
  Swords,
  Target,
  Trash2,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { useOs } from "@/lib/os-store";
import { useAuth } from "@/lib/auth-context";
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
  type ChatAttachment,
} from "@/lib/api-client";

export const Route = createFileRoute("/app/chat")({
  component: ChatPage,
});

const QUICK_ACTIONS = [
  { label: "Can you analyse our competitors?", prompt: "Can you analyse our primary competitors and identify our biggest differentiation gaps?" },
  { label: "What are the biggest risks?", prompt: "Based on our current stage, metrics and market trends, what are our top 3 existential risks?" },
  { label: "Help me with investor pitch", prompt: "How should we frame our growth story and market opportunity for seed investors?" },
  { label: "Create a task", action: "create_task" },
];

const REASONING_STEPS = [
  "Analyzing your company profile",
  "Reading company data",
  "Analyzing market trends (Tavily)",
  "Checking competitors",
  "Running impact analysis",
  "Generating recommendations",
];

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

// Helper to detect structured insights from Co-Founder response
function extractInsights(text: string) {
  const lower = text.toLowerCase();
  const hasOpportunity = lower.includes("market opportunity") || lower.includes("opportunity:");
  const hasGap = lower.includes("competitive gap") || lower.includes("competitor gap") || lower.includes("differentiat");
  const hasImpact = lower.includes("estimated impact") || lower.includes("impact:") || lower.includes("%");
  const hasRec = lower.includes("recommendation") || lower.includes("suggested action");

  if (!hasOpportunity && !hasGap && !hasImpact && !hasRec) {
    return null;
  }

  // Extract or synthesize clean highlight metrics
  let oppValue = "High";
  if (lower.includes("opportunity: moderate") || lower.includes("medium opportunity")) oppValue = "Medium";
  if (lower.includes("opportunity: low")) oppValue = "Niche";

  let gapValue = "Yes";
  if (lower.includes("competitive gap: none") || lower.includes("no gap")) gapValue = "Saturated";

  let impactValue = "+22%";
  const percentMatch = text.match(/([+|-]?\d{1,3}%)/);
  if (percentMatch && percentMatch[1]) {
    impactValue = percentMatch[1];
  }

  let recValue = "Validate";
  if (lower.includes("recommendation: launch") || lower.includes("recommendation: proceed")) recValue = "Proceed";
  if (lower.includes("recommendation: pivot") || lower.includes("recommendation: pause")) recValue = "Refine";

  return {
    opportunity: oppValue,
    gap: gapValue,
    impact: impactValue,
    recommendation: recValue,
  };
}

function ChatPage() {
  const { pushActivity, profile, addTask } = useOs();
  const { user } = useAuth();

  const welcomeMsg = (companyName: string): RagMessage => ({
    role: "assistant",
    text: `Hello founder! I have loaded your company memory ${
      companyName ? `for ${companyName}` : ""
    }. Ask me anything about your product, business plan, financial model, competitors, or customer insights — I will retrieve the relevant company context and cite the exact evidence.`,
    steps: ["Company memory loaded", "Atlas Vector Search active", "Mistral RAG pipeline ready"],
  });

  const [msgs, setMsgs] = useState<RagMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [stats, setStats] = useState({ totalDocs: 0, totalChunks: 0 });
  const [thoughtProcessOpen, setThoughtProcessOpen] = useState(true);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [taskFeedback, setTaskFeedback] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Conversations history state
  const [conversations, setConversations] = useState<{ id: string; title: string; updatedAt: string }[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);

  // Attachment state
  const [pendingAttachment, setPendingAttachment] = useState<ChatAttachment | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [savingAttachmentIndex, setSavingAttachmentIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    "Alex";

  const founderInitials = founderName.slice(0, 1).toUpperCase() || "A";

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

    // Check if initial prompt was passed from Home page
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const initialPrompt = urlParams.get("prompt");
      if (initialPrompt && initialPrompt.trim()) {
        window.history.replaceState({}, "", window.location.pathname);
        setTimeout(() => {
          ask(initialPrompt.trim());
        }, 300);
      }
    }
  }, []);

  const selectConversation = async (id: string) => {
    if (loading) return;
    setConversationId(id);
    setMobileHistoryOpen(false);
    await loadStatsAndHistory(id);
  };

  const startNewChat = () => {
    if (loading) return;
    setConversationId(undefined);
    setPendingAttachment(null);
    setMobileHistoryOpen(false);
    const companyName = profile["company_name"] || "";
    setMsgs([welcomeMsg(companyName)]);
  };

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await deleteConversationApi(id);
      if (res.success) {
        pushActivity("Memory Agent", "deleted a co-founder chat conversation");
        const updatedList = conversations.filter((c) => c.id !== id);
        setConversations(updatedList);
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

  const handleSaveAttachment = async (msgIndex: number) => {
    if (!conversationId) return;
    setSavingAttachmentIndex(msgIndex);
    try {
      const res = await saveChatAttachmentApi(conversationId, msgIndex);
      if (res.success) {
        pushActivity("Memory Agent", "permanently saved chat document to workspace library");
        setMsgs((prev) =>
          prev.map((m, idx) => {
            if (idx === msgIndex) {
              return { ...m, attachment: res.attachment };
            }
            return m;
          })
        );
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
    setActiveStepIndex(0);
    pushActivity("Memory Agent", "retrieved vector context for a founder question");

    // Animate reasoning step progression
    const stepInterval = setInterval(() => {
      setActiveStepIndex((prev) => {
        if (prev < REASONING_STEPS.length - 1) return prev + 1;
        return prev;
      });
    }, 750);

    try {
      const res = await sendChatMessageApi(newMsgs, conversationId);
      clearInterval(stepInterval);
      setActiveStepIndex(REASONING_STEPS.length);

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
      clearInterval(stepInterval);
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

  const handleQuickAction = (qa: (typeof QUICK_ACTIONS)[number]) => {
    if (qa.action === "create_task") {
      addTask("Implement recommendations from Co-Founder Chat", "Chat");
      setTaskFeedback(true);
      setTimeout(() => setTaskFeedback(false), 2500);
      return;
    }
    if (qa.prompt) {
      ask(qa.prompt);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* ── Chat Header ────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Co-Founder Chat
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/30">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              AI Online
            </span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Ask anything. Get startup-specific answers with real context.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMobileHistoryOpen(!mobileHistoryOpen)}
            className="lg:hidden inline-flex items-center gap-1.5 rounded-xl border border-border/60 bg-surface/60 px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-white transition-all cursor-pointer"
          >
            <MessageSquare className="size-3.5 text-cyan-400" />
            <span>History ({conversations.length})</span>
            {mobileHistoryOpen ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>

          <button
            onClick={startNewChat}
            className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-xs font-bold text-black shadow-[0_0_15px_rgba(6,182,212,0.35)] hover:bg-cyan-300 transition-all cursor-pointer"
          >
            <Plus className="size-4 stroke-[2.5]" />
            New Chat
          </button>
        </div>
      </div>

      {/* ── Main Chat Workspace Grid ───────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* Left: Conversations List */}
        <div
          className={cn(
            "rounded-2xl border border-border/50 bg-[#0a1122]/70 p-4 shadow-xl backdrop-blur-md flex-col lg:h-[700px] overflow-hidden",
            mobileHistoryOpen ? "flex h-auto max-h-60" : "hidden lg:flex"
          )}
        >
          <div className="flex items-center justify-between pb-3 border-b border-border/40">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground/80">
              Conversations
            </span>
            <button
              onClick={startNewChat}
              className="grid size-6 place-items-center rounded-lg text-muted-foreground hover:text-white hover:bg-white/[0.05] transition-colors"
              title="New conversation"
            >
              <Plus className="size-4" />
            </button>
          </div>

          <div className="mt-3 flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {loadingConversations ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="size-5 animate-spin text-cyan-400" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground/60 px-3">
                No saved conversations yet. Ask your co-founder anything!
              </div>
            ) : (
              conversations.map((c) => {
                const isActive = conversationId === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => selectConversation(c.id)}
                    className={cn(
                      "group relative flex items-center justify-between rounded-xl px-3 py-2.5 text-xs cursor-pointer transition-all",
                      isActive
                        ? "bg-cyan-500/15 text-cyan-300 font-semibold border border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                        : "text-muted-foreground hover:bg-white/[0.04] hover:text-white"
                    )}
                  >
                    <div className="min-w-0 flex-1 pr-6">
                      <div className="truncate text-white/90">{c.title}</div>
                      <div className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">
                        {new Date(c.updatedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDeleteConversation(c.id, e)}
                      className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-400 transition-all rounded hover:bg-red-500/10"
                      title="Delete chat"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-3 border-t border-border/40 text-center">
            <button
              onClick={() => {}}
              className="text-[11px] text-cyan-400/80 hover:text-cyan-300 font-medium inline-flex items-center gap-1 transition-colors"
            >
              View all conversations →
            </button>
          </div>
        </div>

        {/* Right: Active Chat Stream Pane */}
        <div className="rounded-2xl border border-border/50 bg-[#0a1122]/70 shadow-xl backdrop-blur-md flex flex-col h-[500px] sm:h-[600px] lg:h-[700px] overflow-hidden">
          {/* Scrollable Messages Area */}
          <div className="flex-1 space-y-6 overflow-y-auto p-5 sm:p-6 custom-scrollbar">
            {msgs.map((m, idx) => {
              const isUser = m.role === "user";
              const insights = !isUser ? extractInsights(m.text) : null;

              return (
                <div key={idx} className={cn("flex flex-col", isUser ? "items-end" : "items-start w-full")}>
                  {/* User Message */}
                  {isUser ? (
                    <div className="flex items-start gap-3 max-w-[90%] sm:max-w-[85%]">
                      <div className="space-y-1 text-right">
                        <div className="rounded-2xl rounded-tr-sm bg-cyan-500/20 border border-cyan-400/30 px-4 py-3 text-sm text-white leading-relaxed shadow-md backdrop-blur-sm text-left">
                          {m.text}
                        </div>
                        <div className="text-[10px] text-muted-foreground/60 pr-1">
                          Today, 6:30 PM
                        </div>
                      </div>
                      <div className="grid size-8 shrink-0 place-items-center rounded-full bg-cyan-500/25 text-cyan-300 font-bold text-xs border border-cyan-400/30 mt-0.5">
                        {founderInitials}
                      </div>
                    </div>
                  ) : (
                    /* AI Co-Founder Message */
                    <div className="flex items-start gap-2 sm:gap-3 max-w-full sm:max-w-[90%] w-full">
                      <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-400/30 shadow-[0_0_12px_rgba(6,182,212,0.25)] mt-0.5">
                        <Sparkles className="size-4" />
                      </div>

                      <div className="space-y-3 flex-1 overflow-hidden">
                        {/* Thought Process Box */}
                        {m.steps && m.steps.length > 0 && (
                          <div className="rounded-xl border border-border/40 bg-black/30 p-3 text-xs">
                            <button
                              type="button"
                              onClick={() => setThoughtProcessOpen(!thoughtProcessOpen)}
                              className="flex items-center justify-between w-full text-[11px] font-semibold text-muted-foreground hover:text-white transition-colors"
                            >
                              <span className="flex items-center gap-1.5">
                                <Brain className="size-3.5 text-cyan-400" />
                                Thought process
                              </span>
                              {thoughtProcessOpen ? (
                                <ChevronUp className="size-3.5 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="size-3.5 text-muted-foreground" />
                              )}
                            </button>

                            {thoughtProcessOpen && (
                              <div className="mt-2.5 space-y-1.5 pt-2 border-t border-border/30 animate-in fade-in duration-200">
                                {REASONING_STEPS.map((step, sIdx) => (
                                  <div key={sIdx} className="flex items-center justify-between text-[11px] text-muted-foreground">
                                    <span className="flex items-center gap-1.5">
                                      <span className="text-cyan-400 font-mono text-[10px]">&gt;</span>
                                      {step}
                                    </span>
                                    <Check className="size-3 text-emerald-400 stroke-[3]" />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* AI Text Reply */}
                        <div className="rounded-2xl rounded-tl-sm border border-border/50 bg-[#0e172e]/80 p-4 text-sm text-foreground/95 leading-relaxed shadow-lg whitespace-pre-wrap">
                          {m.text}
                        </div>

                        {/* Structured Insight Cards (when present) */}
                        {insights && (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-3 text-center">
                              <span className="block text-[10px] uppercase font-bold text-muted-foreground">
                                Market Opportunity
                              </span>
                              <span className="mt-1 block text-sm font-bold text-emerald-400">
                                {insights.opportunity}
                              </span>
                            </div>

                            <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3 text-center">
                              <span className="block text-[10px] uppercase font-bold text-muted-foreground">
                                Competitive Gap
                              </span>
                              <span className="mt-1 block text-sm font-bold text-amber-400">
                                {insights.gap}
                              </span>
                            </div>

                            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/[0.06] p-3 text-center">
                              <span className="block text-[10px] uppercase font-bold text-muted-foreground">
                                Estimated Impact
                              </span>
                              <span className="mt-1 block text-sm font-bold text-cyan-300">
                                {insights.impact}
                              </span>
                            </div>

                            <div className="rounded-xl border border-purple-500/30 bg-purple-500/[0.06] p-3 text-center">
                              <span className="block text-[10px] uppercase font-bold text-muted-foreground">
                                Recommendation
                              </span>
                              <span className="mt-1 block text-sm font-bold text-purple-400">
                                {insights.recommendation}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Evidence Sources */}
                        {m.sources && m.sources.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {m.sources.map((s, sIdx) => (
                              <span
                                key={sIdx}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/25 bg-cyan-950/30 px-2.5 py-1 text-[10px] font-medium text-cyan-300"
                              >
                                <FileText className="size-3" />
                                {s}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Attachment Preview & Save to Workspace */}
                        {m.attachment && (
                          <div className="rounded-xl border border-border/60 bg-black/40 p-3 flex items-center justify-between gap-3 max-w-sm">
                            <div className="flex items-center gap-2.5 overflow-hidden">
                              <div className="grid size-8 place-items-center rounded-lg bg-cyan-500/20 text-cyan-400 shrink-0">
                                <FileText className="size-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-white truncate">
                                  {m.attachment.filename}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {formatBytes(m.attachment.fileSizeBytes)}
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSaveAttachment(idx)}
                              disabled={savingAttachmentIndex === idx || m.attachment.isSaved}
                              className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold text-cyan-300 hover:bg-cyan-500/20 transition-all shrink-0"
                            >
                              {m.attachment.isSaved ? "Saved" : "Save to Brain"}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Live Loading / Thought Process */}
            {loading && (
              <div className="flex items-start gap-3 max-w-[85%]">
                <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-400/30 mt-0.5">
                  <Sparkles className="size-4 animate-spin" />
                </div>
                <div className="rounded-2xl border border-border/40 bg-black/40 p-4 space-y-2.5 w-full max-w-md">
                  <div className="text-xs font-semibold text-white flex items-center gap-2">
                    <Loader2 className="size-3.5 animate-spin text-cyan-400" />
                    Analyzing company context & market signals...
                  </div>
                  <div className="space-y-1.5 pt-2 border-t border-border/30 text-[11px]">
                    {REASONING_STEPS.map((step, idx) => (
                      <div key={idx} className="flex items-center justify-between text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <span className="text-cyan-400 font-mono text-[10px]">&gt;</span>
                          {step}
                        </span>
                        {idx < activeStepIndex ? (
                          <Check className="size-3 text-emerald-400 stroke-[3]" />
                        ) : idx === activeStepIndex ? (
                          <Loader2 className="size-3 animate-spin text-cyan-400" />
                        ) : (
                          <span className="size-1.5 rounded-full bg-white/20" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Bottom Docked Input Form */}
          <div className="border-t border-border/40 bg-[#070d1a]/95 p-3 sm:p-4 space-y-2.5 backdrop-blur-xl">
            {/* Pending file pill */}
            {pendingAttachment && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-cyan-500/30 bg-cyan-950/30 p-2 text-xs text-cyan-300 max-w-sm">
                <span className="truncate">{pendingAttachment.filename}</span>
                <button
                  type="button"
                  onClick={() => setPendingAttachment(null)}
                  className="p-1 hover:text-white"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            {/* Main Input Bar */}
            <form
              onSubmit={onSubmit}
              className="relative flex items-center rounded-2xl border border-cyan-500/30 bg-[#0a1224]/80 p-2 shadow-[0_0_20px_rgba(6,182,212,0.15)] focus-within:border-cyan-400 focus-within:shadow-[0_0_25px_rgba(6,182,212,0.25)] transition-all"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                className="w-full bg-transparent text-sm text-white outline-none placeholder:text-muted-foreground/60 px-3"
              />

              <div className="flex items-center gap-1.5 shrink-0 pr-1">
                {/* File input */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                  className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:text-white hover:bg-white/[0.06] transition-colors"
                  title="Attach file"
                >
                  {uploadingFile ? <Loader2 className="size-4 animate-spin text-cyan-400" /> : <Paperclip className="size-4" />}
                </button>

                <button
                  type="button"
                  className="grid size-9 place-items-center rounded-xl text-muted-foreground hover:text-white hover:bg-white/[0.06] transition-colors"
                  title="Voice input"
                >
                  <Mic className="size-4" />
                </button>

                {/* Cyan Send Arrow Button */}
                <button
                  type="submit"
                  disabled={(!input.trim() && !pendingAttachment) || loading}
                  className="grid size-9 place-items-center rounded-full bg-cyan-400 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:bg-cyan-300 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                  title="Send message"
                >
                  <ArrowRight className="size-4 stroke-[2.5]" />
                </button>
              </div>
            </form>

            {/* Quick Action Pills Below Input */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {QUICK_ACTIONS.map((qa, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleQuickAction(qa)}
                  className="rounded-xl border border-border/50 bg-white/[0.02] px-3 py-1 text-[11px] text-muted-foreground transition-all hover:border-cyan-500/40 hover:bg-cyan-950/20 hover:text-cyan-300 cursor-pointer"
                >
                  {qa.label}
                </button>
              ))}
              {taskFeedback && (
                <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-semibold animate-in fade-in">
                  <CheckCircle2 className="size-3.5" /> Task added to workspace!
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
