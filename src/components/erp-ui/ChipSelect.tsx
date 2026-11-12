"use client";

import { cn } from "@/lib/cn";

/** Pick one from a short list with every option in view, as a row of chips that wraps. A radio group for keyboards and screen readers;
 * `options` are [value, label] pairs. */
export function ChipSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly (readonly [string, string])[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex flex-wrap gap-space-2"
    >
      {options.map(([option, text]) => {
        const on = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(option)}
            className={cn(
              "rounded-md border px-space-3 py-[7px] text-[14px] transition-colors duration-150 ease-(--ease-standard)",
              "focus-visible:ring-2 focus-visible:ring-brand-100 focus-visible:outline-none",
              on
                ? "border-brand-600 bg-brand-50 font-medium text-brand-700 ring-1 ring-brand-600"
                : "border-line bg-card text-ink-900 hover:border-brand-300",
            )}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}
