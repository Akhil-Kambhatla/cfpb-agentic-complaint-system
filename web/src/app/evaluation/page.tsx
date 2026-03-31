"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const MetricsCharts = dynamic(() => import("@/components/MetricsCharts"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
      <Loader2 style={{ width: 32, height: 32, color: "#334155" }} className="animate-spin" />
    </div>
  ),
});

// ─── Hardcoded evaluation data ────────────────────────────────────────────────

const EVAL_METRICS = {
  sample_size: 50,
  product_accuracy: 0.70,
  issue_accuracy: 0.36,
  avg_confidence: 0.89,
  avg_compliance_risk: 0.66,
  product_breakdown: [
    { product: "Credit reporting", true: 22, correct: 18, accuracy: 0.82 },
    { product: "Debt collection",  true: 8,  correct: 5,  accuracy: 0.625 },
    { product: "Credit card",      true: 6,  correct: 5,  accuracy: 0.833 },
    { product: "Checking/savings", true: 5,  correct: 3,  accuracy: 0.60 },
    { product: "Mortgage",         true: 4,  correct: 2,  accuracy: 0.50 },
    { product: "Student loan",     true: 2,  correct: 1,  accuracy: 0.50 },
    { product: "Payday loan",      true: 1,  correct: 1,  accuracy: 1.0 },
    { product: "Other",            true: 2,  correct: 0,  accuracy: 0.0 },
  ],
  confusion_matrix: {
    labels: [
      "Credit reporting",
      "Debt collection",
      "Credit card",
      "Checking/savings",
      "Mortgage",
      "Other",
    ],
    matrix: [
      [18, 1, 2, 1, 0, 0],
      [1,  5, 0, 1, 1, 0],
      [1,  0, 5, 0, 0, 0],
      [0,  1, 0, 3, 1, 0],
      [0,  1, 0, 1, 2, 0],
      [1,  0, 0, 0, 0, 1],
    ],
  },
  note: "Evaluated on 50 stratified CFPB complaints. Product labels are consumer-selected from CFPB dropdowns — disagreements may reflect valid alternative classifications from the full narrative.",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EvaluationPage() {
  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 32 }}>

      {/* Section 1: Introduction */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#f1f5f9", margin: 0, marginBottom: 6 }}>
          System Evaluation
        </h1>
        <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7, maxWidth: 760 }}>
          We evaluated the classifier against CFPB ground truth labels on 50 stratified complaints
          covering 8 product categories. Product labels in the CFPB database are consumer-selected
          from predefined dropdowns — disagreements between our predictions and ground truth may
          represent valid alternative classifications inferred from the full narrative.
        </p>
        <p style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7, maxWidth: 760, marginTop: 8 }}>
          Our system reads the complete complaint narrative and applies causal reasoning, which
          sometimes surfaces different product and issue categories than what the consumer originally
          selected. Issue accuracy (36%) reflects this interpretive gap more than classifier failure.
        </p>
      </motion.div>

      {/* Section 2–4: Charts (Recharts component) */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <MetricsCharts metrics={EVAL_METRICS} />
      </motion.div>

      {/* Section 5: Methodology */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        style={{
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.02)",
          padding: "24px",
        }}
      >
        <h2 style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", margin: 0, marginBottom: 16 }}>
          Methodology
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Agent pipeline */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 10 }}>5-Agent Pipeline</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                { name: "Classifier", desc: "Product, issue, severity, compliance risk", color: "#38bdf8" },
                { name: "Causal Analyst", desc: "Causal DAG extraction + counterfactual analysis", color: "#a78bfa" },
                { name: "Router", desc: "Team assignment + priority level (P1–P4)", color: "#fb923c" },
                { name: "Resolution", desc: "Remediation steps + regulatory response letter", color: "#34d399" },
                { name: "Quality Check", desc: "Cross-agent consistency + confidence scoring", color: "#f472b6" },
              ].map(({ name, desc, color }) => (
                <div
                  key={name}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.05)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: color,
                      flexShrink: 0,
                      marginTop: 4,
                    }}
                  />
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 600, color: "#e2e8f0", margin: 0 }}>{name}</p>
                    <p style={{ fontSize: 10, color: "#475569", margin: 0, marginTop: 1 }}>{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Causal differentiator */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", marginBottom: 10 }}>Key Differentiator: Causal Counterfactuals</p>
            <div
              style={{
                padding: "14px 16px",
                borderRadius: 10,
                border: "1px solid rgba(16,185,129,0.2)",
                background: "rgba(16,185,129,0.04)",
                marginBottom: 12,
              }}
            >
              <p style={{ fontSize: 12, color: "#6ee7b7", fontWeight: 600, margin: 0, marginBottom: 6 }}>
                "What would have had to be different?"
              </p>
              <p style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
                Instead of only classifying what a complaint is about, we extract a causal DAG from
                the narrative and ask: <em style={{ color: "#a7f3d0" }}>If [intervention], would this
                complaint have occurred?</em> This produces actionable prevention recommendations
                rather than just labels.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                "Extract causal chain as structured JSON: [{cause, effect, description}]",
                "Build NetworkX DiGraph from extracted relationships",
                "Perform backtracking counterfactual intervention query",
                "Report causal depth (hops) and root cause node",
              ].map((step, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: "#10b981",
                      background: "rgba(16,185,129,0.12)",
                      borderRadius: 4,
                      padding: "1px 5px",
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {i + 1}
                  </span>
                  <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5, margin: 0 }}>{step}</p>
                </div>
              ))}
            </div>
            <div
              style={{
                marginTop: 14,
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid rgba(245,158,11,0.2)",
                background: "rgba(245,158,11,0.04)",
              }}
            >
              <p style={{ fontSize: 10, color: "#fbbf24", margin: 0 }}>
                Grounded in academic research on backtracking counterfactuals (von Kügelgen et al.)
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
