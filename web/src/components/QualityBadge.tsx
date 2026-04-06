import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";

interface Props {
  flag: "pass" | "review" | "fail";
  size?: "sm" | "lg";
}

const CONFIG = {
  pass:   { label: "Pass",   Icon: CheckCircle2, bg: "#d1fae5", text: "#047857", border: "#6ee7b7" },
  review: { label: "Review", Icon: AlertCircle,  bg: "#fef9c3", text: "#854d0e", border: "#fde047" },
  fail:   { label: "Fail",   Icon: XCircle,      bg: "#fee2e2", text: "#b91c1c", border: "#fca5a5" },
};

export default function QualityBadge({ flag, size = "sm" }: Props) {
  const { label, Icon, bg, text, border } = CONFIG[flag] ?? CONFIG.review;
  const pad = size === "lg" ? "6px 14px" : "3px 10px";
  const fs = size === "lg" ? 14 : 11;
  const iconSz = size === "lg" ? 15 : 12;

  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: pad, borderRadius: 9999,
        background: bg, color: text,
        border: `1px solid ${border}`,
        fontSize: fs, fontWeight: 700,
      }}
    >
      <Icon style={{ width: iconSz, height: iconSz }} />
      {label}
    </span>
  );
}
