"use client";

import { motion } from "framer-motion";
import type { ClassificationOutput, RoutingOutput, QualityCheckOutput } from "@/types";

interface Props {
  classification: ClassificationOutput;
  routing?: RoutingOutput | null;
  qualityCheck?: QualityCheckOutput | null;
}

const SEVERITY_STYLE = {
  low:      { bg: "#d1fae5", text: "#047857", border: "#6ee7b7" },
  medium:   { bg: "#fef9c3", text: "#854d0e", border: "#fde047" },
  high:     { bg: "#ffedd5", text: "#c2410c", border: "#fdba74" },
  critical: { bg: "#fee2e2", text: "#b91c1c", border: "#fca5a5" },
};

const PRIORITY_STYLE = {
  P1: { bg: "#fee2e2", text: "#b91c1c", border: "#fca5a5" },
  P2: { bg: "#ffedd5", text: "#c2410c", border: "#fdba74" },
  P3: { bg: "#fef9c3", text: "#854d0e", border: "#fde047" },
  P4: { bg: "#f3f4f6", text: "#6b7280", border: "#e5e7eb" },
};

function MetricCard({ label, children, delay }: { label: string; children: React.ReactNode; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      style={{
        flex: 1, borderRadius: 14, border: "1px solid #e5e7eb",
        background: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        padding: "16px 18px",
      }}
    >
      <p style={{ fontSize: 10, color: "#9ca3af", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </p>
      {children}
    </motion.div>
  );
}

function RiskGauge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? "#ef4444" : pct >= 40 ? "#f59e0b" : "#10b981";
  const circumference = 2 * Math.PI * 26;
  const offset = circumference * (1 - value);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <svg width="60" height="60" viewBox="0 0 60 60">
        <circle cx="30" cy="30" r="26" fill="none" stroke="#f3f4f6" strokeWidth="5" />
        <motion.circle
          cx="30" cy="30" r="26"
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          style={{ transformOrigin: "30px 30px", transform: "rotate(-90deg)" }}
        />
        <text x="30" y="34" textAnchor="middle" fontSize="13" fontWeight="800" fill="#111827">
          {pct}%
        </text>
      </svg>
      <p style={{ fontSize: 11, color: pct >= 70 ? "#b91c1c" : pct >= 40 ? "#92400e" : "#065f46" }}>
        {pct >= 70 ? "High Risk" : pct >= 40 ? "Moderate" : "Low Risk"}
      </p>
    </div>
  );
}

export default function RiskDashboard({ classification, routing, qualityCheck }: Props) {
  const sevStyle = SEVERITY_STYLE[classification.severity] ?? SEVERITY_STYLE.medium;
  const priStyle = routing ? PRIORITY_STYLE[routing.priority_level] ?? PRIORITY_STYLE.P3 : null;
  const confidence = qualityCheck?.overall_confidence ?? classification.confidence;

  return (
    <div style={{ display: "flex", gap: 12 }}>
      {/* Severity */}
      <MetricCard label="Severity" delay={0}>
        <div style={{
          display: "inline-flex", alignItems: "center",
          padding: "6px 14px", borderRadius: 9,
          background: sevStyle.bg, border: `1px solid ${sevStyle.border}`,
        }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: sevStyle.text, textTransform: "capitalize" }}>
            {classification.severity}
          </span>
        </div>
        <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 8 }}>complaint severity level</p>
      </MetricCard>

      {/* Compliance Risk */}
      <MetricCard label="Compliance Risk" delay={0.05}>
        <RiskGauge value={classification.compliance_risk_score} />
      </MetricCard>

      {/* Priority */}
      <MetricCard label="Priority" delay={0.1}>
        {priStyle && routing ? (
          <div style={{
            display: "inline-flex", alignItems: "center",
            padding: "6px 14px", borderRadius: 9,
            background: priStyle.bg, border: `1px solid ${priStyle.border}`,
          }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: priStyle.text }}>
              {routing.priority_level}
            </span>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: "#9ca3af" }}>Routing…</span>
        )}
        <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 8 }}>assigned priority</p>
      </MetricCard>

      {/* Confidence */}
      <MetricCard label="Confidence" delay={0.15}>
        <div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ fontSize: 26, fontWeight: 800, color: "#111827", lineHeight: 1 }}
          >
            {Math.round(confidence * 100)}
            <span style={{ fontSize: 13, color: "#9ca3af", fontWeight: 400 }}>%</span>
          </motion.p>
          <div style={{ marginTop: 8, height: 5, borderRadius: 9999, background: "#f3f4f6" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${confidence * 100}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              style={{
                height: "100%", borderRadius: 9999,
                background: confidence >= 0.8 ? "#10b981" : confidence >= 0.5 ? "#f59e0b" : "#f43f5e",
              }}
            />
          </div>
          <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 6 }}>overall pipeline confidence</p>
        </div>
      </MetricCard>
    </div>
  );
}
