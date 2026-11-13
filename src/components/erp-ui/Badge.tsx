import { cn } from "@/lib/cn";

type BadgeTone =
  | "brand"
  | "clay"
  | "success"
  | "neutral"
  | "warning"
  | "violet"
  | "error"
  | "info"
  | "teal"
  | "rose"
  | "indigo"
  | "slate";

const tones: Record<BadgeTone, string> = {
  brand: "bg-brand-50 text-brand-700",
  clay: "bg-clay-100 text-clay-700",
  success: "bg-success-tint text-success",
  neutral: "bg-black/[0.04] text-ink-600",
  warning: "bg-warning-tint text-warning",
  violet: "bg-accent-violet-tint text-accent-violet",
  error: "bg-error-tint text-error",
  info: "bg-info-tint text-info",
  teal: "bg-service-pos-tint text-service-pos",
  // Plan tiers (PlanBadge): hues used nowhere else.
  rose: "bg-plan-starter-tint text-plan-starter",
  indigo: "bg-plan-growth-tint text-plan-growth",
  slate: "bg-plan-enterprise-tint text-plan-enterprise",
};

export function Badge({
  tone = "clay",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-space-1 rounded-full px-space-3 py-1 text-[11px] font-bold uppercase tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
