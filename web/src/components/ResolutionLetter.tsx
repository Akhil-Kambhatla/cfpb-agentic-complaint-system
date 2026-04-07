"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Mail, Copy, Check, Send, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  letter: string;
}

function EmailModal({ onClose, letter }: { onClose: () => void; letter: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSend = () => {
    if (!email.trim()) return;
    setSent(true);
    setTimeout(onClose, 2200);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.35)", display: "flex",
        alignItems: "center", justifyContent: "center", padding: 24,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        style={{
          background: "#fff", borderRadius: 16,
          border: "1px solid #e5e7eb", boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          padding: "24px 28px", width: "100%", maxWidth: 440,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Mail style={{ width: 16, height: 16, color: "#0ea5e9" }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Send Response Letter</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X style={{ width: 16, height: 16, color: "#9ca3af" }} />
          </button>
        </div>

        {sent ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%", background: "#d1fae5",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px"
            }}>
              <Check style={{ width: 24, height: 24, color: "#059669" }} />
            </div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#059669", margin: "0 0 4px" }}>
              Email queued for delivery ✓
            </p>
            <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>
              Demo mode — delivery simulated. In production, this would send via your configured email provider.
            </p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 12, color: "#4b5563", margin: "0 0 16px", lineHeight: 1.6 }}>
              Enter the consumer&apos;s email address to send the AI-drafted response letter. A human compliance reviewer should verify the content before sending.
            </p>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                Recipient email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="consumer@example.com"
                style={{
                  width: "100%", padding: "8px 12px", borderRadius: 8,
                  border: "1px solid #d1d5db", fontSize: 13, outline: "none",
                  boxSizing: "border-box",
                }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
              />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleSend}
                disabled={!email.trim()}
                style={{
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "9px 16px", borderRadius: 8, border: "none",
                  background: email.trim() ? "#0ea5e9" : "#e5e7eb",
                  color: email.trim() ? "#fff" : "#9ca3af",
                  fontSize: 13, fontWeight: 600, cursor: email.trim() ? "pointer" : "not-allowed",
                }}
              >
                <Send style={{ width: 13, height: 13 }} />
                Send Letter
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: "9px 16px", borderRadius: 8,
                  border: "1px solid #e5e7eb", background: "#fff",
                  fontSize: 13, color: "#374151", cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
            <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 10 }}>
              Demo mode — email delivery is simulated. No actual email will be sent.
            </p>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function ResolutionLetter({ letter }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(letter);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
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
                {/* Action buttons */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "8px 0 4px" }}>
                  <button
                    onClick={() => setEmailOpen(true)}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "5px 10px", borderRadius: 7, fontSize: 11,
                      border: "1px solid #bae6fd", background: "#f0f9ff", cursor: "pointer",
                      color: "#0369a1",
                    }}
                  >
                    <Send style={{ width: 12, height: 12 }} />
                    Send via Email
                  </button>
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

      <AnimatePresence>
        {emailOpen && <EmailModal onClose={() => setEmailOpen(false)} letter={letter} />}
      </AnimatePresence>
    </>
  );
}
