import { cn } from "@/lib/cn";

/** "12 / 50 characters": turns red once the limit is passed. */
export function Counter({ used, max, unit }: { used: number; max: number; unit: "characters" }) {
  return (
    <p
      aria-live="polite"
      className={cn("mt-1 text-right text-[12px] tabular-nums", used > max ? "font-semibold text-error" : "text-ink-400")}
    >
      {used} / {max} {unit}
    </p>
  );
}
