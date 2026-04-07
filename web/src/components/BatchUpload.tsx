"use client";

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Download, FileText, AlertTriangle, CheckCircle2, Loader2, Database } from "lucide-react";

const DEMO_NARRATIVES = [
  "I keep receiving calls about a debt I already paid in full over a year ago. I have sent proof of payment three times — bank statements and a receipt from the original creditor — but the calls continue. They have now reported this debt to all three credit bureaus, dropping my score by 85 points.",
  "I deposited $2,500 cash at a Chase branch. The teller ran the money through the counter but the screen showed $1,300 instead of $2,500. After 45 minutes of waiting for the manager to balance the drawer, they confirmed only $1,300. I am missing $1,200 and my claim was denied.",
  "My mortgage company force-placed an insurance policy on our home for $3,200 after a brief coverage lapse, even after we sent proof of new insurance. They added this to our escrow and our monthly payment increased by $267. When we call, each representative tells us something different.",
  "I booked a hotel through my Citi credit card travel portal. My flight was delayed due to weather and I could not check in on time. By the next morning the hotel had charged me the full $850 room rate. I filed a billing dispute with Citi and after 45 days they ruled it was my responsibility without providing investigation documents.",
  "My bank charged me 6 overdraft fees totaling $210 even though I opted out of overdraft coverage when I opened the account two years ago. I have a confirmation email showing my opt-out election. The bank claims there is no record of this despite my documentation.",
];

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface BatchRow {
  index: number;
  narrative_preview: string;
  product: string;
  severity: string;
  risk_gap: number;
  assigned_team: string;
  priority: string;
  human_review_needed: boolean;
  slack_alert_sent: boolean;
}

interface BatchSummary {
  total_processed: number;
  total_errors: number;
  high_risk_count: number;
  slack_alerts_sent: number;
  avg_resolution_probability: number;
  severity_distribution: Record<string, number>;
  team_distribution: Record<string, number>;
}

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  low:      { bg: "#d1fae5", text: "#047857" },
  medium:   { bg: "#fef9c3", text: "#854d0e" },
  high:     { bg: "#ffedd5", text: "#c2410c" },
  critical: { bg: "#fee2e2", text: "#b91c1c" },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  P1: { bg: "#fee2e2", text: "#b91c1c" },
  P2: { bg: "#ffedd5", text: "#c2410c" },
  P3: { bg: "#fef9c3", text: "#854d0e" },
  P4: { bg: "#f3f4f6", text: "#6b7280" },
};

export default function BatchUpload() {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [summary, setSummary] = useState<BatchSummary | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rawResults, setRawResults] = useState<unknown[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleFile = (f: File) => {
    if (!f.name.endsWith(".csv")) {
      setErrorMsg("Please upload a .csv file.");
      return;
    }
    setFile(f);
    setErrorMsg(null);
    setRows([]);
    setSummary(null);
    setPhase("idle");
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);

  const startFakeProgress = () => {
    setProgress(0);
    progressTimerRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 92) return p;
        return p + (92 - p) * 0.04;
      });
    }, 400);
  };

  const stopFakeProgress = () => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    setProgress(100);
  };

  const loadDemoDataset = () => {
    // Build a CSV blob from the demo narratives
    const header = "narrative\n";
    const rows = DEMO_NARRATIVES.map((n) => `"${n.replace(/"/g, '""')}"`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const demoFile = new File([blob], "demo_complaints.csv", { type: "text/csv" });
    handleFile(demoFile);
  };

  const handleProcess = async () => {
    if (!file) return;
    setPhase("processing");
    setRows([]);
    setSummary(null);
    setErrorMsg(null);
    startFakeProgress();

    const form = new FormData();
    form.append("file", file);

    try {
      const resp = await fetch(`${BASE_URL}/api/analyze-batch-csv`, {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(300_000), // 5 min
      });

      stopFakeProgress();

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`API error ${resp.status}: ${text}`);
      }

      const data = await resp.json() as { results: BatchRow[]; summary: BatchSummary; errors: unknown[] };
      setRawResults(data.results);
      setSummary(data.summary);

      // Animate rows in one at a time
      setPhase("done");
      for (let i = 0; i < data.results.length; i++) {
        await new Promise((r) => setTimeout(r, 80));
        setRows((prev) => [...prev, data.results[i]]);
      }
    } catch (err) {
      stopFakeProgress();
      setPhase("error");
      const msg = err instanceof Error ? err.message : "Processing failed";
      // Detect timeout / signal errors and show friendly message
      if (
        msg.toLowerCase().includes("timeout") ||
        msg.toLowerCase().includes("timed out") ||
        msg.toLowerCase().includes("signal") ||
        msg.toLowerCase().includes("aborted")
      ) {
        setErrorMsg("Processing took longer than expected. Try fewer complaints (max 5 in demo mode).");
      } else {
        setErrorMsg(msg);
      }
    }
  };

  const downloadTemplate = async () => {
    const resp = await fetch(`${BASE_URL}/api/export-sample`);
    if (!resp.ok) return;
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cfpb_upload_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadResults = async () => {
    if (!rawResults.length) return;
    const resp = await fetch(`${BASE_URL}/api/export-results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ results: rawResults }),
    });
    if (!resp.ok) return;
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cfpb_analysis_results.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const card: React.CSSProperties = {
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
    padding: "18px 20px",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => fileInputRef.current?.click()}
        style={{
          borderRadius: 14,
          border: `2px dashed ${isDragging ? "#10b981" : file ? "#10b981" : "#d1d5db"}`,
          background: isDragging ? "#f0fdf4" : file ? "#f0fdf4" : "#fafafa",
          padding: "28px 20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
        />
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: file ? "#d1fae5" : "#f3f4f6",
          border: `1px solid ${file ? "#6ee7b7" : "#e5e7eb"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {file ? (
            <CheckCircle2 style={{ width: 20, height: 20, color: "#059669" }} />
          ) : (
            <Upload style={{ width: 20, height: 20, color: "#6b7280" }} />
          )}
        </div>
        {file ? (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{file.name}</p>
            <p style={{ fontSize: 11, color: "#6b7280" }}>Click to change file</p>
          </div>
        ) : (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
              Drag & drop a CSV, or click to browse
            </p>
            <p style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
              Demo mode: max 5 complaints · Requires a <code style={{ fontFamily: "monospace", background: "#f3f4f6", padding: "1px 4px", borderRadius: 3 }}>narrative</code> column
            </p>
            <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>
              Production deployment supports unlimited batches via queue.
            </p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <motion.button
          whileHover={{ scale: file && phase !== "processing" ? 1.02 : 1 }}
          whileTap={{ scale: file && phase !== "processing" ? 0.97 : 1 }}
          onClick={handleProcess}
          disabled={!file || phase === "processing"}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "8px 18px", borderRadius: 9, border: "none",
            background: file && phase !== "processing" ? "#10b981" : "#d1d5db",
            color: "#fff", fontSize: 13, fontWeight: 600,
            cursor: file && phase !== "processing" ? "pointer" : "not-allowed",
            boxShadow: file ? "0 3px 10px rgba(16,185,129,0.25)" : "none",
          }}
        >
          {phase === "processing" ? (
            <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
          ) : (
            <FileText style={{ width: 14, height: 14 }} />
          )}
          {phase === "processing" ? "Processing…" : "Process Batch"}
        </motion.button>

        <button
          onClick={loadDemoDataset}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 9,
            border: "1px solid #c7d2fe", background: "#eef2ff",
            color: "#4338ca", fontSize: 12, cursor: "pointer",
          }}
        >
          <Database style={{ width: 13, height: 13 }} />
          Load Demo Dataset
        </button>

        <button
          onClick={downloadTemplate}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 9,
            border: "1px solid #e5e7eb", background: "#ffffff",
            color: "#374151", fontSize: 12, cursor: "pointer",
          }}
        >
          <Download style={{ width: 13, height: 13 }} />
          Download Template
        </button>
      </div>

      {/* Error */}
      <AnimatePresence>
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              borderRadius: 10, border: "1px solid #fca5a5",
              background: "#fff1f2", padding: "10px 14px",
            }}
          >
            <AlertTriangle style={{ width: 14, height: 14, color: "#ef4444", flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 12, color: "#b91c1c", margin: 0 }}>{errorMsg}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress bar */}
      <AnimatePresence>
        {phase === "processing" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <div style={{ marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: 11, color: "#374151", fontWeight: 600 }}>Running pipeline…</span>
              <span style={{ fontSize: 11, color: "#6b7280" }}>{Math.round(progress)}%</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "#f3f4f6" }}>
              <motion.div
                style={{ height: "100%", borderRadius: 3, background: "#10b981" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary stats */}
      <AnimatePresence>
        {summary && phase === "done" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 10,
            }}
          >
            {[
              { label: "Processed", value: summary.total_processed, color: "#10b981" },
              { label: "High Risk", value: summary.high_risk_count, color: "#ef4444" },
              { label: "Slack Alerts", value: summary.slack_alerts_sent, color: "#0ea5e9" },
              { label: "Avg Resolution", value: `${Math.round(summary.avg_resolution_probability * 100)}%`, color: "#8b5cf6" },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                style={{
                  borderRadius: 10, border: `1px solid ${color}25`,
                  background: `${color}08`, padding: "12px 14px", textAlign: "center",
                }}
              >
                <p style={{ fontSize: 22, fontWeight: 800, color, lineHeight: 1, margin: 0 }}>{value}</p>
                <p style={{ fontSize: 10, color: "#4b5563", marginTop: 4 }}>{label}</p>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results table */}
      <AnimatePresence>
        {rows.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ overflowX: "auto" }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e5e7eb" }}>
                  {["#", "Narrative", "Product", "Severity", "Risk Gap", "Team", "Priority", "Flags"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "8px 10px", textAlign: "left",
                        fontSize: 10, fontWeight: 700, color: "#374151",
                        textTransform: "uppercase", letterSpacing: "0.05em",
                        background: "#fafafa",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const sevStyle = SEVERITY_COLORS[row.severity] ?? SEVERITY_COLORS.medium;
                  const priStyle = PRIORITY_COLORS[row.priority] ?? PRIORITY_COLORS.P3;
                  return (
                    <motion.tr
                      key={row.index}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25 }}
                      style={{
                        borderBottom: "1px solid #f3f4f6",
                        background: i % 2 === 0 ? "#ffffff" : "#fafafa",
                      }}
                    >
                      <td style={{ padding: "8px 10px", color: "#6b7280", fontWeight: 600 }}>
                        {row.index + 1}
                      </td>
                      <td style={{ padding: "8px 10px", color: "#374151", maxWidth: 200 }}>
                        <span style={{
                          display: "block", overflow: "hidden", textOverflow: "ellipsis",
                          whiteSpace: "nowrap", maxWidth: 180,
                        }}>
                          {row.narrative_preview}
                        </span>
                      </td>
                      <td style={{ padding: "8px 10px", color: "#374151" }}>{row.product}</td>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={{
                          padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700,
                          textTransform: "capitalize",
                          background: sevStyle.bg, color: sevStyle.text,
                        }}>
                          {row.severity}
                        </span>
                      </td>
                      <td style={{
                        padding: "8px 10px", fontWeight: 700,
                        color: row.risk_gap > 0.2 ? "#b91c1c" : row.risk_gap > 0 ? "#92400e" : "#047857",
                      }}>
                        {row.risk_gap >= 0 ? "+" : ""}{Math.round(row.risk_gap * 100)}%
                      </td>
                      <td style={{ padding: "8px 10px", color: "#374151" }}>
                        {row.assigned_team.replace(/_/g, " ")}
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <span style={{
                          padding: "2px 6px", borderRadius: 4, fontSize: 10, fontWeight: 800,
                          background: priStyle.bg, color: priStyle.text,
                        }}>
                          {row.priority}
                        </span>
                      </td>
                      <td style={{ padding: "8px 10px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          {row.human_review_needed && (
                            <span title="Human review needed" style={{ fontSize: 13 }}>⚠️</span>
                          )}
                          {row.slack_alert_sent && (
                            <span title="High-risk Slack alert sent" style={{ fontSize: 13 }}>💬</span>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Download results */}
      {phase === "done" && rows.length > 0 && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={downloadResults}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "8px 16px", borderRadius: 9,
            border: "1px solid #0ea5e9", background: "#f0f9ff",
            color: "#0284c7", fontSize: 12, fontWeight: 600, cursor: "pointer",
            alignSelf: "flex-start",
          }}
        >
          <Download style={{ width: 13, height: 13 }} />
          Download Results CSV
        </motion.button>
      )}
    </div>
  );
}
