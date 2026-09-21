import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  Brain,
  Building2,
  ChevronDown,
  ChevronUp,
  Command,
  Compass,
  FileText,
  FlaskConical,
  Gauge,
  GitBranch,
  Home,
  Landmark,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  LogOut,
  type LucideIcon,
  Map,
  MessagesSquare,
  MoreHorizontal,
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
import { useState, useMemo, useEffect, type FormEvent } from "react";
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

const PRIMARY_NAV: NavItem[] = [
  { to: "/app", label: "Home", icon: Home },
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/chat", label: "Co-Founder", icon: Bot },
  { to: "/app/simulator", label: "Decision Simulator", icon: Compass },
];

const MORE_NAV_GROUPS: { group: string; items: NavItem[] }[] = [
  {
    group: "Intelligence",
    items: [
      { to: "/app/health", label: "Startup Health", icon: Gauge },
      { to: "/app/opportunities", label: "Opportunities", icon: Lightbulb },
      { to: "/app/research", label: "Market Intelligence", icon: Search },
      { to: "/app/validation", label: "Idea Validation", icon: FlaskConical },
      { to: "/app/competitors", label: "Competitor Research", icon: Swords },
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
      { to: "/app/graph", label: "Company Brain", icon: GitBranch },
    ],
  },
  {
    group: "Decide & Build",
    items: [
      { to: "/app/forecast", label: "Financial Forecast", icon: TrendingUp },
      { to: "/app/runway", label: "Runway", icon: Wallet },
      { to: "/app/roadmap", label: "Roadmap", icon: Map },
      { to: "/app/tasks", label: "Tasks", icon: ListChecks },
    ],
  },
  {
    group: "Raise & Tell",
    items: [
      { to: "/app/documents", label: "Templates & Docs", icon: FileText },
      { to: "/app/deck", label: "Pitch Deck Builder", icon: Presentation },
      { to: "/app/investors", label: "Investor Readiness", icon: Landmark },
      { to: "/app/metrics", label: "Metrics", icon: BarChart3 },
    ],
  },
  {
    group: "Account",
    items: [
      { to: "/app/profile", label: "Founder Profile", icon: User },
      { to: "/app/settings", label: "Settings", icon: Settings },
    ],
  },
];

const ALL_ITEMS = [...PRIMARY_NAV, ...MORE_NAV_GROUPS.flatMap((g) => g.items)];

export function AppShell() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { paletteOpen, setPaletteOpen, assistantOpen, setAssistantOpen, activity, overall, profile } = useOs();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isMoreActive = useMemo(() => {
    return MORE_NAV_GROUPS.some((g) =>
      g.items.some((item) => path === item.to || path.startsWith(item.to + "/"))
    );
  }, [path]);

  const [moreExpanded, setMoreExpanded] = useState(isMoreActive);

  useEffect(() => {
    if (isMoreActive) setMoreExpanded(true);
  }, [isMoreActive]);

  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [path]);

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

  const founderEmail = user?.email || "";

  const avatarUrl =
    profile["avatar_url"] ||
    profile["founder_image"] ||
    profile["profile_image"] ||
    (user as any)?.avatar_url ||
    "";

  const founderInitials = useMemo(() => {
    if (!founderName || !founderName.trim()) return "A";
    const parts = founderName.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  }, [founderName]);

  const companyDisplayName = profile["company_name"] || "Nexora";
  const companyDisplaySubtitle = `${profile["current_stage"] || "Early Stage"} · ${profile["industry"] || "Travel"}`;

  const handleLogout = () => {
    logout();
    navigate({ to: "/auth" });
  };

  const navContent = (onNavClick?: () => void) => (
    <>
      <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-4">
        <div>
          <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">COMMAND</div>
          <div className="space-y-1">
            {PRIMARY_NAV.map((item) => {
              const active = item.to === "/app" ? path === "/app" : path.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={onNavClick}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-all",
                    active
                      ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.15)] font-semibold"
                      : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground border border-transparent"
                  )}
                >
                  <item.icon className={cn("size-4 shrink-0", active ? "text-cyan-400" : "text-muted-foreground")} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="pt-1">
          <button
            onClick={() => setMoreExpanded(!moreExpanded)}
            className={cn(
              "w-full flex items-center justify-between rounded-xl px-3 py-2 text-[13px] font-medium transition-all",
              isMoreActive
                ? "text-cyan-300 bg-cyan-950/30 border border-cyan-500/20"
                : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground border border-transparent"
            )}
          >
            <div className="flex items-center gap-2.5">
              <MoreHorizontal className="size-4 shrink-0 text-muted-foreground" />
              <span>More</span>
            </div>
            {moreExpanded ? <ChevronUp className="size-3.5 text-muted-foreground" /> : <ChevronDown className="size-3.5 text-muted-foreground" />}
          </button>

          {moreExpanded && (
            <div className="mt-2 space-y-4 pl-1 pr-1 animate-in fade-in slide-in-from-top-1 duration-200">
              {MORE_NAV_GROUPS.map((group) => (
                <div key={group.group} className="space-y-0.5">
                  <div className="px-2.5 pb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/50">{group.group}</div>
                  {group.items.map((item) => {
                    const active = path === item.to || path.startsWith(item.to + "/");
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        onClick={onNavClick}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                          active
                            ? "bg-cyan-500/15 text-cyan-300 font-medium border border-cyan-500/30"
                            : "text-muted-foreground/80 hover:bg-white/[0.03] hover:text-foreground"
                        )}
                      >
                        <item.icon className={cn("size-3.5 shrink-0", active && "text-cyan-400")} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </nav>

      <div className="border-t border-border/40 p-3 bg-black/20">
        <Link
          to="/app/workspace"
          onClick={onNavClick}
          className="flex items-center gap-2.5 rounded-xl border border-border/40 bg-white/[0.02] p-2 hover:bg-white/[0.05] hover:border-cyan-500/30 transition-all group cursor-pointer"
        >
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-cyan-950 border border-cyan-500/30 text-cyan-400 text-xs font-bold overflow-hidden">
            {mounted && avatarUrl ? (
              <img src={avatarUrl} alt="Logo" className="size-full object-cover" />
            ) : (
              <span className="text-cyan-300 font-semibold">{mounted ? companyDisplayName.slice(0, 2).toUpperCase() : "NE"}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold text-white group-hover:text-cyan-300 transition-colors">{mounted ? companyDisplayName : "Nexora"}</div>
            <div className="truncate text-[10px] text-muted-foreground">{mounted ? companyDisplaySubtitle : "Early Stage · Travel"}</div>
          </div>
        </Link>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">

      {/* Mobile Backdrop */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setMobileDrawerOpen(false)} />
      )}

      {/* Mobile Slide-In Drawer */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex h-full w-[260px] flex-col border-r border-border/50 bg-[#080d19] transition-transform duration-300 ease-in-out lg:hidden",
        mobileDrawerOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between px-4 py-4 border-b border-border/40">
          <Link to="/app" onClick={() => setMobileDrawerOpen(false)} className="flex items-center gap-3">
            <div className="grid size-8 place-items-center rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-400/30 shadow-[0_0_12px_rgba(6,182,212,0.3)]">
              <Sparkles className="size-3.5" />
            </div>
            <div>
              <span className="block text-sm font-bold tracking-tight text-white">Cofoundr OS</span>
              <span className="block text-[9px] text-muted-foreground/80">Think. Decide. Build. Together.</span>
            </div>
          </Link>
          <button onClick={() => setMobileDrawerOpen(false)} className="grid size-8 place-items-center rounded-xl text-muted-foreground hover:text-white hover:bg-white/[0.05] transition-colors">
            <X className="size-4" />
          </button>
        </div>
        {navContent(() => setMobileDrawerOpen(false))}
      </aside>

      {/* Desktop Left Sidebar */}
      <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col border-r border-border/50 bg-[#080d19] lg:flex z-20">
        <Link to="/app" className="flex items-center gap-3 px-5 py-5 transition-opacity hover:opacity-90">
          <div className="grid size-9 place-items-center rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-400/30 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
            <Sparkles className="size-4" />
          </div>
          <div>
            <span className="block text-sm font-bold tracking-tight text-white">Cofoundr OS</span>
            <span className="block text-[10px] text-muted-foreground/80 tracking-tight">Think. Decide. Build. Together.</span>
          </div>
        </Link>
        {navContent()}
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 sm:gap-4 border-b border-border/40 bg-[#080d19]/85 backdrop-blur-xl px-3 py-2.5 sm:px-4 sm:py-3 lg:px-8">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileDrawerOpen(true)}
            className="lg:hidden grid size-9 shrink-0 place-items-center rounded-xl border border-border/50 bg-surface/50 text-muted-foreground hover:text-white hover:border-cyan-500/30 transition-all"
            aria-label="Open navigation menu"
          >
            <MoreHorizontal className="size-4" />
          </button>

          {/* Search bar */}
          <button
            onClick={() => setPaletteOpen(true)}
            className="flex flex-1 min-w-0 max-w-xs sm:max-w-md items-center gap-2 sm:gap-2.5 rounded-xl border border-border/50 bg-surface/60 px-2.5 sm:px-3.5 py-2 text-left text-xs text-muted-foreground transition-all hover:border-cyan-500/40 hover:bg-surface focus:outline-none"
          >
            <Search className="size-3.5 text-muted-foreground/70 shrink-0" />
            <span className="truncate text-xs hidden sm:inline">Ask anything or search...</span>
            <span className="truncate text-xs sm:hidden">Search...</span>
            <kbd className="ml-auto hidden sm:flex items-center gap-0.5 rounded border border-border/60 bg-black/30 px-1.5 py-0.5 text-[10px] text-muted-foreground shrink-0">
              <Command className="size-2.5" />K
            </kbd>
          </button>

          {/* Right Header Actions */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button
              onClick={() => navigate({ to: "/app/health" })}
              className="relative grid size-9 place-items-center rounded-xl border border-border/50 bg-surface/50 text-muted-foreground hover:text-white hover:border-cyan-500/30 transition-all"
              aria-label="Notifications"
            >
              <Bell className="size-4" />
              <span className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow-[0_0_8px_rgba(239,68,68,0.5)]">3</span>
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-1.5 sm:gap-2.5 rounded-xl border border-border/50 bg-surface/40 p-1.5 sm:pl-2 sm:pr-3 transition-all hover:border-cyan-500/40 hover:bg-surface/70 cursor-pointer focus:outline-none"
                  aria-label="Founder account"
                >
                  <div className="grid size-7 place-items-center rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-xs border border-cyan-400/40 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                    {mounted ? founderInitials : "A"}
                  </div>
                  <div className="hidden sm:block text-left">
                    <div className="text-xs font-semibold text-white leading-tight">{mounted ? founderName : "Alex"}</div>
                    <div className="text-[10px] text-muted-foreground leading-tight">Founder</div>
                  </div>
                  <ChevronDown className="size-3 text-muted-foreground hidden sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 sm:w-56 p-1.5 bg-[#0a101f] border-border/70 shadow-2xl backdrop-blur-xl">
                <div className="px-3 py-2 border-b border-border/40 mb-1">
                  <p className="text-xs font-semibold text-white">{founderName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{founderEmail || companyDisplayName}</p>
                </div>
                <DropdownMenuItem asChild>
                  <Link to="/app/profile" className="flex items-center gap-2 text-xs cursor-pointer rounded-lg px-2.5 py-2 hover:bg-white/[0.05]">
                    <User className="size-3.5 text-muted-foreground" />
                    <span>Founder Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/app/settings" className="flex items-center gap-2 text-xs cursor-pointer rounded-lg px-2.5 py-2 hover:bg-white/[0.05]">
                    <Settings className="size-3.5 text-muted-foreground" />
                    <span>Workspace Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1 bg-border/40" />
                <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 text-xs cursor-pointer rounded-lg px-2.5 py-2 text-red-400 hover:bg-red-500/10 focus:bg-red-500/10">
                  <LogOut className="size-3.5" />
                  <span>Log Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Main Routed Content */}
        <main className="min-w-0 flex-1 px-3 py-4 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] sm:px-5 sm:py-6 lg:px-8 lg:py-8 lg:pb-8">
          <div className="mx-auto max-w-[1240px]">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 flex items-stretch border-t border-border/50 bg-[#080d19]/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom,0px)] lg:hidden">
        {PRIMARY_NAV.map((item) => {
          const active = item.to === "/app" ? path === "/app" : path.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 py-2.5 px-1 transition-colors",
                active ? "text-cyan-400" : "text-muted-foreground/70 hover:text-white"
              )}
            >
              <item.icon className={cn("size-5 shrink-0", active && "drop-shadow-[0_0_8px_rgba(6,182,212,0.7)]")} />
              <span className={cn("text-[9px] font-semibold truncate max-w-full text-center leading-tight", active ? "text-cyan-400" : "text-muted-foreground/60")}>
                {item.label === "Decision Simulator" ? "Simulator" : item.label}
              </span>
            </Link>
          );
        })}
        <button
          onClick={() => setMobileDrawerOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 py-2.5 px-1 text-muted-foreground/70 hover:text-white transition-colors"
        >
          <MoreHorizontal className="size-5 shrink-0" />
          <span className="text-[9px] font-semibold text-muted-foreground/60">More</span>
        </button>
      </nav>

      {paletteOpen ? <CommandPalette onClose={() => setPaletteOpen(false)} /> : null}
      <AssistantDock open={assistantOpen} setOpen={setAssistantOpen} />
    </div>
  );
}

function CommandPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const results = ALL_ITEMS.filter((i) => i.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="fixed inset-0 z-50 grid place-items-start justify-center bg-black/60 pt-[8vh] sm:pt-[12vh] backdrop-blur-sm px-3 sm:px-0" onClick={onClose}>
      <div className="panel w-full sm:w-[min(640px,92vw)] overflow-hidden p-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search screens, ask a question, run a simulation..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hidden sm:inline">esc</kbd>
        </div>
        <div className="max-h-[52vh] overflow-y-auto p-2">
          {results.map((r) => (
            <Link key={r.to} to={r.to} onClick={onClose} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground">
              <r.icon className="size-4" />
              {r.label}
            </Link>
          ))}
          {results.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">No screen matched. Press enter to ask your co-founder instead.</div>
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
      setMsgs((m) => [...m, {
        role: "assistant",
        text: `Retrieved 9 chunks from company memory and 2 live sources. On "${q}": the dominant constraint right now is the post-Jun-14 retention regression. I would sequence the rollback first (86% confidence), then pricing.`,
      }]);
    }, 700);
  }

  return (
    <>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] right-4 z-40 lg:bottom-6 lg:right-6 flex items-center gap-2 rounded-full bg-primary px-3 py-2.5 sm:px-4 sm:py-3 text-sm font-medium text-primary-foreground shadow-[var(--shadow-glow)] transition-transform hover:scale-[1.03]"
        >
          <Sparkles className="size-4" />
          <span className="hidden sm:inline">Ask co-founder</span>
          <kbd className="rounded bg-black/15 px-1 text-[10px] hidden sm:inline">J</kbd>
        </button>
      ) : (
        <div className="panel fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] right-3 z-40 lg:bottom-6 lg:right-6 flex h-[420px] sm:h-[520px] w-[calc(100vw-24px)] sm:w-[min(400px,92vw)] flex-col overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <span className="live-dot size-1.5 rounded-full bg-primary" />
              Co-founder thinking with memory
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {msgs.map((m, i) => (
              <div key={i} className={cn("max-w-[92%] rounded-xl px-3 py-2 text-[13px] leading-relaxed", m.role === "assistant" ? "bg-surface-2 text-foreground" : "ml-auto bg-primary/15 text-foreground")}>
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
