"use client";

import { motion } from "framer-motion";
import {
  GitBranch, Shield, Database, Trophy, ArrowRight,
  AlertTriangle, CheckCircle2, Zap, BookOpen, MessageSquare,
} from "lucide-react";

// ─── Section wrapper ──────────────────────────────────────────────────────────
function PageSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay }}
    >
      {children}
    </motion.div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      borderRadius: 16, border: "1px solid #e5e7eb",
      background: "#ffffff", boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
      padding: "20px 24px",
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ value, label, color = "#10b981" }: { value: string; label: string; color?: string }) {
  return (
    <div style={{
      borderRadius: 14, border: `1px solid ${color}30`,
      background: `${color}08`,
      padding: "18px 20px", textAlign: "center",
    }}>
      <p style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1, margin: 0 }}>{value}</p>
      <p style={{ fontSize: 11, color: "#4b5563", marginTop: 6 }}>{label}</p>
    </div>
  );
}

// ─── Agent pill ───────────────────────────────────────────────────────────────
function AgentPill({ name, color, desc }: { name: string; color: string; desc: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12,
      padding: "14px 16px", borderRadius: 12,
      border: `1.5px solid ${color}30`, background: `${color}06`,
    }}>
      <div style={{
        width: 10, height: 10, borderRadius: "50%", background: color,
        flexShrink: 0, marginTop: 4,
      }} />
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: 0 }}>{name}</p>
        <p style={{ fontSize: 11, color: "#4b5563", marginTop: 3, lineHeight: 1.5 }}>{desc}</p>
      </div>
    </div>
  );
}

// ─── Tech badge ───────────────────────────────────────────────────────────────
function TechBadge({ name, tag }: { name: string; tag: string }) {
  return (
    <div style={{
      borderRadius: 10, border: "1px solid #e5e7eb", background: "#fafafa",
      padding: "10px 14px", display: "flex", flexDirection: "column", gap: 4,
    }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: "#111827", margin: 0 }}>{name}</p>
      <p style={{ fontSize: 10, color: "#6b7280" }}>{tag}</p>
    </div>
  );
}

// ─── Mock Slack message ───────────────────────────────────────────────────────
function SlackMockup({ channel, type }: { channel: string; type: "team" | "alert" }) {
  const isAlert = type === "alert";
  const color = isAlert ? "#e11d48" : "#0284c7";
  const icon = isAlert ? "⚠️" : "📋";
  const title = isAlert ? "High-Risk Complaint Detected" : "New Complaint Routed to Your Team";

  return (
    <div style={{
      borderRadius: 10, border: "1px solid #e5e7eb",
      background: "#ffffff", overflow: "hidden",
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    }}>
      {/* Slack-style header bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 14px", background: "#f8fafc",
        borderBottom: "1px solid #e5e7eb",
      }}>
        <div style={{
          width: 16, height: 16, borderRadius: 3,
          background: "#4a154b",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 9, color: "#fff", fontWeight: 800 }}>S</span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#1d1c1d" }}>#{channel}</span>
      </div>

      {/* Message body */}
      <div style={{ padding: "12px 14px" }}>
        <div style={{ display: "flex", gap: 10 }}>
          {/* Avatar */}
          <div style={{
            width: 28, height: 28, borderRadius: 6, flexShrink: 0,
            background: "#10b981", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff",
          }}>
            AI
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#1d1c1d" }}>CFPB Intelligence</span>
              <span style={{ fontSize: 10, color: "#9ca3af" }}>Today at 2:14 PM</span>
            </div>

            {/* Attachment */}
            <div style={{
              borderLeft: `4px solid ${color}`,
              borderRadius: "0 8px 8px 0",
              background: "#fafafa",
              border: `1px solid ${color}30`,
              borderLeftColor: color,
              padding: "10px 12px",
            }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#1d1c1d", margin: "0 0 8px" }}>
                {icon} {title}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px" }}>
                {isAlert ? (
                  <>
                    <div><span style={{ fontSize: 10, color: "#6b7280" }}>Product: </span><span style={{ fontSize: 10, fontWeight: 600, color: "#374151" }}>Credit Card</span></div>
                    <div><span style={{ fontSize: 10, color: "#6b7280" }}>Severity: </span><span style={{ fontSize: 10, fontWeight: 600, color: "#b91c1c" }}>CRITICAL</span></div>
                    <div><span style={{ fontSize: 10, color: "#6b7280" }}>Risk Gap: </span><span style={{ fontSize: 10, fontWeight: 600, color: "#c2410c" }}>+34%</span></div>
                    <div><span style={{ fontSize: 10, color: "#6b7280" }}>Resolution: </span><span style={{ fontSize: 10, fontWeight: 600, color: "#374151" }}>28% (CI: 18%–41%)</span></div>
                  </>
                ) : (
                  <>
                    <div><span style={{ fontSize: 10, color: "#6b7280" }}>Priority: </span><span style={{ fontSize: 10, fontWeight: 700, color: "#b91c1c" }}>🔴 P1</span></div>
                    <div><span style={{ fontSize: 10, color: "#6b7280" }}>Product: </span><span style={{ fontSize: 10, fontWeight: 600, color: "#374151" }}>Debt Collection</span></div>
                    <div><span style={{ fontSize: 10, color: "#6b7280" }}>Severity: </span><span style={{ fontSize: 10, fontWeight: 600, color: "#374151" }}>HIGH</span></div>
                    <div><span style={{ fontSize: 10, color: "#6b7280" }}>Company: </span><span style={{ fontSize: 10, fontWeight: 600, color: "#374151" }}>Equifax</span></div>
                  </>
                )}
              </div>
              <p style={{ fontSize: 10, color: "#6b7280", marginTop: 8, fontStyle: "italic" }}>
                &ldquo;I keep receiving calls about a debt I already paid in full…&rdquo;
              </p>
              <p style={{ fontSize: 9, color: "#9ca3af", marginTop: 6 }}>
                Assigned via CFPB Complaint Intelligence System
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AboutPage() {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px", display: "flex", flexDirection: "column", gap: 48 }}>

      {/* ── 1. Hero ──────────────────────────────────────────────────────────── */}
      <PageSection delay={0}>
        <div style={{ textAlign: "center", padding: "24px 0 8px" }}>
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

          <h1 style={{ fontSize: 36, fontWeight: 800, color: "#111827", margin: "0 0 16px", lineHeight: 1.2 }}>
            Multi-Agent Complaint Intelligence with Bayesian Risk Assessment
          </h1>
          <p style={{ fontSize: 16, color: "#4b5563", maxWidth: 680, margin: "0 auto", lineHeight: 1.7 }}>
            A multi-agent AI system that classifies, analyzes, routes, and resolves consumer
            financial complaints — featuring <strong style={{ color: "#047857" }}>Bayesian risk intelligence</strong> to
            answer: <em>"What is the probability this complaint gets resolved, and what intervention will change that?"</em>
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 28, flexWrap: "wrap" }}>
            <StatCard value="70%" label="Product accuracy" color="#10b981" />
            <StatCard value="6" label="Specialized agents" color="#0ea5e9" />
            <StatCard value="8.4s" label="Avg pipeline latency" color="#8b5cf6" />
            <StatCard value="11" label="Product categories" color="#f59e0b" />
          </div>
        </div>
      </PageSection>

      {/* ── 2. Problem ───────────────────────────────────────────────────────── */}
      <PageSection delay={0.05}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 16px" }}>The Problem</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <Card>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: "#fee2e2", border: "1px solid #fca5a5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <AlertTriangle style={{ width: 18, height: 18, color: "#dc2626" }} />
              </div>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>Manual Review Bottlenecks</h3>
                <p style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.7, margin: 0 }}>
                  The CFPB receives over 5,000 complaints per week. Manual triage by compliance
                  analysts is slow, inconsistent, and costly — creating resolution delays that harm consumers.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: "#fef3c7", border: "1px solid #fcd34d", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <BookOpen style={{ width: 18, height: 18, color: "#d97706" }} />
              </div>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>Hidden Resolution Risk</h3>
                <p style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.7, margin: 0 }}>
                  Existing classifiers only label "what" a complaint is about. They miss which complaints are
                  at risk of being dismissed despite high regulatory exposure — the dangerous gap.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: "#ede9fe", border: "1px solid #c4b5fd", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Shield style={{ width: 18, height: 18, color: "#7c3aed" }} />
              </div>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>Regulatory Complexity</h3>
                <p style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.7, margin: 0 }}>
                  Each product category (mortgages, credit cards, debt collection) falls under different
                  federal regulations — TILA, FCRA, FDCPA, CFPA. Response letters must cite the correct law.
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: "#e0f2fe", border: "1px solid #bae6fd", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Zap style={{ width: 18, height: 18, color: "#0284c7" }} />
              </div>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>Lack of Explainability</h3>
                <p style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.7, margin: 0 }}>
                  Black-box ML classifiers can't explain their decisions to regulators. Compliance teams
                  need auditability — who decided what, with what confidence, and why.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </PageSection>

      {/* ── 3. Approach ──────────────────────────────────────────────────────── */}
      <PageSection delay={0.08}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 16px" }}>Our Approach</h2>
        <Card>
          <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.7, margin: "0 0 20px" }}>
            We built a <strong>LangGraph-orchestrated multi-agent pipeline</strong> where each agent is a
            specialist. The orchestrator routes outputs from one agent to the next, building a cumulative
            evidence chain across six stages.
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap", justifyContent: "center" }}>
            {[
              { label: "Complaint Input", color: "#0ea5e9" },
              { label: "Classifier", color: "#0ea5e9" },
              { label: "Risk Analyzer", color: "#8b5cf6" },
              { label: "Event Chain", color: "#f97316" },
              { label: "Router", color: "#f97316" },
              { label: "Resolution", color: "#10b981" },
              { label: "Quality Check", color: "#ec4899" },
            ].map((step, i, arr) => (
              <div key={step.label} style={{ display: "flex", alignItems: "center", gap: 0 }}>
                <div style={{
                  padding: "8px 14px", borderRadius: 9,
                  background: `${step.color}12`, border: `1.5px solid ${step.color}30`,
                  fontSize: 12, fontWeight: 600, color: step.color,
                  whiteSpace: "nowrap",
                }}>
                  {step.label}
                </div>
                {i < arr.length - 1 && (
                  <ArrowRight style={{ width: 14, height: 14, color: "#d1d5db", margin: "0 4px", flexShrink: 0 }} />
                )}
              </div>
            ))}
          </div>
        </Card>
      </PageSection>

      {/* ── 4. Agents ────────────────────────────────────────────────────────── */}
      <PageSection delay={0.1}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 16px" }}>The Agents</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <AgentPill
            name="Classifier Agent"
            color="#0ea5e9"
            desc="Classifies product, issue, severity, and compliance risk from the raw narrative using structured LLM output and few-shot examples from CFPB categories."
          />
          <AgentPill
            name="Bayesian Risk Analyzer"
            color="#8b5cf6"
            desc="Computes posterior resolution probability with calibrated credible intervals, identifies risk gap vs. product baseline, and recommends the highest-impact intervention."
          />
          <AgentPill
            name="Event Chain Agent"
            color="#f97316"
            desc="Reconstructs the sequence of events from the complaint narrative — identifying the root cause, causal chain, and the prevention step that would have stopped the complaint."
          />
          <AgentPill
            name="Router Agent"
            color="#10b981"
            desc="Assigns complaints to the correct internal team (compliance, legal, fraud, etc.) with priority level using hybrid rule-based + LLM reasoning, then alerts the team via Slack."
          />
          <AgentPill
            name="Resolution Agent"
            color="#ec4899"
            desc="Generates regulation-specific remediation steps and a regulatory-compliant customer response letter citing TILA, FCRA, FDCPA, or CFPA as applicable."
          />
          <AgentPill
            name="Quality Check Agent"
            color="#6b7280"
            desc="Validates consistency across all agents, computes per-agent confidence scores, and flags cases requiring human review when overall confidence falls below 70%."
          />
        </div>
      </PageSection>

      {/* ── 5. Differentiator ────────────────────────────────────────────────── */}
      <PageSection delay={0.12}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 16px" }}>What Makes Us Different</h2>
        <Card style={{ borderLeft: "5px solid #8b5cf6", background: "linear-gradient(135deg, #faf5ff 0%, #ffffff 100%)" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#ede9fe", border: "1px solid #c4b5fd", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <GitBranch style={{ width: 20, height: 20, color: "#7c3aed" }} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>
                Bayesian Risk Intelligence
              </h3>
              <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.7, margin: "0 0 14px" }}>
                Most teams submit classifiers. We go further: our Bayesian Risk Analyzer computes a
                posterior resolution probability with calibrated credible intervals using features derived
                from 1.5 million CFPB complaints. We identify the <em>risk gap</em> — complaints with
                high regulatory exposure but low resolution probability — the cases most likely to be
                wrongly dismissed. Product type is the dominant predictor, explaining over 60% of outcome
                variance across product categories.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[
                  { icon: CheckCircle2, color: "#10b981", title: "Calibrated Uncertainty", desc: "Posterior credible intervals — not just a point estimate — for honest risk communication" },
                  { icon: CheckCircle2, color: "#10b981", title: "Risk Gap Analysis", desc: "Identifies dangerously dismissed complaints: high regulatory risk, low resolution probability" },
                  { icon: CheckCircle2, color: "#10b981", title: "Real-Time Slack Routing", desc: "When pipeline completes, assigned team gets an instant alert with full context and remediation steps" },
                ].map(({ icon: Icon, color, title, desc }) => (
                  <div key={title} style={{ borderRadius: 10, border: "1px solid #f3f4f6", background: "#fafafa", padding: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <Icon style={{ width: 14, height: 14, color }} />
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{title}</span>
                    </div>
                    <p style={{ fontSize: 11, color: "#4b5563", lineHeight: 1.5, margin: 0 }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </PageSection>

      {/* ── 6. Live Integration ──────────────────────────────────────────────── */}
      <PageSection delay={0.13}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 16px" }}>Live Integration</h2>
        <Card>
          <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.7, margin: "0 0 20px" }}>
            When a complaint is processed, the system automatically routes a Slack notification to the assigned team.
            If the complaint exceeds the high-risk threshold (risk gap &gt; 20%), a second alert is sent to the
            compliance oversight channel <strong>#cfpb-alerts</strong>.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                Team Channel (always sent)
              </p>
              <SlackMockup channel="team-billing-disputes" type="team" />
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
                Oversight Channel (high-risk only)
              </p>
              <SlackMockup channel="cfpb-alerts" type="alert" />
            </div>
          </div>

          {/* Team channel mapping */}
          <p style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 10 }}>Team Channel Routing</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
            {[
              { team: "compliance", channel: "#team-compliance" },
              { team: "billing_disputes", channel: "#team-billing-disputes" },
              { team: "fraud", channel: "#team-fraud" },
              { team: "customer_service", channel: "#team-customer-service" },
              { team: "legal", channel: "#team-legal" },
              { team: "executive_escalation", channel: "#team-executive-escalation" },
            ].map(({ team, channel }) => (
              <div key={team} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 12px", borderRadius: 8,
                background: "#f9fafb", border: "1px solid #f3f4f6",
              }}>
                <MessageSquare style={{ width: 12, height: 12, color: "#4a154b", flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#111827", margin: 0 }}>
                    {team.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </p>
                  <p style={{ fontSize: 10, color: "#6b7280", margin: 0 }}>{channel}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </PageSection>

      {/* ── 7. Data ──────────────────────────────────────────────────────────── */}
      <PageSection delay={0.14}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 16px" }}>Data</h2>
        <Card>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <Database style={{ width: 18, height: 18, color: "#0ea5e9" }} />
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: 0 }}>CFPB Consumer Complaint Database</h3>
              </div>
              <p style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.7, margin: 0 }}>
                The public CFPB dataset contains over 5 million complaints since 2011. We filter for
                records with consumer narrative text (~25–30% of all records), then sample stratified
                subsets by product category for development and evaluation.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "Full dataset", value: "5M+ complaints" },
                { label: "With narrative (our filter)", value: "~1.5M records" },
                { label: "Dev set used", value: "10,000 records" },
                { label: "Evaluation set", value: "50 stratified" },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 8, background: "#f9fafb", border: "1px solid #f3f4f6" }}>
                  <span style={{ fontSize: 12, color: "#4b5563" }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#111827", fontFamily: "monospace" }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </PageSection>

      {/* ── 8. Tech Stack ────────────────────────────────────────────────────── */}
      <PageSection delay={0.16}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 16px" }}>Tech Stack</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
          {[
            { name: "LangGraph", tag: "Agent orchestration" },
            { name: "Claude Sonnet 4.6", tag: "LLM backbone" },
            { name: "FastAPI + SSE", tag: "Streaming backend" },
            { name: "Next.js 16", tag: "React frontend" },
            { name: "Framer Motion", tag: "UI animations" },
            { name: "Recharts", tag: "Data visualization" },
            { name: "Slack Webhooks", tag: "Real-time team routing" },
            { name: "Pydantic v2", tag: "Typed agent I/O" },
            { name: "scikit-learn", tag: "Evaluation metrics" },
            { name: "pandas", tag: "Data processing" },
            { name: "Anthropic SDK", tag: "LLM API client" },
            { name: "Python 3.10+", tag: "Backend runtime" },
          ].map((t) => (
            <TechBadge key={t.name} name={t.name} tag={t.tag} />
          ))}
        </div>
      </PageSection>

      {/* ── 9. Competition ───────────────────────────────────────────────────── */}
      <PageSection delay={0.18}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 16px" }}>Competition</h2>
        <Card style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)", borderLeft: "5px solid #10b981" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: "#d1fae5", border: "1px solid #6ee7b7", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Trophy style={{ width: 20, height: 20, color: "#059669" }} />
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 6px" }}>
                2026 UMD Agentic AI Challenge
              </h3>
              <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 14px" }}>Robert H. Smith School of Business · April 2026</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[
                  { label: "Novelty", desc: "Bayesian risk intelligence with calibrated uncertainty — identifies dangerously dismissed complaints that classifiers miss" },
                  { label: "Methodology", desc: "Multi-agent LangGraph with structured I/O, confidence scores, and live Slack integration for team routing" },
                  { label: "Clarity", desc: "Fully explainable decisions with per-agent reasoning traces, feature effects, and human review flags" },
                ].map(({ label, desc }) => (
                  <div key={label} style={{ borderRadius: 10, border: "1px solid #d1fae5", background: "#f0fdf4", padding: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#047857", margin: "0 0 5px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
                    <p style={{ fontSize: 11, color: "#4b5563", lineHeight: 1.5, margin: 0 }}>{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </PageSection>

    </div>
  );
}
