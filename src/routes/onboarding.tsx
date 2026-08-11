import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Edit3,
  Loader2,
  MessageSquare,
  Sparkles,
  User,
  Zap,
  AlertCircle,
  Paperclip,
  FileText,
} from "lucide-react";
import { useOs } from "@/lib/os-store";
import { cn } from "@/lib/utils";
import {
  sendOnboardingChatApi,
  getProfileApi,
  getHistoryApi,
  updateProfileApi,
  uploadDocApi,
} from "@/lib/api-client";
import { completeOnboarding as completeOnboardingApi } from "@/api/onboarding";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Conversational Onboarding — Cofoundr OS" },
      {
        name: "description",
        content: "Chat with your AI co-founder to build a company profile, research your market, and seed company memory.",
      },
      { property: "og:title", content: "Conversational Onboarding — Cofoundr OS" },
      { property: "og:description", content: "Your AI co-founder learns your company through natural conversation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Onboarding,
});

type Message = {
  role: "user" | "assistant";
  text: string;
};

const INITIAL_MESSAGE: Message = {
  role: "assistant",
  text: "Hey there! I'm your AI co-founder in Cofoundr OS. As we talk, I'll analyze your answers in real time and build your company memory profile on the right panel. To start — what are you building, and for whom?",
};

const BUILD_STEPS = [
  "Persisting company profile to MongoDB",
  "Researching market & competitors",
  "Validating the business model against 7 criteria",
  "Generating a stage-aware roadmap",
  "Building the 18-month financial model",
  "Seeding persistent company memory & vector graph",
];

const SUGGESTIONS = [
  "Nexora is an AI travel planner for budget college students",
  "We've built an MVP and surveyed 150 students",
  "What did you understand so far?",
];

type ProfileState = {
  company_name: string;
  one_line_pitch: string;
  description: string;
  industry: string;
  problem_statement: string;
  solution: string;
  product: string;
  target_customer: string;
  business_model: string;
  revenue_model: string;
  current_stage: string;
  team_size: string;
  founders: string[];
  location: string;
  website: string;
  current_progress: string;
  validation_done: boolean;
  validation_details: string;
  customer_interviews: string;
  survey_details: string;
  traction: string;
  competitors: string[];
  current_challenges: string[];
  short_term_goals: string[];
  long_term_vision: string;
  uploaded_documents: string[];
  missing_information: string[];
  profile_completeness: number;
};

const INITIAL_PROFILE: ProfileState = {
  company_name: "",
  one_line_pitch: "",
  description: "",
  industry: "",
  problem_statement: "",
  solution: "",
  product: "",
  target_customer: "",
  business_model: "",
  revenue_model: "",
  current_stage: "",
  team_size: "",
  founders: [],
  location: "",
  website: "",
  current_progress: "",
  validation_done: false,
  validation_details: "",
  customer_interviews: "",
  survey_details: "",
  traction: "",
  competitors: [],
  current_challenges: [],
  short_term_goals: [],
  long_term_vision: "",
  uploaded_documents: [],
  missing_information: [],
  profile_completeness: 0,
};

function Onboarding() {
  const navigate = useNavigate();
  const { completeOnboarding } = useOs();

  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [doneSteps, setDoneSteps] = useState(0);

  // Live Company Profile State (Editable on Right Panel)
  const [profile, setProfile] = useState<ProfileState>(INITIAL_PROFILE);
  const [lastExtractedTime, setLastExtractedTime] = useState<string | null>(null);

  // Structured response data from Gemini
  const [confidenceScore, setConfidenceScore] = useState(0);
  const [missingInformation, setMissingInformation] = useState<string[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load session data & profile from MongoDB on mount (resume behavior)
  useEffect(() => {
    async function loadInitialData() {
      try {
        const fetchedProfile = await getProfileApi();
        if (fetchedProfile) {
          setProfile((prev) => ({
            ...prev,
            ...fetchedProfile,
            founders: Array.isArray(fetchedProfile.founders) ? fetchedProfile.founders : [],
            competitors: Array.isArray(fetchedProfile.competitors) ? fetchedProfile.competitors : [],
            current_challenges: Array.isArray(fetchedProfile.current_challenges) ? fetchedProfile.current_challenges : [],
            short_term_goals: Array.isArray(fetchedProfile.short_term_goals) ? fetchedProfile.short_term_goals : [],
            uploaded_documents: Array.isArray(fetchedProfile.uploaded_documents) ? fetchedProfile.uploaded_documents : [],
          }));
          if (typeof fetchedProfile.profile_completeness === "number") {
            setConfidenceScore(fetchedProfile.profile_completeness);
          }
          if (Array.isArray(fetchedProfile.missing_information)) {
            setMissingInformation(fetchedProfile.missing_information);
          }
        }

        const history = await getHistoryApi();
        if (history && Array.isArray(history.messages) && history.messages.length > 0) {
          setMessages(
            history.messages.map((m: any) => ({
              role: m.role === "user" ? "user" : "assistant",
              text: m.content,
            }))
          );
        }
      } catch (err) {
        console.warn("[onboarding] Previous session load notice (unauthenticated or first session):", err);
      }
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function handleSend(textToSend?: string) {
    const userText = (textToSend || draft).trim();
    if (!userText || loading) return;
    setDraft("");

    const newMessages: Message[] = [...messages, { role: "user", text: userText }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const result = await sendOnboardingChatApi(userText);

      const updatedMessages: Message[] = [
        ...newMessages,
        { role: "assistant", text: result.assistant_reply },
      ];
      setMessages(updatedMessages);

      if (result.profile) {
        setProfile((prev) => ({
          ...prev,
          ...result.profile,
          founders: Array.isArray(result.profile["founders"]) ? result.profile["founders"] : [],
          competitors: Array.isArray(result.profile["competitors"]) ? result.profile["competitors"] : [],
          current_challenges: Array.isArray(result.profile["current_challenges"]) ? result.profile["current_challenges"] : [],
          short_term_goals: Array.isArray(result.profile["short_term_goals"]) ? result.profile["short_term_goals"] : [],
          uploaded_documents: Array.isArray(result.profile["uploaded_documents"]) ? result.profile["uploaded_documents"] : [],
        }));
        setLastExtractedTime("Just now");
      }

      if (typeof result.completeness_score === "number") {
        setConfidenceScore(result.completeness_score);
      }
      if (Array.isArray(result.missing_information)) {
        setMissingInformation(result.missing_information);
      }
    } catch (error) {
      console.error("Onboarding chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "I couldn't process that message right now. Your previous company information is safe. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || uploading) return;

    setUploading(true);
    setMessages((prev) => [
      ...prev,
      { role: "user", text: `[Uploaded Document: ${file.name}]` },
    ]);

    try {
      const result = await uploadDocApi(file);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: result.assistant_reply },
      ]);
      if (result.profile) {
        setProfile((prev) => ({
          ...prev,
          ...result.profile,
          uploaded_documents: Array.isArray(result.profile["uploaded_documents"])
            ? result.profile["uploaded_documents"]
            : [...prev.uploaded_documents, file.name],
        }));
        setLastExtractedTime("Just now");
      }
      if (typeof result.completeness_score === "number") {
        setConfidenceScore(result.completeness_score);
      }
    } catch (err: any) {
      console.error("Doc upload error:", err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `Failed to extract content from ${file.name}. Please ensure it is a PDF, DOCX, TXT, or MD file.`,
        },
      ]);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleProfileChange(key: keyof ProfileState, value: any) {
    const updated = { ...profile, [key]: value };
    setProfile(updated);
    try {
      const res = await updateProfileApi({ [key]: value });
      if (res && typeof res.profile_completeness === "number") {
        setConfidenceScore(res.profile_completeness);
      }
    } catch (err) {
      console.warn("Could not save manual edit to server:", err);
    }
  }

  async function finalizeOnboarding() {
    setBuilding(true);
    const targetProfile = profile as unknown as Record<string, string>;

    try {
      await completeOnboardingApi({
        data: {
          conversationId: "conv-" + Date.now(),
          profile: targetProfile,
        },
      });
    } catch (error) {
      console.warn("Could not complete onboarding via server API:", error);
    }

    completeOnboarding(targetProfile);

    BUILD_STEPS.forEach((_, i) => {
      setTimeout(() => setDoneSteps(i + 1), 700 * (i + 1));
    });

    setTimeout(() => {
      navigate({ to: "/app" });
    }, 700 * BUILD_STEPS.length + 900);
  }

  return (
    <div className="aurora min-h-screen px-4 py-6 md:py-8">
      <div className="mx-auto max-w-7xl">
        {/* Top Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary shadow-glow">
              <Sparkles className="size-5" />
            </span>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Conversational Onboarding</h1>
              <p className="text-xs text-muted-foreground">
                Your AI co-founder listens, understands, and extracts your company memory in real time.
              </p>
            </div>
          </div>
          {!building ? (
            <button
              onClick={() => finalizeOnboarding()}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow hover:scale-[1.02] transition-all"
            >
              Complete Onboarding & Build OS <ArrowRight className="size-3.5" />
            </button>
          ) : null}
        </div>

        {!building ? (
          <div className="grid gap-6 lg:grid-cols-12">
            {/* LEFT COLUMN: Real-Time Chat (7 cols) */}
            <div className="lg:col-span-7">
              <div className="panel flex h-[620px] flex-col p-0 shadow-lg border border-border/70">
                <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 bg-surface/50">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <span className="live-dot size-2 rounded-full bg-primary" />
                    AI Co-Founder Chat
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Grounded in real-time LLM reasoning
                  </span>
                </div>

                {/* Chat Messages */}
                <div className="flex-1 space-y-4 overflow-y-auto p-4 md:p-5">
                  {messages.map((m, i) => (
                    <div key={i} className={cn("flex gap-2.5", m.role === "user" && "justify-end")}>
                      {m.role === "assistant" ? (
                        <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary mt-0.5">
                          <Bot className="size-4" />
                        </div>
                      ) : null}
                      <div className={cn("max-w-[82%]", m.role === "user" && "text-right")}>
                        {m.role === "assistant" ? (
                          <div className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-widest text-primary font-semibold">
                            AI Co-Founder
                          </div>
                        ) : null}
                        <div
                          className={cn(
                            "rounded-2xl px-4 py-3 text-[14px] leading-relaxed transition-all whitespace-pre-wrap",
                            m.role === "assistant"
                              ? "bg-surface-2 text-foreground border border-border/50 shadow-sm"
                              : "bg-primary text-primary-foreground font-medium shadow-sm",
                          )}
                        >
                          {m.text}
                        </div>
                      </div>
                      {m.role === "user" ? (
                        <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground mt-0.5">
                          <User className="size-4" />
                        </div>
                      ) : null}
                    </div>
                  ))}

                  {loading || uploading ? (
                    <div className="flex items-center gap-2.5 p-2 text-xs text-muted-foreground">
                      <div className="grid size-7 place-items-center rounded-lg bg-primary/15 text-primary">
                        <Bot className="size-4" />
                      </div>
                      <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 border border-border/40">
                        <Loader2 className="size-3.5 animate-spin text-primary" />
                        <span>
                          {uploading
                            ? "Parsing document and extracting startup profile..."
                            : "AI co-founder is analyzing your input & extracting profile data…"}
                        </span>
                      </div>
                    </div>
                  ) : null}
                  <div ref={chatEndRef} />
                </div>

                {/* Chat Input */}
                <div className="border-t border-border/60 bg-surface/40 p-3.5 backdrop-blur-sm">
                  {/* Quick suggestion pills */}
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSend(s)}
                        className="rounded-full border border-border bg-surface-2 px-3 py-1 text-[11px] text-muted-foreground hover:border-primary/50 hover:text-foreground transition-all active:scale-95"
                      >
                        💡 {s}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2 px-3 py-2 focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30 transition-all">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      title="Upload PDF, DOCX, TXT, or MD document"
                      className="grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-surface hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-all"
                    >
                      <Paperclip className="size-4" />
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept=".pdf,.docx,.doc,.txt,.md"
                      className="hidden"
                    />

                    <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                    <textarea
                      rows={2}
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Talk naturally — tell your co-founder about your idea, stage, goals, or upload a PRD/deck..."
                      className="w-full resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                    <button
                      onClick={() => handleSend()}
                      disabled={!draft.trim() || loading || uploading}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-[13px] font-medium text-primary-foreground disabled:opacity-50 hover:bg-primary/90 transition-all shrink-0"
                    >
                      Send <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Live Company Profile Inspector (5 cols) */}
            <div className="lg:col-span-5">
              <div className="panel flex h-[620px] flex-col p-0 shadow-lg border border-border/70">
                {/* Panel Header */}
                <div className="border-b border-border/60 p-4 bg-surface/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Zap className="size-4 text-primary" />
                      Live Company Profile
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      <span className="live-dot size-1.5 rounded-full bg-primary" />
                      {lastExtractedTime ? `Extracted ${lastExtractedTime}` : "Extracting in real time"}
                    </span>
                  </div>

                  {/* Completeness Bar — driven by weighted profile completeness */}
                  <div className="mt-3">
                    <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                      <span>Profile Completeness</span>
                      <span className="font-semibold text-primary">{confidenceScore}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${confidenceScore}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Editable Profile Fields */}
                <div className="flex-1 space-y-4 overflow-y-auto p-4 text-xs">
                  <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    <Edit3 className="size-3 text-primary" /> Click any field to edit manually
                  </div>

                  <div className="space-y-3">
                    {/* Company Name */}
                    <div>
                      <label className="mb-1 block font-medium text-muted-foreground">Company Name</label>
                      <input
                        value={profile.company_name || ""}
                        onChange={(e) => handleProfileChange("company_name", e.target.value)}
                        placeholder="e.g. Nexora"
                        className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs font-medium outline-none focus:border-primary/50"
                      />
                    </div>

                    {/* Product */}
                    <div>
                      <label className="mb-1 block font-medium text-muted-foreground">Product</label>
                      <input
                        value={profile.product || ""}
                        onChange={(e) => handleProfileChange("product", e.target.value)}
                        placeholder="e.g. AI Travel Planner SaaS"
                        className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs outline-none focus:border-primary/50"
                      />
                    </div>

                    {/* Grid: Industry + Stage */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="mb-1 block font-medium text-muted-foreground">Industry</label>
                        <input
                          value={profile.industry || ""}
                          onChange={(e) => handleProfileChange("industry", e.target.value)}
                          placeholder="e.g. Travel Tech"
                          className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs outline-none focus:border-primary/50"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block font-medium text-muted-foreground">Current Stage</label>
                        <input
                          value={profile.current_stage || ""}
                          onChange={(e) => handleProfileChange("current_stage", e.target.value)}
                          placeholder="Idea / MVP / Revenue"
                          className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs outline-none focus:border-primary/50"
                        />
                      </div>
                    </div>

                    {/* Target Customer (ICP) */}
                    <div>
                      <label className="mb-1 block font-medium text-muted-foreground">Target Customer (ICP)</label>
                      <input
                        value={profile.target_customer || ""}
                        onChange={(e) => handleProfileChange("target_customer", e.target.value)}
                        placeholder="e.g. College students travelling on a budget"
                        className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs outline-none focus:border-primary/50"
                      />
                    </div>

                    {/* Core Problem */}
                    <div>
                      <label className="mb-1 block font-medium text-muted-foreground">Core Problem</label>
                      <textarea
                        rows={2}
                        value={profile.problem_statement || ""}
                        onChange={(e) => handleProfileChange("problem_statement", e.target.value)}
                        placeholder="What pain point are you solving?"
                        className="w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs outline-none focus:border-primary/50"
                      />
                    </div>

                    {/* Solution */}
                    <div>
                      <label className="mb-1 block font-medium text-muted-foreground">Solution</label>
                      <textarea
                        rows={2}
                        value={profile.solution || ""}
                        onChange={(e) => handleProfileChange("solution", e.target.value)}
                        placeholder="How does your product solve it?"
                        className="w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs outline-none focus:border-primary/50"
                      />
                    </div>

                    {/* Business Model */}
                    <div>
                      <label className="mb-1 block font-medium text-muted-foreground">Business Model</label>
                      <input
                        value={profile.business_model || ""}
                        onChange={(e) => handleProfileChange("business_model", e.target.value)}
                        placeholder="e.g. Freemium SaaS, Subscription"
                        className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs outline-none focus:border-primary/50"
                      />
                    </div>

                    {/* Validation & Surveys */}
                    <div>
                      <label className="mb-1 block font-medium text-muted-foreground">Validation & Research</label>
                      <input
                        value={profile.survey_details || profile.validation_details || ""}
                        onChange={(e) => handleProfileChange("survey_details", e.target.value)}
                        placeholder="e.g. Surveyed 150 college students"
                        className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs outline-none focus:border-primary/50"
                      />
                    </div>

                    {/* Uploaded Documents */}
                    {profile.uploaded_documents && profile.uploaded_documents.length > 0 ? (
                      <div className="rounded-xl border border-border/80 bg-surface-2 p-2.5">
                        <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                          <FileText className="size-3 text-primary" /> Uploaded Documents ({profile.uploaded_documents.length})
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {profile.uploaded_documents.map((doc) => (
                            <span key={doc} className="rounded bg-surface px-2 py-0.5 text-[10px] border border-border text-foreground font-mono">
                              📄 {doc}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {/* Missing Information Panel */}
                    {missingInformation.length > 0 ? (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 uppercase tracking-wider mb-2">
                          <AlertCircle className="size-3" />
                          Still needed
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {missingInformation.map((item) => (
                            <span
                              key={item}
                              className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-medium text-amber-300 capitalize"
                            >
                              {item.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="border-t border-border/60 p-3 bg-surface/50">
                  <button
                    onClick={() => finalizeOnboarding()}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground shadow-glow hover:bg-primary/90 transition-all"
                  >
                    <CheckCircle2 className="size-4" /> Save Profile & Launch Workspace
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Building Workspace Screen */
          <div className="panel max-w-xl mx-auto p-8 shadow-xl text-center">
            <h2 className="text-xl font-semibold tracking-tight">Your AI Co-Founder is getting to work</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Initializing your company profile in MongoDB, seeding vector memory, and building your workspace.
            </p>
            <div className="mt-8 space-y-3 text-left">
              {BUILD_STEPS.map((s, i) => {
                const done = i < doneSteps;
                const active = i === doneSteps;
                return (
                  <div
                    key={s}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border border-border px-4 py-3 text-sm transition-colors",
                      done && "border-primary/30 bg-primary/5 text-foreground font-medium",
                      active && "shimmer border-primary/50 text-foreground font-medium",
                    )}
                  >
                    {done ? (
                      <Check className="size-4 text-primary shrink-0" />
                    ) : active ? (
                      <Loader2 className="size-4 animate-spin text-primary shrink-0" />
                    ) : (
                      <span className="size-4 rounded-full border border-border shrink-0" />
                    )}
                    <span className={cn(!done && !active && "text-muted-foreground")}>{s}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


