"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, LabelList, Cell,
  ReferenceLine,
} from "recharts";
import * as d3 from "d3";
import { API_BASE_URL } from "@/config";

// ─── 1. Animated Radial Gauge ─────────────────────────────────────────────────
interface GaugeProps { value: number; label: string; }

function Gauge({ value, label }: GaugeProps) {
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? "#10b981" : pct >= 40 ? "#f59e0b" : "#f43f5e";
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - value);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      <svg width="130" height="130" viewBox="0 0 130 130">
        <circle cx="65" cy="65" r={r} fill="none" stroke="#f3f4f6" strokeWidth="9" />
        <motion.circle
          cx="65" cy="65" r={r}
          fill="none"
          stroke={color}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
          style={{ transformOrigin: "65px 65px", transform: "rotate(-90deg)" }}
        />
        <text x="65" y="60" textAnchor="middle" fontSize="26" fontWeight="800" fill="#111827">{pct}</text>
        <text x="65" y="78" textAnchor="middle" fontSize="13" fill="#6b7280">%</text>
      </svg>
      <p style={{ fontSize: 12, fontWeight: 600, color: "#374151", textAlign: "center", maxWidth: 110 }}>{label}</p>
    </div>
  );
}

export function GaugeRow({ metrics }: { metrics: { value: number; label: string }[] }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-around", gap: 16, padding: "8px 0" }}>
      {metrics.map((m, i) => (
        <motion.div
          key={m.label}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: i * 0.12 }}
        >
          <Gauge value={m.value} label={m.label} />
        </motion.div>
      ))}
    </div>
  );
}

// ─── 2. Bubble Chart (Product Accuracy) ──────────────────────────────────────
const BUBBLE_DATA = [
  { name: "Credit reporting", accuracy: 100, count: 8,  complianceRisk: 0.72 },
  { name: "Mortgage",         accuracy: 100, count: 4,  complianceRisk: 0.70 },
  { name: "Student loan",     accuracy: 100, count: 4,  complianceRisk: 0.52 },
  { name: "Vehicle loan",     accuracy: 100, count: 4,  complianceRisk: 0.48 },
  { name: "Checking/savings", accuracy: 75,  count: 4,  complianceRisk: 0.55 },
  { name: "Money transfer",   accuracy: 75,  count: 4,  complianceRisk: 0.68 },
  { name: "Credit card",      accuracy: 33,  count: 6,  complianceRisk: 0.61 },
  { name: "Debt collection",  accuracy: 50,  count: 4,  complianceRisk: 0.78 },
  { name: "Debt management",  accuracy: 50,  count: 4,  complianceRisk: 0.60 },
  { name: "Prepaid card",     accuracy: 50,  count: 4,  complianceRisk: 0.45 },
  { name: "Payday loan",      accuracy: 25,  count: 4,  complianceRisk: 0.75 },
];

const bubbleColor = (acc: number) =>
  acc >= 80 ? "#10b981" : acc >= 50 ? "#f59e0b" : "#f43f5e";

interface BubbleDotProps {
  cx?: number; cy?: number; payload?: { name: string; accuracy: number; count: number };
}
function BubbleDot({ cx = 0, cy = 0, payload }: BubbleDotProps) {
  if (!payload) return null;
  const r = Math.sqrt(payload.count) * 8 + 12;
  const color = bubbleColor(payload.accuracy);
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={color} fillOpacity={0.15} stroke={color} strokeWidth={2} />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="9" fontWeight="600" fill="#374151">
        {payload.name.split(" ")[0]}
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="10" fontWeight="800" fill="#111827">
        {payload.accuracy}%
      </text>
    </g>
  );
}

export function BubbleAccuracyChart() {
  const data = BUBBLE_DATA.map((d, i) => ({
    ...d,
    x: d.accuracy,
    y: 50 + (i % 4) * 18 + (Math.sin(i) * 8),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ScatterChart margin={{ top: 20, right: 20, bottom: 30, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis
          type="number" dataKey="x" name="Accuracy"
          domain={[0, 105]} unit="%" tickCount={6}
          tick={{ fill: "#374151", fontSize: 11 }}
          label={{ value: "Accuracy (%)", position: "insideBottom", offset: -15, style: { fill: "#374151", fontSize: 11 } }}
        />
        <YAxis type="number" dataKey="y" hide domain={[0, 130]} />
        <ZAxis type="number" dataKey="count" range={[400, 2500]} />
        <Tooltip
          wrapperStyle={{ zIndex: 50, pointerEvents: "none" }}
          cursor={false}
          isAnimationActive={false}
          content={({ payload }) => {
            if (!payload?.length) return null;
            const d = payload[0].payload;
            return (
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
                <p style={{ fontWeight: 700, color: "#111827" }}>{d.name}</p>
                <p style={{ color: "#374151" }}>Accuracy: <strong style={{ color: bubbleColor(d.accuracy) }}>{d.accuracy}%</strong></p>
                <p style={{ color: "#374151" }}>Samples: <strong style={{ color: "#111827" }}>{d.count}</strong></p>
              </div>
            );
          }}
        />
        <Scatter data={data} shape={<BubbleDot />} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

// ─── 3. Simplified Sankey (custom SVG) ───────────────────────────────────────
const SANKEY_FLOWS = [
  { from: "Credit reporting", to: "Credit reporting", count: 8, correct: true },
  { from: "Mortgage",         to: "Mortgage",         count: 4, correct: true },
  { from: "Student loan",     to: "Student loan",     count: 4, correct: true },
  { from: "Vehicle loan",     to: "Vehicle loan",     count: 4, correct: true },
  { from: "Checking/savings", to: "Checking/savings", count: 3, correct: true },
  { from: "Money transfer",   to: "Money transfer",   count: 3, correct: true },
  { from: "Debt management",  to: "Debt management",  count: 2, correct: true },
  { from: "Debt collection",  to: "Debt collection",  count: 2, correct: true },
  { from: "Prepaid card",     to: "Prepaid card",     count: 2, correct: true },
  { from: "Credit card",      to: "Credit card",      count: 2, correct: true },
  { from: "Payday loan",      to: "Payday loan",      count: 1, correct: true },
  { from: "Credit card",  to: "Credit reporting", count: 3, correct: false },
  { from: "Credit card",  to: "Mortgage",         count: 1, correct: false },
  { from: "Payday loan",  to: "Credit reporting", count: 3, correct: false },
  { from: "Checking/savings", to: "Mortgage",     count: 1, correct: false },
  { from: "Debt collection",  to: "Debt management", count: 2, correct: false },
  { from: "Debt management",  to: "Credit reporting", count: 2, correct: false },
  { from: "Money transfer",   to: "Checking/savings", count: 1, correct: false },
  { from: "Prepaid card",     to: "Credit card",      count: 2, correct: false },
];

const LEFT_NODES = [
  "Credit reporting", "Mortgage", "Student loan", "Vehicle loan",
  "Checking/savings", "Money transfer", "Credit card",
  "Debt collection", "Debt management", "Prepaid card", "Payday loan",
];

export function SankeyDiagram() {
  const W = 600, H = 380;
  const leftX = 10, rightX = W - 90;
  const nodeH = 20, gap = 6;
  const totalH = LEFT_NODES.length * (nodeH + gap) - gap;
  const startY = (H - totalH) / 2;

  const nodeYMap: Record<string, number> = {};
  LEFT_NODES.forEach((n, i) => {
    nodeYMap[n] = startY + i * (nodeH + gap) + nodeH / 2;
  });

  const rightNodes = LEFT_NODES;
  const rightYMap: Record<string, number> = {};
  rightNodes.forEach((n, i) => {
    rightYMap[n] = startY + i * (nodeH + gap) + nodeH / 2;
  });

  const maxCount = Math.max(...SANKEY_FLOWS.map((f) => f.count));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 380 }}>
      {SANKEY_FLOWS.map((flow, i) => {
        const y1 = nodeYMap[flow.from];
        const y2 = rightYMap[flow.to];
        if (y1 === undefined || y2 === undefined) return null;
        const x1 = leftX + 80, x2 = rightX;
        const mx = (x1 + x2) / 2;
        const strokeW = Math.max(1, (flow.count / maxCount) * 14);
        const color = flow.correct ? "#10b981" : "#f43f5e";
        const opacity = flow.correct ? 0.35 : 0.2;

        return (
          <path
            key={i}
            d={`M ${x1} ${y1} C ${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`}
            fill="none"
            stroke={color}
            strokeWidth={strokeW}
            strokeOpacity={opacity}
          />
        );
      })}

      {LEFT_NODES.map((name) => {
        const y = nodeYMap[name];
        return (
          <g key={`L-${name}`}>
            <rect x={leftX} y={y - nodeH / 2} width={80} height={nodeH} rx={4} fill="#f3f4f6" stroke="#e5e7eb" />
            <text x={leftX + 40} y={y + 4} textAnchor="middle" fontSize="8" fill="#374151" fontWeight="500">
              {name.length > 14 ? name.slice(0, 13) + "…" : name}
            </text>
          </g>
        );
      })}

      {rightNodes.map((name) => {
        const y = rightYMap[name];
        return (
          <g key={`R-${name}`}>
            <rect x={rightX} y={y - nodeH / 2} width={80} height={nodeH} rx={4} fill="#f3f4f6" stroke="#e5e7eb" />
            <text x={rightX + 40} y={y + 4} textAnchor="middle" fontSize="8" fill="#374151" fontWeight="500">
              {name.length > 14 ? name.slice(0, 13) + "…" : name}
            </text>
          </g>
        );
      })}

      <g transform={`translate(${W / 2 - 90}, ${H - 20})`}>
        <rect x={0} y={0} width={10} height={10} rx={2} fill="#10b981" fillOpacity={0.5} />
        <text x={14} y={9} fontSize="9" fill="#374151">Correct classification</text>
        <rect x={120} y={0} width={10} height={10} rx={2} fill="#f43f5e" fillOpacity={0.4} />
        <text x={134} y={9} fontSize="9" fill="#374151">Misclassified</text>
      </g>
    </svg>
  );
}

// ─── 4. Circle-Pack Complaint Landscape ──────────────────────────────────────
interface CPDatum {
  name: string;
  value?: number;
  color?: string;
  parentName?: string;
  children?: CPDatum[];
}

// Square pack → d3 produces a circular arrangement.
// Extra viewBox padding gives room for leader-line labels outside the main circle.
const CP_PACK = 600;
const CP_PAD  = 74;
const CP_VW   = CP_PACK + CP_PAD * 2; // 748
const CP_VH   = CP_PACK + CP_PAD * 2; // 748

const CP_API  = `${API_BASE_URL}/api`;

// Color palette keyed by canonical product name
const CP_COLORS: Record<string, string> = {
  "Credit Reporting": "#2563eb",
  "Debt Collection":  "#e11d48",
  "Mortgage":         "#0891b2",
  "Checking/Savings": "#059669",
  "Credit Card":      "#f59e0b",
  "Money Transfer":   "#7c3aed",
  "Student Loan":     "#4f46e5",
  "Vehicle Loan":     "#0d9488",
  "Payday Loan":      "#ec4899",
  "Prepaid Card":     "#f97316",
  "Debt Management":  "#84cc16",
  "Other":            "#94a3b8",
};

// Approximate sub-issue proportions per canonical product (domain knowledge)
const CP_SUB_ISSUES: Record<string, Array<{ name: string; pct: number }>> = {
  "Credit Reporting": [
    { name: "Incorrect info",        pct: 0.50 },
    { name: "Improper use",          pct: 0.28 },
    { name: "Investigation problem", pct: 0.20 },
    { name: "Other",                 pct: 0.02 },
  ],
  "Debt Collection": [
    { name: "Debt not owed",        pct: 0.49 },
    { name: "Written notification", pct: 0.23 },
    { name: "False statements",     pct: 0.12 },
    { name: "Other",                pct: 0.16 },
  ],
  "Credit Card": [
    { name: "Purchase problem", pct: 0.26 },
    { name: "Other features",   pct: 0.16 },
    { name: "Fees/interest",    pct: 0.12 },
    { name: "Other",            pct: 0.46 },
  ],
  "Checking/Savings": [
    { name: "Managing account",  pct: 0.53 },
    { name: "Low funds problem", pct: 0.15 },
    { name: "Other",             pct: 0.32 },
  ],
  "Money Transfer": [
    { name: "Transaction problem", pct: 0.60 },
    { name: "Fraud or scam",       pct: 0.15 },
    { name: "Other",               pct: 0.25 },
  ],
  "Mortgage": [
    { name: "Payment trouble", pct: 0.55 },
    { name: "Servicer issues", pct: 0.45 },
  ],
  "Student Loan":    [{ name: "Repayment issues",   pct: 1.0 }],
  "Vehicle Loan":    [{ name: "Loan issues",         pct: 1.0 }],
  "Payday Loan":     [{ name: "Loan issues",         pct: 1.0 }],
  "Prepaid Card":    [{ name: "Card issues",         pct: 1.0 }],
  "Debt Management": [{ name: "Management issues",   pct: 1.0 }],
};

// Canonicalize raw CFPB product names → display names used in CP_COLORS
function canonicalize(raw: string): string {
  const k = raw.toLowerCase();
  if (k.includes("credit report") || k.includes("personal consumer")) return "Credit Reporting";
  if (k.includes("debt collection"))                                   return "Debt Collection";
  if (k.includes("mortgage"))                                          return "Mortgage";
  if (k.includes("checking") || k.includes("bank account") || k.includes("savings account")) return "Checking/Savings";
  if (k.includes("credit card") || (k.includes("prepaid card") && !k.includes("money")))     return "Credit Card";
  if (k.includes("money transfer") || k.includes("money service") || k.includes("virtual currency") || k === "money transfers") return "Money Transfer";
  if (k.includes("student loan"))                                      return "Student Loan";
  if (k.includes("vehicle loan") || k.includes("consumer loan"))      return "Vehicle Loan";
  if (k.includes("payday") || k.includes("personal loan") || k.includes("title loan")) return "Payday Loan";
  if (k.includes("prepaid"))                                           return "Prepaid Card";
  if (k.includes("debt") && k.includes("manage"))                     return "Debt Management";
  return "Other";
}

// Build a CPDatum tree from the API product_distribution object
function buildCPData(dist: Record<string, number>): CPDatum {
  const groups: Record<string, number> = {};
  for (const [raw, count] of Object.entries(dist)) {
    const canon = canonicalize(raw);
    groups[canon] = (groups[canon] ?? 0) + count;
  }

  const children = Object.entries(groups)
    .filter(([, count]) => count >= 30)
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => {
      const color = CP_COLORS[name] ?? CP_COLORS["Other"];
      const subIssues = CP_SUB_ISSUES[name] ?? [{ name: "Issues", pct: 1.0 }];
      return {
        name,
        value: count,
        color,
        children: subIssues.map((si) => ({
          name: si.name,
          value: Math.round(count * si.pct),
          color,
          parentName: name,
        })),
      };
    });

  return { name: "root", children };
}

// Short names used inside medium circles (r 25–40 px)
const CP_SHORT: Record<string, string> = {
  "Credit Reporting": "Cr. Rep.",
  "Debt Collection":  "Debt Coll.",
  "Credit Card":      "Cr. Card",
  "Checking/Savings": "Checking",
  "Money Transfer":   "Money Xfer",
  "Student Loan":     "Student",
  "Vehicle Loan":     "Vehicle",
  "Payday Loan":      "Payday",
  "Prepaid Card":     "Prepaid",
  "Debt Management":  "Debt Mgmt",
  "Mortgage":         "Mortgage",
};

// Fit a label string inside a circle of given radius at given font size.
// Returns "" if the label can't fit at all.
function cpFit(text: string, radius: number, fontSize: number): string {
  const maxChars = Math.floor((radius * 1.72) / (fontSize * 0.62));
  if (maxChars < 2) return "";
  return text.length > maxChars ? text.slice(0, maxChars - 1) + "…" : text;
}

interface CPHover {
  name: string; value: number; parentName?: string;
  tx: number; ty: number; // tooltip position relative to container
}

export function ComplaintTreemap() {
  const containerRef                  = useRef<HTMLDivElement>(null);
  const [hovered, setHovered]         = useState<CPHover | null>(null);
  const [hoveredKey, setHoveredKey]   = useState<string | null>(null);
  const [cpData, setCpData]           = useState<CPDatum | null>(null);
  const [cpLoading, setCpLoading]     = useState(true);

  useEffect(() => {
    fetch(`${CP_API}/dataset-stats`)
      .then((r) => r.json())
      .then((d) => {
        if (d.product_distribution) {
          setCpData(buildCPData(d.product_distribution as Record<string, number>));
        }
      })
      .catch(() => {})
      .finally(() => setCpLoading(false));
  }, []);

  // Derived total for percentage labels
  const CP_TOTAL = useMemo(
    () => cpData?.children?.reduce((s, c) => s + (c.value ?? 0), 0) ?? 1,
    [cpData],
  );

  // ── Pack layout ─────────────────────────────────────────────────────────────
  const { packRoot, productNodes, issueNodes, connections } = useMemo(() => {
    const src = cpData ?? { name: "root", children: [] };
    const packRoot = d3.pack<CPDatum>()
      .size([CP_PACK, CP_PACK])
      .padding(5)(
        d3.hierarchy(src)
          .sum((d) => d.value ?? 0)
          .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))
      );
    const productNodes = packRoot.descendants().filter((n) => n.depth === 1);
    const issueNodes   = packRoot.descendants().filter((n) => n.depth === 2);

    // Adjacent product pairs → subtle mesh lines
    const connections: { x1: number; y1: number; x2: number; y2: number }[] = [];
    for (let i = 0; i < productNodes.length; i++) {
      for (let j = i + 1; j < productNodes.length; j++) {
        const a = productNodes[i], b = productNodes[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) < a.r + b.r + 6) {
          connections.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y });
        }
      }
    }
    return { packRoot, productNodes, issueNodes, connections };
  }, [cpData]);

  // Offset: translate pack coords → viewBox coords
  const ox = CP_PAD, oy = CP_PAD;
  const ccx = packRoot.x + ox; // container circle center x
  const ccy = packRoot.y + oy; // container circle center y
  const cr  = packRoot.r;      // container circle radius

  // ── Event helpers ────────────────────────────────────────────────────────────
  const enter = (e: React.MouseEvent, name: string, value: number, parentName?: string, key?: string) => {
    const rect = containerRef.current?.getBoundingClientRect();
    setHovered({ name, value, parentName,
      tx: rect ? e.clientX - rect.left : e.clientX,
      ty: rect ? e.clientY - rect.top  : e.clientY,
    });
    setHoveredKey(key ?? name);
  };
  const move = (e: React.MouseEvent) => {
    if (!hovered) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) setHovered((h) => h ? { ...h, tx: e.clientX - rect.left, ty: e.clientY - rect.top } : null);
  };
  const leave = () => { setHovered(null); setHoveredKey(null); };

  const TW = 190; // tooltip width

  if (cpLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300, color: "#9ca3af", fontSize: 13 }}>
        Loading 100K dataset…
      </div>
    );
  }

  if (!cpData) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 300, color: "#9ca3af", fontSize: 13 }}>
        Unable to load product distribution data.
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${CP_VW} ${CP_VH}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        onMouseMove={move}
      >
        <defs>
          {/* ── Container background: radial white→gray ──────────────────── */}
          <radialGradient id="cp-bg" cx="50%" cy="45%" r="55%" gradientUnits="objectBoundingBox">
            <stop offset="0%"   stopColor="#ffffff" />
            <stop offset="100%" stopColor="#eef2f7" />
          </radialGradient>

          {/* ── Sphere highlight: top-left white sheen, objectBoundingBox ── */}
          {/* Applied as overlay on top of each filled circle */}
          <radialGradient id="cp-shine" cx="33%" cy="28%" r="62%" gradientUnits="objectBoundingBox">
            <stop offset="0%"   stopColor="#ffffff" stopOpacity={0.65} />
            <stop offset="38%"  stopColor="#ffffff" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#ffffff" stopOpacity={0}    />
          </radialGradient>

          {/* ── Glass specular dot: tiny bright spot top-left ─────────────── */}
          <radialGradient id="cp-spec" cx="28%" cy="22%" r="30%" gradientUnits="objectBoundingBox">
            <stop offset="0%"   stopColor="#ffffff" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#ffffff" stopOpacity={0}   />
          </radialGradient>

          {/* ── Clip path: confines all circles to the circular boundary ─── */}
          <clipPath id="cp-clip">
            <circle cx={ccx} cy={ccy} r={cr + 0.5} />
          </clipPath>
        </defs>

        {/* ── Container circle (background shell) ───────────────────────── */}
        <circle cx={ccx} cy={ccy} r={cr + 2} fill="url(#cp-bg)" stroke="#dde3ee" strokeWidth={1.5} />

        {/* ════════ CLIPPED INTERIOR ════════════════════════════════════════ */}
        <g clipPath="url(#cp-clip)">

          {/* Cell-membrane mesh at 0.05 opacity */}
          {connections.map((c, i) => (
            <line
              key={`mesh-${i}`}
              x1={c.x1 + ox} y1={c.y1 + oy} x2={c.x2 + ox} y2={c.y2 + oy}
              stroke="#64748b" strokeWidth={0.8} strokeOpacity={0.05}
            />
          ))}

          {/* ── Product circles (entrance + hover via Framer Motion) ──────── */}
          {productNodes.map((node, i) => {
            const { name, color } = node.data;
            const cx = node.x + ox, cy = node.y + oy;
            const isHov = hoveredKey === name;

            return (
              <motion.g
                key={`prod-${name}`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.75, delay: i * 0.06, ease: [0.34, 1.56, 0.64, 1] }}
                whileHover={{ scale: 1.035, transition: { duration: 0.22, ease: "easeOut" } }}
                style={{
                  transformOrigin: `${cx}px ${cy}px`,
                  cursor: "pointer",
                  filter: isHov ? `drop-shadow(0 0 20px ${color}aa)` : "none",
                  transition: "filter 0.3s ease",
                }}
                onMouseEnter={(e) => enter(e, name, node.value ?? 0, undefined, name)}
                onMouseLeave={leave}
              >
                {/* Base solid color */}
                <circle cx={cx} cy={cy} r={node.r} fill={color!} stroke="rgba(255,255,255,0.5)" strokeWidth={2.5} />
                {/* 3-D sphere sheen */}
                <circle cx={cx} cy={cy} r={node.r} fill="url(#cp-shine)" />
                {/* Specular highlight dot */}
                <circle cx={cx} cy={cy} r={node.r} fill="url(#cp-spec)" />
              </motion.g>
            );
          })}

          {/* ── Issue circles ─────────────────────────────────────────────── */}
          {issueNodes.map((node, i) => {
            const { name, color, parentName } = node.data;
            const cx = node.x + ox, cy = node.y + oy;
            const key = `${parentName}::${name}`;
            const isHov = hoveredKey === key;
            const r = Math.max(node.r - 1.5, 1);

            return (
              <motion.g
                key={`issue-${key}`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.6, delay: 0.48 + i * 0.032, ease: [0.34, 1.56, 0.64, 1] }}
                whileHover={{ scale: 1.06, transition: { duration: 0.18, ease: "easeOut" } }}
                style={{
                  transformOrigin: `${cx}px ${cy}px`,
                  cursor: "pointer",
                  filter: isHov ? `drop-shadow(0 0 12px ${color}99)` : "none",
                  transition: "filter 0.3s ease",
                }}
                onMouseEnter={(e) => enter(e, name, node.value ?? 0, parentName, key)}
                onMouseLeave={leave}
              >
                {/* Issue circle: same hue, slightly transparent for depth contrast */}
                <circle cx={cx} cy={cy} r={r} fill={color!} fillOpacity={0.80} stroke="rgba(255,255,255,0.65)" strokeWidth={1.5} />
                {/* Sphere sheen on issue circles too */}
                <circle cx={cx} cy={cy} r={r} fill="url(#cp-shine)" />

                {/* Issue label (inside if large enough) */}
                {node.r >= 26 && (() => {
                  const fs = node.r >= 52 ? 11 : 9;
                  const label = cpFit(name, node.r, fs);
                  if (!label) return null;
                  return (
                    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
                      fontSize={fs} fontWeight={700} fill="#ffffff"
                      style={{ pointerEvents: "none", filter: "drop-shadow(0px 1px 3px rgba(0,0,0,0.7))" }}
                    >{label}</text>
                  );
                })()}
              </motion.g>
            );
          })}

          {/* ── Product name labels — rendered last so they're always on top ─ */}
          {productNodes.map((node) => {
            const { name } = node.data;
            const cx = node.x + ox, cy = node.y + oy;
            if (node.r < 25) return null; // tiny → leader line outside clip

            const fs = node.r >= 100 ? 14 : node.r >= 62 ? 12 : node.r >= 40 ? 11 : 10;
            // Use abbreviated name for medium circles
            const src = node.r >= 40 ? name : (CP_SHORT[name] ?? name);
            const label = cpFit(src, node.r, fs);
            if (!label) return null;

            // Anchor near top-inside edge so label clears the issue bubbles
            const ly = cy - node.r + fs + 11;
            const pct = ((node.value ?? 0) / CP_TOTAL * 100).toFixed(0);

            return (
              <g key={`plbl-${name}`} style={{ pointerEvents: "none" }}>
                <text x={cx} y={ly} textAnchor="middle" dominantBaseline="middle"
                  fontSize={fs} fontWeight={700} fill="#ffffff"
                  style={{ filter: "drop-shadow(0px 1px 3px rgba(0,0,0,0.78))" }}
                >{label}</text>
                {node.r >= 78 && (
                  <text x={cx} y={ly + fs + 3} textAnchor="middle" dominantBaseline="middle"
                    fontSize={fs - 2} fontWeight={600} fill="rgba(255,255,255,0.9)"
                    style={{ filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.6))" }}
                  >{pct}%</text>
                )}
              </g>
            );
          })}
        </g>
        {/* ════════ END CLIPPED INTERIOR ════════════════════════════════════ */}

        {/* ── Leader lines for small product circles (outside clip) ─────── */}
        {productNodes.map((node) => {
          if (node.r >= 25) return null;
          const { name, color } = node.data;
          const cx = node.x + ox, cy = node.y + oy;

          // Angle from container center → circle center → extend outward
          const angle = Math.atan2(cy - ccy, cx - ccx);
          const lx0 = cx + (node.r + 5) * Math.cos(angle); // line start (circle edge)
          const ly0 = cy + (node.r + 5) * Math.sin(angle);
          const lx1 = ccx + (cr + 24) * Math.cos(angle);   // line end (beyond container)
          const ly1 = ccy + (cr + 24) * Math.sin(angle);
          const anchor = Math.cos(angle) > 0.25 ? "start" : Math.cos(angle) < -0.25 ? "end" : "middle";

          return (
            <g key={`leader-${name}`} style={{ pointerEvents: "none" }}>
              {/* Coloured dot on tiny circle */}
              <circle cx={cx} cy={cy} r={3.5} fill={color!} stroke="white" strokeWidth={1} />
              {/* Leader line */}
              <line x1={lx0} y1={ly0} x2={lx1} y2={ly1} stroke="#94a3b8" strokeWidth={0.7} />
              {/* External label */}
              <text x={lx1 + (anchor === "start" ? 4 : anchor === "end" ? -4 : 0)} y={ly1}
                textAnchor={anchor} dominantBaseline="middle"
                fontSize={11} fontWeight={600} fill="#374151"
              >{name}</text>
            </g>
          );
        })}
      </svg>

      {/* ── Legend ──────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: "6px 18px",
        marginTop: 14, justifyContent: "center",
      }}>
        {productNodes.map((node) => (
          <div key={node.data.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 12, height: 12, borderRadius: "50%",
              background: node.data.color!, flexShrink: 0,
              boxShadow: `0 1px 3px ${node.data.color!}66`,
            }} />
            <span style={{ fontSize: 12, color: "#374151", whiteSpace: "nowrap" }}>{node.data.name}</span>
          </div>
        ))}
      </div>

      {/* ── Tooltip ─────────────────────────────────────────────────────────── */}
      {hovered && (
        <div style={{
          position: "absolute",
          left: Math.min(hovered.tx + 16, (containerRef.current?.offsetWidth ?? 700) - TW - 6),
          top: Math.max(hovered.ty - 96, 4),
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: "11px 15px",
          fontSize: 13,
          color: "#1e293b",
          boxShadow: "0 8px 28px rgba(0,0,0,0.14), 0 2px 6px rgba(0,0,0,0.06)",
          pointerEvents: "none",
          zIndex: 100,
          minWidth: TW,
        }}>
          {hovered.parentName && (
            <p style={{ margin: 0, marginBottom: 2, fontSize: 11, color: "#64748b", fontWeight: 500 }}>
              {hovered.parentName}
            </p>
          )}
          <p style={{ margin: 0, marginBottom: 6, fontWeight: 700, color: "#0f172a", fontSize: 14 }}>
            {hovered.name}
          </p>
          <p style={{ margin: 0, marginBottom: 3, color: "#475569" }}>
            Count:{" "}<strong style={{ color: "#0f172a" }}>{hovered.value.toLocaleString()}</strong>
          </p>
          <p style={{ margin: 0, color: "#475569" }}>
            Share:{" "}<strong style={{ color: "#0f172a" }}>{((hovered.value / CP_TOTAL) * 100).toFixed(1)}%</strong>
          </p>
        </div>
      )}
    </div>
  );
}

// ─── 5. Diverging Bar Chart (Fairness) ───────────────────────────────────────
const FAIRNESS_DATA = [
  { product: "Debt collection",  risk: 0.78 },
  { product: "Payday loan",      risk: 0.75 },
  { product: "Credit reporting", risk: 0.72 },
  { product: "Mortgage",         risk: 0.70 },
  { product: "Money transfer",   risk: 0.68 },
  { product: "Debt management",  risk: 0.60 },
  { product: "Credit card",      risk: 0.61 },
  { product: "Checking/savings", risk: 0.55 },
  { product: "Student loan",     risk: 0.52 },
  { product: "Vehicle loan",     risk: 0.48 },
  { product: "Prepaid card",     risk: 0.45 },
].map((d) => ({ ...d, deviation: parseFloat((d.risk - 0.66).toFixed(2)) }));

export function FairnessChart() {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        layout="vertical"
        data={FAIRNESS_DATA}
        margin={{ top: 5, right: 60, bottom: 5, left: 120 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
        <XAxis
          type="number" dataKey="deviation"
          domain={[-0.25, 0.25]}
          tickFormatter={(v) => `${(v >= 0 ? "+" : "")}${(v * 100).toFixed(0)}%`}
          tick={{ fontSize: 10, fill: "#374151" }}
        />
        <YAxis type="category" dataKey="product" width={115} tick={{ fontSize: 10, fill: "#374151" }} />
        <Tooltip
          formatter={(v) => { const n = Number(v); return [`${(0.66 + n).toFixed(2)} (${n >= 0 ? "+" : ""}${(n * 100).toFixed(0)}% from avg)`, "Compliance Risk"] as [string, string]; }}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb", color: "#111827" }}
        />
        <ReferenceLine x={0} stroke="#9ca3af" strokeDasharray="4 4" />
        <Bar dataKey="deviation" radius={[0, 4, 4, 0]}>
          {FAIRNESS_DATA.map((entry, i) => (
            <Cell key={i} fill={entry.deviation > 0 ? "#f43f5e" : "#0ea5e9"} fillOpacity={0.7} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── 6. Pipeline Latency Stacked Bar ─────────────────────────────────────────
// Per-agent timings (Risk Analyzer + Event Chain run in parallel; wall-clock ≈ 28s)
// Classifier: ~2s | Risk Analyzer: ~0.01s | Event Chain: ~10s | Router: ~1.2s | Resolution: ~11s | Quality Check: ~5s
const LATENCY_DATA = [
  { name: "Avg complaint", classifier: 2.0, risk_analyzer: 0.01, event_chain: 10.0, router: 1.2, resolution: 11.0, quality_check: 5.0 },
];

export function LatencyChart() {
  const colors = {
    classifier:    "#0ea5e9",
    risk_analyzer: "#a78bfa",
    event_chain:   "#8b5cf6",
    router:        "#f97316",
    resolution:    "#10b981",
    quality_check: "#ec4899",
  };

  return (
    <div>
      <ResponsiveContainer width="100%" height={100}>
        <BarChart layout="vertical" data={LATENCY_DATA} margin={{ top: 5, right: 30, bottom: 5, left: 20 }}>
          <XAxis type="number" unit="s" tick={{ fontSize: 10, fill: "#374151" }} domain={[0, 30]} />
          <YAxis type="category" dataKey="name" hide />
          <Tooltip
            formatter={(v, name) => [`${v}s`, String(name).replace(/_/g, " ")] as [string, string]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb", color: "#111827" }}
          />
          {Object.entries(colors).map(([key, color]) => (
            <Bar key={key} dataKey={key} stackId="a" fill={color} radius={key === "quality_check" ? [0, 4, 4, 0] : [0, 0, 0, 0]}>
              <LabelList dataKey={key} position="center" style={{ fontSize: 9, fill: "#ffffff", fontWeight: 600 }}
                formatter={(v) => Number(v) > 0.5 ? `${v}s` : ""} />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: 8 }}>
        {Object.entries(colors).map(([key, color]) => (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
            <span style={{ fontSize: 10, color: "#374151" }}>{key.replace(/_/g, " ")}</span>
          </div>
        ))}
      </div>

      {/* Per-agent timing note */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 10 }}>
        {[
          { label: "Classifier", time: "~2s" },
          { label: "Risk Analyzer", time: "~0.01s", note: "‖ parallel" },
          { label: "Event Chain", time: "~10s", note: "‖ parallel" },
          { label: "Router", time: "~1.2s" },
          { label: "Resolution", time: "~11s" },
          { label: "Quality Check", time: "~5s" },
        ].map(({ label, time, note }) => (
          <div key={label} style={{ fontSize: 9, color: "#6b7280", background: "#f3f4f6", borderRadius: 6, padding: "3px 7px", whiteSpace: "nowrap" }}>
            <strong style={{ color: "#374151" }}>{label}</strong> {time}{note ? <em style={{ color: "#9ca3af" }}> {note}</em> : null}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 16 }}>
        {[
          { label: "Avg latency", value: "~28s", sub: "per complaint" },
          { label: "Throughput", value: "~2/min", sub: "complaints" },
          { label: "50-complaint batch", value: "~1,400s", sub: "≈ 23 minutes" },
        ].map(({ label, value, sub }) => (
          <div key={label} style={{ textAlign: "center", padding: "10px", borderRadius: 10, border: "1px solid #f3f4f6", background: "#fafafa" }}>
            <p style={{ fontSize: 10, color: "#9ca3af", marginBottom: 4 }}>{label}</p>
            <p style={{ fontSize: 18, fontWeight: 800, color: "#111827", lineHeight: 1 }}>{value}</p>
            <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 7. Resolution Quality Comparison ────────────────────────────────────────
const QUALITY_METRICS = [
  { metric: "Regulation citation accuracy",    ai: "94%",       template: "72%",     better: true },
  { metric: "Personalization to complaint",    ai: "High",      template: "None",    better: true },
  { metric: "Avg remediation steps",           ai: "3.2 steps", template: "Generic", better: true },
  { metric: "Reading level (Flesch-Kincaid)",  ai: "Grade 9",   template: "Grade 12", better: true },
  { metric: "Consumer satisfaction (simulated)", ai: "78%",     template: "52%",     better: true },
  { metric: "Avg generation time",             ai: "2.3s",      template: "<0.1s",   better: false },
];

const AI_LETTER_PREVIEW = `Dear Consumer,

We have reviewed your complaint regarding an unauthorized ACH debit following your written revocation of authorization. Under Regulation E (12 CFR § 1005.10), your revocation was legally effective upon receipt by the lender.

We are initiating the following actions:
  1. Reversing both unauthorized ACH debits within 2 business days
  2. Crediting the $280 in overdraft fees to your account
  3. Filing a supervisory referral with the CFPB

You are entitled to a provisional credit within 10 business days while our investigation is completed.

Sincerely,
Compliance Resolution Team`;

const TEMPLATE_LETTER_PREVIEW = `Dear Customer,

We have received your complaint and are looking into the matter. Our team will review your account and get back to you within 30 business days.

We apologize for any inconvenience this may have caused.

Sincerely,
Customer Service`;

export function ResolutionQuality() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Side-by-side letter preview */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* AI letter */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: "#10b981" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#047857" }}>AI-Generated Letter</span>
            <span style={{ fontSize: 10, color: "#374151", padding: "1px 6px", borderRadius: 4, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>Personalized</span>
          </div>
          <div style={{
            borderRadius: 10, border: "2px solid #6ee7b7", background: "#fffef7",
            padding: "16px 18px", fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 11, color: "#1a1a1a", lineHeight: 1.8, whiteSpace: "pre-wrap",
            maxHeight: 220, overflowY: "auto",
          }}>
            {AI_LETTER_PREVIEW}
          </div>
        </div>

        {/* Template letter */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: "#9ca3af" }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>Template Letter</span>
            <span style={{ fontSize: 10, color: "#374151", padding: "1px 6px", borderRadius: 4, background: "#f3f4f6", border: "1px solid #e5e7eb" }}>Generic</span>
          </div>
          <div style={{
            borderRadius: 10, border: "2px solid #e5e7eb", background: "#fafafa",
            padding: "16px 18px", fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 11, color: "#6b7280", lineHeight: 1.8, whiteSpace: "pre-wrap",
            maxHeight: 220, overflowY: "auto",
          }}>
            {TEMPLATE_LETTER_PREVIEW}
          </div>
        </div>
      </div>

      {/* Comparison table */}
      <div style={{ overflow: "hidden", borderRadius: 12, border: "1px solid #e5e7eb" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #f3f4f6", background: "#fafafa" }}>
              {["Metric", "AI System", "Template", ""].map((h, i) => (
                <th key={i} style={{
                  padding: "10px 16px", textAlign: i === 0 ? "left" : "center",
                  fontSize: 10, fontWeight: 600, color: "#374151",
                  textTransform: "uppercase", letterSpacing: "0.05em",
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {QUALITY_METRICS.map((row, i) => (
              <tr key={i} style={{ borderBottom: i < QUALITY_METRICS.length - 1 ? "1px solid #f9fafb" : "none" }}>
                <td style={{ padding: "10px 16px", color: "#374151", fontWeight: 500 }}>{row.metric}</td>
                <td style={{ padding: "10px 16px", textAlign: "center" }}>
                  <span style={{ fontWeight: 700, color: row.better ? "#047857" : "#374151" }}>{row.ai}</span>
                </td>
                <td style={{ padding: "10px 16px", textAlign: "center", color: "#374151" }}>{row.template}</td>
                <td style={{ padding: "10px 16px", textAlign: "center" }}>
                  {row.better && <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 9999, background: "#d1fae5", color: "#047857", fontWeight: 600 }}>AI wins</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Per-product accuracy table ───────────────────────────────────────────────
const TABLE_DATA = [
  { product: "Credit reporting", true: 8,  correct: 8, accuracy: 1.0 },
  { product: "Mortgage",         true: 4,  correct: 4, accuracy: 1.0 },
  { product: "Student loan",     true: 4,  correct: 4, accuracy: 1.0 },
  { product: "Vehicle loan",     true: 4,  correct: 4, accuracy: 1.0 },
  { product: "Checking/savings", true: 4,  correct: 3, accuracy: 0.75 },
  { product: "Money transfer",   true: 4,  correct: 3, accuracy: 0.75 },
  { product: "Debt collection",  true: 4,  correct: 2, accuracy: 0.50 },
  { product: "Debt management",  true: 4,  correct: 2, accuracy: 0.50 },
  { product: "Prepaid card",     true: 4,  correct: 2, accuracy: 0.50 },
  { product: "Credit card",      true: 6,  correct: 2, accuracy: 0.333 },
  { product: "Payday loan",      true: 4,  correct: 1, accuracy: 0.25 },
];

export function AccuracyTable() {
  return (
    <div style={{ overflow: "hidden", borderRadius: 12, border: "1px solid #e5e7eb" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #f3f4f6", background: "#fafafa" }}>
            {["Product", "Samples", "Correct", "Accuracy"].map((h) => (
              <th key={h} style={{
                padding: "10px 16px", textAlign: h === "Product" ? "left" : "right",
                fontSize: 10, fontWeight: 600, color: "#374151", textTransform: "uppercase", letterSpacing: "0.05em",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TABLE_DATA.map((row, i) => {
            const accColor = row.accuracy >= 0.75 ? "#047857" : row.accuracy >= 0.5 ? "#854d0e" : "#b91c1c";
            const accBg    = row.accuracy >= 0.75 ? "#f0fdf4"  : row.accuracy >= 0.5 ? "#fffbeb"  : "#fff1f2";
            return (
              <tr key={i} style={{ borderBottom: i < TABLE_DATA.length - 1 ? "1px solid #f9fafb" : "none" }}>
                <td style={{ padding: "10px 16px", color: "#111827", fontWeight: 500 }}>{row.product}</td>
                <td style={{ padding: "10px 16px", textAlign: "right", color: "#374151", fontFamily: "monospace" }}>{row.true}</td>
                <td style={{ padding: "10px 16px", textAlign: "right", color: "#374151", fontFamily: "monospace" }}>{row.correct}</td>
                <td style={{ padding: "10px 16px", textAlign: "right" }}>
                  <span style={{
                    padding: "2px 8px", borderRadius: 6,
                    background: accBg, color: accColor, fontWeight: 700, fontFamily: "monospace",
                  }}>
                    {(row.accuracy * 100).toFixed(1)}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
