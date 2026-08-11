import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "./auth-context";
import {
  healthMetrics as baseMetrics,
  notifications as baseNotifications,
  tasks as baseTasks,
  overallScore as baseOverall,
} from "./company-data";

type ActivityItem = { id: string; agent: string; text: string; time: string };
type TaskItem = (typeof baseTasks)[number];

type OsState = {
  companyId: string | null;
  setCompanyId: (id: string) => void;
  onboarded: boolean;
  completeOnboarding: (profile: Record<string, string>, companyId?: string) => void;
  updateProfile: (updates: Record<string, string>) => Promise<void>;
  profile: Record<string, string>;
  tasks: TaskItem[];
  toggleTask: (id: string) => void;
  addTask: (title: string, from: string) => void;
  acceptedRecs: string[];
  acceptRec: (id: string, title: string) => void;
  scoreBoost: number;
  metrics: any[];
  overall: number;
  activity: ActivityItem[];
  pushActivity: (agent: string, text: string) => void;
  notifications: typeof baseNotifications;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
  assistantOpen: boolean;
  setAssistantOpen: (v: boolean) => void;
  healthReport: any;
  refreshHealth: () => Promise<void>;
};

const OsContext = createContext<OsState | null>(null);

const AGENT_TICKS = [
  ["Research Agent", "indexed 3 new sources on tier-2 student spend"],
  ["Memory Agent", "linked interview note #34 to the activation node"],
  ["Critic Agent", "challenged the ₹699 elasticity assumption"],
  ["Browser Agent", "re-checked StudyOS pricing page — unchanged"],
  ["Forecasting Agent", "refreshed the 18-month runway projection"],
  ["Strategy Agent", "re-scored the auto re-plan wedge: 88% confidence"],
  ["Execution Agent", "queued a follow-up on the data room gap"],
];

export function OsProvider({ children }: { children: ReactNode }) {
  const [companyId, setCompanyIdState] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("cofoundr_companyId");
    }
    return null;
  });
  const [onboarded, setOnboarded] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return !!localStorage.getItem("cofoundr_onboarded");
    }
    return true;
  });
  const [profile, setProfile] = useState<Record<string, string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("cofoundr_profile");
        return saved ? JSON.parse(saved) : {};
      } catch {
        return {};
      }
    }
    return {};
  });
  const [healthReport, setHealthReport] = useState<any>(null);

  const setCompanyId = useCallback((id: string) => {
    setCompanyIdState(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("cofoundr_companyId", id);
    }
  }, []);
  const [tasks, setTasks] = useState<TaskItem[]>(baseTasks);
  const [acceptedRecs, setAcceptedRecs] = useState<string[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [activity, setActivity] = useState<ActivityItem[]>([
    { id: "a0", agent: "Critic Agent", text: "confirmed retention regression traced to onboarding v2", time: "now" },
    { id: "a1", agent: "Research Agent", text: "verified 4 of 9 live sources on pricing elasticity", time: "1m" },
    { id: "a2", agent: "Financial Agent", text: "runway recomputed: 11.8 months", time: "4m" },
  ]);

  const pushActivity = useCallback((agent: string, text: string) => {
    setActivity((prev) => [{ id: crypto.randomUUID(), agent, text, time: "now" }, ...prev].slice(0, 24));
  }, []);

  const { user } = useAuth();

  const refreshHealth = useCallback(async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("cofoundr_token") : null;
    if (token) {
      try {
        const { getHealthReportApi } = await import("./api-client");
        const report = await getHealthReportApi();
        setHealthReport(report);
      } catch (err) {
        console.warn("Failed to load health report from backend:", err);
      }
    }
  }, []);

  useEffect(() => {
    async function loadServerProfile() {
      const token = typeof window !== "undefined" ? localStorage.getItem("cofoundr_token") : null;
      if (token && user) {
        try {
          const { getProfileApi } = await import("./api-client");
          const serverProfile = await getProfileApi();
          if (serverProfile) {
            setProfile((prev) => {
              const next = { ...prev, ...serverProfile };
              if (typeof window !== "undefined") {
                localStorage.setItem("cofoundr_profile", JSON.stringify(next));
              }
              return next;
            });
          }
          await refreshHealth();
        } catch (err) {
          console.warn("Failed to load profile from server:", err);
        }
      } else if (!user) {
        // Clear profile if user logs out
        setProfile({});
        setHealthReport(null);
        if (typeof window !== "undefined") {
          localStorage.removeItem("cofoundr_profile");
        }
      }
    }
    loadServerProfile();
  }, [user, refreshHealth]);

  useEffect(() => {
    const t = setInterval(() => {
      const pick = AGENT_TICKS[Math.floor(Math.random() * AGENT_TICKS.length)]!;
      pushActivity(pick[0]!, pick[1]!);
    }, 9000);
    return () => clearInterval(t);
  }, [pushActivity]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setAssistantOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleTask = useCallback((id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }, []);

  const addTask = useCallback(
    (title: string, from: string) => {
      setTasks((prev) => [
        { id: `T-${100 + prev.length}`, title, from, priority: "P1", due: "Aug 20", done: false },
        ...prev,
      ]);
      pushActivity("Execution Agent", `created task "${title}"`);
    },
    [pushActivity],
  );

  const acceptRec = useCallback(
    (id: string, title: string) => {
      setAcceptedRecs((prev) => (prev.includes(id) ? prev : [...prev, id]));
      addTask(title, id);
      pushActivity("Memory Agent", `wrote decision node for ${id} and updated the knowledge graph`);
    },
    [addTask, pushActivity],
  );

  const completeOnboarding = useCallback(
    (p: Record<string, string>, cId?: string) => {
      setProfile(p);
      setOnboarded(true);
      if (cId) {
        setCompanyIdState(cId);
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("cofoundr_profile", JSON.stringify(p));
        localStorage.setItem("cofoundr_onboarded", "true");
        if (cId) {
          localStorage.setItem("cofoundr_companyId", cId);
        }
      }
      pushActivity("Memory Agent", "created the company profile from onboarding");

      const token = typeof window !== "undefined" ? localStorage.getItem("cofoundr_token") : null;
      if (token) {
        import("./api-client").then(async ({ updateProfileApi, recalculateHealthApi }) => {
          try {
            await updateProfileApi(p);
            const report = await recalculateHealthApi();
            setHealthReport(report);
          } catch (err) {
            console.warn("Failed to persist final onboarding profile to backend:", err);
          }
        });
      }
    },
    [pushActivity],
  );

  const updateProfile = useCallback(
    async (updates: Record<string, string>) => {
      setProfile((prev) => {
        const next = { ...prev, ...updates };
        if (typeof window !== "undefined") {
          localStorage.setItem("cofoundr_profile", JSON.stringify(next));
        }
        return next;
      });

      const token = typeof window !== "undefined" ? localStorage.getItem("cofoundr_token") : null;
      if (token) {
        try {
          const { updateProfileApi, recalculateHealthApi } = await import("./api-client");
          await updateProfileApi(updates);
          pushActivity("Memory Agent", "persisted updated profile details to database");
          
          // Recalculate health
          const report = await recalculateHealthApi();
          setHealthReport(report);
        } catch (err) {
          console.warn("Failed to persist profile updates to server:", err);
        }
      } else {
        pushActivity("Memory Agent", "saved profile updates to local session storage");
      }
    },
    [pushActivity],
  );

  const scoreBoost = acceptedRecs.length * 2;

  const metrics = useMemo(() => {
    if (!healthReport || !healthReport.components || healthReport.components.length === 0) {
      return baseMetrics.map((m) => ({ ...m, score: Math.min(99, m.score + scoreBoost) }));
    }
    
    return healthReport.components.map((c: any) => {
      let key = "business";
      if (c.name.toLowerCase().includes("product")) key = "product";
      else if (c.name.toLowerCase().includes("customer")) key = "customer";
      else if (c.name.toLowerCase().includes("market")) key = "market";
      else if (c.name.toLowerCase().includes("competition")) key = "competition";
      
      const drivers = c.found_info.map((info: string) => ({
        label: info,
        value: "Found",
        good: true
      })).concat(c.missing_info.map((info: string) => ({
        label: info,
        value: "Missing",
        good: false
      })));

      return {
        key,
        label: c.name,
        score: c.score,
        delta: 0,
        trend: c.score >= 80 ? "up" : c.score >= 50 ? "flat" : "down",
        why: c.problems.length > 0 ? c.problems.join(". ") : `Your ${c.name} has been evaluated based on active profile details.`,
        drivers: drivers.length > 0 ? drivers : [{ label: "No details registered", value: "—", good: false }],
        risk: c.problems.length > 0 ? c.problems[0] : undefined
      };
    });
  }, [healthReport, scoreBoost]);

  const overall = useMemo(() => {
    if (healthReport && typeof healthReport.overall_score === "number" && healthReport.overall_score >= 0) {
      return healthReport.overall_score;
    }
    return Math.min(99, baseOverall + scoreBoost);
  }, [healthReport, scoreBoost]);

  const value: OsState = {
    companyId,
    setCompanyId,
    onboarded,
    completeOnboarding,
    updateProfile,
    profile,
    tasks,
    toggleTask,
    addTask,
    acceptedRecs,
    acceptRec,
    scoreBoost,
    metrics,
    overall,
    activity,
    pushActivity,
    notifications: baseNotifications,
    paletteOpen,
    setPaletteOpen,
    assistantOpen,
    setAssistantOpen,
    healthReport,
    refreshHealth
  };

  return <OsContext.Provider value={value}>{children}</OsContext.Provider>;
}

export function useOs() {
  const ctx = useContext(OsContext);
  if (!ctx) throw new Error("useOs must be used inside OsProvider");
  return ctx;
}
