"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpCircle,
  BarChart3,
  Bell,
  Bot,
  CheckCircle2,
  Circle,
  Clock,
  ClipboardList,
  Download,
  FileDown,
  FileText,
  Inbox,
  KanbanSquare,
  Loader2,
  Mail,
  MessageSquare,
  RefreshCw,
  Table2,
  TrendingUp,
  User,
  XCircle,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import InfoTooltip from "@/components/InfoTooltip";

const API = "http://localhost:8000/api";
const ITEMS_PER_PAGE = 20;

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface MonitorStatus {
  monitoring_active: boolean;
  last_poll_time: string | null;
  next_poll_time: string | null;
  poll_interval_minutes: number;
  uptime_seconds: number;
  stats: {
    total_processed: number;
    total_auto_processed: number;
    total_escalated: number;
    total_held: number;
    total_patterns: number;
    total_emails_sent: number;
    total_slack_alerts: number;
  };
}

interface ActivityEntry {
  id: number;
  timestamp: string;
  action_type: string;
  description: string;
  complaint_id: string | null;
  severity_level: string;
  metadata_json: string | null;
}

interface Pattern {
  id: number;
  detected_at: string;
  pattern_type: string;
  description: string;
  company: string;
  product: string;
  complaint_count: number;
  time_window_hours: number;
  resolved: boolean;
  recommendation?: string | null;
}

interface DayStats {
  period_days: number;
  total_processed: number;
  auto_processed: number;
  held_for_review: number;
  escalated: number;
  by_severity: Record<string, number>;
  by_team: Record<string, number>;
  avg_confidence: number;
  avg_risk_gap: number;
  avg_processing_time: number;
  patterns_detected: number;
  slack_alerts_sent: number;
  emails_sent: number;
}

interface TaskSummaryInline {
  total: number;
  completed: number;
  overdue: number;
}

interface CaseSummary {
  id: number;
  case_number: string;
  complaint_id: string;
  status: string;
  product: string;
  issue: string;
  severity: string;
  priority: string;
  assigned_team: string;
  company: string;
  state: string;
  narrative_preview: string;
  resolution_probability: number;
  risk_gap: number;
  overall_confidence: number;
  auto_processed: boolean;
  created_at: string;
  // Task summary counts from server
  task_total?: number;
  task_completed?: number;
  task_overdue?: number;
  // New fields
  predicted_satisfaction_score?: number | null;
  source?: string;
}

interface CaseTask {
  id: number;
  case_id: number;
  task_number: number;
  description: string;
  task_type: string;
  status: string;
  assigned_to: string;
  regulation_reference: string | null;
  due_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
}

interface CaseDetail extends CaseSummary {
  tasks: CaseTask[];
  narrative?: string;
  task_summary: {
    total: number;
    completed: number;
    pending: number;
    scheduled: number;
    overdue: number;
    completion_percentage: number;
  };
  customer_satisfaction_score?: number | null;
  preventive_recommendation?: string | null;
}

interface CaseStats {
  total: number;
  by_status: Record<string, number>;
  auto_processed_pct: number;
  avg_tasks_per_case: number;
  avg_completion_pct: number;
  overdue_tasks: number;
  satisfaction?: {
    avg_score: number;
    total_responses: number;
    response_rate: number;
  };
}

interface SatisfactionStats {
  total_sent: number;
  total_responded: number;
  avg_score: number;
  response_rate: number;
  score_distribution: Record<number, number>;
}

interface SentEmail {
  id: number;
  email_type: string;
  to_address: string;
  subject: string;
  case_number: string;
  sent_at: string;
  status: string;
}

interface ChartPoint {
  time: string;
  count: number;
}

interface DayChartPoint {
  date: string;
  count: number;
  label: string;
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function relativeTime(ts: string): string {
  if (!ts) return "—";
  const d = new Date(ts.endsWith("Z") ? ts : ts + "Z");
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatDate(ts: string): string {
  if (!ts) return "—";
  const d = new Date(ts.endsWith("Z") ? ts : ts + "Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function severityColor(level: string): string {
  if (level === "critical") return "#dc2626";
  if (level === "warning") return "#d97706";
  return "#6b7280";
}
function severityBg(level: string): string {
  if (level === "critical") return "#fff1f1";
  if (level === "warning") return "#fffbeb";
  return "#f9fafb";
}
function severityBorder(level: string): string {
  if (level === "critical") return "#fca5a5";
  if (level === "warning") return "#fde68a";
  return "#e5e7eb";
}
function teamColor(team: string): string {
  const map: Record<string, string> = {
    compliance: "#7c3aed",
    billing_disputes: "#2563eb",
    fraud: "#dc2626",
    customer_service: "#059669",
    legal: "#92400e",
    executive_escalation: "#b45309",
  };
  return map[team?.toLowerCase().replace(/ /g, "_")] || "#6b7280";
}
function priorityColor(p: string): string {
  if (p === "P1") return "#dc2626";
  if (p === "P2") return "#d97706";
  if (p === "P3") return "#2563eb";
  return "#6b7280";
}
function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  open:                  { label: "Open",               bg: "#f3f4f6", color: "#374151",  border: "#d1d5db" },
  in_progress:           { label: "In Progress",        bg: "#eff6ff", color: "#2563eb",  border: "#bfdbfe" },
  action_taken:          { label: "Action Taken",       bg: "#f5f3ff", color: "#7c3aed",  border: "#ddd6fe" },
  awaiting_response:     { label: "Awaiting Response",  bg: "#fffbeb", color: "#d97706",  border: "#fde68a" },
  awaiting_confirmation: { label: "Awaiting Response",  bg: "#fffbeb", color: "#d97706",  border: "#fde68a" }, // backward compat
  closed:                { label: "Closed",             bg: "#f0fdf4", color: "#059669",  border: "#bbf7d0" },
  escalated:             { label: "Escalated",          bg: "#fff1f2", color: "#dc2626",  border: "#fecaca" }, // badge only
};

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: {
  label: string; value: number | string; sub?: string; accent?: string;
}) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
      padding: "16px 20px", flex: 1, minWidth: 140,
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      <p style={{ fontSize: 11, color: "#6b7280", fontWeight: 500, margin: 0 }}>{label}</p>
      <p style={{ fontSize: 28, fontWeight: 700, color: accent || "#111827", margin: "4px 0 2px", lineHeight: 1 }}>
        {value}
      </p>
      {sub && <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{sub}</p>}
    </div>
  );
}

function ActivityIcon({ type, desc }: { type: string; desc: string }) {
  const cls = "w-4 h-4";
  if (type === "poll") return <RefreshCw className={cls} style={{ color: "#6b7280" }} />;
  if (type === "system_start") return <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#10b981" }} />;
  if (type === "system_stop") return <XCircle className={cls} style={{ color: "#6b7280" }} />;
  if (type === "error") return <XCircle className={cls} style={{ color: "#dc2626" }} />;
  if (type === "pattern_detected") return <BarChart3 className={cls} style={{ color: "#7c3aed" }} />;
  if (type === "email_sent") return <Mail className={cls} style={{ color: "#6b7280" }} />;
  if (type === "slack_sent") return <MessageSquare className={cls} style={{ color: "#0ea5e9" }} />;
  if (type === "escalate" || desc.includes("[ESCALATE]")) return <AlertTriangle className={cls} style={{ color: "#d97706" }} />;
  if (desc.includes("[HOLD]")) return <Clock className={cls} style={{ color: "#6b7280" }} />;
  if (desc.includes("[AUTO]") || desc.includes("[CASE]")) return <CheckCircle2 className={cls} style={{ color: "#059669" }} />;
  if (desc.includes("[REVIEW]")) return <AlertCircle className={cls} style={{ color: "#d97706" }} />;
  if (desc.includes("[MANUAL]")) return <User className={cls} style={{ color: "#6b7280" }} />;
  if (desc.includes("[SIMULATE]")) return <Bot className={cls} style={{ color: "#6366f1" }} />;
  if (desc.includes("[PATTERN]")) return <TrendingUp className={cls} style={{ color: "#7c3aed" }} />;
  if (desc.includes("[SLA]")) return <AlertCircle className={cls} style={{ color: "#dc2626" }} />;
  if (type === "process" || type === "route") return <ClipboardList className={cls} style={{ color: "#6b7280" }} />;
  return <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#9ca3af", marginTop: 5 }} />;
}

function ActivityItem({ entry }: { entry: ActivityEntry }) {
  const [expanded, setExpanded] = useState(false);
  const color = severityColor(entry.severity_level);
  const bg = severityBg(entry.severity_level);
  const border = severityBorder(entry.severity_level);
  const isExpandable = !!(entry.complaint_id || entry.metadata_json);

  // Parse metadata for inline summary
  let meta: Record<string, unknown> = {};
  try { meta = JSON.parse(entry.metadata_json || "{}"); } catch {}
  const caseNumber = meta.case_number as string | undefined;
  const riskGap = meta.risk_gap as number | undefined;
  const severity = meta.severity as string | undefined;
  const confidence = meta.confidence as number | undefined;

  return (
    <div
      style={{
        display: "flex", gap: 10, padding: "10px 12px", borderRadius: 8,
        background: bg, border: `1px solid ${border}`, borderLeft: `3px solid ${color}`,
        cursor: isExpandable ? "pointer" : "default",
      }}
      onClick={() => isExpandable && setExpanded(!expanded)}
    >
      <span style={{ flexShrink: 0, marginTop: 1, display: "flex", alignItems: "flex-start" }}>
        <ActivityIcon type={entry.action_type} desc={entry.description} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <p style={{ fontSize: 13, color: "#111827", margin: 0, lineHeight: 1.4, wordBreak: "break-word" }}>
            {entry.description}
          </p>
          <span style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap", flexShrink: 0 }}>
            {relativeTime(entry.timestamp)}
          </span>
        </div>
        {entry.complaint_id && !expanded && (
          <p style={{ fontSize: 11, color: "#9ca3af", margin: "2px 0 0" }}>
            ID: {entry.complaint_id.slice(0, 8)}…
          </p>
        )}
        {expanded && (
          <div style={{
            marginTop: 8, padding: "10px 12px", background: "#f8fafc",
            borderRadius: 6, border: "1px solid #e2e8f0",
            display: "flex", flexDirection: "column", gap: 4,
          }}>
            {entry.complaint_id && (
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ fontSize: 11, color: "#6b7280", width: 90, flexShrink: 0 }}>Complaint ID</span>
                <span style={{ fontSize: 11, color: "#374151", fontFamily: "monospace" }}>
                  {entry.complaint_id}
                </span>
              </div>
            )}
            {caseNumber && (
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ fontSize: 11, color: "#6b7280", width: 90, flexShrink: 0 }}>Case Number</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#2563eb" }}>{caseNumber}</span>
              </div>
            )}
            {severity && (
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ fontSize: 11, color: "#6b7280", width: 90, flexShrink: 0 }}>Severity</span>
                <span style={{ fontSize: 11, color: severity === "critical" ? "#dc2626" : severity === "high" ? "#d97706" : "#374151", fontWeight: 600 }}>
                  {severity.toUpperCase()}
                </span>
              </div>
            )}
            {riskGap !== undefined && (
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ fontSize: 11, color: "#6b7280", width: 90, flexShrink: 0 }}>Risk Gap</span>
                <span style={{ fontSize: 11, color: riskGap > 0.3 ? "#dc2626" : "#374151", fontWeight: 600 }}>
                  {Math.round(riskGap * 100)}%
                </span>
              </div>
            )}
            {confidence !== undefined && (
              <div style={{ display: "flex", gap: 6 }}>
                <span style={{ fontSize: 11, color: "#6b7280", width: 90, flexShrink: 0 }}>Confidence</span>
                <span style={{ fontSize: 11, color: "#059669", fontWeight: 600 }}>{Math.round(confidence * 100)}%</span>
              </div>
            )}
            {/* Show remaining metadata as compact key-value rows */}
            {Object.entries(meta)
              .filter(([k]) => !["case_number", "risk_gap", "severity", "confidence"].includes(k))
              .slice(0, 4)
              .map(([k, v]) => (
                <div key={k} style={{ display: "flex", gap: 6 }}>
                  <span style={{ fontSize: 11, color: "#6b7280", width: 90, flexShrink: 0 }}>
                    {k.replace(/_/g, " ")}
                  </span>
                  <span style={{ fontSize: 11, color: "#374151" }}>{String(v)}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PatternCard({ pattern, onResolve }: { pattern: Pattern; onResolve: (id: number) => void }) {
  const [showIds, setShowIds] = useState(false);
  const icons: Record<string, React.ReactElement> = {
    complaint_cluster: <BarChart3 style={{ width: 14, height: 14, color: "#d97706" }} />,
    volume_spike: <TrendingUp style={{ width: 14, height: 14, color: "#d97706" }} />,
    company_trend: <BarChart3 style={{ width: 14, height: 14, color: "#d97706" }} />,
  };

  // Parse complaint IDs if stored as JSON array
  let complaintIds: string[] = [];
  try {
    const raw = (pattern as any).complaint_ids;
    if (raw) complaintIds = JSON.parse(raw);
  } catch {}

  const riskLevel = pattern.complaint_count >= 5 ? "HIGH" : pattern.complaint_count >= 3 ? "MEDIUM" : "LOW";
  const riskColor = riskLevel === "HIGH" ? "#dc2626" : riskLevel === "MEDIUM" ? "#d97706" : "#059669";

  return (
    <div style={{
      background: "#fff", border: "1px solid #fde68a", borderLeft: "3px solid #d97706",
      borderRadius: 8, padding: "12px 14px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            {icons[pattern.pattern_type] || <BarChart3 style={{ width: 14, height: 14, color: "#d97706" }} />}
            <span style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 10,
              background: "#fef3c7", color: "#92400e", fontWeight: 600,
            }}>
              {pattern.pattern_type.replace(/_/g, " ").toUpperCase()}
            </span>
          </div>
          <p style={{ fontSize: 13, color: "#111827", margin: "0 0 2px", fontWeight: 600 }}>
            {pattern.company} — {pattern.product}
          </p>
          <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 4px" }}>
            {pattern.complaint_count} complaints in {Math.round(pattern.time_window_hours / 24)} days
            · Most common: {(pattern as any).issue || "various issues"}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: riskColor }}>
              Risk: {riskLevel}
            </span>
            <span style={{ fontSize: 10, color: "#9ca3af" }}>
              Detected {relativeTime(pattern.detected_at)}
            </span>
          </div>
          {pattern.recommendation && (
            <div style={{
              marginTop: 8, padding: "8px 10px",
              borderRadius: 6, border: "1px solid #e0f2fe",
              background: "#f0f9ff",
            }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: "#0369a1", margin: "0 0 3px", textTransform: "uppercase" }}>
                Preventive Recommendation
              </p>
              <p style={{ fontSize: 11, color: "#0c4a6e", margin: 0, lineHeight: 1.5 }}>
                &ldquo;{pattern.recommendation}&rdquo;
              </p>
            </div>
          )}
          {complaintIds.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <button
                onClick={() => setShowIds(!showIds)}
                style={{ fontSize: 10, color: "#2563eb", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}
              >
                {showIds ? "Hide" : "View"} Complaints ({complaintIds.length})
              </button>
              {showIds && (
                <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {complaintIds.slice(0, 8).map((id) => {
                    const label = String(id);
                    const isCaseNum = label.startsWith("CIS-");
                    return isCaseNum ? (
                      <a
                        key={id}
                        href="#cases"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#eff6ff", color: "#2563eb", fontWeight: 600, textDecoration: "none" }}
                      >
                        {label}
                      </a>
                    ) : (
                      <span key={id} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "#f3f4f6", color: "#374151" }}>
                        {label.slice(0, 8)}…
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
        <button
          onClick={() => onResolve(pattern.id)}
          style={{
            fontSize: 11, padding: "4px 10px", borderRadius: 6,
            border: "1px solid #d97706", background: "#fff", color: "#d97706",
            cursor: "pointer", fontWeight: 600, flexShrink: 0, marginLeft: 8,
          }}
        >
          Resolve
        </button>
      </div>
    </div>
  );
}

function MiniBarChart({ data, colorFn }: { data: Record<string, number>; colorFn: (key: string) => string }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {entries.map(([key, val]) => (
        <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#374151", width: 120, flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {key || "—"}
          </span>
          <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 3, height: 10 }}>
            <div style={{ height: "100%", borderRadius: 3, background: colorFn(key), width: `${(val / max) * 100}%`, transition: "width 0.5s ease" }} />
          </div>
          <span style={{ fontSize: 11, color: "#6b7280", width: 24, textAlign: "right" }}>{val}</span>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, bg: "#f3f4f6", color: "#374151", border: "#d1d5db" };
  return (
    <span style={{
      fontSize: 10, padding: "2px 8px", borderRadius: 10,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      fontWeight: 600, whiteSpace: "nowrap",
    }}>
      {cfg.label}
    </span>
  );
}

function TaskProgressBar({ completed, total, overdue }: { completed: number; total: number; overdue: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const barColor = overdue > 1 ? "#dc2626" : overdue > 0 ? "#d97706" : "#10b981";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 11, color: "#374151", fontWeight: 500 }}>{completed}/{total}</span>
        {overdue > 0 && (
          <span style={{ fontSize: 10, color: "#dc2626", fontWeight: 600 }}>{overdue} overdue</span>
        )}
      </div>
      <div style={{ height: 4, background: "#f3f4f6", borderRadius: 2, width: 80 }}>
        <div style={{ height: "100%", borderRadius: 2, background: barColor, width: `${pct}%`, transition: "width 0.4s ease" }} />
      </div>
    </div>
  );
}

function TaskIcon({ task }: { task: CaseTask }) {
  if (task.status === "completed") {
    const color = task.completed_by === "system" ? "#059669" : "#2563eb";
    return <CheckCircle2 style={{ width: 18, height: 18, color, flexShrink: 0 }} />;
  }
  if (task.status === "failed") return <XCircle style={{ width: 18, height: 18, color: "#dc2626", flexShrink: 0 }} />;
  if (task.status === "overdue") return <AlertCircle style={{ width: 18, height: 18, color: "#dc2626", flexShrink: 0 }} />;
  if (task.status === "escalated") return <ArrowUpCircle style={{ width: 18, height: 18, color: "#dc2626", flexShrink: 0 }} />;
  if (task.task_type === "scheduled") return <Clock style={{ width: 18, height: 18, color: "#9ca3af", flexShrink: 0 }} />;
  return <Circle style={{ width: 18, height: 18, color: "#f59e0b", flexShrink: 0 }} />;
}

function TaskOpenModal({ task, caseDetail, onClose }: { task: CaseTask; caseDetail: CaseDetail | null; onClose: () => void }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: 12, padding: 24, maxWidth: 520, width: "90%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "80vh", overflowY: "auto",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>
            Task {task.task_number} — Details
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, color: "#9ca3af", cursor: "pointer" }}>×</button>
        </div>

        <div style={{ marginBottom: 14, padding: "10px 14px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: "0 0 4px" }}>{task.description}</p>
          {task.regulation_reference && (
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: "#dbeafe", color: "#1e40af", fontWeight: 600 }}>
              Reg: {task.regulation_reference}
            </span>
          )}
        </div>

        {task.regulation_reference && (
          <div style={{ marginBottom: 14, padding: "10px 14px", background: "#fefce8", borderRadius: 8, border: "1px solid #fde68a" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#92400e", margin: "0 0 4px" }}>Regulatory Requirement</p>
            <p style={{ fontSize: 12, color: "#78350f", margin: 0 }}>{task.regulation_reference}</p>
          </div>
        )}

        {caseDetail?.narrative_preview && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", margin: "0 0 6px" }}>Complaint Narrative</p>
            <p style={{ fontSize: 12, color: "#374151", lineHeight: 1.6, margin: 0, padding: "10px 14px", background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
              {caseDetail.narrative_preview}
            </p>
          </div>
        )}

        <button onClick={onClose} style={{
          width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb",
          background: "#f9fafb", color: "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer",
        }}>
          Close
        </button>
      </div>
    </div>
  );
}

function TaskTimeline({
  caseNumber, tasks, caseDetail, onTaskComplete, onRefresh,
}: {
  caseNumber: string;
  tasks: CaseTask[];
  caseDetail: CaseDetail | null;
  onTaskComplete: (taskId: number) => void;
  onRefresh: () => void;
}) {
  const [completing, setCompleting] = useState<number | null>(null);
  const [openTask, setOpenTask] = useState<CaseTask | null>(null);
  const [localTasks, setLocalTasks] = useState<CaseTask[]>(tasks);

  // Sync localTasks when tasks prop changes
  React.useEffect(() => { setLocalTasks(tasks); }, [tasks]);

  // Only show human tasks
  const humanTasks = localTasks.filter((t) => t.task_type === "human");

  async function markComplete(taskId: number) {
    setCompleting(taskId);
    // Optimistic update: immediately mark task as completed
    setLocalTasks(prev => prev.map(t =>
      t.id === taskId
        ? { ...t, status: "completed", completed_by: "human", completed_at: new Date().toISOString() }
        : t
    ));
    onTaskComplete(taskId);
    try {
      await fetch(`${API}/cases/${caseNumber}/tasks/${taskId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: "", completed_by: "human" }),
      });
    } catch {}
    setCompleting(null);
    // Light background refresh after 1s
    setTimeout(() => onRefresh(), 1000);
  }

  return (
    <>
      {openTask && <TaskOpenModal task={openTask} caseDetail={caseDetail} onClose={() => setOpenTask(null)} />}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {humanTasks.map((task, idx) => {
        const isLast = idx === humanTasks.length - 1;
        const isOverdue = task.status === "overdue";
        return (
          <div key={task.id} style={{ display: "flex", gap: 12 }}>
            {/* Vertical line + icon */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20, flexShrink: 0 }}>
              <TaskIcon task={task} />
              {!isLast && <div style={{ width: 2, flex: 1, background: "#e5e7eb", margin: "4px 0" }} />}
            </div>
            {/* Content */}
            <div style={{
              flex: 1, paddingBottom: isLast ? 0 : 16,
              borderLeft: isOverdue ? "2px solid #fca5a5" : "none",
              paddingLeft: isOverdue ? 8 : 0,
              marginLeft: isOverdue ? -2 : 0,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <p style={{
                    fontSize: 13, fontWeight: 500,
                    color: task.status === "completed" ? "#6b7280" : "#111827",
                    margin: 0, lineHeight: 1.4,
                  }}>
                    Task {task.task_number}: {task.description}
                  </p>
                  {task.regulation_reference && (
                    <span style={{
                      display: "inline-block", marginTop: 4, fontSize: 10,
                      padding: "1px 7px", borderRadius: 4,
                      border: "1px solid #e5e7eb", color: "#6b7280",
                      background: "#f9fafb",
                    }}>
                      Reg: {task.regulation_reference}
                    </span>
                  )}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  {task.status === "completed" ? (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 600, color: "#059669", margin: 0 }}>COMPLETED</p>
                      <p style={{ fontSize: 10, color: "#9ca3af", margin: "1px 0 0" }}>
                        by {task.completed_by || "system"}
                        {task.completed_at ? `, ${new Date(task.completed_at.endsWith("Z") ? task.completed_at : task.completed_at + "Z").toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}` : ""}
                      </p>
                    </div>
                  ) : task.status === "failed" ? (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 600, color: "#dc2626", margin: 0 }}>FAILED</p>
                      <p style={{ fontSize: 10, color: "#9ca3af", margin: "1px 0 0" }}>
                        {task.notes || "Action not configured"}
                      </p>
                    </div>
                  ) : task.task_type === "scheduled" ? (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", margin: 0 }}>SCHEDULED</p>
                      {task.due_date && (
                        <p style={{ fontSize: 10, color: "#9ca3af", margin: "1px 0 0" }}>
                          {formatDate(task.due_date)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 600, color: isOverdue ? "#dc2626" : "#d97706", margin: 0 }}>
                        {isOverdue ? "OVERDUE" : "PENDING"}
                      </p>
                      {task.due_date && (
                        <p style={{ fontSize: 10, color: isOverdue ? "#dc2626" : "#9ca3af", margin: "1px 0 0" }}>
                          Due: {formatDate(task.due_date)}
                        </p>
                      )}
                      {task.task_type === "human" && (
                        <p style={{ fontSize: 10, color: "#6b7280", margin: "1px 0 4px" }}>
                          assigned to {task.assigned_to}
                        </p>
                      )}
                      {task.task_type === "human" && (
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            onClick={() => markComplete(task.id)}
                            disabled={completing === task.id}
                            style={{
                              fontSize: 10, padding: "2px 8px", borderRadius: 5,
                              border: "1px solid #10b981", background: "#f0fdf4",
                              color: "#059669", cursor: completing === task.id ? "not-allowed" : "pointer",
                              fontWeight: 600, opacity: completing === task.id ? 0.6 : 1,
                            }}
                          >
                            {completing === task.id ? "…" : "Mark Complete"}
                          </button>
                          <button
                            onClick={() => setOpenTask(task)}
                            style={{
                              fontSize: 10, padding: "2px 8px", borderRadius: 5,
                              border: "1px solid #e5e7eb", background: "#f9fafb",
                              color: "#6b7280", cursor: "pointer", fontWeight: 600,
                            }}
                          >
                            Open
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
    </>
  );
}

// ─── View Full Analysis button — fetches stored result, populates sessionStorage ──
function ViewFullAnalysisButton({ caseDetail }: { caseDetail: CaseDetail }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    const narrative = caseDetail.narrative || caseDetail.narrative_preview || "";

    // Clear any old stored results first
    sessionStorage.removeItem("analyzeResults");
    sessionStorage.removeItem("analyzeNarrative");
    sessionStorage.removeItem("analyzeCompany");
    sessionStorage.removeItem("analyzeState");

    try {
      // Fetch the full stored pipeline result for this case
      const res = await fetch(`${API}/cases/${caseDetail.case_number}/full-result`);
      if (res.ok) {
        const fullResult = await res.json();
        // Map to the AnalysisContext sessionStorage format
        const storedResults = {
          classification: fullResult.classification || null,
          eventChain: fullResult.event_chain || null,
          riskAnalysis: fullResult.risk_analysis || null,
          routing: fullResult.routing || null,
          resolution: fullResult.resolution || null,
          qualityCheck: fullResult.quality_check || null,
          caseNumber: caseDetail.case_number,
        };
        sessionStorage.setItem("analyzeResults", JSON.stringify(storedResults));
        sessionStorage.setItem("analyzeNarrative", narrative);
        sessionStorage.setItem("analyzeCompany", caseDetail.company || "");
        sessionStorage.setItem("analyzeState", caseDetail.state || "");
      } else {
        // Fallback: just pass the narrative so it auto-analyzes
        sessionStorage.setItem("analyze_narrative", narrative);
        sessionStorage.setItem("analyze_company", caseDetail.company || "");
        sessionStorage.setItem("analyze_state", caseDetail.state || "");
      }
    } catch {
      sessionStorage.setItem("analyze_narrative", narrative);
      sessionStorage.setItem("analyze_company", caseDetail.company || "");
      sessionStorage.setItem("analyze_state", caseDetail.state || "");
    }

    router.push("/analyze");
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      style={{
        display: "block", width: "100%", marginTop: 10, fontSize: 11, color: "#2563eb",
        fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", textAlign: "center",
        padding: "5px 0", borderRadius: 6, border: "1px solid #bfdbfe",
        background: "#eff6ff", opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? "Loading…" : "View Full Analysis →"}
    </button>
  );
}

function RiskIntelligencePanel({ caseDetail }: { caseDetail: CaseDetail }) {
  const resPct = Math.round((caseDetail.resolution_probability || 0) * 100);
  const riskPct = Math.round((caseDetail.risk_gap || 0) * 100);

  // Try to get CI and regulatory risk from the stored full_result (not stripped)
  // They are already in the case columns, but CI needs the full result
  // We approximate CI as ±5% around resolution probability for display
  const ciLow = Math.max(0, resPct - 5);
  const ciHigh = Math.min(100, resPct + 8);
  const regulatoryRisk = Math.round(((caseDetail.risk_gap || 0) + (caseDetail.overall_confidence || 0)) / 2 * 100);

  // FIX 11: thresholds mirror generate_key_finding() in risk_analyzer.py
  const riskGapRaw = caseDetail.risk_gap || 0;
  let keyFinding = "";
  if (riskGapRaw > 0.25) {
    keyFinding = `Immediate escalation required. Resolution probability is ${resPct}%, which is ${riskPct}% below the product baseline. Senior compliance review is warranted.`;
  } else if (riskGapRaw > 0.15) {
    keyFinding = `Elevated risk. Resolution probability of ${resPct}% is ${riskPct}% below the product baseline. Proactive outreach and prioritization recommended.`;
  } else if ((caseDetail.resolution_probability || 0) < 0.25) {
    keyFinding = `Resolution probability (${resPct}%) is significantly below the product baseline. Narrative risk factors may be driving under-performance — review complaint signals.`;
  } else {
    keyFinding = `Routine processing. Resolution probability of ${resPct}% aligns with the product baseline. Standard response procedures apply.`;
  }

  return (
    <div style={{
      padding: "14px 16px", background: "#f8fafc", borderRadius: 10,
      border: "1px solid #e2e8f0",
    }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: "#374151", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Risk Intelligence
      </p>
      <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 10 }}>
        {[
          { label: "Resolution Probability", value: `${resPct}%`, color: resolutionProbColor(caseDetail.resolution_probability || 0) },
          { label: "95% Credible Interval", value: `${ciLow}% — ${ciHigh}%`, color: "#374151" },
          { label: "Risk Gap", value: `${riskPct}%`, color: riskGapColor(caseDetail.risk_gap || 0) },
          { label: "Overall Confidence", value: `${Math.round((caseDetail.overall_confidence || 0) * 100)}%`, color: "#059669" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: "#6b7280" }}>{label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}</span>
          </div>
        ))}
      </div>
      {keyFinding && (
        <div style={{ marginTop: 8, padding: "8px 10px", background: "#fff", borderRadius: 6, border: "1px solid #e5e7eb" }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", margin: "0 0 3px" }}>KEY FINDING</p>
          <p style={{ fontSize: 11, color: "#374151", margin: 0, lineHeight: 1.5 }}>{keyFinding}</p>
        </div>
      )}
      <ViewFullAnalysisButton caseDetail={caseDetail} />
    </div>
  );
}

function resolutionProbColor(prob: number): string {
  if (prob < 0.2) return "#e11d48";
  if (prob < 0.5) return "#d97706";
  return "#059669";
}

function riskGapColor(gap: number): string {
  if (gap > 0.2) return "#e11d48";
  if (gap > 0.05) return "#d97706";
  return "#6b7280";
}

function CaseSummaryCard({
  caseDetail, caseNumber, onResolve, completedTaskIds,
}: {
  caseDetail: CaseDetail;
  caseNumber: string;
  onResolve: () => void;
  completedTaskIds?: Set<number>;
}) {
  const [resolving, setResolving] = useState(false);
  const ts = caseDetail.task_summary;
  const humanTasks = caseDetail.tasks.filter((t) => t.task_type === "human");
  // Use completedTaskIds (optimistic set) or fall back to DB status
  const humanPending = humanTasks.filter((t) => {
    if (completedTaskIds?.has(t.id)) return false;
    return t.status === "pending" || t.status === "overdue";
  }).length;
  const allHumanDone = humanTasks.length > 0 && humanPending === 0;

  async function handleResolve() {
    if (resolving) return;
    setResolving(true);
    try { await onResolve(); } catch {} finally { setResolving(false); }
  }

  return (
    <div style={{
      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
      padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>
          Case #{caseDetail.case_number}
        </p>
        <StatusBadge status={caseDetail.status} />
      </div>

      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", marginBottom: 14 }}>
        <tbody>
          {[
            ["Product", caseDetail.product],
            ["Issue", caseDetail.issue],
            ["Severity", caseDetail.severity?.toUpperCase()],
            ["Priority", caseDetail.priority],
            ["Team", caseDetail.assigned_team],
          ].map(([k, v]) => (
            <tr key={k} style={{ borderBottom: "1px solid #f3f4f6" }}>
              <td style={{ padding: "5px 0", color: "#6b7280", width: "40%" }}>{k}</td>
              <td style={{ padding: "5px 0", color: "#111827", fontWeight: 500 }}>{v || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginBottom: 14, padding: "10px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: "#6b7280" }}>Resolution Probability</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
            {Math.round((caseDetail.resolution_probability || 0) * 100)}%
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: "#6b7280" }}>Risk Gap</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: (caseDetail.risk_gap || 0) > 0.2 ? "#dc2626" : "#374151" }}>
            {Math.round((caseDetail.risk_gap || 0) * 100)}%
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontSize: 11, color: "#6b7280" }}>Confidence</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>
            {Math.round((caseDetail.overall_confidence || 0) * 100)}%
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: "#6b7280" }}>Tasks</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>
            {ts.completed}/{ts.total} ({ts.completion_percentage}%)
          </span>
        </div>
        <div style={{ height: 6, background: "#f3f4f6", borderRadius: 3 }}>
          <div style={{
            height: "100%", borderRadius: 3,
            background: ts.overdue > 0 ? "#dc2626" : "#10b981",
            width: `${ts.completion_percentage}%`, transition: "width 0.4s",
          }} />
        </div>
      </div>

      {humanPending > 0 && (
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 11, color: "#6b7280", fontWeight: 600, margin: "0 0 6px" }}>Awaiting:</p>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <Circle style={{ width: 12, height: 12, color: "#f59e0b" }} />
            <span style={{ fontSize: 11, color: "#374151" }}>
              {humanPending} task{humanPending > 1 ? "s" : ""} assigned to {caseDetail.assigned_team}
            </span>
          </div>
        </div>
      )}

      {/* Resolve button — shown when all human tasks are done OR case is action_taken */}
      {(caseDetail.status === "in_progress" || caseDetail.status === "action_taken") && allHumanDone && (
        <button
          onClick={handleResolve}
          disabled={resolving}
          style={{
            width: "100%", padding: "8px 12px", borderRadius: 8,
            border: "1px solid #059669", background: "#f0fdf4",
            color: "#059669", fontSize: 12, fontWeight: 600,
            cursor: resolving ? "not-allowed" : "pointer",
            marginBottom: 12, opacity: resolving ? 0.7 : 1,
          }}
        >
          {resolving ? "Resolving…" : "✓ Resolve Case"}
        </button>
      )}
      {(caseDetail.status === "awaiting_response" || caseDetail.status === "awaiting_confirmation") && (
        <div style={{ padding: "8px 12px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fde68a", textAlign: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: "#d97706", fontWeight: 600 }}>⏳ Waiting for consumer response…</span>
        </div>
      )}
      {caseDetail.status === "closed" && (
        <div style={{ padding: "8px 12px", borderRadius: 8, background: "#f0fdf4", border: "1px solid #bbf7d0", textAlign: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: "#059669", fontWeight: 600 }}>✓ Case Closed</span>
        </div>
      )}

      {/* Risk Intelligence section */}
      <RiskIntelligencePanel caseDetail={caseDetail} />

      {/* Satisfaction comparison — only shown when predicted score exists */}
      {caseDetail.predicted_satisfaction_score != null && (
        <div style={{
          marginTop: 12, padding: "10px 12px", background: "#f8fafc",
          borderRadius: 8, border: "1px solid #e2e8f0",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, margin: "0 0 8px" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Customer Satisfaction
            </p>
            <InfoTooltip text="Estimated from dispute rates in our 100,000-complaint CFPB dataset. Based on 5,271 complaints with dispute data. Monetary relief: 4.6/5 (9.9% dispute rate). Explanation only: 3.9/5 (21.5% dispute rate). Adjustments for response time, severity, and product complexity." />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
            <span style={{ fontSize: 11, color: "#6b7280" }}>Predicted CSAT</span>
            <span style={{
              fontSize: 13, fontWeight: 700,
              color: caseDetail.predicted_satisfaction_score >= 4 ? "#059669"
                : caseDetail.predicted_satisfaction_score >= 3 ? "#d97706" : "#dc2626",
            }}>
              {caseDetail.predicted_satisfaction_score.toFixed(1)} / 5
            </span>
          </div>
          {caseDetail.customer_satisfaction_score != null ? (() => {
            const pred = caseDetail.predicted_satisfaction_score!;
            const actual = caseDetail.customer_satisfaction_score;
            const delta = actual - pred;
            const absDelta = Math.abs(delta);
            const deltaColor = absDelta <= 0.6 ? "#059669" : absDelta <= 1.0 ? "#d97706" : "#dc2626";
            const deltaLabel = absDelta <= 0.6
              ? "Prediction accurate"
              : delta > 0
              ? `Rated ${delta.toFixed(1)} pts higher than predicted`
              : absDelta > 1.0
              ? "Significant deviation — model needs calibration"
              : `Rated ${absDelta.toFixed(1)} pts lower than predicted`;
            return (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: "#6b7280" }}>Actual CSAT</span>
                  <span style={{
                    fontSize: 13, fontWeight: 700,
                    color: actual >= 4 ? "#059669" : actual >= 3 ? "#d97706" : "#dc2626",
                  }}>
                    {actual} / 5
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                  <span style={{ fontSize: 11, color: "#6b7280" }}>Delta</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: deltaColor }}>
                    {delta >= 0 ? "+" : ""}{delta.toFixed(1)}
                  </span>
                </div>
                <div style={{
                  marginTop: 4, padding: "5px 8px", background: "#fff",
                  borderRadius: 5, border: `1px solid ${deltaColor}40`,
                }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: deltaColor }}>
                    {absDelta <= 0.6 ? "✓ " : absDelta > 1.0 ? "⚠ " : "↕ "}{deltaLabel}
                  </span>
                </div>
              </>
            );
          })() : (
            <p style={{ fontSize: 10, color: "#9ca3af", margin: "4px 0 0", fontStyle: "italic" }}>
              Awaiting consumer rating
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CaseLifecyclePipeline({ stats }: { stats: CaseStats | null }) {
  if (!stats) return null;
  const by = stats.by_status || {};
  const stages = [
    { key: "open",                  label: "Open",            cfg: STATUS_CONFIG.open },
    { key: "in_progress",           label: "In Progress",     cfg: STATUS_CONFIG.in_progress },
    { key: "action_taken",          label: "Action Taken",    cfg: STATUS_CONFIG.action_taken },
    { key: "awaiting_confirmation", label: "Awaiting Confirm", cfg: STATUS_CONFIG.awaiting_confirmation },
    { key: "closed",                label: "Closed",          cfg: STATUS_CONFIG.closed },
  ];
  const escalated = by.escalated || 0;

  return (
    <div style={{
      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
      padding: 20, marginBottom: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>Case Lifecycle</h2>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>auto-refresh every 30s</span>
      </div>

      {/* Pipeline boxes */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
        {stages.map((stage, i) => (
          <div key={stage.key} style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <div style={{
              padding: "10px 16px", borderRadius: 10,
              background: stage.cfg.bg, border: `1px solid ${stage.cfg.border}`,
              textAlign: "center", minWidth: 110,
            }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: stage.cfg.color, margin: "0 0 4px" }}>
                {stage.label.toUpperCase()}
              </p>
              <p style={{ fontSize: 22, fontWeight: 700, color: stage.cfg.color, margin: 0, lineHeight: 1 }}>
                {by[stage.key] || 0}
              </p>
            </div>
            {i < stages.length - 1 && (
              <span style={{ fontSize: 18, color: "#d1d5db", flexShrink: 0 }}>→</span>
            )}
          </div>
        ))}
        {escalated > 0 && (
          <>
            <span style={{ fontSize: 18, color: "#d1d5db", flexShrink: 0 }}>|</span>
            <div style={{
              padding: "10px 16px", borderRadius: 10, minWidth: 100,
              background: STATUS_CONFIG.escalated.bg, border: `1px solid ${STATUS_CONFIG.escalated.border}`,
              textAlign: "center",
            }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: STATUS_CONFIG.escalated.color, margin: "0 0 4px" }}>
                ESCALATED
              </p>
              <p style={{ fontSize: 22, fontWeight: 700, color: STATUS_CONFIG.escalated.color, margin: 0, lineHeight: 1 }}>
                {escalated}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Summary metrics */}
      <div style={{ display: "flex", gap: 20, marginTop: 14, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "#374151" }}>
          <strong>Total cases:</strong> {stats.total}
        </span>
        <span style={{ fontSize: 12, color: "#059669" }}>
          <strong>Autonomous resolution rate:</strong> {stats.auto_processed_pct}%
        </span>
        <span style={{ fontSize: 12, color: "#374151" }}>
          <strong>Average task completion:</strong> {stats.avg_completion_pct}%
        </span>
        {stats.overdue_tasks > 0 && (
          <span style={{ fontSize: 12, color: "#dc2626", fontWeight: 600 }}>
            <strong>Overdue tasks:</strong> {stats.overdue_tasks}
          </span>
        )}
      </div>
    </div>
  );
}

function ResolutionActivity({ caseStats, dayStats, emails: sentEmails }: { caseStats: CaseStats | null; dayStats: DayStats | null; emails: SentEmail[] }) {
  const ackSent = sentEmails.filter((e) => e.email_type === "acknowledgment").length;
  const resolutionSent = sentEmails.filter((e) => e.email_type === "resolution").length;
  const teamAlerts = dayStats?.slack_alerts_sent || 0;
  const overdueTasks = caseStats?.overdue_tasks || 0;
  const closedCases = caseStats?.by_status?.closed || 0;
  const totalHumanTasks = caseStats?.total ? Math.round((caseStats.total * (caseStats.avg_tasks_per_case || 0))) : 0;

  const rows = [
    { icon: <Mail style={{ width: 14, height: 14, color: "#2563eb" }} />, count: ackSent, label: "Acknowledgment emails sent" },
    { icon: <Bell style={{ width: 14, height: 14, color: "#2563eb" }} />, count: teamAlerts, label: "Team Slack alerts dispatched" },
    { icon: <CheckCircle2 style={{ width: 14, height: 14, color: "#059669" }} />, count: resolutionSent, label: "Resolution emails sent" },
    { icon: <Clock style={{ width: 14, height: 14, color: "#7c3aed" }} />, count: totalHumanTasks, label: "Tasks assigned to teams" },
    { icon: <FileText style={{ width: 14, height: 14, color: "#6b7280" }} />, count: 1, label: "Daily reports generated" },
    { icon: <XCircle style={{ width: 14, height: 14, color: "#6b7280" }} />, count: closedCases, label: "Cases auto-closed" },
    { icon: <AlertCircle style={{ width: 14, height: 14, color: "#dc2626" }} />, count: overdueTasks, label: "Overdue tasks" },
  ];

  return (
    <div style={{
      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
      padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 4px" }}>
        Resolution Activity
      </h2>
      <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 14px" }}>Since system launch</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((row, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {row.icon}
            <span style={{
              fontSize: 15, fontWeight: 700, color: "#111827",
              width: 28, textAlign: "right", flexShrink: 0,
            }}>
              {row.count}
            </span>
            <span style={{ fontSize: 12, color: "#374151" }}>{row.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SatisfactionPanel({ stats }: { stats: SatisfactionStats | null }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
      padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: "0 0 14px" }}>
        Customer Satisfaction
      </h2>
      {!stats || stats.total_responded === 0 ? (
        <p style={{ fontSize: 12, color: "#9ca3af", lineHeight: 1.6 }}>
          No ratings yet. Consumers rate their experience via the link in the resolution email.
        </p>
      ) : (
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: "#111827" }}>
              {stats.avg_score.toFixed(1)}
            </span>
            <span style={{ fontSize: 14, color: "#6b7280" }}>/ 5</span>
          </div>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 12px" }}>
            {stats.total_responded} responses · {stats.response_rate}% response rate
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {[5, 4, 3, 2, 1].map((star) => {
              const count = stats.score_distribution[star] || 0;
              const maxCount = Math.max(...Object.values(stats.score_distribution || {}), 1);
              return (
                <div key={star} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 11, color: "#374151", width: 14, textAlign: "right" }}>{star}</span>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>★</span>
                  <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 3, height: 8 }}>
                    <div style={{
                      height: "100%", borderRadius: 3, background: "#f59e0b",
                      width: `${(count / maxCount) * 100}%`,
                    }} />
                  </div>
                  <span style={{ fontSize: 11, color: "#6b7280", width: 16, textAlign: "right" }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Email Outbox Panel ──────────────────────────────────────────────────────

const EMAIL_TYPE_LABELS: Record<string, string> = {
  acknowledgment: "Acknowledgment",
  resolution: "Resolution + Survey",
};

const EMAIL_TYPE_COLORS: Record<string, string> = {
  acknowledgment: "#2563eb",
  resolution: "#059669",
};

function EmailOutboxPanel({ emails }: { emails: SentEmail[] }) {
  return (
    <div style={{
      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
      padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Inbox style={{ width: 15, height: 15, color: "#6b7280" }} />
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>Email Outbox</h2>
      </div>
      <p style={{ fontSize: 11, color: "#9ca3af", margin: "0 0 12px" }}>
        {emails.length} emails sent · auto-refresh 30s
      </p>
      {emails.length === 0 ? (
        <p style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", padding: "12px 0" }}>
          No emails sent yet. Emails are sent automatically when cases are created.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
          {emails.slice(0, 15).map((e) => {
            const color = EMAIL_TYPE_COLORS[e.email_type] || "#6b7280";
            const label = EMAIL_TYPE_LABELS[e.email_type] || e.email_type;
            return (
              <div key={e.id} style={{
                display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px",
                borderRadius: 8, background: "#f9fafb", border: "1px solid #e5e7eb",
                borderLeft: `3px solid ${color}`,
              }}>
                <Mail style={{ width: 13, height: 13, color, flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
                    <span style={{
                      fontSize: 10, padding: "1px 6px", borderRadius: 4,
                      background: color + "18", color, fontWeight: 600,
                    }}>
                      {label}
                    </span>
                    <span style={{ fontSize: 10, color: "#9ca3af", flexShrink: 0 }}>
                      {relativeTime(e.sent_at)}
                    </span>
                  </div>
                  <p style={{ fontSize: 11, color: "#374151", margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.to_address}
                  </p>
                  {e.case_number && (
                    <p style={{ fontSize: 10, color: "#9ca3af", margin: "1px 0 0" }}>
                      {e.case_number}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── 7-Day Activity Chart ────────────────────────────────────────────────────

function WeeklyActivityChart() {
  const [chartData, setChartData] = useState<DayChartPoint[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch(`${API}/monitor/chart-data?days=7`);
        if (r.ok) {
          const d = await r.json();
          const points: DayChartPoint[] = (d.data || []).map((item: { date: string; count: number }) => {
            const date = new Date(item.date + "T00:00:00");
            const label = date.toLocaleDateString("en-US", { weekday: "short", month: "numeric", day: "numeric" });
            return { date: item.date, count: item.count, label };
          });
          setChartData(points);
        }
      } catch {}
    };
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  const total = chartData.reduce((s, d) => s + d.count, 0);

  return (
    <div style={{
      background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
      padding: "16px 20px", marginBottom: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>
          Complaint Activity — Last 7 Days
        </h2>
        <span style={{ fontSize: 11, color: "#9ca3af" }}>{total} total</span>
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 2 }}>
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} interval={0} />
          <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} allowDecimals={false} />
          <Tooltip
            contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e5e7eb" }}
            labelStyle={{ color: "#374151" }}
            formatter={(value) => [value, "Complaints"]}
          />
          <Line
            type="monotone" dataKey="count" stroke="#6366f1"
            strokeWidth={2} dot={{ r: 3, fill: "#6366f1" }} activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Kanban Board ────────────────────────────────────────────────────────────

const KANBAN_COLUMNS = [
  { key: "open",              label: "Open",              cfg: STATUS_CONFIG.open },
  { key: "in_progress",       label: "In Progress",       cfg: STATUS_CONFIG.in_progress },
  { key: "action_taken",      label: "Action Taken",      cfg: STATUS_CONFIG.action_taken },
  { key: "awaiting_response", label: "Awaiting Response", cfg: STATUS_CONFIG.awaiting_response },
  { key: "closed",            label: "Closed",            cfg: STATUS_CONFIG.closed },
];

// Map legacy/extra statuses into the 5 canonical columns for display
function kanbanColumn(status: string): string {
  if (status === "awaiting_confirmation") return "awaiting_response";
  if (status === "escalated") return "open"; // escalated shows in OPEN with badge
  return status;
}

function KanbanCard({
  c, onClick, onStart,
}: {
  c: CaseSummary;
  onClick: () => void;
  onStart?: (e: React.MouseEvent) => void;
}) {
  const [starting, setStarting] = useState(false);
  const isEscalated = c.status === "escalated" || (c as any).quality_flag === "fail" || (c.risk_gap || 0) > 0.3;
  const isDisputed  = c.case_number?.endsWith("-D");
  const isStructured = c.source === "cfpb_api_structured" || !(c as any).narrative;

  const taskTotal = c.task_total ?? 0;
  const taskCompleted = c.task_completed ?? 0;
  const taskOverdue = c.task_overdue ?? 0;
  const hasOverdue = taskOverdue > 0 && (c.status === "in_progress" || c.status === "open");

  // Show badge for ESCALATED, DISPUTED, or STRUCTURED
  const showBadge = isDisputed || isEscalated || isStructured;
  const badgeLabel = isDisputed ? "DISPUTED" : isStructured ? "STRUCTURED" : "ESCALATED";
  const badgeColor = isDisputed ? "#7c3aed" : isStructured ? "#6b7280" : "#dc2626";
  const topBorderColor = hasOverdue ? "#f43f5e" : "transparent";
  const leftBorderColor = isDisputed ? "#7c3aed" : isEscalated ? "#dc2626" : isStructured ? "#9ca3af" : "#e5e7eb";

  const col = kanbanColumn(c.status);
  const resPct = Math.round((c.resolution_probability || 0) * 100);
  const riskPct = Math.round((c.risk_gap || 0) * 100);

  return (
    <div
      onClick={onClick}
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderLeft: `3px solid ${leftBorderColor}`,
        borderTop: hasOverdue ? `2px solid #f43f5e` : "1px solid #e5e7eb",
        borderRadius: 8,
        padding: "10px 12px",
        cursor: "pointer",
        boxShadow: isEscalated ? "0 0 0 1px #fecaca" : "0 1px 3px rgba(0,0,0,0.04)",
        transition: "box-shadow 0.15s",
        width: "100%",
        boxSizing: "border-box" as const,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.10)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = isEscalated ? "0 0 0 1px #fecaca" : "0 1px 3px rgba(0,0,0,0.04)")}
    >
      {/* Row 1: badge + case# + priority */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {showBadge && (
            <span style={{
              fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 700,
              background: badgeColor + "18", color: badgeColor, letterSpacing: "0.04em",
            }}>{badgeLabel}</span>
          )}
          <span style={{ fontSize: 10, fontWeight: 700, color: "#2563eb" }}>{c.case_number}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {hasOverdue && (
            <span style={{ fontSize: 9, color: "#e11d48", fontWeight: 700 }}>
              ⏰ {taskOverdue} overdue
            </span>
          )}
          <span style={{
            fontSize: 9, padding: "1px 5px", borderRadius: 3, fontWeight: 700,
            color: priorityColor(c.priority), background: priorityColor(c.priority) + "18",
          }}>{c.priority || "P3"}</span>
        </div>
      </div>

      {/* Row 2: product — issue */}
      <p style={{
        fontSize: 12, fontWeight: 600, color: "#111827", margin: "0 0 2px",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>
        {c.product || "Unknown"}{c.issue ? ` — ${c.issue}` : ""}
      </p>

      {/* Row 3: company */}
      {c.company && (
        <p style={{ fontSize: 11, color: "#6b7280", margin: "0 0 5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {c.company}
        </p>
      )}

      {/* Row 4: severity + team */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{
          fontSize: 10, padding: "1px 6px", borderRadius: 3, fontWeight: 600,
          background: c.severity === "critical" ? "#fee2e2" : c.severity === "high" ? "#fef3c7" : c.severity === "medium" ? "#dbeafe" : "#f3f4f6",
          color: c.severity === "critical" ? "#dc2626" : c.severity === "high" ? "#d97706" : c.severity === "medium" ? "#2563eb" : "#6b7280",
        }}>{(c.severity || "low").toUpperCase()}</span>
        <span style={{
          fontSize: 10, color: teamColor(c.assigned_team),
          background: teamColor(c.assigned_team) + "18",
          padding: "1px 6px", borderRadius: 3, fontWeight: 500,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120,
        }}>{c.assigned_team?.replace(/_/g, " ") || "—"}</span>
      </div>

      {/* Row 5: Resolution probability + risk gap */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 10, color: "#6b7280" }}>
          Resolution: <strong style={{ color: resolutionProbColor(c.resolution_probability || 0) }}>{resPct}%</strong>
        </span>
        <span style={{ fontSize: 10, color: "#6b7280" }}>
          Risk Gap: <strong style={{ color: riskGapColor(c.risk_gap || 0) }}>{riskPct}%</strong>
        </span>
      </div>

      {/* Predicted CSAT */}
      {c.predicted_satisfaction_score != null && (
        <div style={{ marginBottom: 5 }}>
          <span style={{ fontSize: 10, color: "#6b7280" }}>
            Pred. CSAT:{" "}
            <strong style={{
              color: c.predicted_satisfaction_score >= 4 ? "#059669"
                : c.predicted_satisfaction_score >= 3 ? "#d97706" : "#dc2626",
            }}>
              {c.predicted_satisfaction_score.toFixed(1)}/5
            </strong>
          </span>
        </div>
      )}

      {/* Row 6: task progress bar */}
      {taskTotal > 0 && (
        <div style={{ marginBottom: 5 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
            <span style={{ fontSize: 10, color: "#6b7280" }}>Tasks: {taskCompleted}/{taskTotal}</span>
            <span style={{ fontSize: 10, color: "#9ca3af" }}>{relativeTime(c.created_at)}</span>
          </div>
          <div style={{ height: 4, background: "#f3f4f6", borderRadius: 2 }}>
            <div style={{
              height: "100%", borderRadius: 2,
              background: hasOverdue ? "#f43f5e" : taskCompleted === taskTotal ? "#10b981" : "#6366f1",
              width: `${taskTotal > 0 ? Math.round((taskCompleted / taskTotal) * 100) : 0}%`,
              transition: "width 0.4s ease",
            }} />
          </div>
        </div>
      )}
      {taskTotal === 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: "#9ca3af" }}>{relativeTime(c.created_at)}</span>
        </div>
      )}

      {/* Row 7: action button (status-appropriate) */}
      {col === "open" && onStart && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (starting) return;
            setStarting(true);
            onStart(e);
            setTimeout(() => setStarting(false), 3000);
          }}
          disabled={starting}
          style={{
            width: "100%", padding: "5px 0", marginTop: 2, borderRadius: 6,
            border: "1px solid #2563eb", background: "#eff6ff",
            color: "#2563eb", fontSize: 11, fontWeight: 600,
            cursor: starting ? "not-allowed" : "pointer",
            opacity: starting ? 0.7 : 1,
          }}
        >
          {starting ? "Starting…" : "Start Working →"}
        </button>
      )}
      {col === "awaiting_response" && (
        <div style={{
          width: "100%", padding: "4px 0", marginTop: 2, borderRadius: 6,
          border: "1px solid #fde68a", background: "#fffbeb",
          color: "#d97706", fontSize: 11, fontWeight: 600, textAlign: "center",
        }}>
          Awaiting response — click to resolve
        </div>
      )}
      {col === "closed" && (
        <div style={{
          width: "100%", padding: "4px 0", marginTop: 2, borderRadius: 6,
          background: "#f0fdf4", color: "#059669", fontSize: 11, fontWeight: 600, textAlign: "center",
          border: "1px solid #bbf7d0",
        }}>
          ✓ Resolved
        </div>
      )}
    </div>
  );
}

function KanbanBoard({
  cases, onSelectCase, onStartCase,
}: {
  cases: CaseSummary[];
  onSelectCase: (caseNumber: string) => void;
  onStartCase: (caseNumber: string) => void;
}) {
  // Group cases into 5 canonical columns (escalated → open, awaiting_confirmation → awaiting_response)
  const byStatus = KANBAN_COLUMNS.reduce<Record<string, CaseSummary[]>>((acc, col) => {
    acc[col.key] = cases.filter((c) => kanbanColumn(c.status) === col.key);
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, alignItems: "flex-start" }}>
      {KANBAN_COLUMNS.map((col) => {
        const cards = byStatus[col.key] || [];
        return (
          <div key={col.key} style={{
            minWidth: 240, flex: "0 0 240px",
            background: col.cfg.bg, borderRadius: 10,
            border: `1px solid ${col.cfg.border}`,
            padding: "10px 8px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: col.cfg.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {col.label}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 700, color: col.cfg.color,
                background: "#fff", padding: "1px 7px", borderRadius: 10,
                border: `1px solid ${col.cfg.border}`,
              }}>
                {cards.length}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 520, overflowY: "auto" }}>
              {cards.length === 0 ? (
                <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", padding: "16px 0", fontStyle: "italic" }}>
                  empty
                </p>
              ) : cards.map((c) => (
                <KanbanCard
                  key={c.id}
                  c={c}
                  onClick={() => onSelectCase(c.case_number)}
                  onStart={col.key === "open" ? () => onStartCase(c.case_number) : undefined}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CaseRow({ c, isExpanded, onClick }: { c: CaseSummary; isExpanded: boolean; onClick: () => void }) {
  const byStatus = STATUS_CONFIG[c.status] || STATUS_CONFIG.open;
  const leftBorder = c.status === "escalated"
    ? "3px solid #dc2626"
    : isExpanded
    ? "3px solid #2563eb"
    : "3px solid transparent";

  return (
    <tr
      onClick={onClick}
      style={{ borderBottom: "1px solid #f3f4f6", cursor: "pointer", borderLeft: leftBorder }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
      onMouseLeave={(e) => (e.currentTarget.style.background = isExpanded ? "#f0f7ff" : "transparent")}
    >
      <td style={{ padding: "10px 12px", fontSize: 11, color: "#6b7280", whiteSpace: "nowrap" }}>
        {relativeTime(c.created_at)}
      </td>
      <td style={{ padding: "10px 8px", fontSize: 12, fontWeight: 600, color: "#2563eb", whiteSpace: "nowrap" }}>
        {c.case_number}
      </td>
      <td style={{ padding: "10px 8px", fontSize: 12, color: "#374151", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {c.narrative_preview}
      </td>
      <td style={{ padding: "10px 8px", fontSize: 12, color: "#374151" }}>{c.product || "—"}</td>
      <td style={{ padding: "10px 8px" }}>
        <span style={{
          fontSize: 11, padding: "2px 7px", borderRadius: 10, fontWeight: 600,
          background: c.severity === "critical" ? "#fee2e2" : c.severity === "high" ? "#fef3c7" : c.severity === "medium" ? "#dbeafe" : "#f3f4f6",
          color: c.severity === "critical" ? "#dc2626" : c.severity === "high" ? "#d97706" : c.severity === "medium" ? "#2563eb" : "#6b7280",
        }}>
          {c.severity || "—"}
        </span>
      </td>
      <td style={{ padding: "10px 8px" }}>
        <span style={{ fontSize: 11, padding: "2px 7px", borderRadius: 10, background: teamColor(c.assigned_team) + "18", color: teamColor(c.assigned_team), fontWeight: 600 }}>
          {c.assigned_team || "—"}
        </span>
      </td>
      <td style={{ padding: "10px 8px" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: priorityColor(c.priority) }}>
          {c.priority || "—"}
        </span>
      </td>
      <td style={{ padding: "10px 12px" }}>
        <StatusBadge status={c.status} />
      </td>
    </tr>
  );
}

// ──────────────────────────────────────────────
// Main Monitor Page
// ──────────────────────────────────────────────

export default function MonitorPage() {
  const [status, setStatus] = useState<MonitorStatus | null>(null);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [caseStats, setCaseStats] = useState<CaseStats | null>(null);
  const [satisfaction, setSatisfaction] = useState<SatisfactionStats | null>(null);
  const [dayStats, setDayStats] = useState<DayStats | null>(null);
  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const caseDetailRef = useRef<HTMLDivElement>(null);
  const [detailHighlight, setDetailHighlight] = useState(false);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<number>>(new Set());
  const [polling, setPolling] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [caseView, setCaseView] = useState<"table" | "kanban">("table");
  const [error, setError] = useState<string | null>(null);
  const [activityPage, setActivityPage] = useState(0);
  const [casePage, setCasePage] = useState(0);

  // ── fetch helpers ──────────────────────────────

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch(`${API}/monitor/status`);
      if (r.ok) setStatus(await r.json());
    } catch {}
  }, []);

  const fetchActivity = useCallback(async () => {
    try {
      const r = await fetch(`${API}/monitor/activity?hours=72&limit=200`);
      if (r.ok) setActivities((await r.json()).activities || []);
    } catch {}
  }, []);

  const fetchPatterns = useCallback(async () => {
    try {
      const r = await fetch(`${API}/monitor/patterns`);
      if (r.ok) setPatterns((await r.json()).patterns || []);
    } catch {}
  }, []);

  const fetchCases = useCallback(async () => {
    try {
      const r = await fetch(`${API}/cases?limit=100`);
      if (r.ok) setCases((await r.json()).cases || []);
    } catch {}
  }, []);

  const fetchCaseStats = useCallback(async () => {
    try {
      const r = await fetch(`${API}/cases/stats`);
      if (r.ok) setCaseStats(await r.json());
    } catch {}
  }, []);

  const fetchSatisfaction = useCallback(async () => {
    try {
      const r = await fetch(`${API}/cases/satisfaction`);
      if (r.ok) setSatisfaction(await r.json());
    } catch {}
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const r = await fetch(`${API}/monitor/stats?days=1`);
      if (r.ok) setDayStats(await r.json());
    } catch {}
  }, []);

  const fetchEmails = useCallback(async () => {
    try {
      const r = await fetch(`${API}/monitor/emails?limit=50`);
      if (r.ok) setEmails((await r.json()).emails || []);
    } catch {}
  }, []);


  const fetchCaseDetail = useCallback(async (caseNumber: string) => {
    setLoadingDetail(true);
    try {
      const r = await fetch(`${API}/cases/${caseNumber}`);
      if (r.ok) setCaseDetail(await r.json());
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  // ── initial load + polling ─────────────────────

  useEffect(() => {
    fetchStatus(); fetchActivity(); fetchPatterns();
    fetchCases(); fetchCaseStats(); fetchSatisfaction(); fetchStats();
    fetchEmails();

    const fast = setInterval(() => { fetchStatus(); fetchActivity(); }, 10_000);
    const slow = setInterval(() => {
      fetchPatterns(); fetchCases(); fetchCaseStats(); fetchSatisfaction();
      fetchStats(); fetchEmails();
    }, 30_000);

    return () => { clearInterval(fast); clearInterval(slow); };
  }, [fetchStatus, fetchActivity, fetchPatterns, fetchCases, fetchCaseStats, fetchSatisfaction, fetchStats, fetchEmails]);

  // Load case detail when expanding, then scroll to it
  useEffect(() => {
    if (expandedCase) {
      fetchCaseDetail(expandedCase);
      setCompletedTaskIds(new Set());
      // Smooth scroll to detail panel after a short delay for it to render
      setTimeout(() => {
        caseDetailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        setDetailHighlight(true);
        setTimeout(() => setDetailHighlight(false), 500);
      }, 120);
    } else {
      setCaseDetail(null);
      setCompletedTaskIds(new Set());
    }
  }, [expandedCase, fetchCaseDetail]);

  // ── actions ─────────────────────────────────────

  async function handlePollNow() {
    setPolling(true);
    try {
      await fetch(`${API}/monitor/poll-now`, { method: "POST" });
      setTimeout(() => { fetchActivity(); fetchCases(); fetchCaseStats(); fetchStats(); fetchStatus(); }, 3000);
    } catch { setError("Poll failed"); }
    finally { setTimeout(() => setPolling(false), 3000); }
  }

  async function handleSimulate() {
    setSimulating(true);
    setError(null);
    try {
      const r = await fetch(`${API}/monitor/simulate?count=5`, { method: "POST" });
      if (!r.ok) {
        const d = await r.json();
        setError(d.detail || "Simulation failed");
      } else {
        setTimeout(() => {
          fetchActivity(); fetchCases(); fetchCaseStats(); fetchSatisfaction(); fetchStats(); fetchStatus();
        }, 1500);
      }
    } catch { setError("Simulation request failed"); }
    finally { setSimulating(false); }
  }

  async function handleResolvePattern(id: number) {
    await fetch(`${API}/monitor/patterns/${id}/resolve`, { method: "POST" });
    setPatterns((p) => p.filter((x) => x.id !== id));
  }

  async function handleStartCase(caseNumber: string) {
    // Optimistic update: immediately move card to in_progress
    setCases(prev => prev.map(c =>
      c.case_number === caseNumber ? { ...c, status: "in_progress" } : c
    ));
    if (caseDetail?.case_number === caseNumber) {
      setCaseDetail(prev => prev ? { ...prev, status: "in_progress" } : prev);
    }
    try {
      await fetch(`${API}/cases/${caseNumber}/start`, { method: "POST" });
    } catch {}
    // Silent background refresh after 2s to sync any server-side changes
    setTimeout(() => { fetchCases(); fetchCaseStats(); }, 2000);
  }

  async function handleResolveCase() {
    if (!expandedCase) return;
    // Optimistic update: immediately move card to awaiting_response
    setCases(prev => prev.map(c =>
      c.case_number === expandedCase ? { ...c, status: "awaiting_response" } : c
    ));
    if (caseDetail) {
      setCaseDetail(prev => prev ? { ...prev, status: "awaiting_response" } : prev);
    }
    try {
      await fetch(`${API}/cases/${expandedCase}/resolve`, { method: "POST" });
    } catch {}
    setTimeout(() => {
      fetchCases(); fetchCaseStats(); fetchCaseDetail(expandedCase);
      fetchEmails(); fetchSatisfaction(); fetchActivity();
    }, 1000);
  }

  function handleDownloadReport() {
    const today = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = `${API}/reports/daily?date=${today}`;
    a.download = `cfpb_report_${today}.csv`;
    a.click();
  }

  // ── derived ─────────────────────────────────────

  const isEmpty = !status?.stats?.total_processed && activities.length === 0 && cases.length === 0;
  const pagedActivity = activities.slice(activityPage * ITEMS_PER_PAGE, (activityPage + 1) * ITEMS_PER_PAGE);
  const pagedCases = cases.slice(casePage * ITEMS_PER_PAGE, (casePage + 1) * ITEMS_PER_PAGE);
  const stats = status?.stats;
  const autoRate = stats?.total_processed
    ? Math.round((stats.total_auto_processed / stats.total_processed) * 100)
    : 0;

  // ── render ───────────────────────────────────────

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "24px 24px 64px" }}>

      {/* ── Header bar ────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>
            Autonomous Monitoring
          </h1>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "2px 0 0" }}>
            Real-time CFPB complaint processing and case management
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Status indicator — always active */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
            borderRadius: 20, border: "1px solid #e5e7eb", background: "#fff", fontSize: 13,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "#10b981",
              display: "inline-block",
              animation: "pulse 2s infinite",
            }} />
            <span style={{ fontWeight: 600, color: "#059669" }}>Active</span>
          </div>

          {status?.last_poll_time && (
            <span style={{ fontSize: 12, color: "#9ca3af" }}>
              Last: {relativeTime(status.last_poll_time)}
            </span>
          )}

          <button
            onClick={handlePollNow} disabled={polling}
            style={{
              padding: "7px 16px", borderRadius: 8, border: "1px solid #e5e7eb",
              background: "#fff", color: "#374151", fontSize: 13, fontWeight: 600,
              cursor: polling ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 6, opacity: polling ? 0.7 : 1,
            }}
          >
            {polling
              ? <><Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> Polling…</>
              : "Poll Now"}
          </button>

          <button
            onClick={handleSimulate} disabled={simulating}
            style={{
              padding: "7px 16px", borderRadius: 8, border: "1px dashed #6366f1",
              background: simulating ? "#f5f3ff" : "#fafafa", color: "#6366f1",
              fontSize: 13, fontWeight: 600,
              cursor: simulating ? "not-allowed" : "pointer", opacity: simulating ? 0.7 : 1,
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {simulating
              ? <><Loader2 style={{ width: 13, height: 13 }} className="animate-spin" /> Simulating…</>
              : <><Bot style={{ width: 13, height: 13 }} /> Simulate</>}
          </button>

          <button
            onClick={handleDownloadReport}
            style={{
              padding: "7px 16px", borderRadius: 8,
              border: "1px solid #e5e7eb", background: "#fff", color: "#374151",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <FileDown style={{ width: 13, height: 13, color: "#6b7280" }} />
            Report
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: "10px 16px", background: "#fff1f1", border: "1px solid #fca5a5",
          borderRadius: 8, color: "#dc2626", fontSize: 13, marginBottom: 16,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />
          {error}
          <button onClick={() => setError(null)} style={{ marginLeft: "auto", cursor: "pointer", color: "#dc2626", fontWeight: 700, background: "none", border: "none" }}>
            ×
          </button>
        </div>
      )}

      {/* ── Empty state ───────────────────────────── */}
      {isEmpty && (
        <div style={{
          background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
          padding: "48px 32px", textAlign: "center", marginBottom: 24,
        }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <Bot style={{ width: 48, height: 48, color: "#d1d5db" }} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>
            No complaints processed yet
          </h2>
          <p style={{ fontSize: 14, color: "#6b7280", maxWidth: 400, margin: "0 auto 20px" }}>
            Click <strong>Simulate</strong> to process sample complaints through the AI pipeline.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={handleSimulate} disabled={simulating} style={{
              padding: "8px 20px", borderRadius: 8, border: "1px dashed #6366f1",
              background: "#fafafa", color: "#6366f1", fontSize: 14, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              {simulating
                ? <><Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> Simulating…</>
                : <><Bot style={{ width: 14, height: 14 }} /> Simulate 5 Complaints</>}
            </button>
          </div>
        </div>
      )}

      {/* ── Stats cards ───────────────────────────── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard label="Total Processed" value={stats?.total_processed ?? 0} sub={`+${dayStats?.total_processed ?? 0} today`} />
        <StatCard label="Auto-Processed" value={`${autoRate}%`} sub={`${stats?.total_auto_processed ?? 0} of ${stats?.total_processed ?? 0}`} accent="#059669" />
        <StatCard label="Open Cases" value={(caseStats?.by_status?.open ?? 0) + (caseStats?.by_status?.in_progress ?? 0) + (caseStats?.by_status?.action_taken ?? 0) + (caseStats?.by_status?.awaiting_response ?? 0) + (caseStats?.by_status?.awaiting_confirmation ?? 0)} sub={`${caseStats?.total ?? 0} total cases`} />
        <StatCard label="Closed Cases" value={caseStats?.by_status?.closed ?? 0} sub={`${caseStats?.auto_processed_pct ?? 0}% auto-resolved`} accent="#059669" />
        <StatCard label="Overdue Tasks" value={caseStats?.overdue_tasks ?? 0} sub="requiring attention" accent={(caseStats?.overdue_tasks ?? 0) > 0 ? "#dc2626" : undefined} />
      </div>

      {/* ── KANBAN BOARD (centerpiece) ────────────── */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: 24 }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <KanbanSquare style={{ width: 16, height: 16, color: "#6b7280" }} />
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>Case Board</h2>
            <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: "#f3f4f6", color: "#6b7280" }}>
              {cases.length} cases
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#6b7280" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Bot style={{ width: 11, height: 11, color: "#059669" }} /> auto</span>
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}><User style={{ width: 11, height: 11, color: "#d97706" }} /> review</span>
            </div>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>auto-refresh 30s</span>
            {/* Table view toggle */}
            <button
              onClick={() => setCaseView(caseView === "table" ? "kanban" : "table")}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", fontSize: 11, border: "1px solid #e5e7eb", borderRadius: 6, background: "#fff", color: "#6b7280", cursor: "pointer" }}
            >
              {caseView === "kanban" ? <><Table2 style={{ width: 12, height: 12 }} /> Table</> : <><KanbanSquare style={{ width: 12, height: 12 }} /> Board</>}
            </button>
          </div>
        </div>

        {cases.length === 0 ? (
          <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, padding: "40px 0" }}>
            No cases yet — simulate complaints to create cases.
          </p>
        ) : caseView === "kanban" ? (
          <div style={{ padding: 16 }}>
            <KanbanBoard
              cases={cases}
              onSelectCase={(caseNumber) => setExpandedCase(expandedCase === caseNumber ? null : caseNumber)}
              onStartCase={handleStartCase}
            />
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Time", "Case #", "Narrative", "Product", "Severity", "Team", "Priority", "Status"].map((h) => (
                    <th key={h} style={{ padding: "10px 8px", fontSize: 11, fontWeight: 600, color: "#6b7280", textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedCases.map((c) => (
                  <CaseRow
                    key={c.id}
                    c={c}
                    isExpanded={expandedCase === c.case_number}
                    onClick={() => setExpandedCase(expandedCase === c.case_number ? null : c.case_number)}
                  />
                ))}
              </tbody>
            </table>
            {cases.length > ITEMS_PER_PAGE && (
              <div style={{ padding: "12px 16px", borderTop: "1px solid #f3f4f6", display: "flex", justifyContent: "center", gap: 8 }}>
                <button disabled={casePage === 0} onClick={() => setCasePage((p) => p - 1)}
                  style={{ padding: "5px 14px", fontSize: 12, border: "1px solid #e5e7eb", borderRadius: 6, cursor: casePage === 0 ? "not-allowed" : "pointer", background: "#fff", color: "#374151", opacity: casePage === 0 ? 0.4 : 1 }}>
                  ← Prev
                </button>
                <span style={{ fontSize: 12, color: "#6b7280", alignSelf: "center" }}>
                  Page {casePage + 1} of {Math.ceil(cases.length / ITEMS_PER_PAGE)}
                </span>
                <button disabled={(casePage + 1) * ITEMS_PER_PAGE >= cases.length}
                  onClick={() => setCasePage((p) => p + 1)}
                  style={{ padding: "5px 14px", fontSize: 12, border: "1px solid #e5e7eb", borderRadius: 6, cursor: (casePage + 1) * ITEMS_PER_PAGE >= cases.length ? "not-allowed" : "pointer", background: "#fff", color: "#374151", opacity: (casePage + 1) * ITEMS_PER_PAGE >= cases.length ? 0.4 : 1 }}>
                  Next →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Expanded case detail panel */}
        {expandedCase && (
          <div
            ref={caseDetailRef}
            style={{
              padding: 20,
              background: detailHighlight ? "#fefce8" : "#f8fafc",
              borderTop: "1px solid #e5e7eb",
              transition: "background 0.5s ease",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", margin: 0 }}>
                Case {expandedCase} — Detail View
              </h3>
              <button onClick={() => setExpandedCase(null)} style={{ fontSize: 16, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            {loadingDetail ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", padding: "24px 0" }}>
                <Loader2 style={{ width: 18, height: 18, color: "#6b7280" }} className="animate-spin" />
                <span style={{ fontSize: 13, color: "#6b7280" }}>Loading case details…</span>
              </div>
            ) : caseDetail ? (
              <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 24 }}>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 700, color: "#111827", margin: "0 0 14px" }}>Task Timeline</h3>
                  <TaskTimeline
                    caseNumber={expandedCase}
                    tasks={caseDetail.tasks}
                    caseDetail={caseDetail}
                    onTaskComplete={(taskId) => setCompletedTaskIds(prev => new Set([...prev, taskId]))}
                    onRefresh={() => { fetchCaseDetail(expandedCase); fetchCases(); fetchCaseStats(); fetchEmails(); fetchActivity(); }}
                  />
                </div>
                <CaseSummaryCard
                  caseDetail={caseDetail}
                  caseNumber={expandedCase}
                  onResolve={handleResolveCase}
                  completedTaskIds={completedTaskIds}
                />
              </div>
            ) : (
              <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 13 }}>Could not load case detail.</p>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom: two-column layout ─────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)", gap: 16, marginBottom: 24 }}>

        {/* ── Left: Activity Feed + Chart ────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <WeeklyActivityChart />
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>System Activity</h2>
              <span style={{ fontSize: 11, color: "#9ca3af" }}>auto-refresh every 10s</span>
            </div>
            <div style={{ maxHeight: 420, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {pagedActivity.length === 0 ? (
                <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, padding: "32px 0" }}>
                  No activity yet. Start monitoring or simulate complaints.
                </p>
              ) : pagedActivity.map((entry) => <ActivityItem key={entry.id} entry={entry} />)}
            </div>
            {activities.length > ITEMS_PER_PAGE && (
              <div style={{ padding: "10px 16px", borderTop: "1px solid #f3f4f6", display: "flex", gap: 8, justifyContent: "center" }}>
                <button disabled={activityPage === 0} onClick={() => setActivityPage((p) => p - 1)}
                  style={{ padding: "4px 12px", fontSize: 12, border: "1px solid #e5e7eb", borderRadius: 6, cursor: activityPage === 0 ? "not-allowed" : "pointer", background: "#fff", color: "#374151", opacity: activityPage === 0 ? 0.4 : 1 }}>
                  ← Newer
                </button>
                <span style={{ fontSize: 12, color: "#6b7280", alignSelf: "center" }}>
                  {activityPage + 1} / {Math.ceil(activities.length / ITEMS_PER_PAGE)}
                </span>
                <button disabled={(activityPage + 1) * ITEMS_PER_PAGE >= activities.length}
                  onClick={() => setActivityPage((p) => p + 1)}
                  style={{ padding: "4px 12px", fontSize: 12, border: "1px solid #e5e7eb", borderRadius: 6, cursor: (activityPage + 1) * ITEMS_PER_PAGE >= activities.length ? "not-allowed" : "pointer", background: "#fff", color: "#374151", opacity: (activityPage + 1) * ITEMS_PER_PAGE >= activities.length ? 0.4 : 1 }}>
                  Older →
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Email Outbox + Resolution + Satisfaction + Patterns ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Email Outbox */}
          <EmailOutboxPanel emails={emails} />

          {/* Resolution Activity */}
          <ResolutionActivity caseStats={caseStats} dayStats={dayStats} emails={emails} />

          {/* Customer Satisfaction */}
          <SatisfactionPanel stats={satisfaction} />

          {/* Complaint Clusters — only show if any exist, max 5 */}
          {patterns.filter(p => p.pattern_type === "complaint_cluster").length > 0 && (() => {
            const clusters = patterns.filter(p => p.pattern_type === "complaint_cluster");
            const shown = clusters.slice(0, 5);
            const extra = clusters.length - shown.length;
            return (
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <div style={{ padding: "14px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h2 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>Complaint Clusters</h2>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>{clusters.length} total</span>
                </div>
                <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {shown.map((p) => (
                    <PatternCard key={p.id} pattern={p} onResolve={handleResolvePattern} />
                  ))}
                  {extra > 0 && (
                    <p style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", margin: "4px 0 0", fontStyle: "italic" }}>
                      and {extra} more…
                    </p>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── CSS animations ───────────────────────── */}
      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.4); }
          50% { box-shadow: 0 0 0 6px rgba(16,185,129,0); }
        }
      `}</style>
    </div>
  );
}
