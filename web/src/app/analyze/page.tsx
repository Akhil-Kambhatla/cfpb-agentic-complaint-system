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
  Banknote,
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
          height: 700,
          borderRadius: 16,
          border: "1px solid #e5e7eb",
          background: "#f8fafc",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Loader2 style={{ width: 24, height: 24, color: "#d1d5db" }} className="animate-spin" />
      </div>
    ),
  }
);

// ─── Sample complaints ────────────────────────────────────────────────────────
const SAMPLES = [
  {
    id: "s1",
    product: "Credit Card",
    icon: CreditCard,
    iconColor: "#0ea5e9",
    excerpt:
      "Hotel charged me $850 + 15,000 points via Citi travel portal after a weather delay. Citi failed to investigate my dispute properly under the Fair Credit Billing Act.",
    narrative: `I booked a hotel through my Citi credit card travel portal for a trip in January. My flight was delayed due to weather and I could not check in on time. I called the hotel and they told me to contact Citi since I booked through their portal. I called Citi twice — both times they promised to resolve the issue and said they would call me back. They never did. By the next morning the hotel had charged me the full $850 room rate plus 15,000 ThankYou points. I filed a billing dispute with Citi and after 45 days they ruled it was my responsibility. When I asked for the investigation documents they said they could not provide them. I believe Citi violated my rights under the Fair Credit Billing Act by failing to conduct a proper investigation.`,
  },
  {
    id: "s2",
    product: "Debt Collection",
    icon: Building2,
    iconColor: "#f43f5e",
    excerpt:
      "Collector harasses me over a paid medical bill, reported it to all 3 bureaus (–85 pts), and called my elderly mother without authorization.",
    narrative: `I keep receiving calls and letters from a debt collection agency about a medical bill that I already paid in full over a year ago. I have sent them proof of payment three times — bank statements and a receipt from the hospital — but they continue to harass me. They have now reported this debt to all three credit bureaus, dropping my score by 85 points. They also called my elderly mother trying to get information about me, which I never authorized. I want them to stop contacting me and remove the false reporting.`,
  },
  {
    id: "s3",
    product: "Mortgage",
    icon: Home,
    iconColor: "#a78bfa",
    excerpt:
      "Servicer force-placed a $3,200 insurance policy despite receiving proof of new coverage. Monthly payment rose $267 and reps give conflicting answers.",
    narrative: `Our mortgage company force-placed an insurance policy on our home after a brief lapse in coverage. We immediately got new insurance and sent proof to the servicer, but they are still charging us $3,200 for backdated insurance that multiple insurance agents told us is illegal to issue. They added this to our escrow and our monthly payment increased by $267. When we call, each representative tells us something different and no one can explain the charges.`,
  },
  {
    id: "s4",
    product: "Checking Account",
    icon: Landmark,
    iconColor: "#10b981",
    excerpt:
      "Deposited $2,500 cash at Chase; teller recorded $1,300. After 45 minutes, branch confirmed the shortage but my claim was still denied.",
    narrative: `I deposited $2,500 cash at a Chase branch. The teller ran the money through the counter and put it in her drawer before confirming the amount. The screen showed $1,300 instead of $2,500. When I objected, they said they could not recount because the money was in the drawer. After 45 minutes of waiting for the manager to balance the drawer, they confirmed only $1,300. I am missing $1,200 and the branch manager told me to file a claim, which was denied.`,
  },
  {
    id: "s5",
    product: "Payday Loan",
    icon: Banknote,
    iconColor: "#f97316",
    excerpt:
      "Lender debited my account without authorization after I revoked ACH access, triggering $280 in overdraft fees under Regulation E.",
    narrative: `I took out a $400 payday loan and set up ACH auto-pay. Before the due date I called the lender and revoked ACH authorization in writing as permitted under Regulation E. Despite this, they debited my account anyway — on two separate occasions — causing $280 in overdraft fees charged by my bank. My bank refused to reverse the fees, saying the ACH debits appeared legitimate. The lender claims they never received my revocation notice but I have email confirmation with a timestamp. This is a clear violation of Regulation E's error resolution requirements. I need both the overdraft fees refunded and the unauthorized ACH debits reversed.`,
  },
];

// ─── Framer-motion variants for staggered results reveal ──────────────────────
const resultsContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.18, delayChildren: 0.1 },
  },
};
const resultItem = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

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
    eventChain,
    riskAnalysis,
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
  const isComplete = phase === "complete";
  const hasStarted = phase !== "idle";
  const showResults = isComplete;

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
    }, 500);
  };

  const handleReset = () => {
    resetAnalysis();
    setInputCollapsed(false);
    setMetaOpen(false);
  };

  const card = {
    borderRadius: 16,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
  };

  const isLowConfidence = qualityCheck && qualityCheck.overall_confidence < 0.7;

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 24 }}>

      {/* ── SECTION A: Input ─────────────────────────────────────────────────── */}
      <div style={card}>
        {inputCollapsed ? (
          <button
            onClick={() => setInputCollapsed(false)}
            style={{
              width: "100%", display: "flex", alignItems: "center",
              justifyContent: "space-between", padding: "14px 20px",
              background: "transparent", border: "none", cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Complaint Input</span>
              <span style={{
                fontSize: 10, color: "#6b7280", padding: "2px 7px", borderRadius: 5,
                background: "#f3f4f6", border: "1px solid #e5e7eb",
              }}>
                {narrative.length} chars
              </span>
            </div>
            <ChevronDown style={{ width: 15, height: 15, color: "#9ca3af" }} />
          </button>
        ) : (
          <div style={{ padding: "24px 24px 20px" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>
                  Analyze a Complaint
                </h1>
                <p style={{ fontSize: 13, color: "#4b5563", marginTop: 4 }}>
                  Select a sample or paste your own complaint narrative
                </p>
              </div>
              {hasStarted && (
                <motion.button
                  whileHover={{ scale: 1.02, background: "#f3f4f6" }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleReset}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "7px 14px", borderRadius: 8,
                    border: "1px solid #e5e7eb", background: "#ffffff",
                    color: "#4b5563", fontSize: 12, cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <RefreshCw style={{ width: 12, height: 12 }} />
                  New Analysis
                </motion.button>
              )}
            </div>

            {/* Sample cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 20 }}>
              {SAMPLES.map((s) => {
                const Icon = s.icon;
                const isSelected = narrative === s.narrative;
                return (
                  <motion.button
                    key={s.id}
                    whileHover={{ y: -3, boxShadow: "0 6px 16px rgba(0,0,0,0.10)" }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => loadSample(s.id)}
                    style={{
                      borderRadius: 12,
                      border: `1.5px solid ${isSelected ? "#10b981" : "#e5e7eb"}`,
                      background: isSelected ? "#f0fdf4" : "#ffffff",
                      padding: "12px 12px",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "border-color 0.2s ease",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 6,
                        background: `${s.iconColor}18`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Icon style={{ width: 12, height: 12, color: s.iconColor }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: s.iconColor }}>
                        {s.product}
                      </span>
                    </div>
                    <p style={{ fontSize: 10.5, color: "#4b5563", lineHeight: 1.5, margin: 0 }}>
                      {s.excerpt}
                    </p>
                  </motion.button>
                );
              })}
            </div>

            {/* Textarea */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
                Complaint narrative *
              </label>
              <textarea
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                placeholder="Paste a consumer complaint narrative here, or select a sample above..."
                rows={6}
                style={{
                  width: "100%", borderRadius: 10,
                  border: "1.5px solid #e5e7eb", background: "#fafafa",
                  padding: "10px 14px", fontSize: 13, color: "#111827",
                  fontFamily: "monospace", resize: "none",
                  outline: "none", boxSizing: "border-box",
                  transition: "border-color 0.2s ease",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#10b981"; e.currentTarget.style.background = "#fff"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.background = "#fafafa"; }}
              />
              <p style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>{narrative.length} characters</p>
            </div>

            {/* Metadata toggle */}
            <div style={{ marginBottom: 16 }}>
              <button
                onClick={() => setMetaOpen(!metaOpen)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  fontSize: 12, color: "#6b7280",
                  background: "transparent", border: "none", cursor: "pointer", padding: 0,
                }}
              >
                {metaOpen ? <ChevronUp style={{ width: 13, height: 13 }} /> : <ChevronDown style={{ width: 13, height: 13 }} />}
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
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
                      {[
                        { label: "Company", value: company, onChange: setCompany, placeholder: "e.g. Equifax" },
                        { label: "State", value: state, onChange: setState, placeholder: "e.g. CA" },
                      ].map(({ label, value, onChange, placeholder }) => (
                        <div key={label}>
                          <label style={{ display: "block", fontSize: 11, color: "#6b7280", marginBottom: 5 }}>{label}</label>
                          <input
                            type="text" value={value}
                            onChange={(e) => onChange(e.target.value)}
                            placeholder={placeholder}
                            style={{
                              width: "100%", borderRadius: 8,
                              border: "1.5px solid #e5e7eb", background: "#fafafa",
                              padding: "7px 10px", fontSize: 12, color: "#111827",
                              outline: "none", boxSizing: "border-box",
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
            <motion.button
              whileHover={{ scale: narrative.trim() && !isRunning ? 1.02 : 1, background: narrative.trim() && !isRunning ? "#059669" : undefined }}
              whileTap={{ scale: narrative.trim() && !isRunning ? 0.97 : 1 }}
              onClick={handleSubmit}
              disabled={!narrative.trim() || isRunning}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 24px", borderRadius: 10, border: "none",
                background: narrative.trim() && !isRunning ? "#10b981" : "#d1d5db",
                color: "#fff", fontSize: 14, fontWeight: 600,
                cursor: narrative.trim() && !isRunning ? "pointer" : "not-allowed",
                boxShadow: narrative.trim() ? "0 4px 14px rgba(16,185,129,0.3)" : "none",
                transition: "all 0.2s ease",
              }}
            >
              {isRunning ? (
                <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
              ) : (
                <Play style={{ width: 16, height: 16 }} />
              )}
              {isRunning ? "Analyzing…" : "Analyze Complaint"}
            </motion.button>
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
              display: "flex", alignItems: "flex-start", gap: 12,
              borderRadius: 12, border: "1px solid #fca5a5",
              background: "#fff1f2", padding: "14px 16px",
            }}
          >
            <AlertTriangle style={{ width: 16, height: 16, color: "#ef4444", flexShrink: 0, marginTop: 1 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#991b1b", margin: 0 }}>Analysis Failed</p>
              <p style={{ fontSize: 11, color: "#ef4444", marginTop: 2 }}>{error}</p>
              <p style={{ fontSize: 10, color: "#6b7280", marginTop: 4 }}>
                Make sure the backend is running:{" "}
                <code style={{ fontFamily: "monospace" }}>cd api && uvicorn main:app --reload --port 8000</code>
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── SECTION C: Pipeline Visualization ────────────────────────────────── */}
      <AnimatePresence>
        {hasStarted && (
          <motion.div
            key="pipeline"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Agent Pipeline
              </p>
              {isComplete && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ fontSize: 12, color: "#059669", fontWeight: 600 }}
                >
                  ✓ Complete {totalTime ? `· ${totalTime}s` : ""}
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

      {/* ── SECTIONS E+: Results (after pipeline completes) ──────────────────── */}
      <div ref={resultsRef}>
        <AnimatePresence>
          {showResults && (
            <motion.div
              key="all-results"
              variants={resultsContainer}
              initial="hidden"
              animate="visible"
              style={{ display: "flex", flexDirection: "column", gap: 16 }}
            >
              {/* Human-in-the-loop banner */}
              {isLowConfidence && (
                <motion.div variants={resultItem}>
                  <div style={{
                    display: "flex", alignItems: "flex-start", gap: 14,
                    borderRadius: 14, border: "1px solid #fcd34d",
                    borderLeft: "5px solid #f59e0b",
                    background: "#fffbeb", padding: "16px 20px",
                    boxShadow: "0 2px 8px rgba(245,158,11,0.12)",
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: "#fef3c7", border: "1px solid #fcd34d",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <AlertTriangle style={{ width: 18, height: 18, color: "#d97706" }} />
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "#92400e", margin: 0 }}>
                        Human Review Recommended
                      </p>
                      <p style={{ fontSize: 12, color: "#78350f", marginTop: 4, lineHeight: 1.6 }}>
                        Overall pipeline confidence is <strong>{qualityCheck ? Math.round(qualityCheck.overall_confidence * 100) : "—"}%</strong>, below the 70% threshold. One or more agents returned low-confidence outputs. A compliance reviewer should verify these classifications before routing or responding.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Risk Dashboard */}
              {classification && (
                <motion.div variants={resultItem}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                    Risk Assessment
                  </p>
                  <RiskDashboard
                    classification={classification}
                    routing={routing}
                    qualityCheck={qualityCheck}
                  />
                </motion.div>
              )}

              {/* Detailed results label */}
              <motion.div variants={resultItem} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Detailed Results
                </p>
                <motion.button
                  whileHover={{ scale: 1.02, background: "#f3f4f6" }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleReset}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "6px 12px", borderRadius: 8,
                    border: "1px solid #e5e7eb", background: "#ffffff",
                    color: "#4b5563", fontSize: 11, cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <RefreshCw style={{ width: 11, height: 11 }} />
                  New Analysis
                </motion.button>
              </motion.div>

              {/* Classification */}
              {classification && (
                <motion.div variants={resultItem}>
                  <AgentCardWrapper
                    title="Classification"
                    icon={Tag}
                    badge={
                      <span style={{
                        marginLeft: 8, borderRadius: 9999, padding: "2px 9px", fontSize: 10, fontWeight: 700,
                        textTransform: "capitalize",
                        background: classification.severity === "critical" ? "#fee2e2" : classification.severity === "high" ? "#ffedd5" : classification.severity === "medium" ? "#fef9c3" : "#d1fae5",
                        color: classification.severity === "critical" ? "#b91c1c" : classification.severity === "high" ? "#c2410c" : classification.severity === "medium" ? "#854d0e" : "#047857",
                      }}>
                        {classification.severity}
                      </span>
                    }
                  >
                    <ClassifierCard data={classification} />
                  </AgentCardWrapper>
                </motion.div>
              )}

              {/* Event Chain */}
              {eventChain && (
                <motion.div variants={resultItem}>
                  <AgentCardWrapper title="How This Complaint Happened" icon={GitBranch}>
                    <CausalCard data={eventChain} />
                  </AgentCardWrapper>
                </motion.div>
              )}

              {/* Routing */}
              {routing && (
                <motion.div variants={resultItem}>
                  <AgentCardWrapper
                    title="Routing"
                    icon={Route}
                    badge={
                      <span style={{
                        marginLeft: 8, borderRadius: 9999, padding: "2px 9px", fontSize: 10, fontWeight: 800,
                        background: routing.priority_level === "P1" ? "#fee2e2" : routing.priority_level === "P2" ? "#ffedd5" : routing.priority_level === "P3" ? "#fef9c3" : "#f3f4f6",
                        color: routing.priority_level === "P1" ? "#b91c1c" : routing.priority_level === "P2" ? "#c2410c" : routing.priority_level === "P3" ? "#854d0e" : "#6b7280",
                      }}>
                        {routing.priority_level}
                      </span>
                    }
                  >
                    <RouterCard data={routing} />
                  </AgentCardWrapper>
                </motion.div>
              )}

              {/* Resolution */}
              {resolution && (
                <motion.div variants={resultItem}>
                  <AgentCardWrapper title="Resolution Plan" icon={FileText}>
                    <ResolutionCard data={resolution} />
                  </AgentCardWrapper>
                </motion.div>
              )}

              {/* Quality Check */}
              {qualityCheck && (
                <motion.div variants={resultItem}>
                  <AgentCardWrapper
                    title="Quality Check"
                    icon={ShieldCheck}
                    badge={<span style={{ marginLeft: 8 }}><QualityBadge flag={qualityCheck.quality_flag} /></span>}
                  >
                    <QualityCheckCard data={qualityCheck} />
                  </AgentCardWrapper>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
