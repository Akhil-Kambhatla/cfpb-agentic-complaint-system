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

  totalTime: number | null;

  handleAnalyze: () => Promise<void>;
  resetAnalysis: () => void;
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
  const [qualityCheck, setQualityCheck] = useState<QualityCheckOutput | null>(
    null
  );
  const [totalTime, setTotalTime] = useState<number | null>(null);

  const addLog = useCallback(
    (agent: string, message: string, type: LogEntry["type"] = "info") => {
      setLog((prev) => [...prev, { timestamp: ts(), agent, message, type }]);
    },
    []
  );

  const resetAnalysis = useCallback(() => {
    setAgentStates(makeInitialStates());
    setClassification(null);
    setEventChain(null);
    setRiskAnalysis(null);
    setRouting(null);
    setResolution(null);
    setQualityCheck(null);
    setError(null);
    setLog([]);
    setPhase("idle");
    setTotalTime(null);
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
          setAgentStates((prev) => ({
            ...prev,
            [agentKey]: { status: "running" },
          }));
          if (agentKey !== "pipeline") {
            addLog(agentKey, runningMsg(agentKey, narrative.length), "info");
          }
        } else if (event.status === "complete") {
          if (agentKey !== "pipeline") {
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
        totalTime,
        handleAnalyze,
        resetAnalysis,
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
