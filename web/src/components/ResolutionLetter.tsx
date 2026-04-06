"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Mail, Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  letter: string;
}

export default function ResolutionLetter({ letter }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", background: "transparent", border: "none", cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Mail style={{ width: 15, height: 15, color: "#0ea5e9" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Customer Response Letter</span>
        </div>
        {open ? <ChevronUp style={{ width: 15, height: 15, color: "#9ca3af" }} /> : <ChevronDown style={{ width: 15, height: 15, color: "#9ca3af" }} />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ borderTop: "1px solid #f3f4f6", padding: "0 16px 16px" }}>
              {/* Copy button */}
              <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 0 4px" }}>
                <button
                  onClick={handleCopy}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "5px 10px", borderRadius: 7, fontSize: 11,
                    border: "1px solid #e5e7eb", background: "#fafafa", cursor: "pointer",
                    color: copied ? "#059669" : "#6b7280",
                  }}
                >
                  {copied ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
                  {copied ? "Copied!" : "Copy to clipboard"}
                </button>
              </div>

              {/* Letter */}
              <div style={{
                borderRadius: 10,
                background: "#fffef7",
                border: "1px solid #e5e7eb",
                padding: "24px 28px",
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: 13,
                color: "#1a1a1a",
                lineHeight: 1.8,
                whiteSpace: "pre-wrap",
                boxShadow: "inset 0 1px 4px rgba(0,0,0,0.04)",
              }}>
                {letter}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
