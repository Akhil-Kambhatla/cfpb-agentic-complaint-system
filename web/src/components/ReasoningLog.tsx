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
  System:         "#64748b",
  classifier:     "#38bdf8",
  causal_analyst: "#a78bfa",
  router:         "#fb923c",
  resolution:     "#34d399",
  quality_check:  "#f472b6",
};

const TYPE_COLORS: Record<string, string> = {
  info:    "#94a3b8",
  success: "#6ee7b7",
  warning: "#fbbf24",
  error:   "#fca5a5",
};

export default function ReasoningLog({ entries, totalTime }: Props) {
  const [open, setOpen] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [entries, open]);

  return (
    <div
      style={{
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(5,5,5,0.85)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Terminal style={{ width: 14, height: 14, color: "#64748b" }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8", fontFamily: "monospace" }}>
            Agent Reasoning Log
          </span>
          <span
            style={{
              fontSize: 10,
              color: "#334155",
              fontFamily: "monospace",
              padding: "1px 6px",
              borderRadius: 4,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {entries.length} events
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {totalTime && (
            <span style={{ fontSize: 10, color: "#10b981", fontFamily: "monospace" }}>
              {totalTime}s total
            </span>
          )}
          {open ? (
            <ChevronUp style={{ width: 14, height: 14, color: "#475569" }} />
          ) : (
            <ChevronDown style={{ width: 14, height: 14, color: "#475569" }} />
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
            <div
              style={{
                borderTop: "1px solid rgba(255,255,255,0.06)",
                maxHeight: "220px",
                overflowY: "auto",
                padding: "8px 0",
                fontFamily: "monospace",
                fontSize: 11,
              }}
            >
              {entries.map((entry, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    display: "flex",
                    gap: 8,
                    padding: "2px 16px",
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ color: "#334155", flexShrink: 0 }}>{entry.timestamp}</span>
                  <span
                    style={{
                      color: AGENT_COLORS[entry.agent] ?? "#64748b",
                      flexShrink: 0,
                      minWidth: 90,
                    }}
                  >
                    {entry.agent}
                  </span>
                  <span style={{ color: TYPE_COLORS[entry.type] ?? "#94a3b8" }}>
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
