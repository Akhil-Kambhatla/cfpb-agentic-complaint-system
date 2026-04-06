"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain } from "lucide-react";

const tabs = [
  { href: "/about", label: "About" },
  { href: "/analyze", label: "Analyze" },
  { href: "/evaluation", label: "Evaluation" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        borderBottom: "1px solid #e5e7eb",
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(12px)",
        height: "56px",
        display: "flex",
        alignItems: "center",
      }}
    >
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          width: "100%",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "rgba(16,185,129,0.1)",
              border: "1px solid rgba(16,185,129,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Brain style={{ width: 16, height: 16, color: "#059669" }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>
              CFPB Complaint Intelligence System
            </p>
            <p style={{ fontSize: 10, color: "#6b7280", lineHeight: 1.2 }}>
              Multi-Agent Complaint Intelligence with Bayesian Risk Assessment
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {tabs.map(({ href, label }) => {
            const active = pathname === href || (href === "/about" && pathname === "/");
            return (
              <Link key={href} href={href} style={{ textDecoration: "none" }}>
                <div
                  style={{
                    padding: "6px 16px",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                    color: active ? "#111827" : "#4b5563",
                    background: active ? "#f3f4f6" : "transparent",
                    border: active ? "1px solid #e5e7eb" : "1px solid transparent",
                    transition: "all 0.15s ease",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = "#f9fafb";
                      e.currentTarget.style.color = "#111827";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "#4b5563";
                    }
                  }}
                >
                  {label}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
