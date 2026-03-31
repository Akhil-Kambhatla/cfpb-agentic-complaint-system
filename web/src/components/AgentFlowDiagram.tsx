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
import type { AgentState, RoutingOutput, CausalAnalysisOutput } from "@/types";

// ─── Layout (SVG coords) ──────────────────────────────────────────────────────
const VW = 1000;
const VH = 640;

// Standard node dims
const NW = 160;
const NH = 70;

// Taller node dims for router/causal
const NW_ROUTER = 230;
const NH_ROUTER = 170;
const NW_CAUSAL = 190;
const NH_CAUSAL = 100;
const NW_INPUT = 180;
const NH_INPUT = 52;

// Node centers
const NODES = {
  complaint_input: { cx: 500, cy: 44, nw: NW_INPUT, nh: NH_INPUT },
  classifier:      { cx: 500, cy: 148, nw: NW,       nh: NH },
  causal_analyst:  { cx: 200, cy: 320, nw: NW_CAUSAL, nh: NH_CAUSAL },
  router:          { cx: 800, cy: 332, nw: NW_ROUTER, nh: NH_ROUTER },
  resolution:      { cx: 500, cy: 480, nw: NW,        nh: NH },
  quality_check:   { cx: 500, cy: 590, nw: NW,        nh: NH },
} as const;

// Edge bezier paths (connect bottom of source to top of target)
const EDGE_DEFS = [
  {
    id: "e0",
    source: "complaint_input" as const,
    target: "classifier" as const,
    d: "M 500 70 C 500 96 500 108 500 113",
  },
  {
    id: "e1",
    source: "classifier" as const,
    target: "causal_analyst" as const,
    d: "M 500 183 C 500 230 200 255 200 270",
  },
  {
    id: "e2",
    source: "classifier" as const,
    target: "router" as const,
    d: "M 500 183 C 500 230 800 255 800 247",
  },
  {
    id: "e3",
    source: "causal_analyst" as const,
    target: "resolution" as const,
    d: "M 200 370 C 200 425 500 445 500 445",
  },
  {
    id: "e4",
    source: "router" as const,
    target: "resolution" as const,
    d: "M 800 417 C 800 445 500 445 500 445",
  },
  {
    id: "e5",
    source: "resolution" as const,
    target: "quality_check" as const,
    d: "M 500 515 C 500 536 500 554 500 555",
  },
] as const;

type EdgeId = (typeof EDGE_DEFS)[number]["id"];
type NodeKey = keyof typeof NODES;

// Node colors by status
const COLORS = {
  idle:     { border: "#1e293b", bg: "rgba(15,23,42,0.8)",    text: "#475569", iconBg: "rgba(30,41,59,0.6)",    icon: "#334155" },
  running:  { border: "#0ea5e9", bg: "rgba(14,165,233,0.07)", text: "#7dd3fc", iconBg: "rgba(14,165,233,0.15)", icon: "#38bdf8" },
  complete: { border: "#10b981", bg: "rgba(16,185,129,0.06)", text: "#6ee7b7", iconBg: "rgba(16,185,129,0.15)", icon: "#34d399" },
  error:    { border: "#f43f5e", bg: "rgba(244,63,94,0.07)",  text: "#fda4af", iconBg: "rgba(244,63,94,0.15)",  icon: "#fb7185" },
};

const TEAMS = [
  "compliance",
  "billing_disputes",
  "fraud",
  "customer_service",
  "legal",
  "executive_escalation",
];

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  agentStates: Record<string, AgentState>;
}

export default function AgentFlowDiagram({ agentStates }: Props) {
  const [particleKeys, setParticleKeys] = useState<Record<string, number>>({});

  // Reset particles when agents go idle
  useEffect(() => {
    const allIdle = Object.values(agentStates).every((s) => s.status === "idle");
    if (allIdle) setParticleKeys({});
  }, [agentStates]);

  // Fire particles when a source node completes
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

  const allComplete = ["classifier", "causal_analyst", "router", "resolution", "quality_check"].every(
    (n) => agentStates[n]?.status === "complete"
  );

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "620px",
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(3,7,18,0.6)",
        overflow: "hidden",
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
          <filter id="pg" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="eh" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {EDGE_DEFS.map((edge) => {
          const srcStatus = agentStates[edge.source]?.status ?? "idle";
          const tgtStatus = agentStates[edge.target]?.status ?? "idle";
          const isActive = tgtStatus === "running";
          const isDone = srcStatus === "complete" && tgtStatus === "complete";
          const showHalo = isActive || isDone || allComplete;
          const glowColor = allComplete ? "#10b981" : isActive ? "#0ea5e9" : "#10b981";
          const strokeColor = allComplete ? "#10b981" : isDone ? "#10b981" : isActive ? "#0ea5e9" : "#1e293b";

          return (
            <g key={edge.id}>
              {showHalo && (
                <path
                  d={edge.d}
                  fill="none"
                  stroke={glowColor}
                  strokeWidth={10}
                  strokeOpacity={0.12}
                  strokeLinecap="round"
                  filter="url(#eh)"
                />
              )}
              <path
                id={`p-${edge.id}`}
                d={edge.d}
                fill="none"
                stroke={strokeColor}
                strokeWidth={1.8}
                strokeLinecap="round"
                style={{ transition: "stroke 0.55s ease" }}
              />
            </g>
          );
        })}

        {EDGE_DEFS.map((edge) => {
          const pk = particleKeys[edge.id as EdgeId];
          if (!pk) return null;
          return (
            <g key={`pt-${edge.id}-${pk}`}>
              <circle r="10" fill="#0ea5e9" opacity="0.18" filter="url(#pg)">
                <animateMotion dur="0.85s" fill="freeze" repeatCount="1">
                  <mpath href={`#p-${edge.id}`} />
                </animateMotion>
              </circle>
              <circle r="3.5" fill="#bae6fd">
                <animateMotion dur="0.85s" fill="freeze" repeatCount="1">
                  <mpath href={`#p-${edge.id}`} />
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

      {/* Causal Analyst — taller, shows chain preview */}
      <CausalNode state={agentStates["causal_analyst"] ?? { status: "idle" }} />

      {/* Router — shows team pills */}
      <RouterNode state={agentStates["router"] ?? { status: "idle" }} />

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
      />
    </div>
  );
}

// ─── Complaint Input Node ─────────────────────────────────────────────────────

function ComplaintInputNode() {
  const n = NODES.complaint_input;
  const lp = ((n.cx - n.nw / 2) / VW) * 100;
  const tp = ((n.cy - n.nh / 2) / VH) * 100;
  const wp = (n.nw / VW) * 100;
  const hp = (n.nh / VH) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        position: "absolute",
        left: `${lp}%`,
        top: `${tp}%`,
        width: `${wp}%`,
        height: `${hp}%`,
        borderRadius: 10,
        border: "1px solid rgba(14,165,233,0.4)",
        background: "rgba(14,165,233,0.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      <Inbox style={{ width: 12, height: 12, color: "#38bdf8" }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: "#7dd3fc" }}>Complaint Input</span>
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
}

function StandardNode({ nodeKey, label, subLabel, Icon, state, enterDelay }: StandardNodeProps) {
  const n = NODES[nodeKey];
  const lp = ((n.cx - n.nw / 2) / VW) * 100;
  const tp = ((n.cy - n.nh / 2) / VH) * 100;
  const wp = (n.nw / VW) * 100;
  const hp = (n.nh / VH) * 100;
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
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.36, delay: enterDelay, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "absolute",
        left: `${lp}%`,
        top: `${tp}%`,
        width: `${wp}%`,
        height: `${hp}%`,
        borderRadius: 11,
        border: `1.5px solid ${c.border}`,
        background: c.bg,
        backdropFilter: "blur(8px)",
        overflow: "hidden",
        transition: "border-color 0.5s ease, background 0.5s ease",
      }}
    >
      {state.status === "running" && <PulseRing />}
      {state.status === "complete" && <CompletionGlow />}

      <div style={{ display: "flex", alignItems: "center", height: "100%", padding: "0 10px", gap: 8 }}>
        <IconBubble Icon={Icon} status={state.status} c={c} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: c.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.35, transition: "color 0.45s ease" }}>
            {label}
          </p>
          <p style={{ fontSize: 9, color: "#475569", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1, lineHeight: 1.3 }}>
            {statusText}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Causal Analyst Node ──────────────────────────────────────────────────────

function CausalNode({ state }: { state: AgentState }) {
  const n = NODES.causal_analyst;
  const lp = ((n.cx - n.nw / 2) / VW) * 100;
  const tp = ((n.cy - n.nh / 2) / VH) * 100;
  const wp = (n.nw / VW) * 100;
  const hp = (n.nh / VH) * 100;
  const c = COLORS[state.status] ?? COLORS.idle;

  const result = state.result as CausalAnalysisOutput | undefined;
  const chain = result?.causal_chain;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.36, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "absolute",
        left: `${lp}%`,
        top: `${tp}%`,
        width: `${wp}%`,
        height: `${hp}%`,
        borderRadius: 11,
        border: `1.5px solid ${c.border}`,
        background: c.bg,
        backdropFilter: "blur(8px)",
        overflow: "hidden",
        transition: "border-color 0.5s ease, background 0.5s ease",
        padding: "8px 10px",
        boxSizing: "border-box",
      }}
    >
      {state.status === "running" && <PulseRing />}
      {state.status === "complete" && <CompletionGlow />}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
        <IconBubble Icon={GitBranch} status={state.status} c={c} size={24} />
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, color: c.text, lineHeight: 1.3 }}>Causal Analyst</p>
          <p style={{ fontSize: 8, color: "#475569", lineHeight: 1.2 }}>
            {state.status === "running" ? "Building causal graph…" : state.status === "complete" ? `Done · ${state.elapsed ?? ""}s` : "Root cause & DAG"}
          </p>
        </div>
      </div>

      {/* Mini causal chain preview when complete */}
      {state.status === "complete" && chain && chain.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {chain.slice(0, 3).map((edge, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <div style={{
                fontSize: 7,
                color: i === 0 ? "#f59e0b" : "#94a3b8",
                background: i === 0 ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.04)",
                borderRadius: 4,
                padding: "2px 5px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}>
                {i === 0 ? edge.cause : edge.effect}
              </div>
              {i < Math.min(chain.length - 1, 2) && (
                <div style={{ fontSize: 7, color: "#334155", textAlign: "center", lineHeight: 1 }}>↓</div>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ─── Router Node ──────────────────────────────────────────────────────────────

function RouterNode({ state }: { state: AgentState }) {
  const n = NODES.router;
  const lp = ((n.cx - n.nw / 2) / VW) * 100;
  const tp = ((n.cy - n.nh / 2) / VH) * 100;
  const wp = (n.nw / VW) * 100;
  const hp = (n.nh / VH) * 100;
  const c = COLORS[state.status] ?? COLORS.idle;

  const result = state.result as RoutingOutput | undefined;
  const selectedTeam = result?.assigned_team ?? "";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.36, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "absolute",
        left: `${lp}%`,
        top: `${tp}%`,
        width: `${wp}%`,
        height: `${hp}%`,
        borderRadius: 11,
        border: `1.5px solid ${c.border}`,
        background: c.bg,
        backdropFilter: "blur(8px)",
        overflow: "hidden",
        transition: "border-color 0.5s ease, background 0.5s ease",
        padding: "8px 10px",
        boxSizing: "border-box",
      }}
    >
      {state.status === "running" && <PulseRing />}
      {state.status === "complete" && <CompletionGlow />}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <IconBubble Icon={Route} status={state.status} c={c} size={24} />
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, color: c.text, lineHeight: 1.3 }}>Router</p>
          <p style={{ fontSize: 8, color: "#475569", lineHeight: 1.2 }}>
            {state.status === "running" ? "Assigning team…" : state.status === "complete" ? `Done · ${state.elapsed ?? ""}s` : "Team & priority"}
          </p>
        </div>
        {result?.priority_level && (
          <span style={{
            marginLeft: "auto",
            fontSize: 8,
            fontWeight: 700,
            padding: "2px 5px",
            borderRadius: 4,
            background: result.priority_level === "P1" ? "rgba(244,63,94,0.2)" : result.priority_level === "P2" ? "rgba(249,115,22,0.2)" : "rgba(245,158,11,0.2)",
            color: result.priority_level === "P1" ? "#fb7185" : result.priority_level === "P2" ? "#fb923c" : "#fbbf24",
          }}>
            {result.priority_level}
          </span>
        )}
      </div>

      {/* Team pills */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {TEAMS.map((team) => {
          const isSelected = selectedTeam === team;
          const isComplete = state.status === "complete";
          return (
            <div
              key={team}
              style={{
                fontSize: 7.5,
                fontWeight: isSelected && isComplete ? 600 : 400,
                padding: "2px 6px",
                borderRadius: 4,
                background: isSelected && isComplete ? "rgba(16,185,129,0.18)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${isSelected && isComplete ? "rgba(16,185,129,0.35)" : "rgba(255,255,255,0.05)"}`,
                color: isSelected && isComplete ? "#6ee7b7" : "#334155",
                transition: "all 0.4s ease",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              {isSelected && isComplete && (
                <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#10b981", flexShrink: 0 }} />
              )}
              {team.replace(/_/g, " ")}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function PulseRing() {
  return (
    <motion.div
      style={{ position: "absolute", inset: -1, borderRadius: 11, border: "2px solid #38bdf8", pointerEvents: "none" }}
      animate={{ opacity: [0.2, 0.8, 0.2], scale: [1, 1.04, 1] }}
      transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

function CompletionGlow() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.35, 0.12] }}
      transition={{ duration: 0.8 }}
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 11,
        background: "radial-gradient(ellipse at 50% 60%, rgba(16,185,129,0.25) 0%, transparent 70%)",
        pointerEvents: "none",
      }}
    />
  );
}

function IconBubble({
  Icon,
  status,
  c,
  size = 28,
}: {
  Icon: React.ElementType;
  status: string;
  c: (typeof COLORS)["idle"];
  size?: number;
}) {
  const iconSize = size - 14;
  return (
    <motion.div
      animate={status === "running" ? { scale: [1, 1.1, 1] } : { scale: 1 }}
      transition={{ duration: 0.75, repeat: status === "running" ? Infinity : 0 }}
      style={{
        width: size,
        height: size,
        borderRadius: 7,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: c.iconBg,
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
