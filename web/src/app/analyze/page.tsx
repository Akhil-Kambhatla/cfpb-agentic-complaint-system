"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Play,
  Tag,
  GitBranch,
  Route,
  FileText,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import dynamic from "next/dynamic";
import {
  AgentCardWrapper,
  ClassifierCard,
  CausalCard,
  RouterCard,
  ResolutionCard,
  QualityCheckCard,
} from "@/components/AgentCard";
import QualityBadge from "@/components/QualityBadge";
import { analyzeComplaint, getSampleComplaints } from "@/lib/api";
import type {
  AgentName,
  AgentState,
  ClassificationOutput,
  CausalAnalysisOutput,
  RoutingOutput,
  ResolutionOutput,
  QualityCheckOutput,
  SampleComplaint,
} from "@/types";

// React Flow must be client-side only
const AgentFlowDiagram = dynamic(() => import("@/components/AgentFlowDiagram"), {
  ssr: false,
  loading: () => (
    <div className="h-48 rounded-xl border border-white/10 bg-slate-900/60 flex items-center justify-center">
      <Loader2 className="h-6 w-6 text-slate-500 animate-spin" />
    </div>
  ),
});

const AGENTS: AgentName[] = ["classifier", "causal_analyst", "router", "resolution", "quality_check"];

const INITIAL_STATES: Record<string, AgentState> = Object.fromEntries(
  AGENTS.map((a) => [a, { status: "idle" }])
);

type AnalysisPhase = "idle" | "running" | "complete" | "error";

export default function AnalyzePage() {
  const [narrative, setNarrative] = useState("");
  const [company, setCompany] = useState("");
  const [state, setState] = useState("");
  const [metaOpen, setMetaOpen] = useState(false);

  const [samples, setSamples] = useState<SampleComplaint[]>([]);
  const [selectedSample, setSelectedSample] = useState("");

  const [phase, setPhase] = useState<AnalysisPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [agentStates, setAgentStates] = useState<Record<string, AgentState>>(INITIAL_STATES);

  // Typed results
  const [classification, setClassification] = useState<ClassificationOutput | null>(null);
  const [causalAnalysis, setCausalAnalysis] = useState<CausalAnalysisOutput | null>(null);
  const [routing, setRouting] = useState<RoutingOutput | null>(null);
  const [resolution, setResolution] = useState<ResolutionOutput | null>(null);
  const [qualityCheck, setQualityCheck] = useState<QualityCheckOutput | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Load sample complaints
  useEffect(() => {
    getSampleComplaints()
      .then(setSamples)
      .catch(() => {/* silently ignore if API offline */});
  }, []);

  const handleSampleSelect = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const id = e.target.value;
      setSelectedSample(id);
      const s = samples.find((s) => s.id === id);
      if (s) {
        setNarrative(s.narrative);
        setCompany(s.company);
        setState(s.state);
      }
    },
    [samples]
  );

  const resetState = () => {
    setAgentStates(INITIAL_STATES);
    setClassification(null);
    setCausalAnalysis(null);
    setRouting(null);
    setResolution(null);
    setQualityCheck(null);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (!narrative.trim()) return;
    resetState();
    setPhase("running");

    try {
      for await (const event of analyzeComplaint(narrative.trim(), { company, state })) {
        const agentKey = event.agent;

        if (event.status === "running") {
          setAgentStates((prev) => ({
            ...prev,
            [agentKey]: { status: "running" },
          }));
        } else if (event.status === "complete") {
          if (agentKey !== "pipeline") {
            setAgentStates((prev) => ({
              ...prev,
              [agentKey]: { status: "complete", elapsed: event.elapsed, result: event.result },
            }));
          }

          // Store typed results
          if (agentKey === "classifier") setClassification(event.result as ClassificationOutput);
          if (agentKey === "causal_analyst") setCausalAnalysis(event.result as CausalAnalysisOutput);
          if (agentKey === "router") setRouting(event.result as RoutingOutput);
          if (agentKey === "resolution") setResolution(event.result as ResolutionOutput);
          if (agentKey === "quality_check") setQualityCheck(event.result as QualityCheckOutput);

          if (agentKey === "pipeline") {
            setPhase("complete");
            setTimeout(() => {
              resultsRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 300);
          }
        } else if (event.status === "error") {
          throw new Error(event.message ?? "Pipeline error");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
      setPhase("error");
    }
  };

  const allComplete = AGENTS.every((a) => agentStates[a]?.status === "complete");

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Complaint Analysis</h1>
        <p className="text-slate-400 text-sm mt-1">
          Paste a complaint narrative or select a sample, then click Analyze.
        </p>
      </div>

      {/* Input section */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
        {/* Sample selector */}
        {samples.length > 0 && (
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Load sample complaint</label>
            <select
              value={selectedSample}
              onChange={handleSampleSelect}
              className="w-full rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">— Select a sample —</option>
              {samples.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.product} — {s.issue}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Narrative textarea */}
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Complaint narrative *</label>
          <textarea
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            placeholder="Paste the consumer complaint narrative here..."
            rows={7}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none font-mono"
          />
          <p className="text-[11px] text-slate-600 mt-1">{narrative.length} chars</p>
        </div>

        {/* Optional metadata */}
        <div>
          <button
            onClick={() => setMetaOpen(!metaOpen)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            {metaOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            Optional metadata (company, state)
          </button>
          <AnimatePresence>
            {metaOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Company</label>
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="e.g. Equifax"
                      className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">State</label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="e.g. CA"
                      className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Analyze button */}
        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: narrative.trim() ? 1.02 : 1 }}
            whileTap={{ scale: narrative.trim() ? 0.98 : 1 }}
            onClick={handleAnalyze}
            disabled={!narrative.trim() || phase === "running"}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {phase === "running" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {phase === "running" ? "Analyzing..." : "Analyze"}
          </motion.button>

          {phase !== "idle" && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => { resetState(); setPhase("idle"); setNarrative(""); setSelectedSample(""); }}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2.5 text-xs text-slate-400 hover:text-white hover:border-white/20 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reset
            </motion.button>
          )}
        </div>
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4"
          >
            <AlertTriangle className="h-4 w-4 text-rose-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-rose-300">Analysis Failed</p>
              <p className="text-xs text-rose-400 mt-0.5">{error}</p>
              <p className="text-xs text-slate-500 mt-1">
                Make sure the backend is running: <code className="font-mono">cd api && uvicorn main:app --reload --port 8000</code>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Agent flow diagram */}
      <AnimatePresence>
        {phase !== "idle" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-300">Agent Pipeline</h2>
              {allComplete && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-emerald-400 font-medium"
                >
                  ✓ All agents complete
                </motion.span>
              )}
            </div>
            <AgentFlowDiagram agentStates={agentStates} />

            {/* Timing row */}
            <div className="flex flex-wrap gap-3">
              {AGENTS.map((agent) => {
                const s = agentStates[agent];
                if (!s || s.status === "idle") return null;
                return (
                  <div key={agent} className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="capitalize">{agent.replace(/_/g, " ")}</span>
                    {s.elapsed && (
                      <span className="font-mono text-slate-400">{s.elapsed}s</span>
                    )}
                    {s.status === "running" && (
                      <Loader2 className="h-3 w-3 animate-spin text-sky-400" />
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <div ref={resultsRef} className="space-y-4">
        <AnimatePresence>
          {classification && (
            <AgentCardWrapper
              key="classification"
              title="Classification"
              icon={Tag}
              delay={0}
              badge={
                <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                  classification.severity === "critical" ? "bg-rose-500/20 text-rose-300" :
                  classification.severity === "high" ? "bg-orange-500/20 text-orange-300" :
                  classification.severity === "medium" ? "bg-amber-500/20 text-amber-300" :
                  "bg-emerald-500/20 text-emerald-300"
                }`}>{classification.severity}</span>
              }
            >
              <ClassifierCard data={classification} />
            </AgentCardWrapper>
          )}

          {causalAnalysis && (
            <AgentCardWrapper key="causal" title="Causal Analysis" icon={GitBranch} delay={0.05}>
              <CausalCard data={causalAnalysis} />
            </AgentCardWrapper>
          )}

          {routing && (
            <AgentCardWrapper
              key="routing"
              title="Routing"
              icon={Route}
              delay={0.1}
              badge={
                <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  routing.priority_level === "P1" ? "bg-rose-500/20 text-rose-300" :
                  routing.priority_level === "P2" ? "bg-orange-500/20 text-orange-300" :
                  routing.priority_level === "P3" ? "bg-amber-500/20 text-amber-300" :
                  "bg-slate-700 text-slate-300"
                }`}>{routing.priority_level}</span>
              }
            >
              <RouterCard data={routing} />
            </AgentCardWrapper>
          )}

          {resolution && (
            <AgentCardWrapper key="resolution" title="Resolution Plan" icon={FileText} delay={0.15}>
              <ResolutionCard data={resolution} />
            </AgentCardWrapper>
          )}

          {qualityCheck && (
            <AgentCardWrapper
              key="quality"
              title="Quality Check"
              icon={ShieldCheck}
              delay={0.2}
              badge={<span className="ml-2"><QualityBadge flag={qualityCheck.quality_flag} /></span>}
            >
              <QualityCheckCard data={qualityCheck} />
            </AgentCardWrapper>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
