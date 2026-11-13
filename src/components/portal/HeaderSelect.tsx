"use client";

import type { ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/cn";

export type HeaderSelectOption<T extends string> = {
  value: T;
  label: string;
  /** Small grey line under the label, e.g. a branch's city. */
  hint?: string | null;
};

/** The header's dropdown (branch, period, channel): a chip that opens a styled list with the current
 * choice ticked. Replaces the browser's native <select>, whose open list can't be styled. */
export function HeaderSelect<T extends string>({
  icon,
  value,
  options,
  onChange,
  ariaLabel,
  align = "end",
}: {
  icon: ReactNode;
  value: T;
  options: readonly HeaderSelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  align?: "start" | "end";
}) {
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`${ariaLabel}: ${current?.label ?? ""}`}
        className={cn(
          "group flex cursor-pointer items-center gap-space-2 rounded-md border border-line bg-card px-space-3 py-1.5 text-[13px] font-medium text-ink-700 outline-none",
          "transition-colors duration-150 hover:border-brand-300 hover:bg-brand-50/60",
          "focus-visible:ring-2 focus-visible:ring-brand-400 data-popup-open:border-brand-400 data-popup-open:bg-brand-50/60",
        )}
      >
        <span className="text-ink-400 [&>svg]:h-[15px] [&>svg]:w-[15px]">{icon}</span>
        <span className="max-w-[160px] truncate">{current?.label}</span>
        <ChevronDown
          size={14}
          className="text-ink-400 transition-transform duration-150 group-data-popup-open:rotate-180"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-[200px] p-1.5">
        {options.map((o) => {
          const selected = o.value === current?.value;
          return (
            <DropdownMenuItem
              key={o.value}
              onClick={() => onChange(o.value)}
              className={cn(
                "gap-space-3 px-space-3 py-2",
                selected && "bg-brand-50 text-brand-700",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px]">{o.label}</span>
                {o.hint && (
                  <span className="block truncate text-[11.5px] font-normal text-ink-400">
                    {o.hint}
                  </span>
                )}
              </span>
              {selected && <Check size={15} className="shrink-0 text-brand-600" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
