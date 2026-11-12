"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type PageTab<T extends string> = { key: T; label: string; icon?: ReactNode };

/** The tab bar the Customers pages (Campaigns, Segments...) use: an icon beside each label, the active
 * tab tinted with a brand underline. One component so every portal page's tabs look the same. */
export function PageTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: PageTab<T>[];
  value: T;
  onChange: (key: T) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "no-scrollbar mb-space-4 flex gap-space-1 overflow-x-auto border-b border-line",
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
            "-mb-px flex shrink-0 items-center gap-space-2 rounded-t-lg border-b-2 px-space-4 py-space-2 text-[14px] font-semibold transition-colors",
            value === t.key
              ? "border-brand-600 bg-brand-50 text-brand-700"
              : "border-transparent text-ink-600 hover:text-ink-900",
          )}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}
