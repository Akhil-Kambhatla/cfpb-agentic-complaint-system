"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  text: string;
}

export default function InfoTooltip({ text }: Props) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ top: boolean; left: boolean }>({ top: true, left: false });
  const iconRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!visible || !iconRef.current) return;
    const rect = iconRef.current.getBoundingClientRect();
    const spaceRight = window.innerWidth - rect.right;
    const spaceTop = rect.top;
    setPosition({
      top: spaceTop > 120,
      left: spaceRight < 320,
    });
  }, [visible]);

  return (
    <span
      ref={iconRef}
      style={{ position: "relative", display: "inline-flex", alignItems: "center", verticalAlign: "middle" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {/* ℹ icon */}
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 14, height: 14, borderRadius: "50%",
        border: "1px solid #d1d5db", background: "#f9fafb",
        fontSize: 9, fontWeight: 700, color: "#9ca3af",
        cursor: "default", marginLeft: 4, flexShrink: 0,
        userSelect: "none",
      }}>
        ℹ
      </span>

      {/* Tooltip card */}
      {visible && (
        <span style={{
          position: "fixed",
          zIndex: 9999,
          width: 360,
          maxWidth: "calc(100vw - 32px)",
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
          padding: "10px 14px",
          fontSize: 11,
          color: "#374151",
          lineHeight: 1.65,
          whiteSpace: "normal",
          overflowWrap: "break-word",
          pointerEvents: "none",
          // Position relative to the viewport using getBoundingClientRect
          top: (() => {
            if (!iconRef.current) return 0;
            const r = iconRef.current.getBoundingClientRect();
            return position.top ? r.top - 8 : r.bottom + 8;
          })(),
          left: (() => {
            if (!iconRef.current) return 0;
            const r = iconRef.current.getBoundingClientRect();
            return position.left ? r.right - 360 : r.left - 8;
          })(),
          transform: position.top ? "translateY(-100%)" : "translateY(0)",
        }}>
          {text}
        </span>
      )}
    </span>
  );
}
