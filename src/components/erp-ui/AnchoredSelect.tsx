"use client";

import { Select as SelectPrimitive } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import { cn } from "@/lib/cn";

/** An in-page select whose popup stays aligned with its control, including in device emulation. */
export function AnchoredSelect<Value extends string | number>({
  value,
  defaultValue,
  onValueChange,
  options,
  label,
  id,
  className,
  compact = false,
  disabled,
  name,
  form,
  required,
  ref,
  ...triggerProps
}: {
  value?: Value;
  defaultValue?: Value;
  onValueChange?: (value: Value) => void;
  options: readonly { value: Value; label: ReactNode; disabled?: boolean }[];
  label?: string;
  compact?: boolean;
  required?: boolean;
  ref?: Ref<HTMLButtonElement>;
} & Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "value" | "defaultValue" | "onChange" | "children"
>) {
  return (
    <SelectPrimitive.Root
      value={value}
      defaultValue={
        defaultValue ?? options.find((option) => !option.disabled)?.value
      }
      items={options}
      onValueChange={(next) => {
        if (next !== null) onValueChange?.(next);
      }}
      disabled={disabled}
      name={name}
      form={form}
      required={required}
      id={id}
      modal={false}
    >
      <SelectPrimitive.Trigger
        {...triggerProps}
        ref={ref}
        id={id}
        aria-label={triggerProps["aria-label"] ?? label}
        className={cn(
          "inline-flex min-w-0 w-full items-center justify-between gap-space-2 rounded-md border border-line bg-card text-ink-900 outline-none disabled:cursor-not-allowed disabled:bg-paper disabled:text-ink-400",
          compact
            ? "h-10 px-space-2 text-[12px] focus-visible:ring-2 focus-visible:ring-brand-400"
            : "h-11 px-space-3 text-[14px] shadow-[var(--shadow-sm)] focus:border-brand-400 focus:ring-2 focus:ring-brand-100",
          className,
        )}
      >
        <SelectPrimitive.Value className="min-w-0 truncate text-left" />
        <SelectPrimitive.Icon className="shrink-0">
          <ChevronDown size={compact ? 12 : 14} />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Positioner
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={8}
          alignItemWithTrigger={false}
          className="z-50 outline-none"
          onClick={(event) => event.stopPropagation()}
        >
          <SelectPrimitive.Popup
            className={cn(
              "max-h-[var(--available-height)] w-max min-w-[var(--anchor-width)] max-w-[calc(100vw-16px)] overflow-y-auto rounded-md border border-line bg-card p-1 text-ink-900 shadow-[var(--shadow-md)] outline-none",
              compact ? "text-[12px]" : "text-[14px]",
            )}
          >
            <SelectPrimitive.List>
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-space-2 rounded px-[9px] py-2 outline-none select-none data-highlighted:bg-brand-50 data-highlighted:text-brand-700 data-disabled:cursor-not-allowed data-disabled:text-ink-400",
                    compact ? "min-h-9" : "min-h-11",
                  )}
                >
                  <SelectPrimitive.ItemText className="min-w-0 flex-1 break-words">
                    {option.label}
                  </SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="shrink-0">
                    <Check size={12} />
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.List>
          </SelectPrimitive.Popup>
        </SelectPrimitive.Positioner>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
