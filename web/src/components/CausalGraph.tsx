"use client";

import { motion } from "framer-motion";
import { Lightbulb, Shield, AlertTriangle } from "lucide-react";
import type { CausalAnalysisOutput } from "@/types";

interface Props {
  data: CausalAnalysisOutput;
}

// Color gradient: amber (root cause) → rose (complaint filed)
function getCardStyle(index: number, total: number) {
  if (total === 0) return { border: "#f43f5e", bg: "#fff1f2", accent: "#f43f5e", num: "#dc2626", numBg: "#fee2e2" };
  const t = total === 1 ? 1 : index / (total - 1);
  const r = Math.round(245 + (244 - 245) * t);
  const g = Math.round(158 + (63  - 158) * t);
  const b = Math.round(11  + (94  - 11)  * t);
  const color = `rgb(${r},${g},${b})`;
  const bg = t < 0.35 ? "#fffbeb" : t > 0.7 ? "#fff1f2" : "#fff8f1";
  const numBg = t < 0.35 ? "#fef3c7" : t > 0.7 ? "#fee2e2" : "#ffedd5";
  const numColor = t < 0.35 ? "#92400e" : t > 0.7 ? "#b91c1c" : "#c2410c";
  return { border: color, bg, accent: color, num: numColor, numBg };
}

export default function CausalGraph({ data }: Props) {
  // Build de-duplicated event list from causal_chain
  const events: string[] = [];
  if (data.causal_chain.length > 0) {
    events.push(data.causal_chain[0].cause);
    for (const edge of data.causal_chain) {
      if (!events.includes(edge.effect)) {
        events.push(edge.effect);
      }
    }
  }

  const total = events.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Sub-title */}
      <p style={{ fontSize: 12, color: "#4b5563", marginBottom: 20, lineHeight: 1.5 }}>
        Tracing the chain of events from root cause to complaint
        {" "}
        <span style={{
          display: "inline-flex", alignItems: "center", padding: "1px 8px",
          borderRadius: 9999, background: "#f3f4f6", border: "1px solid #e5e7eb",
          fontSize: 11, color: "#4b5563", fontWeight: 500,
        }}>
          {data.causal_depth} event{data.causal_depth !== 1 ? "s" : ""} in chain
        </span>
      </p>

      {/* Causal chain */}
      <div style={{ position: "relative" }}>
        {events.map((event, i) => {
          const s = getCardStyle(i, total - 1);
          const isRoot = i === 0;
          const isLast = i === total - 1;
          const nextStyle = i < total - 1 ? getCardStyle(i + 1, total - 1) : s;

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08, duration: 0.35 }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center" }}
            >
              {/* Root cause label */}
              {isRoot && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 5,
                  marginBottom: 6, alignSelf: "flex-start", marginLeft: 54,
                }}>
                  <AlertTriangle style={{ width: 13, height: 13, color: "#f59e0b" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Root Cause
                  </span>
                </div>
              )}
              {isLast && !isRoot && (
                <div style={{ marginBottom: 6, alignSelf: "flex-start", marginLeft: 54 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#b91c1c", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Complaint Filed
                  </span>
                </div>
              )}

              {/* Card row */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, width: "100%" }}>
                {/* Numbered circle */}
                <div style={{
                  width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: s.numBg, border: `2px solid ${s.border}`,
                  fontSize: 14, fontWeight: 800, color: s.num,
                }}>
                  {i + 1}
                </div>

                {/* Event card */}
                <div style={{
                  flex: 1, borderRadius: 12, padding: "14px 16px",
                  border: `1.5px solid ${s.border}`,
                  background: s.bg,
                  borderLeft: `4px solid ${s.accent}`,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: 0 }}>{event}</p>
                  {isRoot && data.root_cause && data.root_cause !== event && (
                    <p style={{ fontSize: 11, color: "#4b5563", marginTop: 4 }}>{data.root_cause}</p>
                  )}
                </div>
              </div>

              {/* Pulsating arrow connector (not after last) */}
              {i < total - 1 && (
                <motion.div
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "4px 0" }}
                  animate={{ opacity: [0.4, 1.0, 0.4] }}
                  transition={{
                    delay: i * 0.35,
                    duration: 1.6,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <div style={{
                    width: 2,
                    height: 18,
                    background: `linear-gradient(to bottom, ${s.border}, ${nextStyle.border})`,
                  }} />
                  <div style={{
                    width: 0,
                    height: 0,
                    borderLeft: "6px solid transparent",
                    borderRight: "6px solid transparent",
                    borderTop: `8px solid ${nextStyle.border}`,
                  }} />
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Prevention Opportunity box */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: total * 0.08 + 0.2 }}
        style={{
          marginTop: 24,
          borderRadius: 12,
          border: "1px solid #6ee7b7",
          borderLeft: "4px solid #10b981",
          background: "#ecfdf5",
          padding: "16px 18px",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <Lightbulb style={{ width: 18, height: 18, color: "#059669", flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#065f46", margin: 0, marginBottom: 6 }}>
              Prevention Opportunity
            </p>
            <p style={{ fontSize: 13, color: "#047857", lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>
              {data.counterfactual_intervention}
            </p>
            {data.prevention_recommendation && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: 7, marginTop: 10 }}>
                <Shield style={{ width: 14, height: 14, color: "#059669", flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.6, margin: 0 }}>
                  {data.prevention_recommendation}
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
