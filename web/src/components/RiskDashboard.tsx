"use client";

import { motion } from "framer-motion";
import type { ClassificationOutput, RoutingOutput, QualityCheckOutput } from "@/types";

interface Props {
  classification: ClassificationOutput;
  routing?: RoutingOutput | null;
  qualityCheck?: QualityCheckOutput | null;
}

const SEVERITY_CONFIG = {
  low:      { color: "#10b981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)" },
  medium:   { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" },
  high:     { color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.3)" },
  critical: { color: "#f43f5e", bg: "rgba(244,63,94,0.12)",  border: "rgba(244,63,94,0.3)" },
};

const PRIORITY_CONFIG = {
  P1: { color: "#f43f5e", bg: "rgba(244,63,94,0.12)",  border: "rgba(244,63,94,0.3)" },
  P2: { color: "#f97316", bg: "rgba(249,115,22,0.12)", border: "rgba(249,115,22,0.3)" },
  P3: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" },
  P4: { color: "#94a3b8", bg: "rgba(148,163,184,0.08)", border: "rgba(148,163,184,0.2)" },
};

function RiskCard({
  label,
  children,
  delay,
}: {
  label: string;
  children: React.ReactNode;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      style={{
        flex: 1,
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.03)",
        backdropFilter: "blur(8px)",
        padding: "14px 16px",
      }}
    >
      <p style={{ fontSize: 10, color: "#475569", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </p>
      {children}
    </motion.div>
  );
}

function RiskGauge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? "#f43f5e" : pct >= 40 ? "#f59e0b" : "#10b981";
  const circumference = 2 * Math.PI * 20;
  const offset = circumference * (1 - value);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <svg width="48" height="48" viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
        <motion.circle
          cx="24"
          cy="24"
          r="20"
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ transformOrigin: "24px 24px", transform: "rotate(-90deg)" }}
        />
        <text x="24" y="28" textAnchor="middle" fontSize="10" fontWeight="700" fill={color}>
          {pct}%
        </text>
      </svg>
      <div>
        <p style={{ fontSize: 11, color: "#94a3b8" }}>
          {pct >= 70 ? "High Risk" : pct >= 40 ? "Moderate" : "Low Risk"}
        </p>
      </div>
    </div>
  );
}

export default function RiskDashboard({ classification, routing, qualityCheck }: Props) {
  const sevConfig = SEVERITY_CONFIG[classification.severity] ?? SEVERITY_CONFIG.medium;
  const priConfig = routing
    ? PRIORITY_CONFIG[routing.priority_level] ?? PRIORITY_CONFIG.P3
    : null;
  const confidence = qualityCheck?.overall_confidence ?? classification.confidence;

  return (
    <div style={{ display: "flex", gap: 12 }}>
      {/* Severity */}
      <RiskCard label="Severity" delay={0}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "5px 12px",
            borderRadius: 8,
            background: sevConfig.bg,
            border: `1px solid ${sevConfig.border}`,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: sevConfig.color, textTransform: "capitalize" }}>
            {classification.severity}
          </span>
        </div>
        <p style={{ fontSize: 10, color: "#334155", marginTop: 6 }}>complaint severity</p>
      </RiskCard>

      {/* Compliance Risk */}
      <RiskCard label="Compliance Risk" delay={0.05}>
        <RiskGauge value={classification.compliance_risk_score} />
      </RiskCard>

      {/* Priority */}
      <RiskCard label="Priority" delay={0.1}>
        {priConfig && routing ? (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "5px 14px",
              borderRadius: 8,
              background: priConfig.bg,
              border: `1px solid ${priConfig.border}`,
            }}
          >
            <span style={{ fontSize: 18, fontWeight: 800, color: priConfig.color }}>
              {routing.priority_level}
            </span>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: "#334155" }}>Routing…</span>
        )}
        <p style={{ fontSize: 10, color: "#334155", marginTop: 6 }}>assigned priority</p>
      </RiskCard>

      {/* Confidence */}
      <RiskCard label="Confidence" delay={0.15}>
        <div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ fontSize: 22, fontWeight: 800, color: "#f1f5f9", lineHeight: 1 }}
          >
            {Math.round(confidence * 100)}
            <span style={{ fontSize: 12, color: "#475569" }}>%</span>
          </motion.p>
          <div style={{ marginTop: 6, height: 4, borderRadius: 4, background: "rgba(255,255,255,0.06)" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${confidence * 100}%` }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              style={{
                height: "100%",
                borderRadius: 4,
                background: confidence >= 0.8 ? "#10b981" : confidence >= 0.5 ? "#f59e0b" : "#f43f5e",
              }}
            />
          </div>
        </div>
      </RiskCard>
    </div>
  );
}
