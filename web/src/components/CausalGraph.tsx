"use client";

import { motion } from "framer-motion";
import { ArrowDown, Lightbulb, AlertTriangle, Shield } from "lucide-react";
import type { CausalAnalysisOutput } from "@/types";

interface Props {
  data: CausalAnalysisOutput;
}

export default function CausalGraph({ data }: Props) {
  return (
    <div className="space-y-4">
      {/* Causal chain */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Causal Chain (depth: {data.causal_depth})
        </p>
        <div className="space-y-0">
          {data.causal_chain.map((edge, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              {/* Root cause node */}
              {i === 0 && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 mb-0">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-500">
                      Root Cause
                    </span>
                  </div>
                  <p className="text-sm text-amber-100">{edge.cause}</p>
                  {edge.description && (
                    <p className="text-xs text-slate-400 mt-1">{edge.description}</p>
                  )}
                </div>
              )}

              {/* Arrow */}
              <div className="flex justify-center py-1">
                <ArrowDown className="h-4 w-4 text-slate-600" />
              </div>

              {/* Effect / next cause */}
              {i < data.causal_chain.length - 1 ? (
                <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-sm text-slate-200">{edge.effect}</p>
                </div>
              ) : (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-400">
                      Outcome
                    </span>
                  </div>
                  <p className="text-sm text-rose-100">{edge.effect}</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Counterfactual */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-3"
      >
        <div className="flex items-start gap-2">
          <Lightbulb className="h-4 w-4 text-sky-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-500 mb-1">
              Counterfactual Intervention
            </p>
            <p className="text-sm text-sky-100 italic">{data.counterfactual_intervention}</p>
          </div>
        </div>
      </motion.div>

      {/* Prevention */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3"
      >
        <div className="flex items-start gap-2">
          <Shield className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500 mb-1">
              Prevention Recommendation
            </p>
            <p className="text-sm text-emerald-100">{data.prevention_recommendation}</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
