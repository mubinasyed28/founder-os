import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Brain,
  Building2,
  Command,
  Compass,
  FileText,
  FlaskConical,
  Gauge,
  GitBranch,
  Landmark,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  LogOut,
  type LucideIcon,
  Map,
  MessagesSquare,
  Presentation,
  Search,
  Settings,
  Sparkles,
  Swords,
  Timer,
  TrendingUp,
  User,
  Wallet,
  X,
} from "lucide-react";
import { useState, useMemo, type FormEvent } from "react";
import { company } from "@/lib/company-data";
import { useAuth } from "@/lib/auth-context";
import { useOs } from "@/lib/os-store";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = { to: string; label: string; icon: LucideIcon };

const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: "Command",
    items: [
      { to: "/app", label: "Dashboard", icon: LayoutDashboard },
      { to: "/app/chat", label: "Co-Founder Chat", icon: MessagesSquare },
      { to: "/app/health", label: "Startup Health", icon: Gauge },
      { to: "/app/opportunities", label: "Opportunities", icon: Lightbulb },
    ],
  },
  {
    group: "Intelligence",
    items: [
      { to: "/app/research", label: "Research Center", icon: Search },
      { to: "/app/validation", label: "Idea Validation", icon: FlaskConical },
      { to: "/app/competitors", label: "Competitor Intel", icon: Swords },
      { to: "/app/reasoning", label: "Reasoning Pipeline", icon: Brain },
      { to: "/app/agents", label: "Agent Network", icon: Bot },
      { to: "/app/learning", label: "Continuous Learning", icon: Activity },
    ],
  },
  {
    group: "Memory",
    items: [
      { to: "/app/workspace", label: "Company Workspace", icon: Building2 },
      { to: "/app/knowledge", label: "Knowledge Base", icon: BookOpen },
      { to: "/app/timeline", label: "Memory Timeline", icon: Timer },
      { to: "/app/graph", label: "Knowledge Graph", icon: GitBranch },
    ],
  },
  {
    group: "Decide & Build",
    items: [
      { to: "/app/simulator", label: "Decision Simulator", icon: Compass },
      { to: "/app/forecast", label: "Financial Forecast", icon: TrendingUp },
      { to: "/app/runway", label: "Runway", icon: Wallet },
      { to: "/app/roadmap", label: "Roadmap", icon: Map },
      { to: "/app/tasks", label: "Tasks", icon: ListChecks },
    ],
  },
  {
    group: "Raise & Tell",
    items: [
      { to: "/app/documents", label: "Document Generator", icon: FileText },
      { to: "/app/deck", label: "Pitch Deck Builder", icon: Presentation },
      { to: "/app/investors", label: "Investor Readiness", icon: Landmark },
      { to: "/app/metrics", label: "Metrics", icon: BarChart3 },
    ],
  },
  {
    group: "Account",
    items: [
      { to: "/app/profile", label: "Profile", icon: User },
      { to: "/app/settings", label: "Settings", icon: Settings },
    ],
  },
];

const ALL_ITEMS = NAV.flatMap((g) => g.items);

export function AppShell() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { paletteOpen, setPaletteOpen, assistantOpen, setAssistantOpen, activity, overall, profile } = useOs();

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

  const founderEmail = user?.email || "";

  const avatarUrl =
    profile["avatar_url"] ||
    profile["founder_image"] ||
    profile["profile_image"] ||
    (user as any)?.avatar_url ||
    "";

  const founderInitials = useMemo(() => {
    if (!founderName || !founderName.trim()) return "MK";
    const parts = founderName.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    if (parts[0].length >= 2) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return parts[0].slice(0, 1).toUpperCase();
  }, [founderName]);

  const handleLogout = () => {
    logout();
    navigate({ to: "/auth" });
  };

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <Link to="/app" className="flex items-center gap-2.5 px-5 py-5">
          <span className="grid size-8 place-items-center rounded-xl bg-primary/15 text-primary glow-ring">
            <Sparkles className="size-4" />
          </span>
          <span>
            <span className="block text-sm font-semibold tracking-tight">Cofoundr OS</span>
            <span className="block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {company.name}
            </span>
          </span>
        </Link>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {NAV.map((group) => (
            <div key={group.group} className="mb-4">
              <div className="px-2 pb-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
                {group.group}
              </div>
              {group.items.map((item) => {
                const active = item.to === "/app" ? path === "/app" : path.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "mb-0.5 flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                    )}
                  >
                    <item.icon className={cn("size-4", active && "text-primary")} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="rounded-xl bg-surface-2 p-3">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Startup score</span>
              <span className="font-semibold text-primary tabular-nums">{overall}</span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${overall}%` }} />
            </div>
            <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="live-dot inline-block size-1.5 rounded-full bg-primary" />
              10 agents online
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border glass px-4 py-3 lg:px-8">
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex w-full max-w-md items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-left text-[13px] text-muted-foreground transition-colors hover:border-primary/40"
          >
            <Search className="size-3.5" />
            Ask your co-founder or jump anywhere…
            <kbd className="ml-auto flex items-center gap-0.5 rounded border border-border px-1.5 py-0.5 text-[10px]">
              <Command className="size-2.5" />K
            </kbd>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-[11px] text-muted-foreground md:flex">
              <span className="live-dot inline-block size-1.5 rounded-full bg-primary" />
              {activity[0]?.agent} {activity[0]?.text.slice(0, 42)}…
            </div>
            <button className="relative grid size-8 place-items-center rounded-lg border border-border bg-surface-2 text-muted-foreground hover:text-foreground">
              <Bell className="size-4" />
              <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-primary" />
            </button>

            {/* Dynamic Founder Avatar / Initials & Logout Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="group relative flex size-8 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-2 transition-all hover:border-primary/50 hover:shadow-sm focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  title={`${founderName} (${avatarUrl ? "Photo active" : "Initials"})`}
                  aria-label="Founder profile & account menu"
                >
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={founderName}
                      className="size-full object-cover transition-transform duration-300 group-hover:scale-110"
                    />
                  ) : (
                    <div className="grid size-full place-items-center bg-primary/15 text-[11px] font-semibold text-primary transition-colors group-hover:bg-primary/25">
                      {founderInitials}
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 p-1.5 glass border-border/80 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center gap-2.5 px-2.5 py-2 border-b border-border/60 mb-1">
                  <div className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/15 text-xs font-bold text-primary border border-primary/25 shadow-inner">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={founderName} className="size-full object-cover" />
                    ) : (
                      founderInitials
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground flex items-center gap-1.5">
                      {founderName}
                      <span className="inline-block size-1.5 rounded-full bg-primary" title="Active Founder" />
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {founderEmail || (profile["company_name"] ? `CEO · ${profile["company_name"]}` : "Co-founder & CEO")}
                    </p>
                  </div>
                </div>

                <DropdownMenuItem asChild>
                  <Link
                    to="/app/profile"
                    className="flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-lg cursor-pointer hover:bg-surface-2 transition-colors"
                  >
                    <User className="size-3.5 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="font-medium text-foreground">Founder Profile</div>
                      <div className="text-[10px] text-muted-foreground">Change photo & identity</div>
                    </div>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem asChild>
                  <Link
                    to="/app/settings"
                    className="flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-lg cursor-pointer hover:bg-surface-2 transition-colors"
                  >
                    <Settings className="size-3.5 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="font-medium text-foreground">Workspace Settings</div>
                      <div className="text-[10px] text-muted-foreground">Preferences & agents</div>
                    </div>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="my-1 bg-border/60" />

                <DropdownMenuItem
                  onClick={handleLogout}
                  className="flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-lg cursor-pointer text-destructive focus:text-destructive hover:bg-destructive/10 focus:bg-destructive/10 transition-colors"
                >
                  <LogOut className="size-3.5" />
                  <div className="flex-1">
                    <div className="font-semibold">Log Out</div>
                    <div className="text-[10px] text-destructive/80">End session & clear tokens</div>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-8 lg:px-8">
          <div className="mx-auto max-w-[1180px]">
            <Outlet />
          </div>
        </main>
      </div>

      {paletteOpen ? <CommandPalette onClose={() => setPaletteOpen(false)} /> : null}
      <AssistantDock open={assistantOpen} setOpen={setAssistantOpen} />
    </div>
  );
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const results = ALL_ITEMS.filter((i) => i.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fixed inset-0 z-50 grid place-items-start justify-center bg-black/60 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <div
        className="panel w-[min(640px,92vw)] overflow-hidden p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search screens, ask a question, run a simulation…"
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">esc</kbd>
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-2">
          {results.map((r) => (
            <Link
              key={r.to}
              to={r.to}
              onClick={onClose}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <r.icon className="size-4" />
              {r.label}
            </Link>
          ))}
          {results.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No screen matched. Press enter to ask your co-founder instead.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AssistantDock({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const { pushActivity } = useOs();
  const [msgs, setMsgs] = useState([
    { role: "assistant", text: "I'm watching 6 metrics and 6 competitors. Ask me anything about the company." },
  ]);
  const [input, setInput] = useState("");

  function send(e: FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const q = input.trim();
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: q }]);
    pushActivity("Memory Agent", "retrieved 9 context chunks for a founder question");
    setTimeout(() => {
      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          text: `Retrieved 9 chunks from company memory and 2 live sources. On "${q}": the dominant constraint right now is the post-Jun-14 retention regression — it suppresses Product score, weakens diligence, and delays the price test. I'd sequence the rollback first (86% confidence), then pricing.`,
        },
      ]);
    }, 700);
  }

  return (
    <>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:scale-[1.03]"
        >
          <Sparkles className="size-4" />
          Ask co-founder
          <kbd className="rounded bg-black/15 px-1 text-[10px]">⌘J</kbd>
        </button>
      ) : (
        <div className="panel fixed bottom-6 right-6 z-40 flex h-[520px] w-[min(400px,92vw)] flex-col overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="live-dot size-1.5 rounded-full bg-primary" />
              Co-founder · thinking with memory
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={cn(
                  "max-w-[92%] rounded-xl px-3 py-2 text-[13px] leading-relaxed",
                  m.role === "assistant"
                    ? "bg-surface-2 text-foreground"
                    : "ml-auto bg-primary/15 text-foreground",
                )}
              >
                {m.text}
              </div>
            ))}
          </div>
          <form onSubmit={send} className="border-t border-border p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What should I focus on today?"
              className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none focus:border-primary/50"
            />
          </form>
        </div>
      )}
    </>
  );
}
