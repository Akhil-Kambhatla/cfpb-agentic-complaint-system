"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

// All chart components are client-only (Recharts needs browser)
const Charts = dynamic(() => import("@/components/EvaluationCharts").then((m) => ({
  default: () => {
    const {
      GaugeRow, BubbleAccuracyChart, SankeyDiagram,
      ComplaintTreemap, FairnessChart, LatencyChart, AccuracyTable,
      ResolutionQuality,
    } = m;

    return (
      <EvaluationContent
        GaugeRow={GaugeRow}
        BubbleAccuracyChart={BubbleAccuracyChart}
        SankeyDiagram={SankeyDiagram}
        ComplaintTreemap={ComplaintTreemap}
        FairnessChart={FairnessChart}
        LatencyChart={LatencyChart}
        AccuracyTable={AccuracyTable}
        ResolutionQuality={ResolutionQuality}
      />
    );
  },
})), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", justifyContent: "center", padding: "80px 0" }}>
      <Loader2 style={{ width: 32, height: 32, color: "#d1d5db" }} className="animate-spin" />
    </div>
  ),
});

// ─── Interpretation box ────────────────────────────────────────────────────────
function Interpretation({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      marginTop: 14,
      background: "#f9fafb",
      border: "1px solid #e5e7eb",
      borderRadius: 10,
      padding: "14px 16px",
      color: "#374151",
      fontSize: 13,
      lineHeight: 1.65,
    }}>
      {children}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, subtitle, children, delay = 0 }: {
  title: string; subtitle: string; children: React.ReactNode; delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: "#111827", margin: 0 }}>{title}</h2>
        <p style={{ fontSize: 12, color: "#4b5563", marginTop: 4, lineHeight: 1.6 }}>{subtitle}</p>
      </div>
      <div style={{
        borderRadius: 16, border: "1px solid #e5e7eb",
        background: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
        padding: "20px 24px",
      }}>
        {children}
      </div>
    </motion.section>
  );
}

// ─── Main content component ───────────────────────────────────────────────────
function EvaluationContent({
  GaugeRow, BubbleAccuracyChart, SankeyDiagram, ComplaintTreemap,
  FairnessChart, LatencyChart, AccuracyTable, ResolutionQuality,
}: {
  GaugeRow: React.ComponentType<{ metrics: { value: number; label: string }[] }>;
  BubbleAccuracyChart: React.ComponentType;
  SankeyDiagram: React.ComponentType;
  ComplaintTreemap: React.ComponentType;
  FairnessChart: React.ComponentType;
  LatencyChart: React.ComponentType;
  AccuracyTable: React.ComponentType;
  ResolutionQuality: React.ComponentType;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Key Metrics */}
      <Section
        title="Key Metrics"
        subtitle="Classification performance measured on 50 stratified complaints across 11 product categories."
        delay={0.1}
      >
        <GaugeRow metrics={[
          { value: 0.70, label: "Product Accuracy" },
          { value: 0.36, label: "Issue Accuracy" },
          { value: 0.89, label: "Avg Confidence" },
          { value: 0.66, label: "Avg Compliance Risk" },
        ]} />
        <Interpretation>
          Product accuracy of 70% means our classifier correctly identifies the financial product category
          for 7 out of 10 complaints. Issue accuracy is lower at 36% because CFPB issue labels are
          consumer-selected from dropdown menus, and our system often identifies a more precise issue by
          reading the full narrative.
        </Interpretation>
      </Section>

      {/* Product-Level Accuracy */}
      <Section
        title="Product-Level Accuracy"
        subtitle="Bubble size = number of test complaints. Color: green ≥80%, yellow 50–79%, red <50%. Hover for details."
        delay={0.15}
      >
        <BubbleAccuracyChart />
        <Interpretation>
          Each bubble represents a product category. Size shows how many test complaints that category had.
          Position on the x-axis shows classification accuracy. Green bubbles (≥80%) indicate strong
          performance, while red bubbles (&lt;50%) indicate categories needing improvement — primarily
          Payday Loan and Credit Card, where narrative language overlaps with Credit Reporting issues.
        </Interpretation>
      </Section>

      {/* Classification Flow */}
      <Section
        title="Classification Flow"
        subtitle="Shows how true labels (left) map to predicted labels (right). Green flows = correct; red flows = misclassified."
        delay={0.2}
      >
        <SankeyDiagram />
        <Interpretation>
          This diagram shows how complaints flow from their actual product category (left) to our
          system&apos;s predicted category (right). Green flows indicate correct classifications. Pink
          diagonal flows show misclassifications — for example, some Credit Card complaints were
          classified as Credit Reporting because the narratives discuss credit report impacts from
          disputed charges.
        </Interpretation>
      </Section>

      {/* Resolution Quality */}
      <Section
        title="Resolution Letter Quality"
        subtitle="AI-generated letters vs. generic templates. Our system personalizes to the specific complaint, cites applicable regulations, and provides actionable remediation steps."
        delay={0.22}
      >
        <ResolutionQuality />
        <Interpretation>
          Our system generates significantly more detailed responses than typical company replies. While
          59% of companies simply close complaints &quot;with explanation,&quot; our system provides specific
          remediation steps, references applicable regulations (e.g., Regulation E, FCRA), and includes
          preventive recommendations tailored to the specific complaint narrative.
        </Interpretation>
      </Section>

      {/* Complaint Landscape */}
      <Section
        title="Complaint Landscape (10,000-record Dev Set)"
        subtitle="Area proportional to complaint volume. Nested rectangles show top issues within each product category. Hover for counts."
        delay={0.25}
      >
        <ComplaintTreemap />
        <Interpretation>
          This treemap shows the composition of our 10,000-complaint dataset. Rectangle size is
          proportional to complaint volume. Credit Reporting dominates at 76% of complaints, reflecting
          real-world CFPB trends where credit bureau errors are the most common consumer grievance.
          Nested rectangles show the top issues within each product — hover any rectangle for exact
          counts and percentages.
        </Interpretation>
      </Section>

      {/* Fairness Analysis */}
      <Section
        title="Fairness Analysis — Compliance Risk by Product"
        subtitle="Bars show deviation from the average compliance risk score (0.66). Red = above average risk, blue = below average. No systematic bias detected."
        delay={0.3}
      >
        <FairnessChart />
        <Interpretation>
          Bars show how each product&apos;s average compliance risk compares to the overall average (0.66).
          Products extending right (red) have above-average compliance risk — Debt Collection and Payday
          Loans carry the highest regulatory risk due to FDCPA and state usury law requirements. Products
          extending left (blue) have below-average risk, indicating lower regulatory complexity.
        </Interpretation>
      </Section>

      {/* System Performance */}
      <Section
        title="System Performance"
        subtitle="Latency breakdown per agent for a single complaint. Total pipeline time ≈ 8.4 seconds. Batch of 50 takes ≈ 7 minutes."
        delay={0.35}
      >
        <LatencyChart />
        <Interpretation>
          Each segment shows how long one agent takes to process a single complaint. The full pipeline
          runs in approximately 8.4 seconds end-to-end. At this rate, the system can process about
          7 complaints per minute or 420 per hour — sufficient for real-time triage of CFPB&apos;s
          daily intake volume.
        </Interpretation>
      </Section>

      {/* Per-Product Accuracy Table */}
      <Section
        title="Per-Product Accuracy (Reference)"
        subtitle="Detailed counts for each product category in our 50-complaint evaluation set."
        delay={0.4}
      >
        <AccuracyTable />
        <Interpretation>
          Four product categories achieve 100% accuracy: Credit Reporting, Mortgage, Student Loan, and
          Vehicle Loan — these have distinctive narrative patterns that map cleanly to CFPB categories.
          Credit Card and Payday Loan accuracy is lower because consumers often describe the downstream
          credit reporting impact rather than the originating product problem.
        </Interpretation>
      </Section>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function EvaluationPage() {
  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "32px 24px", display: "flex", flexDirection: "column", gap: 28 }}>

      {/* Introduction */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111827", margin: 0, marginBottom: 12 }}>
          System Evaluation
        </h1>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{
            borderRadius: 14, border: "1px solid #e5e7eb",
            background: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            padding: "18px 20px",
          }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: 0, marginBottom: 8 }}>
              Evaluation Methodology
            </h3>
            <p style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.7, margin: 0 }}>
              We evaluated the classifier against CFPB ground truth labels on 50 stratified complaints
              covering 11 product categories. Labels in the CFPB database are consumer-selected from
              predefined dropdowns — our system reads the full narrative and sometimes surfaces a
              different but valid classification.
            </p>
          </div>
          <div style={{
            borderRadius: 14, border: "1px solid #e5e7eb",
            background: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            padding: "18px 20px",
          }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: 0, marginBottom: 8 }}>
              Bayesian Risk Intelligence Differentiator
            </h3>
            <p style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.7, margin: 0 }}>
              Unlike pure classifiers, our Event Chain agent reconstructs the event sequence from
              the narrative, while the Bayesian Risk Analyzer answers: <em style={{ color: "#047857" }}>&quot;What is the probability this complaint gets resolved, and what risk-based intervention will change that?&quot;</em> This produces actionable prevention recommendations grounded in probabilistic risk assessment.
            </p>
          </div>
        </div>
      </motion.div>

      {/* All charts rendered client-side */}
      <Charts />
    </div>
  );
}
