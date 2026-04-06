"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Terminal } from "lucide-react";
import type { LogEntry } from "@/contexts/AnalysisContext";

interface Props {
  entries: LogEntry[];
  totalTime?: number | null;
}

const AGENT_COLORS: Record<string, string> = {
  System:        "#9ca3af",
  classifier:    "#0ea5e9",
  risk_analyzer: "#8b5cf6",
  event_chain:   "#a855f7",
  router:        "#f97316",
  resolution:    "#10b981",
  quality_check: "#ec4899",
};

const TYPE_COLORS: Record<string, string> = {
  info:    "#6b7280",
  success: "#059669",
  warning: "#d97706",
  error:   "#dc2626",
};

export default function ReasoningLog({ entries, totalTime }: Props) {
  const [open, setOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [entries, open]);

  return (
    <div style={{
      borderRadius: 12,
      border: "1px solid #e5e7eb",
      background: "#fafafa",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 16px", background: "transparent", border: "none", cursor: "pointer",
          borderBottom: open ? "1px solid #e5e7eb" : "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Terminal style={{ width: 14, height: 14, color: "#9ca3af" }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", fontFamily: "monospace" }}>
            Agent Reasoning Log
          </span>
          <span style={{
            fontSize: 10, color: "#9ca3af",
            padding: "1px 6px", borderRadius: 4,
            background: "#f3f4f6", border: "1px solid #e5e7eb",
          }}>
            {entries.length} events
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {totalTime && (
            <span style={{ fontSize: 11, color: "#059669", fontFamily: "monospace" }}>
              {totalTime}s total
            </span>
          )}
          {open ? (
            <ChevronUp style={{ width: 14, height: 14, color: "#9ca3af" }} />
          ) : (
            <ChevronDown style={{ width: 14, height: 14, color: "#9ca3af" }} />
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              maxHeight: "220px", overflowY: "auto",
              padding: "8px 0", fontFamily: "monospace", fontSize: 11,
              background: "#fafafa",
            }}>
              {entries.map((entry, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.12 }}
                  style={{ display: "flex", gap: 10, padding: "2px 16px", lineHeight: 1.6 }}
                >
                  <span style={{ color: "#d1d5db", flexShrink: 0 }}>{entry.timestamp}</span>
                  <span style={{ color: AGENT_COLORS[entry.agent] ?? "#9ca3af", flexShrink: 0, minWidth: 100 }}>
                    {entry.agent}
                  </span>
                  <span style={{ color: TYPE_COLORS[entry.type] ?? "#6b7280" }}>
                    {entry.message}
                  </span>
                </motion.div>
              ))}
              <div ref={bottomRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
