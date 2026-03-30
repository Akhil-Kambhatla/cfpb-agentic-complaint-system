"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import type {
  ClassificationOutput,
  CausalAnalysisOutput,
  RoutingOutput,
  ResolutionOutput,
  QualityCheckOutput,
} from "@/types";
import CausalGraph from "./CausalGraph";
import ResolutionLetter from "./ResolutionLetter";
import QualityBadge from "./QualityBadge";

// ── Severity helpers ─────────────────────────────────────────

const severityColors = {
  low: "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30",
  medium: "bg-amber-500/20 text-amber-300 ring-amber-500/30",
  high: "bg-orange-500/20 text-orange-300 ring-orange-500/30",
  critical: "bg-rose-500/20 text-rose-300 ring-rose-500/30",
};

const priorityColors = {
  P1: "bg-rose-500/20 text-rose-300",
  P2: "bg-orange-500/20 text-orange-300",
  P3: "bg-amber-500/20 text-amber-300",
  P4: "bg-slate-700 text-slate-300",
};

function ConfidenceBar({ value, label }: { value: number; label?: string }) {
  return (
    <div className="space-y-1">
      {label && <p className="text-[10px] text-slate-500 capitalize">{label}</p>}
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-slate-700">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${value * 100}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className={`h-full rounded-full ${
              value >= 0.8 ? "bg-emerald-500" : value >= 0.5 ? "bg-amber-500" : "bg-rose-500"
            }`}
          />
        </div>
        <span className="text-xs font-mono text-slate-300 w-10 text-right">
          {(value * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

// ── Classifier card ──────────────────────────────────────────

export function ClassifierCard({ data }: { data: ClassificationOutput }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/30 px-3 py-1 text-xs font-medium">
          {data.predicted_product}
        </span>
        <span
          className={`rounded-full ring-1 px-3 py-1 text-xs font-semibold capitalize ${
            severityColors[data.severity] ?? severityColors.medium
          }`}
        >
          {data.severity} severity
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-white/5 p-3">
          <p className="text-[10px] text-slate-500 mb-1">Issue</p>
          <p className="text-xs text-slate-200">{data.predicted_issue}</p>
        </div>
        <div className="rounded-lg bg-white/5 p-3">
          <p className="text-[10px] text-slate-500 mb-1">Sub-issue</p>
          <p className="text-xs text-slate-200">{data.predicted_sub_issue ?? "—"}</p>
        </div>
      </div>

      <div className="space-y-2">
        <ConfidenceBar value={data.confidence} label="Classifier confidence" />
        <ConfidenceBar value={data.compliance_risk_score} label="Compliance risk score" />
      </div>

      <div className="rounded-lg bg-white/5 p-3">
        <p className="text-[10px] text-slate-500 mb-1">Reasoning</p>
        <p className="text-xs text-slate-300">{data.reasoning}</p>
      </div>
    </div>
  );
}

// ── Causal Analyst card ──────────────────────────────────────

export function CausalCard({ data }: { data: CausalAnalysisOutput }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
          <p className="text-[10px] text-amber-500 mb-1">Root Cause</p>
          <p className="text-xs text-amber-100">{data.root_cause}</p>
        </div>
        <div className="rounded-lg bg-white/5 p-3">
          <p className="text-[10px] text-slate-500 mb-1">Causal Depth</p>
          <p className="text-2xl font-bold text-slate-200">{data.causal_depth}</p>
          <p className="text-[10px] text-slate-500">hops from root to complaint</p>
        </div>
      </div>
      <CausalGraph data={data} />
      <ConfidenceBar value={data.confidence} label="Causal confidence" />
    </div>
  );
}

// ── Router card ──────────────────────────────────────────────

export function RouterCard({ data }: { data: RoutingOutput }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <span className="rounded-full bg-violet-500/20 text-violet-300 ring-1 ring-violet-500/30 px-3 py-1 text-xs font-medium capitalize">
          {data.assigned_team.replace(/_/g, " ")}
        </span>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            priorityColors[data.priority_level] ?? priorityColors.P3
          }`}
        >
          {data.priority_level}
        </span>
        {data.escalation_flag && (
          <span className="rounded-full bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/30 px-3 py-1 text-xs font-semibold">
            🚨 Escalated
          </span>
        )}
      </div>

      {data.escalation_reason && (
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3">
          <p className="text-[10px] text-rose-400 mb-1">Escalation Reason</p>
          <p className="text-xs text-rose-100">{data.escalation_reason}</p>
        </div>
      )}

      <div className="rounded-lg bg-white/5 p-3">
        <p className="text-[10px] text-slate-500 mb-1">Routing Reasoning</p>
        <p className="text-xs text-slate-300">{data.reasoning}</p>
      </div>
    </div>
  );
}

// ── Resolution card ──────────────────────────────────────────

export function ResolutionCard({ data }: { data: ResolutionOutput }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-white/5 p-3">
          <p className="text-[10px] text-slate-500 mb-2">Regulations</p>
          <div className="flex flex-wrap gap-1">
            {data.applicable_regulations.map((reg) => (
              <span
                key={reg}
                className="rounded bg-sky-500/20 text-sky-300 px-1.5 py-0.5 text-[10px] font-mono"
              >
                {reg}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-lg bg-white/5 p-3">
          <p className="text-[10px] text-slate-500 mb-1">Est. Resolution</p>
          <p className="text-2xl font-bold text-slate-200">{data.estimated_resolution_days}</p>
          <p className="text-[10px] text-slate-500">days</p>
        </div>
      </div>

      <div>
        <p className="text-[10px] text-slate-500 mb-2">Remediation Steps</p>
        <ol className="space-y-2">
          {data.remediation_steps.map((step, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-400">
                {i + 1}
              </span>
              <p className="text-xs text-slate-300 pt-0.5">{step}</p>
            </li>
          ))}
        </ol>
      </div>

      <ResolutionLetter letter={data.customer_response_letter} />
    </div>
  );
}

// ── Quality Check card ───────────────────────────────────────

export function QualityCheckCard({ data }: { data: QualityCheckOutput }) {
  const [traceOpen, setTraceOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="text-center">
          <p className="text-4xl font-bold text-white">
            {(data.overall_confidence * 100).toFixed(0)}
            <span className="text-xl text-slate-500">%</span>
          </p>
          <p className="text-[10px] text-slate-500">overall confidence</p>
        </div>
        <QualityBadge flag={data.quality_flag} size="lg" />
      </div>

      <div>
        <p className="text-[10px] text-slate-500 mb-2">Per-Agent Confidence</p>
        <div className="space-y-1.5">
          {Object.entries(data.agent_confidences).map(([agent, conf]) => (
            <ConfidenceBar key={agent} value={conf} label={agent.replace(/_/g, " ")} />
          ))}
        </div>
      </div>

      {data.consistency_issues.length > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <p className="text-[10px] text-amber-500 mb-1">Consistency Issues</p>
          <ul className="list-disc list-inside space-y-1">
            {data.consistency_issues.map((issue, i) => (
              <li key={i} className="text-xs text-amber-200">
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-white/10 bg-white/5">
        <button
          onClick={() => setTraceOpen(!traceOpen)}
          className="flex w-full items-center justify-between px-4 py-2.5"
        >
          <span className="text-xs text-slate-400">Reasoning Trace</span>
          {traceOpen ? (
            <ChevronUp className="h-3.5 w-3.5 text-slate-500" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
          )}
        </button>
        <AnimatePresence>
          {traceOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <p className="px-4 pb-3 text-xs text-slate-300 border-t border-white/10 pt-2">
                {data.reasoning_trace}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Generic expandable wrapper ───────────────────────────────

interface CardWrapperProps {
  title: string;
  icon: React.ElementType;
  badge?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  delay?: number;
}

export function AgentCardWrapper({
  title,
  icon: Icon,
  badge,
  children,
  defaultOpen = true,
  delay = 0,
}: CardWrapperProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="rounded-xl border border-white/10 bg-white/5 overflow-hidden"
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
            <Icon className="h-4 w-4 text-slate-300" />
          </div>
          <span className="font-semibold text-white">{title}</span>
          {badge}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/10 px-5 py-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
