"use client";

import { motion } from "framer-motion";
import type { RiskAnalysisOutput } from "@/types";

interface Props {
  riskAnalysis: RiskAnalysisOutput;
  company?: string | null;
}

// ─── Semi-circle gauge (speedometer) ─────────────────────────────────────────
function SemiGauge({ value }: { value: number }) {
  const R = 52;
  const CX = 72;
  const CY = 64;
  const STROKE = 10;
  const arcLen = Math.PI * R;
  const offset = arcLen * (1 - value);
  const pct = Math.round(value * 100);

  // Color zones: 0-30 green, 30-60 yellow, 60-100 red (for resolution probability — higher is better)
  const color = pct >= 60 ? "#10b981" : pct >= 30 ? "#f59e0b" : "#ef4444";
  const label = pct >= 60 ? "Likely resolved" : pct >= 30 ? "Uncertain" : "High risk";

  // Needle: angle from 180° (left) to 0° (right), value maps 0→180°, 1→0°
  const angleRad = (1 - value) * Math.PI;
  const needleLen = R - 8;
  const nx = CX + needleLen * Math.cos(angleRad);
  const ny = CY - needleLen * Math.sin(angleRad); // SVG Y is inverted

  // Zone arcs (background color zones)
  const redEnd = 0.3;
  const yellowEnd = 0.6;
  const redLen = arcLen * redEnd;
  const yellowLen = arcLen * (yellowEnd - redEnd);
  const greenLen = arcLen * (1 - yellowEnd);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg width={CX * 2} height={CY + 16} viewBox={`0 ${CY - R - STROKE} ${CX * 2} ${R + STROKE + 16}`}>
        <defs>
          <linearGradient id="gauge-red" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>

        {/* Background arc — gray */}
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke="#f3f4f6"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />

        {/* Red zone (0–30%) */}
        <path
          id="arc-red"
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke="#fca5a5"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${redLen} ${arcLen}`}
          strokeDashoffset="0"
        />

        {/* Yellow zone (30–60%) */}
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke="#fde047"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${yellowLen} ${arcLen}`}
          strokeDashoffset={-redLen}
        />

        {/* Green zone (60–100%) */}
        <path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke="#6ee7b7"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${greenLen} ${arcLen}`}
          strokeDashoffset={-(redLen + yellowLen)}
        />

        {/* Value indicator arc */}
        <motion.path
          d={`M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${arcLen} ${arcLen}`}
          initial={{ strokeDashoffset: arcLen }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />

        {/* Needle */}
        <motion.line
          x1={CX}
          y1={CY}
          x2={nx}
          y2={ny}
          stroke="#374151"
          strokeWidth={2.5}
          strokeLinecap="round"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.4 }}
        />
        <circle cx={CX} cy={CY} r={4} fill="#374151" />

        {/* Zone labels */}
        <text x={CX - R + 4} y={CY + 14} fontSize="9" fill="#9ca3af">0%</text>
        <text x={CX + R - 14} y={CY + 14} fontSize="9" fill="#9ca3af">100%</text>
      </svg>

      <div style={{ textAlign: "center", marginTop: 4 }}>
        <p style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1, margin: 0 }}>
          {pct}%
        </p>
        <p style={{ fontSize: 11, color: "#4b5563", marginTop: 2 }}>{label}</p>
      </div>
    </div>
  );
}

// ─── Risk gap bar ─────────────────────────────────────────────────────────────
function RiskGapBar({ riskGap, regulatoryRisk, resolutionProb }: {
  riskGap: number;
  regulatoryRisk: number;
  resolutionProb: number;
}) {
  const regPct = Math.round(regulatoryRisk * 100);
  const resPct = Math.round(resolutionProb * 100);
  const gapPct = Math.round(Math.abs(riskGap) * 100);
  const isPositiveGap = riskGap > 0; // positive = underperforming

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: "#374151", fontWeight: 600 }}>
          Regulatory Risk: {regPct}%
        </span>
        <span style={{ fontSize: 11, color: "#374151", fontWeight: 600 }}>
          Resolution: {resPct}%
        </span>
      </div>

      {/* Dual bar */}
      <div style={{ position: "relative", height: 20, borderRadius: 10, background: "#f3f4f6", overflow: "hidden" }}>
        {/* Regulatory risk (from left, red) */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${regPct}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          style={{
            position: "absolute", left: 0, top: 0, height: "100%",
            background: "#fca5a5", borderRadius: "10px 0 0 10px",
          }}
        />
        {/* Resolution prob (from right, green) */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${resPct}%` }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.15 }}
          style={{
            position: "absolute", right: 0, top: 0, height: "100%",
            background: "#6ee7b7", borderRadius: "0 10px 10px 0",
          }}
        />
      </div>

      {isPositiveGap && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{
            marginTop: 8, padding: "6px 10px", borderRadius: 8,
            background: "#fff7ed", border: "1px solid #fdba74",
          }}
        >
          <span style={{ fontSize: 11, color: "#c2410c", fontWeight: 600 }}>
            ⚠ Gap: {gapPct} percentage points below baseline — underperforming
          </span>
        </motion.div>
      )}
    </div>
  );
}

// ─── Feature contributions bar chart ─────────────────────────────────────────
function FeatureBar({ name, value }: { name: string; value: number }) {
  const abs = Math.abs(value);
  const isPositive = value >= 0;
  const pct = Math.min(Math.round(abs * 100), 100);
  const barColor = isPositive ? "#fca5a5" : "#6ee7b7"; // red = increases risk, green = reduces risk

  const label = name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 10, color: "#4b5563", width: 120, flexShrink: 0, textAlign: "right" }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 8, borderRadius: 4, background: "#f3f4f6", position: "relative" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          style={{ height: "100%", borderRadius: 4, background: barColor }}
        />
      </div>
      <span style={{ fontSize: 10, color: "#6b7280", width: 36, flexShrink: 0 }}>
        {isPositive ? "+" : "-"}{pct}%
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function RiskAssessmentPanel({ riskAnalysis, company }: Props) {
  const {
    resolution_probability,
    credible_interval_lower,
    credible_interval_upper,
    risk_gap,
    regulatory_risk,
    intervention_effect,
    company_baseline,
    company_resolution_rate,
    feature_contributions,
    recommended_action,
  } = riskAnalysis;

  const ciLow = Math.round(credible_interval_lower * 100);
  const ciHigh = Math.round(credible_interval_upper * 100);
  const interventionPct = Math.round((resolution_probability + intervention_effect) * 100);
  const interventionGain = Math.round(intervention_effect * 100);

  // Sort feature contributions by absolute value descending, take top 5
  const topFeatures = Object.entries(feature_contributions)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 5);

  const hasCompanyData = company_resolution_rate != null;
  const companyRate = hasCompanyData ? Math.round(company_resolution_rate! * 100) : null;
  const industryRate = Math.round(company_baseline * 100);

  const card: React.CSSProperties = {
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    padding: "16px 18px",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Row 1: Gauge + Risk Gap */}
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 14 }}>

        {/* Resolution Probability Gauge */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          style={card}
        >
          <p style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
            Resolution Probability
          </p>
          <SemiGauge value={resolution_probability} />
          <p style={{ fontSize: 10, color: "#6b7280", textAlign: "center", marginTop: 8 }}>
            95% CI: {ciLow}%–{ciHigh}%
          </p>
        </motion.div>

        {/* Risk Gap + Key Finding */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            style={card}
          >
            <p style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
              Risk Gap Analysis
            </p>
            <RiskGapBar
              riskGap={risk_gap}
              regulatoryRisk={regulatory_risk}
              resolutionProb={resolution_probability}
            />
          </motion.div>

          {/* Key Finding */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.1 }}
            style={{
              ...card,
              borderLeft: "4px solid #8b5cf6",
              background: "linear-gradient(135deg, #faf5ff 0%, #ffffff 100%)",
            }}
          >
            <p style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              Key Finding
            </p>
            <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.6, margin: 0 }}>
              {recommended_action}
            </p>
          </motion.div>
        </div>
      </div>

      {/* Row 2: Company Intelligence + Intervention + Features */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>

        {/* Company Intelligence */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.12 }}
          style={card}
        >
          <p style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            Company Intelligence
          </p>
          {company && <p style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginBottom: 10 }}>{company}</p>}
          {hasCompanyData ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: "#4b5563" }}>Company rate</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#111827" }}>{companyRate}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: "#f3f4f6" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${companyRate}%` }}
                    transition={{ duration: 0.8 }}
                    style={{ height: "100%", borderRadius: 3, background: "#0ea5e9" }}
                  />
                </div>
              </div>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: "#4b5563" }}>Industry avg</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#111827" }}>{industryRate}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: "#f3f4f6" }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${industryRate}%` }}
                    transition={{ duration: 0.8, delay: 0.1 }}
                    style={{ height: "100%", borderRadius: 3, background: "#d1d5db" }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: "#4b5563" }}>Product baseline</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#111827" }}>{industryRate}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "#f3f4f6" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${industryRate}%` }}
                  transition={{ duration: 0.8 }}
                  style={{ height: "100%", borderRadius: 3, background: "#d1d5db" }}
                />
              </div>
              <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 8 }}>
                No company-specific history available
              </p>
            </div>
          )}
        </motion.div>

        {/* Intervention Estimate */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.15 }}
          style={{
            ...card,
            background: "linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)",
            border: "1px solid #6ee7b7",
          }}
        >
          <p style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            Intervention Estimate
          </p>
          <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.6, margin: "0 0 12px" }}>
            If key risk factors are addressed, resolution probability would increase to:
          </p>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 28, fontWeight: 800, color: "#059669", lineHeight: 1 }}>
              {Math.min(interventionPct, 100)}%
            </span>
            {interventionGain > 0 && (
              <span style={{
                fontSize: 12, fontWeight: 700,
                color: "#047857", padding: "2px 6px",
                borderRadius: 5, background: "#d1fae5",
              }}>
                +{interventionGain} pp
              </span>
            )}
          </div>
        </motion.div>

        {/* Feature Effects */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.18 }}
          style={card}
        >
          <p style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
            Feature Effects
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {topFeatures.map(([name, value]) => (
              <FeatureBar key={name} name={name} value={value} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: "#fca5a5" }} />
              <span style={{ fontSize: 9, color: "#6b7280" }}>Increases risk</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: "#6ee7b7" }} />
              <span style={{ fontSize: 9, color: "#6b7280" }}>Reduces risk</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
