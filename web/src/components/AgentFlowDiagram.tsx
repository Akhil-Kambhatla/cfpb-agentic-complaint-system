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
} from "lucide-react";
import type { AgentState } from "@/types";

// ─── Layout constants ─────────────────────────────────────────────────────────
// The SVG uses viewBox="0 0 VW VH" with preserveAspectRatio="none" so that
// SVG coordinates map proportionally to container pixels. HTML nodes are
// positioned as percentages derived from the same coordinate space, ensuring
// the bezier path endpoints always land exactly at each node's center.

const VW = 1000; // SVG viewBox width
const VH = 500; // SVG viewBox height
const NW = 156; // node width  (SVG units → scales with container)
const NH = 72; // node height (SVG units)

// Node centers in SVG space
// NH/2 = 36 → edges connect at: top = cy−36, bottom = cy+36
const NODE_DEFS = [
  // classifier   bottom = 86
  { id: "classifier",     label: "Classifier",    desc: "Product & severity", Icon: Tag,         cx: 500, cy: 50,  enterDelay: 0    },
  // causal_analyst  top = 169,  bottom = 241
  { id: "causal_analyst", label: "Causal Analyst",desc: "Root cause & DAG",  Icon: GitBranch,   cx: 190, cy: 205, enterDelay: 0.07 },
  // router          top = 169,  bottom = 241
  { id: "router",         label: "Router",        desc: "Team & priority",   Icon: Route,       cx: 810, cy: 205, enterDelay: 0.07 },
  // resolution      top = 314,  bottom = 386
  { id: "resolution",     label: "Resolution",    desc: "Remediation plan",  Icon: FileText,    cx: 500, cy: 350, enterDelay: 0.14 },
  // quality_check   top = 417,  bottom = 489
  { id: "quality_check",  label: "Quality Check", desc: "Confidence & QA",   Icon: ShieldCheck, cx: 500, cy: 453, enterDelay: 0.21 },
] as const;

type NodeId = (typeof NODE_DEFS)[number]["id"];
type NodeDef = (typeof NODE_DEFS)[number];

const EDGE_DEFS = [
  {
    id: "e1",
    source: "classifier"     as NodeId,
    target: "causal_analyst" as NodeId,
    d: "M 500 86 C 500 135 190 128 190 169",
  },
  {
    id: "e2",
    source: "classifier" as NodeId,
    target: "router"     as NodeId,
    d: "M 500 86 C 500 135 810 128 810 169",
  },
  {
    id: "e3",
    source: "causal_analyst" as NodeId,
    target: "resolution"     as NodeId,
    d: "M 190 241 C 190 292 500 264 500 314",
  },
  {
    id: "e4",
    source: "router"     as NodeId,
    target: "resolution" as NodeId,
    d: "M 810 241 C 810 292 500 264 500 314",
  },
  {
    id: "e5",
    source: "resolution"    as NodeId,
    target: "quality_check" as NodeId,
    d: "M 500 386 C 500 402 500 402 500 417",
  },
] as const;

// ─── Node colors ──────────────────────────────────────────────────────────────
const NODE_COLORS: Record<
  string,
  { border: string; bg: string; text: string; iconBg: string; iconColor: string }
> = {
  idle:     { border: "#334155", bg: "rgba(30,41,59,0.7)",     text: "#94a3b8", iconBg: "rgba(51,65,85,0.6)",    iconColor: "#64748b" },
  running:  { border: "#0ea5e9", bg: "rgba(14,165,233,0.09)",  text: "#7dd3fc", iconBg: "rgba(14,165,233,0.18)", iconColor: "#38bdf8" },
  complete: { border: "#10b981", bg: "rgba(16,185,129,0.08)",  text: "#6ee7b7", iconBg: "rgba(16,185,129,0.18)", iconColor: "#34d399" },
  error:    { border: "#f43f5e", bg: "rgba(244,63,94,0.08)",   text: "#fda4af", iconBg: "rgba(244,63,94,0.18)",  iconColor: "#fb7185" },
};

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  agentStates: Record<string, AgentState>;
}

export default function AgentFlowDiagram({ agentStates }: Props) {
  // Keying particles by edge id: a non-zero value means "play this particle".
  // Changing the key remounts the SVG <animateMotion> element, replaying it.
  const [particleKeys, setParticleKeys] = useState<Record<string, number>>({});

  // Reset particles when all agents return to idle (new analysis starting)
  useEffect(() => {
    const allIdle = Object.values(agentStates).every((s) => s.status === "idle");
    if (allIdle) setParticleKeys({});
  }, [agentStates]);

  // Fire a particle along every edge whose source just completed
  useEffect(() => {
    for (const edge of EDGE_DEFS) {
      if (agentStates[edge.source]?.status === "complete") {
        setParticleKeys((prev) => {
          if (prev[edge.id]) return prev; // already fired for this run
          return { ...prev, [edge.id]: Date.now() };
        });
      }
    }
  }, [agentStates]);

  const allComplete = NODE_DEFS.every(
    (n) => agentStates[n.id]?.status === "complete"
  );

  return (
    <div
      className="relative w-full rounded-xl border border-white/10 bg-slate-900/60 overflow-hidden"
      style={{ height: "460px" }}
    >
      {/* ── SVG: bezier edges + traveling particles ─────────────────────────── */}
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none"
        aria-hidden="true"
      >
        <defs>
          <filter id="afg-particle-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="afg-edge-halo" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Edges */}
        {EDGE_DEFS.map((edge) => {
          const srcStatus = agentStates[edge.source]?.status ?? "idle";
          const tgtStatus = agentStates[edge.target]?.status ?? "idle";

          const isActive = tgtStatus === "running";
          const isDone   = srcStatus === "complete" && tgtStatus === "complete";
          const showHalo = isActive || isDone || allComplete;

          const glowColor  = allComplete ? "#10b981" : isActive ? "#0ea5e9" : "#10b981";
          const strokeColor = allComplete
            ? "#10b981"
            : isDone   ? "#10b981"
            : isActive ? "#0ea5e9"
            : "#1e293b";

          return (
            <g key={edge.id}>
              {/* Soft ambient halo behind active edges */}
              {showHalo && (
                <path
                  d={edge.d}
                  fill="none"
                  stroke={glowColor}
                  strokeWidth={10}
                  strokeOpacity={0.13}
                  strokeLinecap="round"
                  filter="url(#afg-edge-halo)"
                />
              )}
              {/* Main edge path — also referenced by <mpath> for animateMotion */}
              <path
                id={`afg-path-${edge.id}`}
                d={edge.d}
                fill="none"
                stroke={strokeColor}
                strokeWidth={1.8}
                strokeLinecap="round"
                style={{ transition: "stroke 0.6s ease" }}
              />
            </g>
          );
        })}

        {/* Traveling particles — remount via key to replay animateMotion */}
        {EDGE_DEFS.map((edge) => {
          const pKey = particleKeys[edge.id];
          if (!pKey) return null;
          return (
            <g key={`particle-${edge.id}-${pKey}`}>
              {/* Outer glow halo */}
              <circle r="10" fill="#0ea5e9" opacity="0.2" filter="url(#afg-particle-glow)">
                <animateMotion dur="0.9s" fill="freeze" repeatCount="1">
                  <mpath href={`#afg-path-${edge.id}`} />
                </animateMotion>
              </circle>
              {/* Core bright dot */}
              <circle r="4" fill="#bae6fd">
                <animateMotion dur="0.9s" fill="freeze" repeatCount="1">
                  <mpath href={`#afg-path-${edge.id}`} />
                </animateMotion>
              </circle>
            </g>
          );
        })}
      </svg>

      {/* ── HTML node overlays ────────────────────────────────────────────────── */}
      {NODE_DEFS.map((def) => {
        const state = agentStates[def.id] ?? { status: "idle" as const };
        return <AgentNodeBox key={def.id} def={def} state={state} />;
      })}
    </div>
  );
}

// ─── Node box component ───────────────────────────────────────────────────────

function AgentNodeBox({ def, state }: { def: NodeDef; state: AgentState }) {
  const { Icon, label, desc, cx, cy, enterDelay } = def;
  const { status, elapsed } = state;
  const c = NODE_COLORS[status] ?? NODE_COLORS.idle;

  // Map SVG coordinate space to container-relative percentages
  const leftPct   = ((cx - NW / 2) / VW) * 100;
  const topPct    = ((cy - NH / 2) / VH) * 100;
  const widthPct  = (NW / VW) * 100;
  const heightPct = (NH / VH) * 100;

  const statusLabel =
    status === "running"               ? "Processing…"
    : status === "complete" && elapsed != null ? `Done · ${elapsed}s`
    : status === "complete"            ? "Done"
    : status === "error"               ? "Error"
    : desc;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.38, delay: enterDelay, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position:      "absolute",
        left:          `${leftPct}%`,
        top:           `${topPct}%`,
        width:         `${widthPct}%`,
        height:        `${heightPct}%`,
        border:        `1.5px solid ${c.border}`,
        borderRadius:  11,
        background:    c.bg,
        backdropFilter:"blur(6px)",
        overflow:      "hidden",
        transition:    "border-color 0.5s ease, background 0.5s ease",
      }}
    >
      {/* Pulse ring when running */}
      {status === "running" && (
        <motion.div
          style={{
            position:    "absolute",
            inset:       -1,
            borderRadius: 11,
            border:      "2px solid #38bdf8",
            pointerEvents:"none",
          }}
          animate={{ opacity: [0.2, 0.85, 0.2], scale: [1, 1.045, 1] }}
          transition={{ duration: 1.35, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* Radial completion glow */}
      {status === "complete" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.4, 0.14] }}
          transition={{ duration: 0.85 }}
          style={{
            position:     "absolute",
            inset:        0,
            borderRadius: 11,
            background:   "radial-gradient(ellipse at 50% 60%, rgba(16,185,129,0.28) 0%, transparent 70%)",
            pointerEvents:"none",
          }}
        />
      )}

      {/* Content row */}
      <div
        style={{
          display:     "flex",
          alignItems:  "center",
          height:      "100%",
          padding:     "0 10px",
          gap:         8,
        }}
      >
        {/* Icon bubble */}
        <motion.div
          animate={status === "running" ? { scale: [1, 1.12, 1] } : { scale: 1 }}
          transition={{ duration: 0.8, repeat: status === "running" ? Infinity : 0 }}
          style={{
            width:          28,
            height:         28,
            borderRadius:   7,
            flexShrink:     0,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            background:     c.iconBg,
          }}
        >
          {status === "running" ? (
            <Loader2
              style={{ width: 13, height: 13, color: c.iconColor }}
              className="animate-spin"
            />
          ) : status === "complete" ? (
            <CheckCircle2 style={{ width: 13, height: 13, color: c.iconColor }} />
          ) : status === "error" ? (
            <XCircle style={{ width: 13, height: 13, color: c.iconColor }} />
          ) : (
            <Icon style={{ width: 13, height: 13, color: c.iconColor }} />
          )}
        </motion.div>

        {/* Label + status */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize:      11,
              fontWeight:    600,
              color:         c.text,
              whiteSpace:    "nowrap",
              overflow:      "hidden",
              textOverflow:  "ellipsis",
              lineHeight:    1.35,
              transition:    "color 0.45s ease",
            }}
          >
            {label}
          </p>
          <p
            style={{
              fontSize:      9,
              color:         "#475569",
              whiteSpace:    "nowrap",
              overflow:      "hidden",
              textOverflow:  "ellipsis",
              marginTop:     1,
              lineHeight:    1.3,
            }}
          >
            {statusLabel}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
