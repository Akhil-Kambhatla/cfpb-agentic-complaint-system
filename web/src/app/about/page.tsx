"use client";

import { useState, useEffect, useRef } from "react";
import { motion, useInView } from "framer-motion";
import Image from "next/image";
import {
  Trophy, ArrowRight, GitBranch, Database,
} from "lucide-react";
import { API_BASE_URL } from "@/config";

// ─── Count-up animation ────────────────────────────────────────────────────────
function CountUp({
  end, suffix = "", prefix = "", duration = 1500, decimals = 0,
}: {
  end: number; suffix?: string; prefix?: string; duration?: number; decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const startTime = Date.now();
    const frame = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(end * eased);
      if (progress < 1) requestAnimationFrame(frame);
      else setCount(end);
    };
    requestAnimationFrame(frame);
  }, [inView, end, duration]);

  const display = decimals > 0 ? count.toFixed(decimals) : Math.round(count).toLocaleString();
  return <span ref={ref}>{prefix}{display}{suffix}</span>;
}

// ─── Full-width section with alternating background ────────────────────────────
function SectionWrapper({
  children, bg = "#ffffff",
}: {
  children: React.ReactNode; bg?: string;
}) {
  return (
    <div style={{ background: bg, width: "100%" }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        style={{ maxWidth: 1100, margin: "0 auto", padding: "72px 24px" }}
      >
        {children}
      </motion.div>
    </div>
  );
}

// ─── Shared card ──────────────────────────────────────────────────────────────
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      borderRadius: 16, border: "1px solid #e5e7eb",
      background: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      padding: "20px 24px", ...style,
    }}>
      {children}
    </div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 30, fontWeight: 800, color: "#111827", margin: "0 0 24px", lineHeight: 1.2 }}>
      {children}
    </h2>
  );
}

// ─── Animated stat card (problem section) ────────────────────────────────────
function BigStatCard({
  label, color = "#10b981", end, suffix = "", prefix = "", decimals = 0,
}: {
  label: string; color?: string; end: number; suffix?: string; prefix?: string; decimals?: number;
}) {
  return (
    <div style={{
      borderRadius: 16, border: `1px solid ${color}30`,
      background: `${color}08`, padding: "24px 20px",
      textAlign: "center", flex: 1, minWidth: 160,
    }}>
      <p style={{ fontSize: 36, fontWeight: 800, color, lineHeight: 1, margin: 0 }}>
        <CountUp end={end} suffix={suffix} prefix={prefix} decimals={decimals} />
      </p>
      <p style={{ fontSize: 12, color: "#4b5563", marginTop: 8 }}>{label}</p>
    </div>
  );
}

// ─── Agent row ────────────────────────────────────────────────────────────────
function AgentRow({ num, name, color, desc }: { num: number; name: string; color: string; desc: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 14,
      padding: "14px 18px", borderRadius: 12,
      border: `1px solid ${color}20`, background: `${color}05`,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 8, background: color,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, fontSize: 13, fontWeight: 800, color: "#fff",
      }}>
        {num}
      </div>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: "0 0 3px" }}>{name}</p>
        <p style={{ fontSize: 12, color: "#4b5563", margin: 0, lineHeight: 1.5 }}>{desc}</p>
      </div>
    </div>
  );
}

// ─── Team member card ─────────────────────────────────────────────────────────
function TeamMemberCard({
  firstName, lastName, program, photo, initials, placeholderColor,
}: {
  firstName: string; lastName: string; program: string;
  photo?: string; initials: string; placeholderColor: string;
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        width: 120, height: 120, borderRadius: "50%", margin: "0 auto 14px",
        overflow: "hidden", flexShrink: 0,
        background: photo ? "transparent" : placeholderColor,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {photo ? (
          <Image
            src={photo}
            alt={`${firstName} ${lastName}`}
            width={120}
            height={120}
            style={{ objectFit: "cover", width: "100%", height: "100%", borderRadius: "50%" }}
          />
        ) : (
          <span style={{ fontSize: 36, fontWeight: 800, color: "#fff" }}>{initials}</span>
        )}
      </div>
      <p style={{ fontSize: 16, fontWeight: 600, color: "#111827", margin: "0 0 4px", textAlign: "center" }}>
        {firstName}
      </p>
      <p style={{ fontSize: 16, fontWeight: 600, color: "#111827", margin: "0 0 6px", textAlign: "center" }}>
        {lastName}
      </p>
      <p style={{ fontSize: 13, color: "#6b7280", margin: 0, textAlign: "center" }}>{program}</p>
    </div>
  );
}

// ─── ROI Calculator ────────────────────────────────────────────────────────────
function ROICalculator() {
  const [volume, setVolume] = useState(5000);

  const annualSystemCost = Math.round(volume * 12 * 0.051 + 840); // API + hosting + monitoring
  const highRiskCaught = Math.round(volume * 12 * 0.086);
  const exposureAvoided = highRiskCaught * 50000;
  const roi = Math.round(((exposureAvoided - annualSystemCost) / annualSystemCost) * 100);

  const fmt = (n: number) =>
    n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
      ? `$${(n / 1_000).toFixed(0)}K`
      : `$${n}`;

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <label style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 12 }}>
          Monthly complaint volume:{" "}
          <span style={{ color: "#0284c7", fontWeight: 800 }}>{volume.toLocaleString()}</span>
        </label>
        <input
          type="range" min={100} max={50000} step={100}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          style={{ width: "100%", accentColor: "#0284c7", cursor: "pointer" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: 10, color: "#9ca3af" }}>100</span>
          <span style={{ fontSize: 10, color: "#9ca3af" }}>50,000</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
        {[
          { label: "Annual System Cost", value: fmt(annualSystemCost), color: "#6b7280" },
          { label: "High-Risk Complaints Caught", value: `${highRiskCaught.toLocaleString()}/yr`, color: "#f97316" },
          { label: "Regulatory Exposure Avoided", value: fmt(exposureAvoided), color: "#10b981" },
          { label: "Estimated ROI", value: `${roi.toLocaleString()}%`, color: "#7c3aed" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{
            borderRadius: 12, border: `1px solid ${color}25`,
            background: `${color}08`, padding: "16px 20px", textAlign: "center",
          }}>
            <p style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1, margin: "0 0 6px" }}>{value}</p>
            <p style={{ fontSize: 11, color: "#4b5563", margin: 0 }}>{label}</p>
          </div>
        ))}
      </div>

      <p style={{ fontSize: 12, color: "#6b7280", marginTop: 16, lineHeight: 1.7 }}>
        <strong>Important context:</strong> This is an expected-value calculation. Not every dismissed complaint triggers regulatory action — the probability per complaint is low. However, CFPB enforcement actions in 2024 ranged from $100K to over $5M per action (source: CFPB 2024 Consumer Response Annual Report). The &ldquo;$50K average regulatory impact&rdquo; is our conservative estimate that weights the low probability of enforcement against the high cost when it occurs. If the system prevents even one enforcement action per year, the ROI exceeds 70× at the corrected annual cost of ~$6,960 for 100K complaints/month.
      </p>
      <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>
        Cost: $0.051/complaint ($0.006 input + $0.045 output at Claude Sonnet pricing). Source: Anthropic API pricing, April 2026.
      </p>
    </div>
  );
}

// ─── Dataset stats type ───────────────────────────────────────────────────────
interface DatasetStats {
  total_complaints_analyzed: number;
  total_complaints_in_database: number;
  bayesian_training_samples: number;
  pct_closed_with_explanation: number;
  pct_got_resolution: number;
  high_risk_gap_pct: number;
  unique_products: number;
}

const API = `${API_BASE_URL}/api`;

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AboutPage() {
  const [stats, setStats] = useState<DatasetStats | null>(null);

  useEffect(() => {
    fetch(`${API}/dataset-stats`)
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {});
  }, []);

  const closedPct = stats?.pct_closed_with_explanation ?? 59.8;
  const highRiskPct = stats?.high_risk_gap_pct ?? 12.0;
  const totalAnalyzed = stats?.total_complaints_analyzed ?? 100000;
  const bayesianSamples = stats?.bayesian_training_samples ?? 35000;
  const uniqueProducts = stats?.unique_products ?? 11;

  return (
    <div>

      {/* ── 1. Hero ──────────────────────────────────────────────────────────── */}
      <SectionWrapper bg="#ffffff">
        <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "5px 14px", borderRadius: 9999,
            background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)",
            marginBottom: 20,
          }}>
            <Trophy style={{ width: 13, height: 13, color: "#059669" }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#047857" }}>
              2026 UMD Agentic AI Challenge · Smith School of Business
            </span>
          </div>

          <h1 style={{ fontSize: 44, fontWeight: 800, color: "#111827", margin: "0 0 12px", lineHeight: 1.15 }}>
            CFPB Complaint Intelligence System
          </h1>
          <p style={{ fontSize: 20, fontWeight: 600, color: "#374151", margin: "0 0 16px" }}>
            Multi-Agent AI with Bayesian Risk Assessment
          </p>
          <p style={{ fontSize: 15, color: "#6b7280", maxWidth: 640, margin: "0 auto 36px", lineHeight: 1.75 }}>
            Turning consumer complaints into actionable intelligence — identifying high-risk
            dismissals before they become regulatory problems.
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
            {[
              { value: "70%", label: "Product accuracy", color: "#10b981" },
              { value: "6", label: "Specialized agents", color: "#0ea5e9" },
              { value: "~28s", label: "Avg pipeline latency (6 agents, 2 in parallel)", color: "#8b5cf6" },
              { value: String(uniqueProducts), label: "Product categories", color: "#f59e0b" },
            ].map(({ value, label, color }) => (
              <div key={label} style={{
                borderRadius: 14, border: `1px solid ${color}30`, background: `${color}08`,
                padding: "18px 24px", textAlign: "center", minWidth: 120,
              }}>
                <p style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1, margin: 0 }}>{value}</p>
                <p style={{ fontSize: 11, color: "#4b5563", marginTop: 6 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </SectionWrapper>

      {/* ── 2. Team Samanvay ─────────────────────────────────────────────────── */}
      <SectionWrapper bg="#f9fafb">
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ fontSize: 30, fontWeight: 800, color: "#111827", margin: "0 0 8px", lineHeight: 1.2 }}>
            Team Samanvay
          </h2>
          <p style={{ fontSize: 15, color: "#6b7280", margin: 0 }}>University of Maryland, College Park</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 32, maxWidth: 860, margin: "0 auto" }}>
          <TeamMemberCard firstName="Akhil" lastName="Kambhatla" program="MSDS" photo="/team/akhil_kambhatla.jpeg" initials="AK" placeholderColor="#10b981" />
          <TeamMemberCard firstName="Hemanth" lastName="Thulasiraman" program="MSDS" photo="/team/hemanth_thulasiraman.jpeg" initials="HT" placeholderColor="#3b82f6" />
          <TeamMemberCard firstName="Ravi" lastName="Parvatham" program="MSML" photo="/team/ravi_parvatham.jpeg" initials="RP" placeholderColor="#8b5cf6" />
          <TeamMemberCard firstName="Namratha" lastName="Jeethendra" program="MSDS" photo="/team/namratha_jeethendra.jpeg" initials="NJ" placeholderColor="#f59e0b" />
        </div>
      </SectionWrapper>

      {/* ── 3. The Problem ───────────────────────────────────────────────────── */}
      <SectionWrapper bg="#ffffff">
        <SectionTitle>The $2.9 Billion Problem</SectionTitle>

        <div style={{ display: "flex", gap: 16, marginBottom: 8, flexWrap: "wrap" }}>
          <BigStatCard end={14} suffix="M+" label="complaints in the CFPB database" color="#0ea5e9" />
          <BigStatCard end={2.9} suffix="B" prefix="$" label="complaint management software market (2026)" color="#7c3aed" decimals={1} />
          <BigStatCard end={closedPct} suffix="%" label="of complaints closed with just an explanation" color="#f97316" decimals={1} />
          <BigStatCard end={highRiskPct} suffix="%" label="of dismissed complaints carry high regulatory risk" color="#e11d48" decimals={1} />
        </div>
        <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          {[
            "14M+: CFPB Consumer Complaint Database, 2011–2025",
            "$2.9B: Research and Markets, Global Forecast 2026",
            `${closedPct.toFixed(1)}%: Our ${(totalAnalyzed / 1000).toFixed(0)}K-complaint analysis (2024+)`,
            `${highRiskPct.toFixed(1)}%: Risk gap analysis on our ${(totalAnalyzed / 1000).toFixed(0)}K-complaint dataset`,
          ].map((s) => (
            <p key={s} style={{ fontSize: 10, color: "#9ca3af", margin: 0, flex: 1, minWidth: 160 }}>Source: {s}</p>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Card>
            <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.8, margin: 0 }}>
              Financial institutions receive thousands of consumer complaints monthly through the CFPB.
              The majority are handled reactively — categorized by hand, routed inconsistently, and often
              dismissed with a generic explanation. This creates regulatory exposure: complaints that should
              have been resolved are dismissed, leading to enforcement actions, fines, and customer churn.
            </p>
          </Card>
          <Card>
            <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.8, margin: 0 }}>
              The complaint management software market is projected to grow from $2.9B to $5.3B by 2032
              (10.5% CAGR). Companies like Zendesk, Salesforce, and Freshworks are investing heavily in
              AI-powered complaint resolution. Our system addresses the gap none of these platforms fill:
              predicting which complaints are dangerously under-prioritized using calibrated Bayesian
              risk assessment.
            </p>
          </Card>
        </div>
      </SectionWrapper>

      {/* ── 3. Our Solution ──────────────────────────────────────────────────── */}
      <SectionWrapper bg="#ffffff">
        <SectionTitle>What We Built</SectionTitle>
        <p style={{ fontSize: 14, color: "#4b5563", lineHeight: 1.75, marginTop: -8, marginBottom: 28 }}>
          A multi-agent AI system with 6 specialized agents that process complaints end-to-end:
          from raw narrative to risk-assessed, team-routed resolution plan with real-time Slack alerts.
        </p>

        {/* Static pipeline diagram */}
        <Card style={{ marginBottom: 24, background: "#fafafa" }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 16px" }}>
            Agent Pipeline
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
            {[
              { label: "Input", color: "#6b7280" },
              { label: "Classifier", color: "#0ea5e9" },
              { label: "Bayesian Risk Analyzer", color: "#8b5cf6" },
              { label: "Event Chain Analyst", color: "#f97316" },
              { label: "Router", color: "#10b981" },
              { label: "Resolution Generator", color: "#ec4899" },
              { label: "Quality Check", color: "#6366f1" },
            ].map((step, i, arr) => (
              <div key={step.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  padding: "7px 14px", borderRadius: 8,
                  background: `${step.color}12`, border: `1.5px solid ${step.color}35`,
                  fontSize: 12, fontWeight: 600, color: step.color, whiteSpace: "nowrap",
                }}>
                  {step.label}
                </div>
                {i < arr.length - 1 && (
                  <ArrowRight style={{ width: 13, height: 13, color: "#d1d5db", flexShrink: 0 }} />
                )}
              </div>
            ))}
          </div>
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <AgentRow num={1} name="Classifier" color="#0ea5e9"
            desc="Identifies product, issue, severity, and compliance risk from raw narrative using structured LLM output and few-shot examples from CFPB categories." />
          <AgentRow num={2} name="Bayesian Risk Analyzer" color="#8b5cf6"
            desc={`Predicts resolution probability with calibrated uncertainty — 95% credible intervals, not just a point estimate, using Bayesian logistic regression on ${bayesianSamples.toLocaleString()} CFPB complaints.`} />
          <AgentRow num={3} name="Event Chain Analyst" color="#f97316"
            desc="Traces the sequence of events that led to the complaint, identifying root cause, causal chain, and the prevention step that would have stopped the complaint." />
          <AgentRow num={4} name="Router" color="#10b981"
            desc="Assigns to the right team at the right priority using hybrid rule-based + LLM reasoning, then sends real-time Slack alerts to the assigned channel." />
          <AgentRow num={5} name="Resolution Generator" color="#ec4899"
            desc="Creates remediation plan and regulatory-compliant customer response letter citing TILA, FCRA, FDCPA, or CFPA as applicable to the product type." />
          <AgentRow num={6} name="Quality Check" color="#6366f1"
            desc="Validates consistency across all agents, computes per-agent confidence scores, and flags cases for human review when overall confidence falls below 70%." />
        </div>
      </SectionWrapper>

      {/* ── 4. Differentiator ────────────────────────────────────────────────── */}
      <SectionWrapper bg="#f9fafb">
        <SectionTitle>Our Differentiator: Bayesian Risk Intelligence</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          {[
            {
              title: "Calibrated Uncertainty",
              color: "#8b5cf6",
              text: `Most AI systems give you a single number: "this complaint is 70% likely to be resolved." But how reliable is that number? Our system uses Bayesian statistics to say: "between 65% and 75%, and we're 95% sure." If the range is narrow, we're confident. If it's wide, we're telling you honestly that we're less certain. This calibrated honesty helps compliance teams decide when to trust the AI and when to involve a human.`,
            },
            {
              title: "Risk Gap Analysis",
              color: "#e11d48",
              text: `We analyzed ${(totalAnalyzed).toLocaleString()} real CFPB complaints and discovered something alarming: ${Math.round(totalAnalyzed * highRiskPct / 100).toLocaleString()} complaints (${highRiskPct.toFixed(1)}%) were dismissed by companies despite carrying high regulatory risk. These are the complaints most likely to trigger CFPB enforcement actions — and companies are letting them slip through. Across the full 14M+ complaint CFPB database, this pattern would scale to potentially hundreds of thousands of dangerously mishandled complaints. Our system catches them automatically.`,
            },
            {
              title: "The Product Type Finding",
              color: "#10b981",
              text: "Here's what surprised us most: the single biggest factor determining whether your complaint gets resolved isn't how eloquently you describe your problem, whether you cite federal regulations, or whether you mention hiring a lawyer. It's simply what type of financial product your complaint is about. Credit reporting complaints get resolved 47% of the time. Student loan complaints: only 1.9% — a 25x gap. This structural bias means our system can predict likely outcomes the moment a complaint is classified, before anyone reads a single word of the narrative.",
            },
          ].map(({ title, color, text }) => (
            <Card key={title} style={{ borderTop: `4px solid ${color}` }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 10px" }}>{title}</h3>
              <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.7, margin: 0 }}>{text}</p>
            </Card>
          ))}
        </div>
      </SectionWrapper>

      {/* ── 5. Timeline & Cost ───────────────────────────────────────────────── */}
      <SectionWrapper bg="#ffffff">
        <SectionTitle>Deployment Timeline & Cost</SectionTitle>

        {/* Timeline steps */}
        <div style={{ display: "flex", gap: 8, marginBottom: 36, overflowX: "auto", paddingBottom: 4 }}>
          {[
            { week: "Week 1–2", title: "API Integration", desc: "Connect to existing CRM (Salesforce, ServiceNow, Zendesk) via webhook" },
            { week: "Week 3", title: "Data Pipeline", desc: "Set up CFPB API for real-time complaint feed" },
            { week: "Week 4", title: "Slack / Teams", desc: "Team routing alerts and high-risk escalation integration" },
            { week: "Week 5", title: "User Acceptance Testing", desc: "UAT with compliance team and stakeholders" },
            { week: "Week 6", title: "Production", desc: "Deploy to production + monitoring dashboard" },
          ].map((step, i) => (
            <div key={step.week} style={{ flex: 1, minWidth: 160 }}>
              <div style={{
                padding: "16px 14px", borderRadius: 12,
                border: "1px solid #e5e7eb", background: "#fafafa", height: "100%",
                boxSizing: "border-box",
              }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: 22, height: 22, borderRadius: "50%",
                  background: "#0284c7", color: "#fff",
                  fontSize: 11, fontWeight: 800, marginBottom: 8,
                }}>
                  {i + 1}
                </div>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#0284c7", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 5px" }}>
                  {step.week}
                </p>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>{step.title}</p>
                <p style={{ fontSize: 11, color: "#6b7280", margin: 0, lineHeight: 1.5 }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Cost table */}
        <Card>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 16px" }}>Cost Breakdown</p>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "#374151", fontWeight: 700 }}>Item</th>
                <th style={{ textAlign: "right", padding: "8px 12px", color: "#374151", fontWeight: 700 }}>Monthly Cost</th>
                <th style={{ textAlign: "right", padding: "8px 12px", color: "#374151", fontWeight: 700 }}>Annual Cost</th>
              </tr>
            </thead>
            <tbody>
              {[
                { item: "Claude API (100,000 complaints/month @ $0.051/complaint)", monthly: "$5,100", annual: "$61,200" },
                { item: "Cloud hosting (FastAPI + Next.js)", monthly: "$50", annual: "$600" },
                { item: "Monitoring & logging", monthly: "$20", annual: "$240" },
              ].map(({ item, monthly, annual }) => (
                <tr key={item} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 12px", color: "#374151" }}>{item}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: "#374151", fontFamily: "monospace" }}>{monthly}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: "#374151", fontFamily: "monospace" }}>{annual}</td>
                </tr>
              ))}
              <tr style={{ borderTop: "2px solid #e5e7eb", background: "#f9fafb" }}>
                <td style={{ padding: "10px 12px", fontWeight: 700, color: "#111827" }}>Total operational cost</td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, color: "#10b981", fontFamily: "monospace" }}>$580</td>
                <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 800, color: "#10b981", fontFamily: "monospace" }}>$6,960</td>
              </tr>
            </tbody>
          </table>
          <p style={{ fontSize: 11, color: "#6b7280", marginTop: 12, lineHeight: 1.7 }}>
            Cost per complaint: ~2,000 input tokens × $3/M + ~3,000 output tokens × $15/M = <strong>$0.051/complaint</strong>. Averaged across 6 agents. Source: Anthropic API pricing, April 2026. No GPU infrastructure required.
          </p>
        </Card>
      </SectionWrapper>

      {/* ── 6. ROI Calculator ────────────────────────────────────────────────── */}
      <SectionWrapper bg="#f9fafb">
        <SectionTitle>Return on Investment</SectionTitle>
        <Card>
          <ROICalculator />
        </Card>
        <Card style={{ marginTop: 16, background: "#f9fafb", border: "1px solid #e5e7eb" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: "0 0 10px" }}>A Note on Scaling</p>
          <p style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.75, margin: "0 0 12px" }}>
            This ROI calculator assumes linear scaling of API costs. In a real enterprise deployment processing 50,000+ complaints per month:
          </p>
          <ul style={{ margin: 0, padding: "0 0 0 16px", display: "flex", flexDirection: "column", gap: 4 }}>
            {[
              "Parallel processing infrastructure adds ~$200–500/month (message queues, worker processes)",
              "Anthropic API rate limits may require an upgraded plan for sustained throughput at 50K+ complaints/month",
              "A dedicated monitoring dashboard adds ~$100/month",
              "At 50,000 complaints/month: API cost ~$2,550 + infrastructure ~$800 = ~$3,350/month total",
              "Per-complaint API cost stays at ~$0.051 regardless of scale — Anthropic doesn't offer volume discounts at this tier",
            ].map((item) => (
              <li key={item} style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.65 }}>• {item}</li>
            ))}
          </ul>
        </Card>
      </SectionWrapper>

      {/* ── 7. Risks & Mitigations ───────────────────────────────────────────── */}
      <SectionWrapper bg="#ffffff">
        <SectionTitle>Risks & Mitigations</SectionTitle>
        <p style={{ fontSize: 14, color: "#4b5563", lineHeight: 1.75, marginTop: -16, marginBottom: 20 }}>
          Building AI systems for regulatory compliance carries real responsibility. Before deploying, any organization should evaluate these risks honestly. We&apos;ve built mitigations directly into the system, but transparency about limitations is as important as the technology itself.
        </p>
        <Card style={{ padding: "24px 28px" }}>
          {/* Header row */}
          <div style={{
            display: "grid", gridTemplateColumns: "180px 1fr 1fr 1fr", gap: 16,
            paddingBottom: 12, borderBottom: "2px solid #e5e7eb",
          }}>
            {["Risk", "Impact", "Built (current)", "Production Enhancement"].map((h) => (
              <p key={h} style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>{h}</p>
            ))}
          </div>

          {[
            {
              risk: "Demographic bias in predictions",
              impact: "Product-type-driven predictions structurally disadvantage consumers in low-resolution categories (e.g., student loans: 1.9% resolution rate vs. credit reporting: 47%).",
              current: "Evaluation dashboard shows per-product resolution disparities. Human review flags low-confidence predictions.",
              future: "Fairness audits across demographic groups (requires demographic data we don't currently have). Per-product resolution targets.",
            },
            {
              risk: "Over-reliance on automation",
              impact: "Teams may act on AI recommendations without critical review, especially for P1 complaints.",
              current: "Agents below 70% confidence flagged for human review. Quality Check validates cross-agent consistency. All outputs labeled as recommendations.",
              future: "Mandatory human approval workflow for P1 complaints. Audit trail for every automated decision.",
            },
            {
              risk: "Gaming the system",
              impact: "Companies could selectively resolve complaints that trigger high risk scores while ignoring others.",
              current: "Not currently addressed in the system.",
              future: "Temporal monitoring of company resolution patterns. Alert when a company's resolution rate changes suddenly.",
            },
            {
              risk: "Privacy concerns",
              impact: "Complaint narratives can contain sensitive personal and financial details.",
              current: "Processes CFPB's pre-scrubbed public data only. Slack alerts contain excerpts only, not full narratives.",
              future: "PII scrubbing pipeline for raw intake data. Data retention policies. SOC2 compliance review.",
            },
            {
              risk: "Model drift",
              impact: "Bayesian model trained on 2024 snapshot may become inaccurate as complaint patterns change.",
              current: "Static model — no automated retraining. Fixed coefficients from initial training run.",
              future: "Quarterly retraining on fresh CFPB data. Model versioning. Accuracy monitoring dashboard.",
            },
          ].map(({ risk, impact, current, future }, i, arr) => (
            <div key={risk} style={{
              display: "grid", gridTemplateColumns: "180px 1fr 1fr 1fr", gap: 16,
              padding: "16px 0",
              borderBottom: i < arr.length - 1 ? "1px solid #f3f4f6" : "none",
            }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: 0 }}>{risk}</p>
              <p style={{ fontSize: 12, color: "#374151", margin: 0, lineHeight: 1.65 }}>{impact}</p>
              <p style={{ fontSize: 12, color: "#374151", margin: 0, lineHeight: 1.65 }}>
                <span style={{ display: "inline-block", background: "#d1fae5", color: "#065f46", borderRadius: 4, padding: "1px 5px", fontSize: 10, fontWeight: 700, marginBottom: 4 }}>BUILT</span>
                <br />{current}
              </p>
              <p style={{ fontSize: 12, color: "#374151", margin: 0, lineHeight: 1.65 }}>
                <span style={{ display: "inline-block", background: "#e0f2fe", color: "#0369a1", borderRadius: 4, padding: "1px 5px", fontSize: 10, fontWeight: 700, marginBottom: 4 }}>FUTURE</span>
                <br />{future}
              </p>
            </div>
          ))}
        </Card>
      </SectionWrapper>

      {/* ── 8. Integration Architecture ──────────────────────────────────────── */}
      <SectionWrapper bg="#f9fafb">
        <SectionTitle>Enterprise Integration Architecture</SectionTitle>
        <p style={{ fontSize: 14, color: "#4b5563", lineHeight: 1.75, marginTop: -16, marginBottom: 20 }}>
          An AI system only creates value when it connects to the tools teams already use. The diagram below shows how our system plugs into an organization&apos;s existing workflow — from where complaints enter (upstream) to where results are delivered (downstream). All connections shown below are built and documented as working API endpoints.
        </p>
        <Card style={{ padding: "28px 32px" }}>
          {/* Flow diagram */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 28, alignItems: "center", marginBottom: 32 }}>

            {/* Upstream */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 14px" }}>
                Upstream
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "CFPB API", desc: "daily complaint feed" },
                  { label: "Salesforce Service Cloud", desc: "case creation webhook" },
                  { label: "Email / Web intake", desc: "generic webhook" },
                ].map(({ label, desc }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      flex: 1, padding: "10px 14px", borderRadius: 10,
                      border: "1px solid #e5e7eb", background: "#fff",
                    }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#374151", margin: 0 }}>{label}</p>
                      <p style={{ fontSize: 10, color: "#9ca3af", margin: 0 }}>{desc}</p>
                    </div>
                    <ArrowRight style={{ width: 14, height: 14, color: "#9ca3af", flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Center system box */}
            <div style={{
              borderRadius: 16, border: "2px solid #10b981",
              background: "linear-gradient(135deg, #f0fdf4, #ffffff)",
              padding: "24px 28px", textAlign: "center", minWidth: 200,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, background: "#d1fae5",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 14px",
              }}>
                <GitBranch style={{ width: 22, height: 22, color: "#059669" }} />
              </div>
              <p style={{ fontSize: 14, fontWeight: 800, color: "#111827", margin: "0 0 2px" }}>
                CFPB Complaint
              </p>
              <p style={{ fontSize: 14, fontWeight: 800, color: "#111827", margin: "0 0 10px" }}>
                Intelligence System
              </p>
              <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 14px", lineHeight: 1.6 }}>
                6 AI Agents<br />Bayesian Risk Assessment
              </p>
              <div style={{ borderTop: "1px solid #d1fae5", paddingTop: 12, marginTop: 4 }}>
                <p style={{ fontSize: 10, color: "#9ca3af", margin: "0 0 6px" }}>powered by</p>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "5px 12px", borderRadius: 8,
                  background: "#faf5ff", border: "1px solid #e9d5ff",
                }}>
                  <Database style={{ width: 11, height: 11, color: "#7c3aed" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed" }}>Claude API</span>
                </div>
              </div>
            </div>

            {/* Downstream */}
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 14px" }}>
                Downstream
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "Slack (#team-billing)", desc: "real-time routing alerts" },
                  { label: "Slack (#team-compliance)", desc: "high-risk escalations" },
                  { label: "Slack (#cfpb-alerts)", desc: "oversight channel" },
                  { label: "Email", desc: "customer response letters (draft)" },
                  { label: "Salesforce", desc: "AI fields written back to case" },
                  { label: "CSV / Excel export", desc: "batch results download" },
                  { label: "Compliance dashboard", desc: "web-based monitoring" },
                ].map(({ label, desc }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <ArrowRight style={{ width: 13, height: 13, color: "#9ca3af", flexShrink: 0 }} />
                    <div style={{
                      flex: 1, padding: "7px 12px", borderRadius: 8,
                      border: "1px solid #e5e7eb", background: "#fff",
                    }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#374151", margin: 0 }}>{label}</p>
                      <p style={{ fontSize: 10, color: "#9ca3af", margin: 0 }}>{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Explanations */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20, borderTop: "1px solid #e5e7eb", paddingTop: 20 }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#374151", margin: "0 0 8px" }}>Upstream (data sources)</p>
              <ul style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.75, margin: 0, paddingLeft: 16 }}>
                <li><strong>CFPB API:</strong> polls daily for new complaints about specific companies</li>
                <li><strong>Salesforce:</strong> accepts Case objects via webhook, returns AI-enriched fields</li>
                <li><strong>Generic webhook:</strong> any CRM/ticketing system can POST complaints and receive analysis</li>
              </ul>
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#374151", margin: "0 0 8px" }}>Downstream (outputs)</p>
              <ul style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.75, margin: 0, paddingLeft: 16 }}>
                <li><strong>Slack:</strong> real-time team routing + high-risk escalation alerts</li>
                <li><strong>Salesforce:</strong> writes back AI classification, risk scores, and resolution plans</li>
                <li><strong>CSV export:</strong> batch results for compliance reporting</li>
                <li><strong>Dashboard:</strong> web-based monitoring of complaint trends and risk metrics</li>
              </ul>
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#374151", margin: "0 0 8px" }}>External dependency</p>
              <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.75, margin: 0 }}>
                <strong>Anthropic Claude API:</strong> required for LLM-powered analysis.
                Estimated uptime: 99.9% (Anthropic SLA). Fallback: queue complaints and
                process when API recovers.
              </p>
            </div>
          </div>
        </Card>
      </SectionWrapper>

      {/* ── 9. Future Roadmap ────────────────────────────────────────────────── */}
      <SectionWrapper bg="#f9fafb">
        <SectionTitle>Future Roadmap</SectionTitle>
        <p style={{ fontSize: 15, color: "#6b7280", marginTop: -16, marginBottom: 8, fontWeight: 500 }}>
          Transforming complaint intelligence into a complete compliance operations platform
        </p>
        <p style={{ fontSize: 14, color: "#4b5563", lineHeight: 1.75, marginBottom: 32 }}>
          Our current system demonstrates the core autonomous complaint management lifecycle. The features below represent our development roadmap for transforming this into a production-grade platform that addresses the most critical gaps in the $3.2B complaint management market.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          {/* Left: New Agents */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 14px" }}>
              New Agents
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                {
                  title: "Regulatory Risk Prediction Agent",
                  desc: "Analyzes complaint patterns across companies and predicts which patterns will likely attract CFPB enforcement action. Uses historical enforcement data combined with current complaint trends to generate early warnings. Example: 'Bank of America's mortgage complaint pattern matches 3 of 5 indicators that preceded recent enforcement actions.'",
                  tagLabel: "Novel — no existing solution offers this",
                  tagBg: "#d1fae5", tagColor: "#065f46",
                },
                {
                  title: "Proactive Outreach Agent",
                  desc: "Instead of waiting for complaints, this agent monitors account activity patterns (unusual fees, payment failures, service disruptions) to identify customers likely to file complaints BEFORE they do. Triggers preemptive contact and resolution, reducing complaint volume at the source.",
                  tagLabel: "Preventive — shifts from reactive to proactive",
                  tagBg: "#dbeafe", tagColor: "#1e40af",
                },
                {
                  title: "Churn Risk Agent",
                  desc: "Connects complaint data to customer lifetime value. For each complaint, calculates the revenue at risk if the complaint is mishandled. Example: 'Dismissing this complaint carries a 40% churn probability, representing $12,000 in customer lifetime value.' Makes the business case for resolution in dollar terms.",
                  tagLabel: "Revenue impact — speaks the language of executives",
                  tagBg: "#ede9fe", tagColor: "#5b21b6",
                },
                {
                  title: "Multi-Channel Ingestion Agent",
                  desc: "Ingests complaints from email, social media, phone call transcripts (via speech-to-text), web forms, and regulatory portals. Normalizes all formats into the standard processing pipeline. A single entry point for complaints regardless of channel.",
                  tagLabel: "Enterprise-ready — handles real-world complexity",
                  tagBg: "#fef3c7", tagColor: "#92400e",
                },
              ].map(({ title, desc, tagLabel, tagBg, tagColor }) => (
                <div key={title} style={{
                  background: "#ffffff", border: "1px solid #e5e7eb",
                  borderRadius: 12, padding: "20px",
                  display: "flex", flexDirection: "column", gap: 8,
                }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: 0 }}>{title}</p>
                  <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.65, margin: 0, flex: 1 }}>{desc}</p>
                  <span style={{
                    display: "inline-block", background: tagBg, color: tagColor,
                    borderRadius: 9999, padding: "3px 10px", fontSize: 11, fontWeight: 600,
                    alignSelf: "flex-start", marginTop: 4,
                  }}>
                    {tagLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Platform Capabilities */}
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 14px" }}>
              Platform Capabilities
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                {
                  title: "Fine-Tuned Classification Model",
                  desc: "Train a specialized model (LoRA fine-tuning on open-source LLM) on CFPB labeled data for 95%+ product accuracy, sub-second classification, and zero per-complaint API cost. Reduces classification latency from 2 seconds to under 100 milliseconds.",
                  tagLabel: "Performance — 20x faster, 10x cheaper",
                  tagBg: "#e0f2fe", tagColor: "#0369a1",
                },
                {
                  title: "Semantic Complaint Search",
                  desc: "Embedding-based similarity search across the entire complaint history. Find all complaints similar to a given one, even if they use completely different language. Enables pattern discovery that keyword search misses.",
                  tagLabel: "Intelligence — finds hidden connections",
                  tagBg: "#e0e7ff", tagColor: "#3730a3",
                },
                {
                  title: "Automated Regulatory Reporting",
                  desc: "Auto-generates the quarterly CFPB compliance reports that every financial institution must file. Currently these take compliance teams weeks to compile manually. The system generates them in minutes from its case database.",
                  tagLabel: "Compliance — saves weeks of manual work",
                  tagBg: "#ccfbf1", tagColor: "#115e59",
                },
                {
                  title: "Complaint-to-Revenue Analytics",
                  desc: "Connects complaint patterns to business metrics: customer churn rate by complaint type, revenue impact of resolution delays, cost of regulatory inaction. Provides executives with a financial dashboard that translates complaint data into business decisions.",
                  tagLabel: "Business value — from compliance cost to strategic asset",
                  tagBg: "#ffe4e6", tagColor: "#9f1239",
                },
              ].map(({ title, desc, tagLabel, tagBg, tagColor }) => (
                <div key={title} style={{
                  background: "#ffffff", border: "1px solid #e5e7eb",
                  borderRadius: 12, padding: "20px",
                  display: "flex", flexDirection: "column", gap: 8,
                }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: 0 }}>{title}</p>
                  <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.65, margin: 0, flex: 1 }}>{desc}</p>
                  <span style={{
                    display: "inline-block", background: tagBg, color: tagColor,
                    borderRadius: 9999, padding: "3px 10px", fontSize: 11, fontWeight: 600,
                    alignSelf: "flex-start", marginTop: 4,
                  }}>
                    {tagLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </SectionWrapper>

      {/* ── 10. Tech Stack ───────────────────────────────────────────────────── */}
      <SectionWrapper bg="#ffffff">
        <SectionTitle>Technology Stack</SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {[
            { name: "Python / FastAPI", tag: "Backend API & streaming" },
            { name: "Next.js / React / TypeScript", tag: "Frontend" },
            { name: "Claude AI (Anthropic SDK)", tag: "LLM backbone" },
            { name: "PyMC", tag: "Bayesian inference" },
            { name: "LangGraph", tag: "Agent orchestration" },
            { name: "NetworkX", tag: "Graph analysis" },
            { name: "Pandas / scikit-learn", tag: "Data processing & evaluation" },
            { name: "Recharts / D3", tag: "Visualization" },
            { name: "Slack API", tag: "Real-time alerts" },
          ].map(({ name, tag }) => (
            <div key={name} style={{
              borderRadius: 12, border: "1px solid #e5e7eb", background: "#fafafa",
              padding: "14px 16px",
            }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>{name}</p>
              <p style={{ fontSize: 11, color: "#6b7280", margin: 0 }}>{tag}</p>
            </div>
          ))}
        </div>
      </SectionWrapper>


    </div>
  );
}
