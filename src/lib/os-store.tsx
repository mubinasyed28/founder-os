import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "./auth-context";
import {
  healthMetrics as baseMetrics,
  notifications as baseNotifications,
  tasks as baseTasks,
  overallScore as baseOverall,
  opportunities as baseOpportunities,
  getProfileTailoredOpportunities,
  memoryTimeline as baseTimeline,
  type Opportunity,
  type OpportunityDecision,
  type MemoryEvent,
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
  opportunities: Opportunity[];
  refreshOpportunities: () => Promise<void>;
  decideOpportunity: (
    id: string,
    decision: "pursue" | "park" | "reject" | "validate",
    reasoning: string,
    customAction?: string
  ) => Promise<void>;
  updateValidationExperiment: (
    oppId: string,
    expId: string,
    status: "pending" | "passed" | "failed"
  ) => Promise<void>;
  timeline: MemoryEvent[];
  addTimelineEvent: (event: MemoryEvent) => void;
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

  // Opportunities & Decision Intelligence State
  const [opportunities, setOpportunities] = useState<Opportunity[]>(() => {
    const initialProfile = typeof window !== "undefined" && localStorage.getItem("cofoundr_profile")
      ? JSON.parse(localStorage.getItem("cofoundr_profile") || "{}")
      : {};
    const baseList = getProfileTailoredOpportunities(initialProfile, baseOpportunities);
    if (typeof window !== "undefined") {
      try {
        const savedDecisions = localStorage.getItem("cofoundr_opportunity_decisions");
        const savedExps = localStorage.getItem("cofoundr_opportunity_experiments");
        const decisionsMap = savedDecisions ? JSON.parse(savedDecisions) : {};
        const expsMap = savedExps ? JSON.parse(savedExps) : {};

        return baseList.map((opp) => {
          let updated = { ...opp };
          if (decisionsMap[opp.id]) {
            const dec = decisionsMap[opp.id];
            updated.decisionRecord = dec;
            if (dec.decision === "pursue") updated.status = "pursued";
            else if (dec.decision === "park") updated.status = "parked";
            else if (dec.decision === "reject") updated.status = "rejected";
            else if (dec.decision === "validate") updated.status = "validating";
          }
          if (updated.validationExperiments) {
            updated.validationExperiments = updated.validationExperiments.map((exp) => {
              const expKey = `${opp.id}_${exp.id}`;
              if (expsMap[expKey]) {
                return { ...exp, status: expsMap[expKey] };
              }
              return exp;
            });
          }
          return updated;
        });
      } catch {
        return baseList;
      }
    }
    return baseList;
  });

  // Memory Timeline State
  const [timeline, setTimeline] = useState<MemoryEvent[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("cofoundr_timeline_events");
        const extra: MemoryEvent[] = saved ? JSON.parse(saved) : [];
        return [...extra, ...baseTimeline];
      } catch {
        return baseTimeline;
      }
    }
    return baseTimeline;
  });

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

  const refreshOpportunities = useCallback(async () => {
    try {
      const { getOpportunitiesApi } = await import("./api-client");
      const oppData = await getOpportunitiesApi();
      const rawList = oppData && oppData.opportunities && oppData.opportunities.length > 0
        ? oppData.opportunities
        : getProfileTailoredOpportunities(profile, baseOpportunities);

      const decisionsMap = oppData?.decisions || {};
      const expsMap = oppData?.experiments || {};

      setOpportunities(
        rawList.map((opp: any) => {
          let updated = { ...opp };
          if (decisionsMap[opp.id]) {
            const dec = decisionsMap[opp.id];
            updated.decisionRecord = dec;
            if (dec.decision === "pursue") updated.status = "pursued";
            else if (dec.decision === "park") updated.status = "parked";
            else if (dec.decision === "reject") updated.status = "rejected";
            else if (dec.decision === "validate") updated.status = "validating";
          }
          if (updated.validationExperiments) {
            updated.validationExperiments = updated.validationExperiments.map((exp: any) => {
              const expKey = `${opp.id}_${exp.id}`;
              if (expsMap[expKey]) {
                return { ...exp, status: expsMap[expKey] };
              }
              return exp;
            });
          }
          return updated;
        })
      );
    } catch (err) {
      console.warn("Failed to refresh opportunities:", err);
    }
  }, [profile]);

  useEffect(() => {
    async function loadServerProfile() {
      const token = typeof window !== "undefined" ? localStorage.getItem("cofoundr_token") : null;
      if (token && user) {
        try {
          const { getProfileApi, getOpportunitiesApi } = await import("./api-client");
          const serverProfile = await getProfileApi();
          let currentProf = profile;
          if (serverProfile) {
            currentProf = { ...profile, ...serverProfile };
            setProfile(currentProf);
            if (typeof window !== "undefined") {
              localStorage.setItem("cofoundr_profile", JSON.stringify(currentProf));
            }
          }

          // Fetch opportunities decisions & profile-tailored items from server
          try {
            const oppData = await getOpportunitiesApi();
            const rawList = oppData && oppData.opportunities && oppData.opportunities.length > 0
              ? oppData.opportunities
              : getProfileTailoredOpportunities(currentProf, baseOpportunities);

            const decisionsMap = oppData?.decisions || {};
            const expsMap = oppData?.experiments || {};

            setOpportunities(
              rawList.map((opp: any) => {
                let updated = { ...opp };
                if (decisionsMap[opp.id]) {
                  const dec = decisionsMap[opp.id];
                  updated.decisionRecord = dec;
                  if (dec.decision === "pursue") updated.status = "pursued";
                  else if (dec.decision === "park") updated.status = "parked";
                  else if (dec.decision === "reject") updated.status = "rejected";
                  else if (dec.decision === "validate") updated.status = "validating";
                }
                if (updated.validationExperiments) {
                  updated.validationExperiments = updated.validationExperiments.map((exp: any) => {
                    const expKey = `${opp.id}_${exp.id}`;
                    if (expsMap[expKey]) {
                      return { ...exp, status: expsMap[expKey] };
                    }
                    return exp;
                  });
                }
                return updated;
              })
            );
          } catch (oppErr) {
            console.warn("Could not sync server opportunities:", oppErr);
            setOpportunities(getProfileTailoredOpportunities(currentProf, baseOpportunities));
          }

          await refreshHealth();
        } catch (err) {
          console.warn("Failed to load profile from server:", err);
        }
      } else if (!user) {
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

  const addTimelineEvent = useCallback((event: MemoryEvent) => {
    setTimeline((prev) => {
      const next = [event, ...prev];
      if (typeof window !== "undefined") {
        try {
          const saved = localStorage.getItem("cofoundr_timeline_events");
          const existing: MemoryEvent[] = saved ? JSON.parse(saved) : [];
          localStorage.setItem("cofoundr_timeline_events", JSON.stringify([event, ...existing].slice(0, 50)));
        } catch {}
      }
      return next;
    });
  }, []);

  const decideOpportunity = useCallback(
    async (
      id: string,
      decision: "pursue" | "park" | "reject" | "validate",
      reasoning: string,
      customAction?: string
    ) => {
      const opp = opportunities.find((o) => o.id === id);
      if (!opp) return;

      const decidedAt = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const memoryEventId = `M-${120 + timeline.length}`;
      let createdTaskId: string | undefined = undefined;

      if (decision === "pursue") {
        const taskTitle = customAction || opp.recommendedAction.label;
        createdTaskId = `T-${100 + tasks.length}`;
        addTask(taskTitle, opp.id);
      }

      const decisionRecord: OpportunityDecision = {
        decision,
        decidedAt,
        reasoning,
        actionSummary: customAction || opp.recommendedAction.label,
        createdTaskIds: createdTaskId ? [createdTaskId] : [],
        memoryEventId,
      };

      // 1. Update state
      setOpportunities((prev) =>
        prev.map((o) => {
          if (o.id !== id) return o;
          return {
            ...o,
            status:
              decision === "pursue"
                ? "pursued"
                : decision === "park"
                ? "parked"
                : decision === "reject"
                ? "rejected"
                : "validating",
            decisionRecord,
          };
        })
      );

      // 2. Persist to localStorage
      if (typeof window !== "undefined") {
        try {
          const saved = localStorage.getItem("cofoundr_opportunity_decisions");
          const map = saved ? JSON.parse(saved) : {};
          map[id] = decisionRecord;
          localStorage.setItem("cofoundr_opportunity_decisions", JSON.stringify(map));
        } catch {}
      }

      // 3. Create Memory Timeline Event
      const memoryEvent: MemoryEvent = {
        id: memoryEventId,
        date: decidedAt,
        type: "decision",
        title: `${
          decision === "pursue"
            ? "Pursuing"
            : decision === "validate"
            ? "Validating"
            : decision === "park"
            ? "Parked"
            : "Rejected"
        } opportunity: ${opp.title}`,
        detail: reasoning || opp.recommendedAction.description,
        links: [opp.id, opp.type, ...(opp.linkedCompetitors || [])],
      };
      addTimelineEvent(memoryEvent);

      // 4. Agent notifications
      pushActivity("Strategy Agent", `recorded decision: ${decision.toUpperCase()} for ${opp.id}`);
      pushActivity("Memory Agent", `wrote decision node ${memoryEventId} to company memory`);

      // 5. Backend sync
      try {
        const { decideOpportunityApi } = await import("./api-client");
        await decideOpportunityApi(id, {
          decision,
          reasoning,
          action_summary: customAction || opp.recommendedAction.label,
        });
      } catch (err) {
        console.warn("Backend decision sync error (working in local memory):", err);
      }
    },
    [opportunities, timeline.length, tasks.length, addTask, addTimelineEvent, pushActivity]
  );

  const updateValidationExperiment = useCallback(
    async (oppId: string, expId: string, status: "pending" | "passed" | "failed") => {
      setOpportunities((prev) =>
        prev.map((opp) => {
          if (opp.id !== oppId) return opp;
          const experiments = (opp.validationExperiments || []).map((exp) =>
            exp.id === expId ? { ...exp, status } : exp
          );
          // Recalculate confidence
          const passedCount = experiments.filter((e) => e.status === "passed").length;
          const failedCount = experiments.filter((e) => e.status === "failed").length;
          const baseConf = opp.confidence;
          const adjustedConf = Math.min(99, Math.max(15, baseConf + passedCount * 4 - failedCount * 8));

          return {
            ...opp,
            confidence: adjustedConf,
            validationExperiments: experiments,
          };
        })
      );

      // Save to localStorage
      if (typeof window !== "undefined") {
        try {
          const saved = localStorage.getItem("cofoundr_opportunity_experiments");
          const map = saved ? JSON.parse(saved) : {};
          map[`${oppId}_${expId}`] = status;
          localStorage.setItem("cofoundr_opportunity_experiments", JSON.stringify(map));
        } catch {}
      }

      pushActivity("Research Agent", `updated experiment ${expId} on ${oppId} to ${status}`);

      // Backend sync
      try {
        const { updateValidationApi } = await import("./api-client");
        await updateValidationApi(oppId, { experiment_id: expId, status });
      } catch (err) {
        console.warn("Backend experiment sync error:", err);
      }
    },
    [pushActivity]
  );

  const pursuedCount = useMemo(() => opportunities.filter((o) => o.status === "pursued").length, [opportunities]);
  const scoreBoost = acceptedRecs.length * 2 + pursuedCount * 3;

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

      const drivers = c.found_info
        .map((info: string) => ({
          label: info,
          value: "Found",
          good: true,
        }))
        .concat(
          c.missing_info.map((info: string) => ({
            label: info,
            value: "Missing",
            good: false,
          }))
        );

      return {
        key,
        label: c.name,
        score: c.score,
        delta: 0,
        trend: c.score >= 80 ? "up" : c.score >= 50 ? "flat" : "down",
        why:
          c.problems.length > 0
            ? c.problems.join(". ")
            : `Your ${c.name} has been evaluated based on active profile details.`,
        drivers: drivers.length > 0 ? drivers : [{ label: "No details registered", value: "—", good: false }],
        risk: c.problems.length > 0 ? c.problems[0] : undefined,
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
    opportunities,
    refreshOpportunities,
    decideOpportunity,
    updateValidationExperiment,
    timeline,
    addTimelineEvent,
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
    refreshHealth,
  };

  return <OsContext.Provider value={value}>{children}</OsContext.Provider>;
}

export function useOs() {
  const ctx = useContext(OsContext);
  if (!ctx) throw new Error("useOs must be used inside OsProvider");
  return ctx;
}
