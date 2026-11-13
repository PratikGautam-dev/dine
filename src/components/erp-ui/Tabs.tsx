"use client";

import { cn } from "@/lib/cn";

type Tab<T extends string> = { key: T; label: string };

/** A simple controlled tab bar. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: Tab<T>[];
  value: T;
  onChange: (key: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "mb-space-4 flex gap-space-1 no-scrollbar overflow-x-auto border-b border-line",
        className,
      )}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          role="tab"
          type="button"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "-mb-px shrink-0 border-b-2 px-[12px] py-space-2 text-[14px] font-semibold transition-colors md:px-space-4",
            value === t.key
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-ink-600 hover:text-ink-900",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
