"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { RiskAnalysisOutput } from "@/types";
import InfoTooltip from "./InfoTooltip";

const DATASET_AVG_PCT = 36.9; // from dataset_stats.json (100K complaints)

const PANEL_TOOLTIPS = {
  resolutionProb: "Will this complaint get resolved? Predicted by our Bayesian model trained on 100,000 real CFPB outcomes. The percentage is the most likely outcome. The '95% CI' range means we're 95% confident the true probability falls within those bounds. Wider range = more uncertainty.",
  riskGap: "The danger zone metric. Regulatory Risk minus Resolution Probability. Example: 74% regulatory risk but only 9% chance of resolution = 65-point gap. This means the company will almost certainly dismiss this complaint, but doing so carries high regulatory risk. Gap > 20% triggers an automatic Slack alert to the oversight channel.",
  companyIntel: `How does this company compare? We looked at all complaints against this company in our 100,000-complaint CFPB dataset and calculated what percentage got meaningful resolution. The blue bar shows their rate vs. the dataset average (${DATASET_AVG_PCT}% across our 100,000 complaints). If the company is not in our dataset, the system uses the dataset average for predictions.`,
  intervention: "What if the complaint were stronger? We re-run our Bayesian model pretending the complaint cited specific regulations, then compare the new probability to the original. The difference shows how much citing regulations could improve the consumer's chances. Note: this is a statistical estimate, not a guarantee.",
  featureEffects: "What actually matters? Our Bayesian model learned that product type is far more influential than any other signal. Everything else — dollar amounts, legal citations, narrative length — makes much less difference. This means the system is structured around products, not individual complaint quality.",
};

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

      {isPositiveGap && riskGap > 0.20 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          style={{
            marginTop: 8, padding: "6px 10px", borderRadius: 8,
            background: riskGap > 0.30 ? "#fff1f2" : "#fff7ed",
            border: `1px solid ${riskGap > 0.30 ? "#fca5a5" : "#fdba74"}`,
          }}
        >
          <span style={{ fontSize: 11, color: riskGap > 0.30 ? "#b91c1c" : "#c2410c", fontWeight: 600 }}>
            [{riskGap > 0.30 ? "CRITICAL" : "ELEVATED"}] Gap: {gapPct} pp below baseline
          </span>
        </motion.div>
      )}
      {isPositiveGap && riskGap > 0.10 && riskGap <= 0.20 && (
        <p style={{ fontSize: 10, color: "#92400e", marginTop: 6 }}>
          Moderate gap: {gapPct} pp below baseline — standard monitoring applies.
        </p>
      )}
    </div>
  );
}

// ─── Feature Effects: dynamic from API ───────────────────────────────────────
interface FeatureCoefficient {
  name: string;
  coefficient: number;
  positive: boolean;
}

interface BayesianCoefficients {
  coefficients: FeatureCoefficient[];
  product_dominance_ratio: number;
  overall_resolution_rate: number;
  training_samples: number;
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function FeatureEffects({ features: _features }: { features: [string, number][] }) {
  const [bayesianData, setBayesianData] = useState<BayesianCoefficients | null>(null);

  useEffect(() => {
    fetch(`${BASE_URL}/api/bayesian-coefficients`)
      .then((r) => r.json())
      .then((d) => setBayesianData(d))
      .catch(() => {});
  }, []);

  // Fallback coefficients from actual model (bayesian_results.json)
  const FALLBACK_COEFFICIENTS: FeatureCoefficient[] = [
    { name: "Product Type", coefficient: 0.5815, positive: true },
    { name: "Dollar Amount", coefficient: 0.0699, positive: true },
    { name: "Attorney Mention", coefficient: 0.0463, positive: false },
    { name: "Regulation Mention", coefficient: 0.0135, positive: true },
    { name: "Narrative Length", coefficient: 0.0162, positive: false },
  ];

  const coefficients = bayesianData?.coefficients ?? FALLBACK_COEFFICIENTS;
  const ratio = bayesianData?.product_dominance_ratio ?? 13;

  const maxCoef = coefficients[0]?.coefficient ?? 1;

  // Compute product share of total coefficient magnitude
  const totalMag = coefficients.reduce((s, c) => s + c.coefficient, 0);
  const productMag = coefficients.find((c) => c.name === "Product Type")?.coefficient ?? maxCoef;
  const productSharePct = totalMag > 0 ? Math.round((productMag / totalMag) * 100) : 85;
  const otherSharePct = 100 - productSharePct;

  const R = 36;
  const CX = 44;
  const CY = 44;
  const circumference = 2 * Math.PI * R;
  const productShare = productSharePct / 100;
  const productArc = circumference * productShare;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Donut chart */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <svg width={CX * 2} height={CY * 2} viewBox={`0 0 ${CX * 2} ${CY * 2}`}>
          <circle cx={CX} cy={CY} r={R} fill="none" stroke="#f3f4f6" strokeWidth={10} />
          <circle
            cx={CX} cy={CY} r={R} fill="none" stroke="#d1d5db" strokeWidth={10}
            strokeDasharray={`${circumference * (otherSharePct / 100)} ${circumference}`}
            strokeDashoffset={-(circumference * productShare)}
            strokeLinecap="round"
            style={{ transformOrigin: `${CX}px ${CY}px`, transform: "rotate(-90deg)" }}
          />
          <motion.circle
            cx={CX} cy={CY} r={R} fill="none" stroke="#10b981" strokeWidth={10}
            strokeDasharray={`${productArc} ${circumference}`}
            strokeLinecap="round"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - productArc }}
            transition={{ duration: 1.0, ease: "easeOut" }}
            style={{ transformOrigin: `${CX}px ${CY}px`, transform: "rotate(-90deg)" }}
          />
          <text x={CX} y={CY - 4} textAnchor="middle" fontSize="13" fontWeight="800" fill="#059669">{productSharePct}%</text>
          <text x={CX} y={CY + 10} textAnchor="middle" fontSize="8" fill="#6b7280">product</text>
        </svg>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#059669", margin: "0 0 2px" }}>Product type drives {productSharePct}%</p>
          <p style={{ fontSize: 10, color: "#6b7280", margin: 0, lineHeight: 1.4 }}>All other features combined: {otherSharePct}%</p>
        </div>
      </div>

      {/* Coefficient bars */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {coefficients.map(({ name, coefficient, positive }) => {
          const widthPct = maxCoef > 0 ? (coefficient / maxCoef) * 95 : 0;
          const barColor = name === "Product Type" ? "#10b981" : "#d1d5db";
          const coefLabel = positive ? `+${coefficient.toFixed(3)}` : `−${coefficient.toFixed(3)}`;
          return (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 9, color: name === "Product Type" ? "#059669" : "#6b7280", width: 90, flexShrink: 0, fontWeight: name === "Product Type" ? 700 : 400 }}>
                {name}
              </span>
              <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#f3f4f6" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${widthPct}%` }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  style={{ height: "100%", borderRadius: 3, background: barColor }}
                />
              </div>
              <span style={{ fontSize: 9, color: "#9ca3af", width: 36, flexShrink: 0, fontFamily: "monospace" }}>
                {coefLabel}
              </span>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 9, color: "#9ca3af", marginTop: 2, lineHeight: 1.4 }}>
        Product type is {ratio}× more influential than mentioning a lawyer.
      </p>
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
          <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
            <p style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
              Resolution Probability
            </p>
            <InfoTooltip text={PANEL_TOOLTIPS.resolutionProb} />
          </div>
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
            <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
              <p style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
                Risk Gap Analysis
              </p>
              <InfoTooltip text={PANEL_TOOLTIPS.riskGap} />
            </div>
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
          <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
            <p style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
              Company Intelligence
            </p>
            <InfoTooltip text={PANEL_TOOLTIPS.companyIntel} />
          </div>

          {/* State 1: company mentioned AND found in dataset */}
          {company && hasCompanyData && (
            <>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginBottom: 10 }}>{company}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: "#4b5563" }}>Company rate</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#111827" }}>{companyRate}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "#f3f4f6", overflow: "hidden" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(companyRate ?? 0, 0.5)}%` }}
                      transition={{ duration: 0.8 }}
                      style={{ height: "100%", background: "#0ea5e9" }}
                    />
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 10, color: "#4b5563" }}>Dataset avg</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#111827" }}>{DATASET_AVG_PCT}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: "#f3f4f6", overflow: "hidden" }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${DATASET_AVG_PCT}%` }}
                      transition={{ duration: 0.8, delay: 0.1 }}
                      style={{ height: "100%", background: "#d1d5db" }}
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* State 2: company mentioned but NOT found */}
          {company && !hasCompanyData && (
            <>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginBottom: 6 }}>&ldquo;{company}&rdquo;</p>
              <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 8px", lineHeight: 1.5 }}>
                Company not found in our 100,000-complaint dataset.
              </p>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: "#4b5563" }}>Dataset avg</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#111827" }}>{DATASET_AVG_PCT}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "#f3f4f6", overflow: "hidden" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${DATASET_AVG_PCT}%` }}
                  transition={{ duration: 0.8 }}
                  style={{ height: "100%", background: "#d1d5db" }}
                />
              </div>
              <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 6 }}>
                Using dataset average for risk assessment.
              </p>
            </>
          )}

          {/* State 3: no company specified */}
          {!company && (
            <>
              <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 8px", lineHeight: 1.5 }}>
                No company specified in complaint.
              </p>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: "#4b5563" }}>Dataset avg</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#111827" }}>{DATASET_AVG_PCT}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "#f3f4f6", overflow: "hidden" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${DATASET_AVG_PCT}%` }}
                  transition={{ duration: 0.8 }}
                  style={{ height: "100%", background: "#d1d5db" }}
                />
              </div>
              <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 6 }}>
                Using dataset average for risk assessment.
              </p>
            </>
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
          <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
            <p style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
              Intervention Estimate
            </p>
            <InfoTooltip text={PANEL_TOOLTIPS.intervention} />
          </div>
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
          <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
            <p style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", margin: 0 }}>
              Feature Effects
            </p>
            <InfoTooltip text={PANEL_TOOLTIPS.featureEffects} />
          </div>
          <FeatureEffects features={topFeatures} />
        </motion.div>
      </div>
    </div>
  );
}
