"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import type {
  ClassificationOutput,
  CausalAnalysisOutput,
  RoutingOutput,
  ResolutionOutput,
  QualityCheckOutput,
} from "@/types";
import CausalGraph from "./CausalGraph";
import ResolutionLetter from "./ResolutionLetter";
import QualityBadge from "./QualityBadge";

// ── Confidence bar ─────────────────────────────────────────────────────────────

function ConfidenceBar({ value, label, warnBelow = 0.7 }: { value: number; label?: string; warnBelow?: number }) {
  const color = value >= 0.8 ? "#10b981" : value >= 0.5 ? "#f59e0b" : "#f43f5e";
  const isLow = value < warnBelow;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && (
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <p style={{ fontSize: 11, color: "#4b5563", textTransform: "capitalize" }}>{label}</p>
          {isLow && (
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              padding: "1px 6px", borderRadius: 9999,
              background: "#fef3c7", border: "1px solid #fcd34d",
              fontSize: 10, fontWeight: 600, color: "#92400e",
            }}>
              <AlertTriangle style={{ width: 9, height: 9 }} />
              Review
            </span>
          )}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ height: 6, flex: 1, borderRadius: 9999, background: "#f3f4f6" }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${value * 100}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            style={{ height: "100%", borderRadius: 9999, background: color }}
          />
        </div>
        <span style={{ fontSize: 11, fontFamily: "monospace", color: "#374151", width: 36, textAlign: "right" }}>
          {(value * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

// ── Classifier card ───────────────────────────────────────────────────────────

export function ClassifierCard({ data }: { data: ClassificationOutput }) {
  const sevColor =
    data.severity === "critical" ? { bg: "#fee2e2", text: "#b91c1c", border: "#fca5a5" } :
    data.severity === "high"     ? { bg: "#ffedd5", text: "#c2410c", border: "#fdba74" } :
    data.severity === "medium"   ? { bg: "#fef9c3", text: "#854d0e", border: "#fde047" } :
                                   { bg: "#d1fae5", text: "#047857", border: "#6ee7b7" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <span style={{
          borderRadius: 9999, padding: "4px 12px", fontSize: 12, fontWeight: 600,
          background: "#e0f2fe", color: "#0369a1", border: "1px solid #bae6fd",
        }}>
          {data.predicted_product}
        </span>
        <span style={{
          borderRadius: 9999, padding: "4px 12px", fontSize: 12, fontWeight: 700,
          textTransform: "capitalize",
          background: sevColor.bg, color: sevColor.text, border: `1px solid ${sevColor.border}`,
        }}>
          {data.severity} severity
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[
          { label: "Issue", value: data.predicted_issue },
          { label: "Sub-issue", value: data.predicted_sub_issue ?? "—" },
        ].map(({ label, value }) => (
          <div key={label} style={{ borderRadius: 10, border: "1px solid #f3f4f6", background: "#fafafa", padding: 12 }}>
            <p style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
            <p style={{ fontSize: 12, color: "#111827" }}>{value}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <ConfidenceBar value={data.confidence} label="Classifier confidence" />
        <ConfidenceBar value={data.compliance_risk_score} label="Compliance risk score" warnBelow={2} />
      </div>

      <div style={{ borderRadius: 10, border: "1px solid #f3f4f6", background: "#fafafa", padding: 12 }}>
        <p style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Reasoning</p>
        <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.6 }}>{data.reasoning}</p>
      </div>
    </div>
  );
}

// ── Causal Analyst card ───────────────────────────────────────────────────────

export function CausalCard({ data }: { data: CausalAnalysisOutput }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <CausalGraph data={data} />
      <ConfidenceBar value={data.confidence} label="Causal analysis confidence" />
    </div>
  );
}

// ── Router card ───────────────────────────────────────────────────────────────

export function RouterCard({ data }: { data: RoutingOutput }) {
  const allTeams = [
    "compliance", "billing_disputes", "fraud",
    "customer_service", "legal", "executive_escalation",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Team Assignment
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
          {allTeams.map((team) => {
            const isSelected = team === data.assigned_team;
            return (
              <div
                key={team}
                style={{
                  padding: "8px 10px", borderRadius: 8,
                  border: `1.5px solid ${isSelected ? "#10b981" : "#e5e7eb"}`,
                  background: isSelected ? "#ecfdf5" : "#fafafa",
                  fontSize: 11, fontWeight: isSelected ? 700 : 400,
                  color: isSelected ? "#047857" : "#6b7280",
                  textAlign: "center",
                  transition: "all 0.3s ease",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                }}
              >
                {isSelected && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", flexShrink: 0 }} />}
                {team.replace(/_/g, " ")}
              </div>
            );
          })}
        </div>
      </div>

      {data.escalation_reason && (
        <div style={{ borderRadius: 10, border: "1px solid #fca5a5", background: "#fff1f2", padding: 12 }}>
          <p style={{ fontSize: 10, color: "#ef4444", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Escalation Reason</p>
          <p style={{ fontSize: 12, color: "#991b1b", lineHeight: 1.6 }}>{data.escalation_reason}</p>
        </div>
      )}

      <div style={{ borderRadius: 10, border: "1px solid #f3f4f6", background: "#fafafa", padding: 12 }}>
        <p style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Routing Reasoning</p>
        <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.6 }}>{data.reasoning}</p>
      </div>
    </div>
  );
}

// ── Resolution card ───────────────────────────────────────────────────────────

export function ResolutionCard({ data }: { data: ResolutionOutput }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Regulations + timeline */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
        <div style={{ borderRadius: 10, border: "1px solid #f3f4f6", background: "#fafafa", padding: 12 }}>
          <p style={{ fontSize: 10, color: "#6b7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Applicable Regulations</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {data.applicable_regulations.map((reg) => (
              <span
                key={reg}
                style={{
                  borderRadius: 6, background: "#e0f2fe", color: "#0369a1",
                  padding: "2px 8px", fontSize: 11, fontFamily: "monospace", fontWeight: 600,
                }}
              >
                {reg}
              </span>
            ))}
          </div>
        </div>
        <div style={{ borderRadius: 10, border: "1px solid #f3f4f6", background: "#fafafa", padding: 12, textAlign: "center", minWidth: 100 }}>
          <p style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Est. Resolution</p>
          <p style={{ fontSize: 28, fontWeight: 800, color: "#111827", lineHeight: 1 }}>{data.estimated_resolution_days}</p>
          <p style={{ fontSize: 10, color: "#6b7280" }}>business days</p>
        </div>
      </div>

      {/* Remediation steps */}
      <div>
        <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>Remediation Steps</p>
        <ol style={{ display: "flex", flexDirection: "column", gap: 8, padding: 0, margin: 0, listStyle: "none" }}>
          {data.remediation_steps.map((step, i) => (
            <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{
                display: "flex", width: 22, height: 22, flexShrink: 0,
                alignItems: "center", justifyContent: "center",
                borderRadius: "50%", background: "#d1fae5", fontSize: 11, fontWeight: 700, color: "#059669",
              }}>
                {i + 1}
              </span>
              <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.6, paddingTop: 2 }}>{step}</p>
            </li>
          ))}
        </ol>
      </div>

      {/* Preventive recommendations */}
      {data.preventive_recommendations && data.preventive_recommendations.length > 0 && (
        <div>
          <p style={{ fontSize: 11, color: "#6b7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>Preventive Recommendations</p>
          <ul style={{ display: "flex", flexDirection: "column", gap: 6, padding: 0, margin: 0, listStyle: "none" }}>
            {data.preventive_recommendations.map((rec, i) => (
              <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                <span style={{ color: "#10b981", flexShrink: 0, marginTop: 2 }}>•</span>
                <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.6 }}>{rec}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Customer letter */}
      <ResolutionLetter letter={data.customer_response_letter} />
    </div>
  );
}

// ── Quality Check card ────────────────────────────────────────────────────────

export function QualityCheckCard({ data }: { data: QualityCheckOutput }) {
  const [traceOpen, setTraceOpen] = useState(false);
  const pct = Math.round(data.overall_confidence * 100);
  const circumference = 2 * Math.PI * 38;
  const isLowConfidence = data.overall_confidence < 0.7;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Human-in-the-loop warning */}
      {isLowConfidence && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            borderRadius: 10, border: "1px solid #fcd34d",
            borderLeft: "4px solid #f59e0b",
            background: "#fffbeb", padding: "12px 14px",
          }}
        >
          <AlertTriangle style={{ width: 16, height: 16, color: "#d97706", flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#92400e", margin: 0 }}>Human Review Recommended</p>
            <p style={{ fontSize: 11, color: "#78350f", marginTop: 2, lineHeight: 1.5 }}>
              Overall confidence is {pct}% — below the 70% threshold. A human reviewer should verify these classifications before acting.
            </p>
          </div>
        </motion.div>
      )}

      {/* Confidence ring + badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <svg width="96" height="96" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="38" fill="none" stroke="#f3f4f6" strokeWidth="7" />
          <motion.circle
            cx="48" cy="48" r="38" fill="none"
            stroke={pct >= 80 ? "#10b981" : pct >= 60 ? "#f59e0b" : "#f43f5e"}
            strokeWidth="7" strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - data.overall_confidence) }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{ transformOrigin: "48px 48px", transform: "rotate(-90deg)" }}
          />
          <text x="48" y="52" textAnchor="middle" fontSize="20" fontWeight="800" fill="#111827">
            {pct}%
          </text>
        </svg>
        <div>
          <p style={{ fontSize: 12, color: "#4b5563", marginBottom: 8 }}>Overall confidence</p>
          <QualityBadge flag={data.quality_flag} size="lg" />
        </div>
      </div>

      {/* Per-agent bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <p style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>Per-Agent Confidence</p>
        {Object.entries(data.agent_confidences).map(([agent, conf]) => (
          <ConfidenceBar key={agent} value={conf} label={agent.replace(/_/g, " ")} />
        ))}
      </div>

      {data.consistency_issues.length > 0 && (
        <div style={{ borderRadius: 10, border: "1px solid #fcd34d", background: "#fffbeb", padding: 12 }}>
          <p style={{ fontSize: 10, color: "#92400e", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>Consistency Issues</p>
          <ul style={{ padding: 0, margin: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
            {data.consistency_issues.map((issue, i) => (
              <li key={i} style={{ fontSize: 12, color: "#78350f" }}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Reasoning trace */}
      <div style={{ borderRadius: 10, border: "1px solid #e5e7eb" }}>
        <button
          onClick={() => setTraceOpen(!traceOpen)}
          style={{
            display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between",
            padding: "10px 14px", background: "transparent", border: "none", cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 12, color: "#4b5563" }}>Reasoning Trace</span>
          {traceOpen ? <ChevronUp style={{ width: 14, height: 14, color: "#9ca3af" }} /> : <ChevronDown style={{ width: 14, height: 14, color: "#9ca3af" }} />}
        </button>
        <AnimatePresence>
          {traceOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              style={{ overflow: "hidden" }}
            >
              <p style={{ padding: "10px 14px", paddingTop: 0, borderTop: "1px solid #f3f4f6", fontSize: 12, color: "#374151", lineHeight: 1.6 }}>
                {data.reasoning_trace}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Generic expandable wrapper ────────────────────────────────────────────────

interface CardWrapperProps {
  title: string;
  icon: React.ElementType;
  badge?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  delay?: number;
}

export function AgentCardWrapper({
  title,
  icon: Icon,
  badge,
  children,
  defaultOpen = true,
}: CardWrapperProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{
      borderRadius: 16, border: "1px solid #e5e7eb",
      background: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      overflow: "hidden",
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", background: "transparent", border: "none", cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: "#f3f4f6", border: "1px solid #e5e7eb",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon style={{ width: 17, height: 17, color: "#374151" }} />
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{title}</span>
          {badge}
        </div>
        {open ? (
          <ChevronUp style={{ width: 16, height: 16, color: "#9ca3af" }} />
        ) : (
          <ChevronDown style={{ width: 16, height: 16, color: "#9ca3af" }} />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.25 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ borderTop: "1px solid #f3f4f6", padding: "16px 20px" }}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
