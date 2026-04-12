"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { analyzeComplaint } from "@/lib/api";
import type {
  AgentName,
  AgentState,
  ClassificationOutput,
  CausalAnalysisOutput,
  RiskAnalysisOutput,
  RoutingOutput,
  ResolutionOutput,
  QualityCheckOutput,
  SatisfactionPrediction,
} from "@/types";

export interface LogEntry {
  timestamp: string;
  agent: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

const AGENTS: AgentName[] = [
  "classifier",
  "risk_analyzer",
  "event_chain",
  "router",
  "resolution",
  "quality_check",
];

const makeInitialStates = (): Record<string, AgentState> =>
  Object.fromEntries(AGENTS.map((a) => [a, { status: "idle" as const }]));

export type AnalysisPhase = "idle" | "running" | "complete" | "error";

interface AnalysisContextType {
  narrative: string;
  company: string;
  state: string;
  setNarrative: (v: string) => void;
  setCompany: (v: string) => void;
  setState: (v: string) => void;

  phase: AnalysisPhase;
  error: string | null;
  agentStates: Record<string, AgentState>;
  log: LogEntry[];

  classification: ClassificationOutput | null;
  eventChain: CausalAnalysisOutput | null;
  riskAnalysis: RiskAnalysisOutput | null;
  routing: RoutingOutput | null;
  resolution: ResolutionOutput | null;
  qualityCheck: QualityCheckOutput | null;
  predictedSatisfaction: SatisfactionPrediction | null;

  totalTime: number | null;
  slackAlertSent: boolean | null;
  teamAlertSent: boolean | null;
  caseNumber: string | null;

  handleAnalyze: () => Promise<void>;
  resetAnalysis: () => void;
  restoreFromSession: () => boolean;
}

const AnalysisContext = createContext<AnalysisContextType | null>(null);

function ts(): string {
  return new Date().toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function runningMsg(agent: string, charCount: number): string {
  switch (agent) {
    case "classifier":
      return `Reading narrative... ${charCount} characters`;
    case "risk_analyzer":
      return "Running Bayesian posterior inference...";
    case "event_chain":
      return "Extracting event chain...";
    case "router":
      return "Analyzing risk gap for team assignment...";
    case "resolution":
      return "Generating remediation plan...";
    case "quality_check":
      return "Validating agent consistency...";
    default:
      return "Processing...";
  }
}

function completeMsg(agent: string, result: unknown, elapsed?: number): string {
  const r = result as Record<string, unknown>;
  const t = elapsed ? ` (${elapsed}s)` : "";
  switch (agent) {
    case "classifier":
      return `Identified: ${r?.predicted_product} | ${r?.predicted_issue} | Severity: ${String(r?.severity).toUpperCase()}${t}`;
    case "risk_analyzer": {
      const prob = r?.resolution_probability != null
        ? `${(Number(r.resolution_probability) * 100).toFixed(0)}%`
        : "?";
      const gap = r?.risk_gap != null
        ? `${Number(r.risk_gap) >= 0 ? "+" : ""}${(Number(r.risk_gap) * 100).toFixed(0)}%`
        : "";
      return `Resolution probability: ${prob}. Risk gap vs baseline: ${gap}. Level: ${String(r?.risk_level ?? "").toUpperCase()}${t}`;
    }
    case "event_chain": {
      const depth = r?.causal_depth ?? "?";
      return `Found ${depth}-step event chain. Root cause: ${r?.root_cause}${t}`;
    }
    case "router": {
      const reasoning = String(r?.reasoning ?? "").slice(0, 70);
      return `Assigned to ${r?.assigned_team} (${r?.priority_level}). ${reasoning}...${t}`;
    }
    case "resolution": {
      const regs = Array.isArray(r?.applicable_regulations)
        ? (r.applicable_regulations as string[]).join(", ")
        : "";
      return `Customer letter drafted. References: ${regs}${t}`;
    }
    case "quality_check": {
      const conf = r?.overall_confidence
        ? `${(Number(r.overall_confidence) * 100).toFixed(0)}%`
        : "?";
      return `All agents consistent. Confidence: ${conf}. Status: ${String(
        r?.quality_flag ?? ""
      ).toUpperCase()}${t}`;
    }
    default:
      return `Complete${t}`;
  }
}

// ─── sessionStorage helpers ────────────────────────────────────────────────────

const SS_RESULTS_KEY = "analyzeResults";
const SS_NARRATIVE_KEY = "analyzeNarrative";
const SS_COMPANY_KEY = "analyzeCompany";
const SS_STATE_KEY = "analyzeState";

function saveResultsToSession(
  results: {
    classification: ClassificationOutput | null;
    eventChain: CausalAnalysisOutput | null;
    riskAnalysis: RiskAnalysisOutput | null;
    routing: RoutingOutput | null;
    resolution: ResolutionOutput | null;
    qualityCheck: QualityCheckOutput | null;
    caseNumber: string | null;
  },
  narrative: string,
  company: string,
  state: string
) {
  try {
    sessionStorage.setItem(SS_RESULTS_KEY, JSON.stringify(results));
    sessionStorage.setItem(SS_NARRATIVE_KEY, narrative);
    sessionStorage.setItem(SS_COMPANY_KEY, company);
    sessionStorage.setItem(SS_STATE_KEY, state);
  } catch {}
}

function loadResultsFromSession() {
  try {
    const raw = sessionStorage.getItem(SS_RESULTS_KEY);
    if (!raw) return null;
    return {
      results: JSON.parse(raw) as {
        classification: ClassificationOutput;
        eventChain: CausalAnalysisOutput;
        riskAnalysis: RiskAnalysisOutput;
        routing: RoutingOutput;
        resolution: ResolutionOutput;
        qualityCheck: QualityCheckOutput;
        caseNumber: string | null;
      },
      narrative: sessionStorage.getItem(SS_NARRATIVE_KEY) || "",
      company: sessionStorage.getItem(SS_COMPANY_KEY) || "",
      state: sessionStorage.getItem(SS_STATE_KEY) || "",
    };
  } catch {
    return null;
  }
}

export function clearSessionResults() {
  try {
    sessionStorage.removeItem(SS_RESULTS_KEY);
    sessionStorage.removeItem(SS_NARRATIVE_KEY);
    sessionStorage.removeItem(SS_COMPANY_KEY);
    sessionStorage.removeItem(SS_STATE_KEY);
  } catch {}
}

export function AnalysisProvider({ children }: { children: React.ReactNode }) {
  const [narrative, setNarrative] = useState("");
  const [company, setCompany] = useState("");
  const [state, setState] = useState("");

  const [phase, setPhase] = useState<AnalysisPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [agentStates, setAgentStates] = useState<Record<string, AgentState>>(
    makeInitialStates()
  );
  const [log, setLog] = useState<LogEntry[]>([]);

  const [classification, setClassification] =
    useState<ClassificationOutput | null>(null);
  const [eventChain, setEventChain] =
    useState<CausalAnalysisOutput | null>(null);
  const [riskAnalysis, setRiskAnalysis] =
    useState<RiskAnalysisOutput | null>(null);
  const [routing, setRouting] = useState<RoutingOutput | null>(null);
  const [resolution, setResolution] = useState<ResolutionOutput | null>(null);
  const [qualityCheck, setQualityCheck] = useState<QualityCheckOutput | null>(null);
  const [predictedSatisfaction, setPredictedSatisfaction] = useState<SatisfactionPrediction | null>(null);
  const [totalTime, setTotalTime] = useState<number | null>(null);
  const [slackAlertSent, setSlackAlertSent] = useState<boolean | null>(null);
  const [teamAlertSent, setTeamAlertSent] = useState<boolean | null>(null);
  const [caseNumber, setCaseNumber] = useState<string | null>(null);

  // Restore from sessionStorage on mount (FIX 4)
  React.useEffect(() => {
    const saved = loadResultsFromSession();
    if (saved && saved.results.classification) {
      setNarrative(saved.narrative);
      setCompany(saved.company);
      setState(saved.state);
      setClassification(saved.results.classification);
      setEventChain(saved.results.eventChain);
      setRiskAnalysis(saved.results.riskAnalysis);
      setRouting(saved.results.routing);
      setResolution(saved.results.resolution);
      setQualityCheck(saved.results.qualityCheck);
      setCaseNumber(saved.results.caseNumber);
      setPhase("complete");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addLog = useCallback(
    (agent: string, message: string, type: LogEntry["type"] = "info") => {
      setLog((prev) => [...prev, { timestamp: ts(), agent, message, type }]);
    },
    []
  );

  const resetAnalysis = useCallback(() => {
    clearSessionResults();
    setAgentStates(makeInitialStates());
    setClassification(null);
    setEventChain(null);
    setRiskAnalysis(null);
    setRouting(null);
    setResolution(null);
    setQualityCheck(null);
    setPredictedSatisfaction(null);
    setError(null);
    setLog([]);
    setPhase("idle");
    setTotalTime(null);
    setSlackAlertSent(null);
    setTeamAlertSent(null);
    setCaseNumber(null);
  }, []);

  const restoreFromSession = useCallback((): boolean => {
    const saved = loadResultsFromSession();
    if (saved && saved.results.classification) {
      setNarrative(saved.narrative);
      setCompany(saved.company);
      setState(saved.state);
      setClassification(saved.results.classification);
      setEventChain(saved.results.eventChain);
      setRiskAnalysis(saved.results.riskAnalysis);
      setRouting(saved.results.routing);
      setResolution(saved.results.resolution);
      setQualityCheck(saved.results.qualityCheck);
      setCaseNumber(saved.results.caseNumber);
      setLog([]);
      setAgentStates(makeInitialStates());
      setPhase("complete");
      return true;
    }
    return false;
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!narrative.trim()) return;
    resetAnalysis();
    const t0 = Date.now();
    setPhase("running");
    addLog("System", `Starting analysis... ${narrative.length} characters`, "info");

    try {
      for await (const event of analyzeComplaint(narrative.trim(), {
        company,
        state,
      })) {
        const agentKey = event.agent;

        if (event.status === "running") {
          if (agentKey === "risk_analyzer") {
            // Risk Analyzer and Event Chain run in parallel — activate both at once
            // so the animation shows them lighting up simultaneously, not sequentially.
            setAgentStates((prev) => ({
              ...prev,
              risk_analyzer: { status: "running" },
              event_chain: { status: "running" },
            }));
            addLog("risk_analyzer", runningMsg("risk_analyzer", narrative.length), "info");
            addLog("event_chain", runningMsg("event_chain", narrative.length), "info");
          } else {
            setAgentStates((prev) => ({
              ...prev,
              [agentKey]: { status: "running" },
            }));
            if (agentKey !== "pipeline") {
              addLog(agentKey, runningMsg(agentKey, narrative.length), "info");
            }
          }
        } else if (event.status === "complete") {
          if (agentKey !== "pipeline") {
            // Backend now sends individual elapsed times for risk_analyzer and event_chain
            // (using asyncio.as_completed so each completes independently)
            setAgentStates((prev) => ({
              ...prev,
              [agentKey]: {
                status: "complete",
                elapsed: event.elapsed,
                result: event.result,
              },
            }));
            addLog(
              agentKey,
              completeMsg(agentKey, event.result, event.elapsed),
              "success"
            );
          }

          if (agentKey === "classifier")
            setClassification(event.result as ClassificationOutput);
          if (agentKey === "event_chain")
            setEventChain(event.result as CausalAnalysisOutput);
          if (agentKey === "risk_analyzer")
            setRiskAnalysis(event.result as RiskAnalysisOutput);
          if (agentKey === "router") setRouting(event.result as RoutingOutput);
          if (agentKey === "resolution")
            setResolution(event.result as ResolutionOutput);
          if (agentKey === "quality_check")
            setQualityCheck(event.result as QualityCheckOutput);

          if (agentKey === "pipeline") {
            const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
            setTotalTime(parseFloat(elapsed));
            addLog("System", `Pipeline complete in ${elapsed} seconds`, "success");

            const pipelineResult = event.result as Record<string, unknown> | undefined;
            const slackSent = (pipelineResult?.slack_alert_sent as boolean) ?? false;
            const teamSent = (pipelineResult?.team_alert_sent as boolean) ?? false;
            setSlackAlertSent(slackSent);
            setTeamAlertSent(teamSent);
            const newCaseNumber = (pipelineResult?.case_number as string) ?? null;
            if (newCaseNumber) {
              setCaseNumber(newCaseNumber);
            }
            const sat = pipelineResult?.predicted_satisfaction as SatisfactionPrediction | null | undefined;
            if (sat) setPredictedSatisfaction(sat);

            // Persist to sessionStorage so results survive tab switches (FIX 4)
            setClassification((cls) => {
              setEventChain((ec) => {
                setRiskAnalysis((ra) => {
                  setRouting((rt) => {
                    setResolution((res) => {
                      setQualityCheck((qc) => {
                        saveResultsToSession(
                          { classification: cls, eventChain: ec, riskAnalysis: ra, routing: rt, resolution: res, qualityCheck: qc, caseNumber: newCaseNumber },
                          narrative.trim(), company, state
                        );
                        return qc;
                      });
                      return res;
                    });
                    return rt;
                  });
                  return ra;
                });
                return ec;
              });
              return cls;
            });

            const assignedTeam = ((pipelineResult?.routing as Record<string, unknown>)?.assigned_team as string) ?? "";
            if (teamSent && assignedTeam) {
              const channel = `team-${assignedTeam.replace(/_/g, "-")}`;
              addLog("Router", `Alert sent to #${channel}`, "success");
            }
            if (slackSent) {
              addLog("Quality Check", "[ALERT] High-risk alert sent to #cfpb-alerts", "warning");
            }

            setPhase("complete");
          }
        } else if (event.status === "error") {
          throw new Error(event.message ?? "Pipeline error");
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Analysis failed";
      setError(msg);
      setPhase("error");
      addLog("System", `Error: ${msg}`, "error");
    }
  }, [narrative, company, state, addLog, resetAnalysis]);

  return (
    <AnalysisContext.Provider
      value={{
        narrative,
        company,
        state,
        setNarrative,
        setCompany,
        setState,
        phase,
        error,
        agentStates,
        log,
        classification,
        eventChain,
        riskAnalysis,
        routing,
        resolution,
        qualityCheck,
        predictedSatisfaction,
        totalTime,
        slackAlertSent,
        teamAlertSent,
        caseNumber,
        handleAnalyze,
        resetAnalysis,
        restoreFromSession,
      }}
    >
      {children}
    </AnalysisContext.Provider>
  );
}

export function useAnalysis(): AnalysisContextType {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis must be used within AnalysisProvider");
  return ctx;
}
