"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import dynamic from "next/dynamic";
import { getEvaluation } from "@/lib/api";
import type { EvaluationMetrics } from "@/types";

const MetricsCharts = dynamic(() => import("@/components/MetricsCharts"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 text-slate-500 animate-spin" />
    </div>
  ),
});

export default function EvaluationPage() {
  const [metrics, setMetrics] = useState<EvaluationMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    getEvaluation()
      .then(setMetrics)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="h-5 w-5 text-emerald-400" />
            <h1 className="text-2xl font-bold text-white">Evaluation Metrics</h1>
          </div>
          <p className="text-slate-400 text-sm">
            Classifier performance on a stratified sample of CFPB complaints.
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </motion.button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-3">
            <Loader2 className="h-10 w-10 text-emerald-400 animate-spin mx-auto" />
            <p className="text-slate-400 text-sm">Loading evaluation metrics...</p>
          </div>
        </div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-5"
        >
          <AlertTriangle className="h-4 w-4 text-rose-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-rose-300">Failed to load metrics</p>
            <p className="text-xs text-rose-400 mt-1">{error}</p>
            <p className="text-xs text-slate-500 mt-2">
              Make sure the backend is running:{" "}
              <code className="font-mono">cd api && uvicorn main:app --reload --port 8000</code>
            </p>
          </div>
        </motion.div>
      )}

      {metrics && !loading && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <MetricsCharts metrics={metrics} />
        </motion.div>
      )}
    </div>
  );
}
