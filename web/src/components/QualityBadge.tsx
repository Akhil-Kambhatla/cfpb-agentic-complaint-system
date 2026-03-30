import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";

interface Props {
  flag: "pass" | "review" | "fail";
  size?: "sm" | "lg";
}

const config = {
  pass: {
    label: "Pass",
    icon: CheckCircle2,
    classes: "bg-emerald-500/20 text-emerald-400 ring-emerald-500/40",
  },
  review: {
    label: "Review",
    icon: AlertCircle,
    classes: "bg-amber-500/20 text-amber-400 ring-amber-500/40",
  },
  fail: {
    label: "Fail",
    icon: XCircle,
    classes: "bg-rose-500/20 text-rose-400 ring-rose-500/40",
  },
};

export default function QualityBadge({ flag, size = "sm" }: Props) {
  const { label, icon: Icon, classes } = config[flag] ?? config.review;
  const sizeClasses = size === "lg" ? "px-4 py-2 text-base" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ${classes} ${sizeClasses}`}
    >
      <Icon className={size === "lg" ? "h-4 w-4" : "h-3 w-3"} />
      {label}
    </span>
  );
}
