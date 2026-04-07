"use client";

import { useState, useRef } from "react";

interface Props {
  text: string;
}

export default function InfoTooltip({ text }: Props) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  return (
    <span
      ref={ref}
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
          position: "absolute",
          bottom: "calc(100% + 8px)",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 9999,
          width: 300,
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 10,
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          padding: "10px 12px",
          fontSize: 11,
          color: "#374151",
          lineHeight: 1.6,
          whiteSpace: "normal",
          pointerEvents: "none",
        }}>
          {text}
          {/* Arrow */}
          <span style={{
            position: "absolute",
            top: "100%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 0, height: 0,
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderTop: "6px solid #e5e7eb",
          }} />
          <span style={{
            position: "absolute",
            top: "calc(100% - 1px)",
            left: "50%",
            transform: "translateX(-50%)",
            width: 0, height: 0,
            borderLeft: "5px solid transparent",
            borderRight: "5px solid transparent",
            borderTop: "5px solid #ffffff",
          }} />
        </span>
      )}
    </span>
  );
}
