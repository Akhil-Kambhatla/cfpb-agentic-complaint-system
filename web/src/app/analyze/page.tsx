"use client";

import { useRef, useState } from "react";
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
  CreditCard,
  Building2,
  Home,
  Landmark,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useAnalysis } from "@/contexts/AnalysisContext";
import {
  AgentCardWrapper,
  ClassifierCard,
  CausalCard,
  RouterCard,
  ResolutionCard,
  QualityCheckCard,
} from "@/components/AgentCard";
import QualityBadge from "@/components/QualityBadge";
import ReasoningLog from "@/components/ReasoningLog";
import RiskDashboard from "@/components/RiskDashboard";

const AgentFlowDiagram = dynamic(
  () => import("@/components/AgentFlowDiagram"),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          height: 620,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(3,7,18,0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Loader2 style={{ width: 24, height: 24, color: "#334155" }} className="animate-spin" />
      </div>
    ),
  }
);

// ─── Hardcoded sample complaints ──────────────────────────────────────────────

const SAMPLES = [
  {
    id: "s1",
    product: "Credit Card",
    icon: CreditCard,
    iconColor: "#38bdf8",
    excerpt:
      "I booked a hotel through my Citi credit card travel portal. My flight was delayed and the hotel charged me $850 plus 15,000 points. Citi ruled it was my responsibility after a 45-day investigation.",
    narrative: `I booked a hotel through my Citi credit card travel portal for a trip in January. My flight was delayed due to weather and I could not check in on time. I called the hotel and they told me to contact Citi since I booked through their portal. I called Citi twice — both times they promised to resolve the issue and said they would call me back. They never did. By the next morning the hotel had charged me the full $850 room rate plus 15,000 ThankYou points. I filed a billing dispute with Citi and after 45 days they ruled it was my responsibility. When I asked for the investigation documents they said they could not provide them. I believe Citi violated my rights under the Fair Credit Billing Act by failing to conduct a proper investigation.`,
  },
  {
    id: "s2",
    product: "Debt Collection",
    icon: Building2,
    iconColor: "#f43f5e",
    excerpt:
      "A debt collector keeps contacting me about a medical bill I already paid a year ago. They've reported it to all three credit bureaus, dropping my score 85 points, and called my elderly mother.",
    narrative: `I keep receiving calls and letters from a debt collection agency about a medical bill that I already paid in full over a year ago. I have sent them proof of payment three times — bank statements and a receipt from the hospital — but they continue to harass me. They have now reported this debt to all three credit bureaus, dropping my score by 85 points. They also called my elderly mother trying to get information about me, which I never authorized. I want them to stop contacting me and remove the false reporting.`,
  },
  {
    id: "s3",
    product: "Mortgage",
    icon: Home,
    iconColor: "#a78bfa",
    excerpt:
      "Our mortgage servicer force-placed a $3,200 insurance policy after a brief lapse. We sent proof of new coverage but they still charged us, raising our monthly payment by $267.",
    narrative: `Our mortgage company force-placed an insurance policy on our home after a brief lapse in coverage. We immediately got new insurance and sent proof to the servicer, but they are still charging us $3,200 for backdated insurance that multiple insurance agents told us is illegal to issue. They added this to our escrow and our monthly payment increased by $267. When we call, each representative tells us something different and no one can explain the charges.`,
  },
  {
    id: "s4",
    product: "Checking Account",
    icon: Landmark,
    iconColor: "#34d399",
    excerpt:
      "I deposited $2,500 cash at a Chase branch but the teller recorded only $1,300. After 45 minutes waiting for the manager, they confirmed the shortage but my claim was denied.",
    narrative: `I deposited $2,500 cash at a Chase branch. The teller ran the money through the counter and put it in her drawer before confirming the amount. The screen showed $1,300 instead of $2,500. When I objected, they said they could not recount because the money was in the drawer. After 45 minutes of waiting for the manager to balance the drawer, they confirmed only $1,300. I am missing $1,200 and the branch manager told me to file a claim, which was denied.`,
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyzePage() {
  const {
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
    causalAnalysis,
    routing,
    resolution,
    qualityCheck,
    totalTime,
    handleAnalyze,
    resetAnalysis,
  } = useAnalysis();

  const [inputCollapsed, setInputCollapsed] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  const isRunning = phase === "running";
  const hasResults = phase === "complete" || classification !== null;
  const hasStarted = phase !== "idle";

  const loadSample = (id: string) => {
    const s = SAMPLES.find((x) => x.id === id);
    if (s) {
      setNarrative(s.narrative);
      setCompany("");
      setState("");
    }
  };

  const handleSubmit = async () => {
    setInputCollapsed(true);
    await handleAnalyze();
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 400);
  };

  const handleReset = () => {
    resetAnalysis();
    setInputCollapsed(false);
    setMetaOpen(false);
  };

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
      {/* ── SECTION A: Input ─────────────────────────────────────────────────── */}
      <div
        style={{
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.02)",
          overflow: "hidden",
        }}
      >
        {/* Header row when collapsed */}
        {inputCollapsed ? (
          <button
            onClick={() => setInputCollapsed(false)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 20px",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8" }}>Complaint Input</span>
              <span
                style={{
                  fontSize: 10,
                  color: "#334155",
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {narrative.length} chars
              </span>
            </div>
            <ChevronDown style={{ width: 14, height: 14, color: "#475569" }} />
          </button>
        ) : (
          <div style={{ padding: "20px 20px 16px" }}>
            {/* Section label */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", margin: 0 }}>
                  Analyze a Complaint
                </h1>
                <p style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  Select a sample or paste your own narrative
                </p>
              </div>
              {hasStarted && (
                <button
                  onClick={handleReset}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.1)",
                    background: "transparent",
                    color: "#64748b",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  <RefreshCw style={{ width: 12, height: 12 }} />
                  New Analysis
                </button>
              )}
            </div>

            {/* Sample cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
              {SAMPLES.map((s) => {
                const Icon = s.icon;
                const isSelected = narrative === s.narrative;
                return (
                  <button
                    key={s.id}
                    onClick={() => loadSample(s.id)}
                    style={{
                      borderRadius: 10,
                      border: `1px solid ${isSelected ? "rgba(16,185,129,0.4)" : "rgba(255,255,255,0.07)"}`,
                      background: isSelected ? "rgba(16,185,129,0.06)" : "rgba(255,255,255,0.02)",
                      padding: "10px 12px",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 5,
                          background: `${s.iconColor}18`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Icon style={{ width: 11, height: 11, color: s.iconColor }} />
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: s.iconColor }}>
                        {s.product}
                      </span>
                    </div>
                    <p style={{ fontSize: 10, color: "#64748b", lineHeight: 1.45, margin: 0 }}>
                      {s.excerpt}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Textarea */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 6 }}>
                Complaint narrative *
              </label>
              <textarea
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                placeholder="Paste a consumer complaint narrative here, or select a sample above..."
                rows={6}
                style={{
                  width: "100%",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(3,7,18,0.6)",
                  padding: "10px 14px",
                  fontSize: 12,
                  color: "#e2e8f0",
                  fontFamily: "monospace",
                  resize: "none",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <p style={{ fontSize: 10, color: "#334155", marginTop: 3 }}>{narrative.length} characters</p>
            </div>

            {/* Metadata toggle */}
            <div style={{ marginBottom: 14 }}>
              <button
                onClick={() => setMetaOpen(!metaOpen)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 11,
                  color: "#475569",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                {metaOpen ? (
                  <ChevronUp style={{ width: 12, height: 12 }} />
                ) : (
                  <ChevronDown style={{ width: 12, height: 12 }} />
                )}
                Optional metadata (company, state)
              </button>
              <AnimatePresence>
                {metaOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    style={{ overflow: "hidden" }}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                      {[
                        { label: "Company", value: company, onChange: setCompany, placeholder: "e.g. Equifax" },
                        { label: "State", value: state, onChange: setState, placeholder: "e.g. CA" },
                      ].map(({ label, value, onChange, placeholder }) => (
                        <div key={label}>
                          <label style={{ display: "block", fontSize: 10, color: "#475569", marginBottom: 4 }}>
                            {label}
                          </label>
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder={placeholder}
                            style={{
                              width: "100%",
                              borderRadius: 8,
                              border: "1px solid rgba(255,255,255,0.08)",
                              background: "rgba(3,7,18,0.6)",
                              padding: "7px 10px",
                              fontSize: 12,
                              color: "#e2e8f0",
                              outline: "none",
                              boxSizing: "border-box",
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Analyze button */}
            <div style={{ display: "flex", gap: 10 }}>
              <motion.button
                whileHover={{ scale: narrative.trim() ? 1.02 : 1 }}
                whileTap={{ scale: narrative.trim() ? 0.97 : 1 }}
                onClick={handleSubmit}
                disabled={!narrative.trim() || isRunning}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 22px",
                  borderRadius: 10,
                  border: "none",
                  background: narrative.trim() && !isRunning ? "#10b981" : "rgba(16,185,129,0.3)",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: narrative.trim() && !isRunning ? "pointer" : "not-allowed",
                  boxShadow: narrative.trim() ? "0 4px 20px rgba(16,185,129,0.25)" : "none",
                  transition: "all 0.2s ease",
                }}
              >
                {isRunning ? (
                  <Loader2 style={{ width: 15, height: 15 }} className="animate-spin" />
                ) : (
                  <Play style={{ width: 15, height: 15 }} />
                )}
                {isRunning ? "Analyzing…" : "Analyze Complaint"}
              </motion.button>
            </div>
          </div>
        )}
      </div>

      {/* ── Error banner ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              borderRadius: 12,
              border: "1px solid rgba(244,63,94,0.3)",
              background: "rgba(244,63,94,0.08)",
              padding: "14px 16px",
            }}
          >
            <AlertTriangle style={{ width: 16, height: 16, color: "#f43f5e", flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#fda4af", margin: 0 }}>Analysis Failed</p>
              <p style={{ fontSize: 11, color: "#f43f5e", marginTop: 2 }}>{error}</p>
              <p style={{ fontSize: 10, color: "#475569", marginTop: 4 }}>
                Make sure the backend is running:{" "}
                <code style={{ fontFamily: "monospace" }}>cd api && uvicorn main:app --reload --port 8000</code>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SECTION B: Risk Dashboard ─────────────────────────────────────────── */}
      <AnimatePresence>
        {classification && (
          <motion.div
            key="risk-dashboard"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Risk Assessment
            </p>
            <RiskDashboard
              classification={classification}
              routing={routing}
              qualityCheck={qualityCheck}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SECTION C: Pipeline Visualization ────────────────────────────────── */}
      <AnimatePresence>
        {hasStarted && (
          <motion.div
            key="pipeline"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Agent Pipeline
              </p>
              {phase === "complete" && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ fontSize: 11, color: "#10b981", fontWeight: 600 }}
                >
                  ✓ Complete {totalTime ? `in ${totalTime}s` : ""}
                </motion.span>
              )}
            </div>
            <AgentFlowDiagram agentStates={agentStates} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SECTION D: Reasoning Log ──────────────────────────────────────────── */}
      <AnimatePresence>
        {log.length > 0 && (
          <motion.div
            key="log"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <ReasoningLog entries={log} totalTime={totalTime} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SECTION E: Detailed Results ───────────────────────────────────────── */}
      <div ref={resultsRef} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {hasResults && (
          <p style={{ fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Detailed Results
          </p>
        )}

        <AnimatePresence>
          {classification && (
            <AgentCardWrapper
              key="classification"
              title="Classification"
              icon={Tag}
              delay={0}
              badge={
                <span
                  style={{
                    marginLeft: 8,
                    borderRadius: 9999,
                    padding: "2px 8px",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "capitalize",
                    background:
                      classification.severity === "critical"
                        ? "rgba(244,63,94,0.2)"
                        : classification.severity === "high"
                        ? "rgba(249,115,22,0.2)"
                        : classification.severity === "medium"
                        ? "rgba(245,158,11,0.2)"
                        : "rgba(16,185,129,0.2)",
                    color:
                      classification.severity === "critical"
                        ? "#fb7185"
                        : classification.severity === "high"
                        ? "#fb923c"
                        : classification.severity === "medium"
                        ? "#fbbf24"
                        : "#6ee7b7",
                  }}
                >
                  {classification.severity}
                </span>
              }
            >
              <ClassifierCard data={classification} />
            </AgentCardWrapper>
          )}

          {causalAnalysis && (
            <AgentCardWrapper key="causal" title="Causal Analysis" icon={GitBranch} delay={0.04}>
              <CausalCard data={causalAnalysis} />
            </AgentCardWrapper>
          )}

          {routing && (
            <AgentCardWrapper
              key="routing"
              title="Routing"
              icon={Route}
              delay={0.08}
              badge={
                <span
                  style={{
                    marginLeft: 8,
                    borderRadius: 9999,
                    padding: "2px 8px",
                    fontSize: 10,
                    fontWeight: 800,
                    background:
                      routing.priority_level === "P1"
                        ? "rgba(244,63,94,0.2)"
                        : routing.priority_level === "P2"
                        ? "rgba(249,115,22,0.2)"
                        : routing.priority_level === "P3"
                        ? "rgba(245,158,11,0.2)"
                        : "rgba(100,116,139,0.2)",
                    color:
                      routing.priority_level === "P1"
                        ? "#fb7185"
                        : routing.priority_level === "P2"
                        ? "#fb923c"
                        : routing.priority_level === "P3"
                        ? "#fbbf24"
                        : "#94a3b8",
                  }}
                >
                  {routing.priority_level}
                </span>
              }
            >
              <RouterCard data={routing} />
            </AgentCardWrapper>
          )}

          {resolution && (
            <AgentCardWrapper key="resolution" title="Resolution Plan" icon={FileText} delay={0.12}>
              <ResolutionCard data={resolution} />
            </AgentCardWrapper>
          )}

          {qualityCheck && (
            <AgentCardWrapper
              key="quality"
              title="Quality Check"
              icon={ShieldCheck}
              delay={0.16}
              badge={
                <span style={{ marginLeft: 8 }}>
                  <QualityBadge flag={qualityCheck.quality_flag} />
                </span>
              }
            >
              <QualityCheckCard data={qualityCheck} />
            </AgentCardWrapper>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
