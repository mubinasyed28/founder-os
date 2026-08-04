import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  healthMetrics as baseMetrics,
  notifications as baseNotifications,
  tasks as baseTasks,
  overallScore as baseOverall,
} from "./company-data";

type ActivityItem = { id: string; agent: string; text: string; time: string };
type TaskItem = (typeof baseTasks)[number];

type OsState = {
  onboarded: boolean;
  completeOnboarding: (profile: Record<string, string>) => void;
  profile: Record<string, string>;
  tasks: TaskItem[];
  toggleTask: (id: string) => void;
  addTask: (title: string, from: string) => void;
  acceptedRecs: string[];
  acceptRec: (id: string, title: string) => void;
  scoreBoost: number;
  metrics: typeof baseMetrics;
  overall: number;
  activity: ActivityItem[];
  pushActivity: (agent: string, text: string) => void;
  notifications: typeof baseNotifications;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
  assistantOpen: boolean;
  setAssistantOpen: (v: boolean) => void;
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
  const [onboarded, setOnboarded] = useState(true);
  const [profile, setProfile] = useState<Record<string, string>>({});
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
    (p: Record<string, string>) => {
      setProfile(p);
      setOnboarded(true);
      pushActivity("Memory Agent", "created the company profile from onboarding");
    },
    [pushActivity],
  );

  const scoreBoost = acceptedRecs.length * 2;

  const metrics = useMemo(
    () => baseMetrics.map((m) => ({ ...m, score: Math.min(99, m.score + scoreBoost) })),
    [scoreBoost],
  );

  const value: OsState = {
    onboarded,
    completeOnboarding,
    profile,
    tasks,
    toggleTask,
    addTask,
    acceptedRecs,
    acceptRec,
    scoreBoost,
    metrics,
    overall: Math.min(99, baseOverall + scoreBoost),
    activity,
    pushActivity,
    notifications: baseNotifications,
    paletteOpen,
    setPaletteOpen,
    assistantOpen,
    setAssistantOpen,
  };

  return <OsContext.Provider value={value}>{children}</OsContext.Provider>;
}

export function useOs() {
  const ctx = useContext(OsContext);
  if (!ctx) throw new Error("useOs must be used inside OsProvider");
  return ctx;
}
