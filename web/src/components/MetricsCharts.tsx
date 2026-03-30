"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { EvaluationMetrics } from "@/types";

interface Props {
  metrics: EvaluationMetrics;
}

function AccuracyGauge({ value, label }: { value: number; label: string }) {
  const pct = (value * 100).toFixed(1);
  const color = value >= 0.85 ? "#10b981" : value >= 0.7 ? "#f59e0b" : "#f43f5e";

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <p className="text-xs text-slate-400 mb-3">{label}</p>
      <p className="text-4xl font-bold" style={{ color }}>
        {pct}
        <span className="text-xl text-slate-500">%</span>
      </p>
      <div className="mt-3 h-2 rounded-full bg-slate-700">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value * 100}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function ConfusionMatrix({ matrix, labels }: { matrix: number[][]; labels: string[] }) {
  const maxVal = Math.max(...matrix.flat());

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="p-2 text-slate-500 text-left">True \\ Pred</th>
            {labels.map((l) => (
              <th key={l} className="p-2 text-slate-400 text-center font-medium max-w-[80px]">
                <span className="block truncate max-w-[80px]" title={l}>
                  {l}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={i}>
              <td className="p-2 text-slate-400 font-medium">
                <span className="block truncate max-w-[100px]" title={labels[i]}>
                  {labels[i]}
                </span>
              </td>
              {row.map((val, j) => {
                const isCorrect = i === j;
                const intensity = maxVal > 0 ? val / maxVal : 0;
                const bg = isCorrect
                  ? `rgba(16, 185, 129, ${0.15 + intensity * 0.65})`
                  : val > 0
                  ? `rgba(244, 63, 94, ${0.1 + intensity * 0.4})`
                  : "rgba(255,255,255,0.03)";
                return (
                  <td
                    key={j}
                    className="p-2 text-center font-mono font-semibold rounded"
                    style={{
                      backgroundColor: bg,
                      color: val > 0 ? (isCorrect ? "#6ee7b7" : "#fca5a5") : "#475569",
                    }}
                  >
                    {val}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MetricsCharts({ metrics }: Props) {
  const barData = metrics.product_breakdown.map((p) => ({
    name: p.product,
    accuracy: Math.round(p.accuracy * 100),
    correct: p.correct,
    total: p.true,
  }));

  return (
    <div className="space-y-8">
      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <AccuracyGauge value={metrics.product_accuracy} label="Product Accuracy" />
        <AccuracyGauge value={metrics.issue_accuracy} label="Issue Accuracy" />
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs text-slate-400 mb-3">Avg Confidence</p>
          <p className="text-4xl font-bold text-sky-400">
            {(metrics.avg_confidence * 100).toFixed(0)}
            <span className="text-xl text-slate-500">%</span>
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-5">
          <p className="text-xs text-slate-400 mb-3">Sample Size</p>
          <p className="text-4xl font-bold text-violet-400">{metrics.sample_size}</p>
          <p className="text-xs text-slate-500 mt-1">complaints evaluated</p>
        </div>
      </div>

      {/* Per-product bar chart */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm font-semibold text-white mb-4">Product-Level Accuracy</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={barData} margin={{ top: 0, right: 0, bottom: 40, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="name"
              tick={{ fill: "#64748b", fontSize: 10 }}
              angle={-30}
              textAnchor="end"
              interval={0}
            />
            <YAxis tick={{ fill: "#64748b", fontSize: 10 }} domain={[0, 100]} unit="%" />
            <Tooltip
              contentStyle={{
                backgroundColor: "#0f172a",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value) => [`${value}%`, "Accuracy"]}
            />
            <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
              {barData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={
                    entry.accuracy >= 85
                      ? "#10b981"
                      : entry.accuracy >= 70
                      ? "#f59e0b"
                      : "#f43f5e"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Confusion matrix */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm font-semibold text-white mb-4">
          Confusion Matrix{" "}
          <span className="text-xs font-normal text-slate-400">(rows = true label)</span>
        </p>
        <ConfusionMatrix
          matrix={metrics.confusion_matrix.matrix}
          labels={metrics.confusion_matrix.labels}
        />
      </div>

      {/* Product breakdown table */}
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-5 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Product
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Samples
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Correct
              </th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Accuracy
              </th>
            </tr>
          </thead>
          <tbody>
            {metrics.product_breakdown.map((row, i) => (
              <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-5 py-3 text-slate-200">{row.product}</td>
                <td className="px-5 py-3 text-right text-slate-400 font-mono">{row.true}</td>
                <td className="px-5 py-3 text-right text-slate-400 font-mono">{row.correct}</td>
                <td className="px-5 py-3 text-right font-mono font-semibold">
                  <span
                    className={
                      row.accuracy >= 0.85
                        ? "text-emerald-400"
                        : row.accuracy >= 0.7
                        ? "text-amber-400"
                        : "text-rose-400"
                    }
                  >
                    {(row.accuracy * 100).toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {metrics.note && (
        <p className="text-xs text-slate-500 italic">{metrics.note}</p>
      )}
    </div>
  );
}
