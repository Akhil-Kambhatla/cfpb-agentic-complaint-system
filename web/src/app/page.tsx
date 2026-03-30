"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Tag,
  GitBranch,
  Route,
  FileText,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  Network,
  BarChart3,
} from "lucide-react";

const agents = [
  {
    icon: Tag,
    name: "Classifier",
    desc: "Identifies product, issue type, severity, and compliance risk from raw complaint text.",
    color: "text-sky-400",
    bg: "bg-sky-500/10 border-sky-500/20",
  },
  {
    icon: GitBranch,
    name: "Causal Analyst",
    desc: "Extracts causal DAGs and performs counterfactual root cause analysis — our key differentiator.",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
  },
  {
    icon: Route,
    name: "Router",
    desc: "Assigns complaints to internal teams (compliance, fraud, legal) with P1–P4 priority.",
    color: "text-violet-400",
    bg: "bg-violet-500/10 border-violet-500/20",
  },
  {
    icon: FileText,
    name: "Resolution",
    desc: "Generates remediation steps and regulatory-compliant customer response letters.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
  },
  {
    icon: ShieldCheck,
    name: "Quality Check",
    desc: "Validates consistency across all agent outputs and assigns explainability scores.",
    color: "text-rose-400",
    bg: "bg-rose-500/10 border-rose-500/20",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16 space-y-24">
      {/* Hero */}
      <div className="text-center space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium text-emerald-400"
        >
          <Sparkles className="h-3.5 w-3.5" />
          UMD Agentic AI Challenge 2026
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-5xl font-bold tracking-tight text-white"
        >
          CFPB Complaint
          <br />
          <span className="text-emerald-400">Intelligence System</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mx-auto max-w-2xl text-lg text-slate-400"
        >
          A 5-agent LangGraph pipeline that classifies consumer complaints, constructs causal
          graphs, routes to the right team, and generates regulatory-compliant resolution plans
          — with explainability traces for every decision.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-center gap-4"
        >
          <Link href="/analyze">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 transition-colors"
            >
              Analyze a Complaint
              <ArrowRight className="h-4 w-4" />
            </motion.button>
          </Link>
          <Link href="/evaluation">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 font-semibold text-white hover:bg-white/10 transition-colors"
            >
              <BarChart3 className="h-4 w-4" />
              View Evaluation Metrics
            </motion.button>
          </Link>
        </motion.div>
      </div>

      {/* Pipeline overview */}
      <div>
        <div className="flex items-center gap-3 mb-8">
          <Network className="h-5 w-5 text-emerald-400" />
          <h2 className="text-xl font-semibold text-white">5-Agent Pipeline</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {agents.map((agent, i) => (
            <motion.div
              key={agent.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i }}
              className={`rounded-xl border p-4 ${agent.bg}`}
            >
              <div className="flex items-center gap-2 mb-3">
                <agent.icon className={`h-5 w-5 ${agent.color}`} />
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {i + 1}. {agent.name}
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{agent.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Flow connector */}
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
          {agents.map((a, i) => (
            <span key={a.name} className="flex items-center gap-2">
              <span className={`font-medium ${a.color}`}>{a.name}</span>
              {i < agents.length - 1 && <ArrowRight className="h-3 w-3 text-slate-600" />}
            </span>
          ))}
        </div>
      </div>

      {/* Causal analysis differentiator */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-8"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/20">
            <GitBranch className="h-6 w-6 text-amber-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-amber-100 mb-2">
              Our Differentiator: Causal Counterfactual Analysis
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-4">
              Most systems just classify <em>what</em> a complaint is about. We answer:{" "}
              <strong className="text-amber-300">
                "What would have had to be different for this complaint to not have occurred?"
              </strong>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              {[
                {
                  step: "Extract",
                  desc: "LLM extracts causal chain as structured [{cause, effect}] graph from narrative",
                },
                {
                  step: "Analyze",
                  desc: "Build directed acyclic graph (DAG), identify root cause via longest path",
                },
                {
                  step: "Intervene",
                  desc: "Backtracking counterfactual: minimal intervention that prevents the complaint",
                },
              ].map((item) => (
                <div key={item.step} className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                  <p className="text-xs font-bold text-amber-400 mb-1">{item.step}</p>
                  <p className="text-xs text-slate-300">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        {[
          { value: "10,000", label: "Training complaints" },
          { value: "88%", label: "Product accuracy" },
          { value: "5", label: "Specialized agents" },
          { value: "~35s", label: "Per complaint" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-white/10 bg-white/5 p-5">
            <p className="text-3xl font-bold text-emerald-400">{stat.value}</p>
            <p className="text-xs text-slate-400 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
