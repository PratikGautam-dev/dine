"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/cn";

/** A dropdown that takes several choices at once. What is chosen shows as removable chips inside the box itself (it grows as they wrap); the
 * popup stays open while ticking. */
export function MultiSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select…",
  id,
  disabled,
  className,
}: {
  options: readonly { value: string; label: string }[];
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}) {
  const labels = new Map(options.map((o) => [o.value, o.label]));
  const chosen = value.filter((v) => labels.has(v));
  return (
    <div className={cn("space-y-space-2", className)}>
      <SelectPrimitive.Root
        multiple
        value={value}
        onValueChange={(next) => onValueChange(next as string[])}
        items={options as { value: string; label: string }[]}
        disabled={disabled}
        id={id}
        modal={false}
      >
        <div className="relative">
          <SelectPrimitive.Trigger
            id={id}
            aria-label={placeholder}
            className="absolute inset-0 h-full w-full rounded-md border border-line bg-card shadow-[var(--shadow-sm)] outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-paper"
          >
            <SelectPrimitive.Value className="sr-only">
              {(selected: string[]) =>
                selected.map((v) => labels.get(v) ?? v).join(", ") ||
                placeholder
              }
            </SelectPrimitive.Value>
          </SelectPrimitive.Trigger>
          {/* What is chosen is drawn inside the box, over the (invisible) button that opens the list; only the chips' ✕ take clicks. */}
          <div className="pointer-events-none relative flex min-h-11 flex-wrap items-center gap-space-1 py-1.5 pl-space-3 pr-9 text-[14px] text-ink-900">
            {chosen.length === 0 && (
              <span className="text-ink-400">{placeholder}</span>
            )}
            {chosen.map((v) => (
              <span
                key={v}
                className="pointer-events-auto inline-flex items-center gap-1 rounded-full bg-ink-50 py-0.5 pl-space-3 pr-1 text-[13px]"
              >
                <span className="max-w-[12rem] truncate">{labels.get(v)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${labels.get(v)}`}
                  disabled={disabled}
                  onClick={() => onValueChange(value.filter((x) => x !== v))}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-ink-600 hover:bg-black/[0.08] hover:text-ink-900"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-space-3 top-1/2 -translate-y-1/2 text-ink-600"
          />
        </div>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Positioner
            side="bottom"
            align="start"
            sideOffset={4}
            collisionPadding={8}
            alignItemWithTrigger={false}
            className="z-[70] outline-none"
            onClick={(event) => event.stopPropagation()}
          >
            <SelectPrimitive.Popup className="max-h-[min(18rem,var(--available-height))] w-[var(--anchor-width)] max-w-[calc(100vw-16px)] overflow-y-auto rounded-md border border-line bg-card p-1 text-[14px] text-ink-900 shadow-[var(--shadow-md)] outline-none">
              <SelectPrimitive.List>
                {options.map((option) => (
                  <SelectPrimitive.Item
                    key={option.value}
                    value={option.value}
                    className="flex min-h-10 cursor-pointer items-center gap-space-2 rounded px-space-2 py-2 outline-none select-none data-highlighted:bg-brand-50 data-highlighted:text-brand-700"
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-line bg-card">
                      <SelectPrimitive.ItemIndicator>
                        <Check size={12} />
                      </SelectPrimitive.ItemIndicator>
                    </span>
                    <SelectPrimitive.ItemText className="min-w-0 flex-1 break-words">
                      {option.label}
                    </SelectPrimitive.ItemText>
                  </SelectPrimitive.Item>
                ))}
              </SelectPrimitive.List>
            </SelectPrimitive.Popup>
          </SelectPrimitive.Positioner>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}
