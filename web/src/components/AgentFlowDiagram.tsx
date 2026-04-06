"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Tag,
  GitBranch,
  Route,
  FileText,
  ShieldCheck,
  Loader2,
  CheckCircle2,
  XCircle,
  Inbox,
} from "lucide-react";
import type { AgentState, RoutingOutput, CausalAnalysisOutput, RiskAnalysisOutput } from "@/types";

// ─── SVG coordinate space ─────────────────────────────────────────────────────
const VW = 1000;
const VH = 780;

// Node sizes (SVG units)
const NW_STD = 200;
const NH_STD = 90;
const NW_INPUT = 210;
const NH_INPUT = 60;
const NW_RISK = 220;
const NH_RISK = 90;
const NW_CHAIN = 220;
const NH_CHAIN = 126;
const NW_ROUTER = 268;
const NH_ROUTER = 210;

// Node centers
const NODES = {
  complaint_input: { cx: 500, cy: 46,  nw: NW_INPUT,  nh: NH_INPUT },
  classifier:      { cx: 500, cy: 165, nw: NW_STD,    nh: NH_STD },
  risk_analyzer:   { cx: 500, cy: 296, nw: NW_RISK,   nh: NH_RISK },
  event_chain:     { cx: 192, cy: 450, nw: NW_CHAIN,  nh: NH_CHAIN },
  router:          { cx: 808, cy: 462, nw: NW_ROUTER,  nh: NH_ROUTER },
  resolution:      { cx: 500, cy: 618, nw: NW_STD,    nh: NH_STD },
  quality_check:   { cx: 500, cy: 730, nw: NW_STD,    nh: NH_STD },
} as const;

type NodeKey = keyof typeof NODES;

// Pre-computed bottom & top edges for each node
const bottom = (k: NodeKey) => NODES[k].cy + NODES[k].nh / 2;
const top    = (k: NodeKey) => NODES[k].cy - NODES[k].nh / 2;
const cx     = (k: NodeKey) => NODES[k].cx;

const EDGE_DEFS = [
  {
    id: "e0",
    source: "complaint_input" as NodeKey,
    target: "classifier" as NodeKey,
    d: `M ${cx("complaint_input")} ${bottom("complaint_input")} C ${cx("complaint_input")} ${(bottom("complaint_input")+top("classifier"))/2} ${cx("classifier")} ${(bottom("complaint_input")+top("classifier"))/2} ${cx("classifier")} ${top("classifier")}`,
  },
  {
    id: "e1",
    source: "classifier" as NodeKey,
    target: "risk_analyzer" as NodeKey,
    d: `M ${cx("classifier")} ${bottom("classifier")} C ${cx("classifier")} ${(bottom("classifier")+top("risk_analyzer"))/2} ${cx("risk_analyzer")} ${(bottom("classifier")+top("risk_analyzer"))/2} ${cx("risk_analyzer")} ${top("risk_analyzer")}`,
  },
  {
    id: "e2",
    source: "risk_analyzer" as NodeKey,
    target: "event_chain" as NodeKey,
    d: `M ${cx("risk_analyzer")} ${bottom("risk_analyzer")} C ${cx("risk_analyzer")} ${(bottom("risk_analyzer")+top("event_chain"))/2} ${cx("event_chain")} ${(bottom("risk_analyzer")+top("event_chain"))/2} ${cx("event_chain")} ${top("event_chain")}`,
  },
  {
    id: "e3",
    source: "risk_analyzer" as NodeKey,
    target: "router" as NodeKey,
    d: `M ${cx("risk_analyzer")} ${bottom("risk_analyzer")} C ${cx("risk_analyzer")} ${(bottom("risk_analyzer")+top("router"))/2} ${cx("router")} ${(bottom("risk_analyzer")+top("router"))/2} ${cx("router")} ${top("router")}`,
  },
  {
    id: "e4",
    source: "event_chain" as NodeKey,
    target: "resolution" as NodeKey,
    d: `M ${cx("event_chain")} ${bottom("event_chain")} C ${cx("event_chain")} ${(bottom("event_chain")+top("resolution"))/2} ${cx("resolution")} ${(bottom("event_chain")+top("resolution"))/2} ${cx("resolution")} ${top("resolution")}`,
  },
  {
    id: "e5",
    source: "router" as NodeKey,
    target: "resolution" as NodeKey,
    d: `M ${cx("router")} ${bottom("router")} C ${cx("router")} ${(bottom("router")+top("resolution"))/2} ${cx("resolution")} ${(bottom("router")+top("resolution"))/2} ${cx("resolution")} ${top("resolution")}`,
  },
  {
    id: "e6",
    source: "resolution" as NodeKey,
    target: "quality_check" as NodeKey,
    d: `M ${cx("resolution")} ${bottom("resolution")} C ${cx("resolution")} ${(bottom("resolution")+top("quality_check"))/2} ${cx("quality_check")} ${(bottom("resolution")+top("quality_check"))/2} ${cx("quality_check")} ${top("quality_check")}`,
  },
] as const;

// ─── Light-theme node colors ──────────────────────────────────────────────────
const COLORS = {
  idle:     { border: "#d1d5db", bg: "#f9fafb",                    text: "#9ca3af", iconBg: "#f3f4f6", icon: "#d1d5db" },
  running:  { border: "#0ea5e9", bg: "rgba(240,249,255,0.96)",     text: "#0369a1", iconBg: "rgba(14,165,233,0.12)", icon: "#0ea5e9" },
  complete: { border: "#10b981", bg: "rgba(240,253,244,0.96)",     text: "#047857", iconBg: "rgba(16,185,129,0.12)", icon: "#10b981" },
  error:    { border: "#f43f5e", bg: "rgba(255,241,242,0.96)",     text: "#be123c", iconBg: "rgba(244,63,94,0.12)",  icon: "#f43f5e" },
};

const TEAMS = [
  "compliance",
  "billing_disputes",
  "fraud",
  "customer_service",
  "legal",
  "executive_escalation",
];

// ─── Main component ───────────────────────────────────────────────────────────
interface Props {
  agentStates: Record<string, AgentState>;
  teamAlertSent?: boolean;
  slackAlertSent?: boolean;
}

export default function AgentFlowDiagram({ agentStates, teamAlertSent, slackAlertSent }: Props) {
  const [particleKeys, setParticleKeys] = useState<Record<string, number>>({});

  useEffect(() => {
    const allIdle = Object.values(agentStates).every((s) => s.status === "idle");
    if (allIdle) setParticleKeys({});
  }, [agentStates]);

  useEffect(() => {
    for (const edge of EDGE_DEFS) {
      if (agentStates[edge.source]?.status === "complete") {
        setParticleKeys((prev) => {
          if (prev[edge.id]) return prev;
          return { ...prev, [edge.id]: Date.now() };
        });
      }
    }
  }, [agentStates]);

  const allComplete = [
    "classifier", "risk_analyzer", "event_chain", "router", "resolution", "quality_check",
  ].every((n) => agentStates[n]?.status === "complete");

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "760px",
        borderRadius: 16,
        border: "1px solid #e5e7eb",
        background: "#f8fafc",
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      {/* SVG edges + particles */}
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
        aria-hidden
      >
        <defs>
          <filter id="pg-light" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="eh-light" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {EDGE_DEFS.map((edge) => {
          const srcStatus = agentStates[edge.source]?.status ?? "idle";
          const tgtStatus = agentStates[edge.target]?.status ?? "idle";
          const isActive = tgtStatus === "running";
          const isDone = srcStatus === "complete" && tgtStatus === "complete";
          const glowColor = allComplete ? "#10b981" : isActive ? "#0ea5e9" : "#10b981";
          const strokeColor = allComplete ? "#10b981" : isDone ? "#10b981" : isActive ? "#0ea5e9" : "#e5e7eb";
          const showHalo = isActive || isDone || allComplete;

          return (
            <g key={edge.id}>
              {showHalo && (
                <path
                  d={edge.d}
                  fill="none"
                  stroke={glowColor}
                  strokeWidth={12}
                  strokeOpacity={0.1}
                  strokeLinecap="round"
                  filter="url(#eh-light)"
                />
              )}
              <path
                id={`lp-${edge.id}`}
                d={edge.d}
                fill="none"
                stroke={strokeColor}
                strokeWidth={2}
                strokeLinecap="round"
                style={{ transition: "stroke 0.55s ease" }}
              />
            </g>
          );
        })}

        {EDGE_DEFS.map((edge) => {
          const pk = particleKeys[edge.id];
          if (!pk) return null;
          return (
            <g key={`pt-${edge.id}-${pk}`}>
              <circle r="10" fill="#0ea5e9" opacity="0.15" filter="url(#pg-light)">
                <animateMotion dur="1.5s" fill="freeze" repeatCount="1">
                  <mpath href={`#lp-${edge.id}`} />
                </animateMotion>
              </circle>
              <circle r="4" fill="#0ea5e9">
                <animateMotion dur="1.5s" fill="freeze" repeatCount="1">
                  <mpath href={`#lp-${edge.id}`} />
                </animateMotion>
              </circle>
            </g>
          );
        })}
      </svg>

      {/* Complaint Input node */}
      <ComplaintInputNode />

      {/* Standard nodes */}
      <StandardNode
        nodeKey="classifier"
        label="Classifier"
        subLabel="Product & severity"
        Icon={Tag}
        state={agentStates["classifier"] ?? { status: "idle" }}
        enterDelay={0}
      />

      <RiskNode state={agentStates["risk_analyzer"] ?? { status: "idle" }} />
      <EventChainNode state={agentStates["event_chain"] ?? { status: "idle" }} />
      <RouterNode state={agentStates["router"] ?? { status: "idle" }} teamAlertSent={teamAlertSent} />

      <StandardNode
        nodeKey="resolution"
        label="Resolution"
        subLabel="Remediation plan"
        Icon={FileText}
        state={agentStates["resolution"] ?? { status: "idle" }}
        enterDelay={0.18}
      />
      <StandardNode
        nodeKey="quality_check"
        label="Quality Check"
        subLabel="Confidence & QA"
        Icon={ShieldCheck}
        state={agentStates["quality_check"] ?? { status: "idle" }}
        enterDelay={0.22}
        slackAlertSent={slackAlertSent}
      />
    </div>
  );
}

// ─── Helpers: % positioning from SVG coords ───────────────────────────────────
function pctLeft(cx: number, nw: number) { return ((cx - nw / 2) / VW) * 100; }
function pctTop(cy: number, nh: number)  { return ((cy - nh / 2) / VH) * 100; }
function pctW(nw: number) { return (nw / VW) * 100; }
function pctH(nh: number) { return (nh / VH) * 100; }

// ─── Complaint Input Node ─────────────────────────────────────────────────────
function ComplaintInputNode() {
  const n = NODES.complaint_input;
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        position: "absolute",
        left: `${pctLeft(n.cx, n.nw)}%`,
        top: `${pctTop(n.cy, n.nh)}%`,
        width: `${pctW(n.nw)}%`,
        height: `${pctH(n.nh)}%`,
        borderRadius: 10,
        border: "1.5px solid #bae6fd",
        background: "#f0f9ff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
      }}
    >
      <Inbox style={{ width: 14, height: 14, color: "#0284c7" }} />
      <span style={{ fontSize: 13, fontWeight: 600, color: "#0284c7" }}>Complaint Input</span>
    </motion.div>
  );
}

// ─── Standard Node ────────────────────────────────────────────────────────────
interface StandardNodeProps {
  nodeKey: NodeKey;
  label: string;
  subLabel: string;
  Icon: React.ElementType;
  state: AgentState;
  enterDelay: number;
  slackAlertSent?: boolean;
}

function StandardNode({ nodeKey, label, subLabel, Icon, state, enterDelay, slackAlertSent }: StandardNodeProps) {
  const n = NODES[nodeKey];
  const c = COLORS[state.status] ?? COLORS.idle;

  const statusText =
    state.status === "running"
      ? "Processing…"
      : state.status === "complete" && state.elapsed != null
      ? `Done · ${state.elapsed}s`
      : state.status === "complete"
      ? "Done"
      : state.status === "error"
      ? "Error"
      : subLabel;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: enterDelay, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "absolute",
        left: `${pctLeft(n.cx, n.nw)}%`,
        top: `${pctTop(n.cy, n.nh)}%`,
        width: `${pctW(n.nw)}%`,
        height: `${pctH(n.nh)}%`,
        borderRadius: 12,
        border: `2px solid ${c.border}`,
        background: c.bg,
        boxShadow: state.status !== "idle" ? `0 2px 12px ${c.border}28` : "0 1px 4px rgba(0,0,0,0.06)",
        overflow: "hidden",
        transition: "border-color 0.5s ease, background 0.5s ease, box-shadow 0.5s ease",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 12,
      }}
    >
      {state.status === "running" && <PulseRing color={c.border} />}
      {state.status === "complete" && <CompletionGlow color="#10b981" />}

      <IconBubble Icon={Icon} status={state.status} c={c} size={36} iconSize={18} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 14, fontWeight: 700, color: state.status === "idle" ? "#9ca3af" : "#111827",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          transition: "color 0.45s ease", lineHeight: 1.3,
        }}>
          {label}
        </p>
        <p style={{
          fontSize: 12, color: state.status === "idle" ? "#d1d5db" : c.text,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          marginTop: 2, lineHeight: 1.3, transition: "color 0.45s ease",
        }}>
          {statusText}
        </p>
      </div>
      {slackAlertSent && state.status === "complete" && (
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          title="⚠️ High-risk alert sent to #cfpb-alerts"
          style={{
            fontSize: 14, flexShrink: 0, cursor: "default",
            padding: "2px 6px", borderRadius: 6,
            background: "#fff7ed", border: "1px solid #fdba74",
          }}
        >
          💬
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Risk Analyzer Node ───────────────────────────────────────────────────────
function RiskNode({ state }: { state: AgentState }) {
  const n = NODES.risk_analyzer;
  const c = COLORS[state.status] ?? COLORS.idle;
  const result = state.result as RiskAnalysisOutput | undefined;

  const statusText = state.status === "running"
    ? "Bayesian inference…"
    : state.status === "complete" && state.elapsed != null
    ? `Done · ${state.elapsed}s`
    : state.status === "complete"
    ? "Done"
    : "Posterior risk model";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.04, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "absolute",
        left: `${pctLeft(n.cx, n.nw)}%`,
        top: `${pctTop(n.cy, n.nh)}%`,
        width: `${pctW(n.nw)}%`,
        height: `${pctH(n.nh)}%`,
        borderRadius: 12,
        border: `2px solid ${c.border}`,
        background: c.bg,
        boxShadow: state.status !== "idle" ? `0 2px 12px ${c.border}28` : "0 1px 4px rgba(0,0,0,0.06)",
        overflow: "hidden",
        transition: "border-color 0.5s ease, background 0.5s ease, box-shadow 0.5s ease",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: 12,
      }}
    >
      {state.status === "running" && <PulseRing color={c.border} />}
      {state.status === "complete" && <CompletionGlow color="#10b981" />}

      <IconBubble Icon={ShieldCheck} status={state.status} c={c} size={36} iconSize={18} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 14, fontWeight: 700, color: state.status === "idle" ? "#9ca3af" : "#111827",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          transition: "color 0.45s ease", lineHeight: 1.3,
        }}>
          Risk Analyzer
        </p>
        <p style={{
          fontSize: 12, color: state.status === "idle" ? "#d1d5db" : c.text,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          marginTop: 2, lineHeight: 1.3, transition: "color 0.45s ease",
        }}>
          {statusText}
        </p>
      </div>

      {result?.risk_level && (
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 5,
          background: result.risk_level === "critical" ? "#fee2e2" : result.risk_level === "high" ? "#ffedd5" : result.risk_level === "medium" ? "#fef9c3" : "#d1fae5",
          color: result.risk_level === "critical" ? "#b91c1c" : result.risk_level === "high" ? "#c2410c" : result.risk_level === "medium" ? "#854d0e" : "#047857",
          border: `1px solid ${result.risk_level === "critical" ? "#fca5a5" : result.risk_level === "high" ? "#fdba74" : result.risk_level === "medium" ? "#fde047" : "#6ee7b7"}`,
          flexShrink: 0,
        }}>
          {result.risk_level.toUpperCase()}
        </span>
      )}
    </motion.div>
  );
}

// ─── Event Chain Node ─────────────────────────────────────────────────────────
function EventChainNode({ state }: { state: AgentState }) {
  const n = NODES.event_chain;
  const c = COLORS[state.status] ?? COLORS.idle;
  const result = state.result as CausalAnalysisOutput | undefined;
  const chain = result?.causal_chain;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.07, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "absolute",
        left: `${pctLeft(n.cx, n.nw)}%`,
        top: `${pctTop(n.cy, n.nh)}%`,
        width: `${pctW(n.nw)}%`,
        height: `${pctH(n.nh)}%`,
        borderRadius: 12,
        border: `2px solid ${c.border}`,
        background: c.bg,
        boxShadow: state.status !== "idle" ? `0 2px 12px ${c.border}28` : "0 1px 4px rgba(0,0,0,0.06)",
        overflow: "hidden",
        transition: "border-color 0.5s ease, background 0.5s ease, box-shadow 0.5s ease",
        padding: "12px 14px",
        boxSizing: "border-box",
      }}
    >
      {state.status === "running" && <PulseRing color={c.border} />}
      {state.status === "complete" && <CompletionGlow color="#10b981" />}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <IconBubble Icon={GitBranch} status={state.status} c={c} size={32} iconSize={16} />
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: state.status === "idle" ? "#9ca3af" : "#111827", lineHeight: 1.3 }}>
            Event Chain
          </p>
          <p style={{ fontSize: 12, color: c.text, lineHeight: 1.3 }}>
            {state.status === "running" ? "Extracting event chain…" : state.status === "complete" ? `Done · ${state.elapsed ?? ""}s` : "Root cause & sequence"}
          </p>
        </div>
      </div>

      {state.status === "complete" && chain && chain.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {chain.slice(0, 3).map((edge, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <div style={{
                fontSize: 10,
                color: i === 0 ? "#92400e" : "#4b5563",
                background: i === 0 ? "#fef3c7" : "#f3f4f6",
                border: `1px solid ${i === 0 ? "#fcd34d" : "#e5e7eb"}`,
                borderRadius: 5,
                padding: "2px 7px",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>
                {i === 0 ? `⚠ ${edge.cause}` : edge.effect}
              </div>
              {i < Math.min(chain.length - 1, 2) && (
                <div style={{ fontSize: 9, color: "#9ca3af", textAlign: "center" }}>↓</div>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── Router Node ──────────────────────────────────────────────────────────────
function RouterNode({ state, teamAlertSent }: { state: AgentState; teamAlertSent?: boolean }) {
  const n = NODES.router;
  const c = COLORS[state.status] ?? COLORS.idle;
  const result = state.result as RoutingOutput | undefined;
  const selectedTeam = result?.assigned_team ?? "";
  const isComplete = state.status === "complete";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: 0.07, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "absolute",
        left: `${pctLeft(n.cx, n.nw)}%`,
        top: `${pctTop(n.cy, n.nh)}%`,
        width: `${pctW(n.nw)}%`,
        height: `${pctH(n.nh)}%`,
        borderRadius: 12,
        border: `2px solid ${c.border}`,
        background: c.bg,
        boxShadow: state.status !== "idle" ? `0 2px 12px ${c.border}28` : "0 1px 4px rgba(0,0,0,0.06)",
        overflow: "hidden",
        transition: "border-color 0.5s ease, background 0.5s ease, box-shadow 0.5s ease",
        padding: "12px 14px",
        boxSizing: "border-box",
      }}
    >
      {state.status === "running" && <PulseRing color={c.border} />}
      {state.status === "complete" && <CompletionGlow color="#10b981" />}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <IconBubble Icon={Route} status={state.status} c={c} size={32} iconSize={16} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: state.status === "idle" ? "#9ca3af" : "#111827", lineHeight: 1.3 }}>
            Router
          </p>
          <p style={{ fontSize: 12, color: c.text, lineHeight: 1.3 }}>
            {state.status === "running" ? "Assigning team…" : state.status === "complete" ? `Done · ${state.elapsed ?? ""}s` : "Team & priority"}
          </p>
        </div>
        {result?.priority_level && (
          <span style={{
            fontSize: 11, fontWeight: 700,
            padding: "3px 7px", borderRadius: 6,
            background: result.priority_level === "P1" ? "#fee2e2" : result.priority_level === "P2" ? "#ffedd5" : "#fef9c3",
            color: result.priority_level === "P1" ? "#b91c1c" : result.priority_level === "P2" ? "#c2410c" : "#854d0e",
            border: `1px solid ${result.priority_level === "P1" ? "#fca5a5" : result.priority_level === "P2" ? "#fdba74" : "#fde047"}`,
          }}>
            {result.priority_level}
          </span>
        )}
      </div>

      {/* Team pills */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {TEAMS.map((team) => {
          const isSelected = isComplete && selectedTeam === team;
          return (
            <div
              key={team}
              style={{
                fontSize: 12,
                fontWeight: isSelected ? 600 : 400,
                padding: "3px 8px",
                borderRadius: 6,
                background: isSelected ? "#d1fae5" : "#f9fafb",
                border: `1px solid ${isSelected ? "#6ee7b7" : "#e5e7eb"}`,
                color: isSelected ? "#047857" : "#9ca3af",
                transition: "all 0.4s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {isSelected && (
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#10b981", flexShrink: 0 }} />
                )}
                {team.replace(/_/g, " ")}
              </div>
              {isSelected && teamAlertSent && (
                <motion.span
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 }}
                  title={`Alert sent to #team-${team.replace(/_/g, "-")}`}
                  style={{ fontSize: 11, flexShrink: 0 }}
                >
                  💬
                </motion.span>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────
function PulseRing({ color }: { color: string }) {
  return (
    <motion.div
      style={{ position: "absolute", inset: -2, borderRadius: 13, border: `2px solid ${color}`, pointerEvents: "none" }}
      animate={{ opacity: [0.3, 0.9, 0.3], scale: [1, 1.03, 1] }}
      transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

function CompletionGlow({ color }: { color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.3, 0.08] }}
      transition={{ duration: 0.9 }}
      style={{
        position: "absolute", inset: 0, borderRadius: 12,
        background: `radial-gradient(ellipse at 50% 60%, ${color}40 0%, transparent 70%)`,
        pointerEvents: "none",
      }}
    />
  );
}

function IconBubble({
  Icon, status, c, size, iconSize,
}: {
  Icon: React.ElementType;
  status: string;
  c: (typeof COLORS)["idle"];
  size: number;
  iconSize: number;
}) {
  return (
    <motion.div
      animate={status === "running" ? { scale: [1, 1.1, 1] } : { scale: 1 }}
      transition={{ duration: 0.75, repeat: status === "running" ? Infinity : 0 }}
      style={{
        width: size, height: size, borderRadius: 9, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: c.iconBg,
        border: `1px solid ${c.border}40`,
      }}
    >
      {status === "running" ? (
        <Loader2 style={{ width: iconSize, height: iconSize, color: c.icon }} className="animate-spin" />
      ) : status === "complete" ? (
        <CheckCircle2 style={{ width: iconSize, height: iconSize, color: c.icon }} />
      ) : status === "error" ? (
        <XCircle style={{ width: iconSize, height: iconSize, color: c.icon }} />
      ) : (
        <Icon style={{ width: iconSize, height: iconSize, color: c.icon }} />
      )}
    </motion.div>
  );
}
