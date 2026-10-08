// Reskinned radio-card pattern shared by FulfillmentSection and PaymentSection -- modeled on
// dine-client's checkout/PaymentSection.tsx and DeliveryAddressSection.tsx option cards (an
// icon chip + title/subtitle + a real radio input), ported onto `sf-` tokens.
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Props = {
  name: string;
  selected: boolean;
  onSelect: () => void;
  icon: ReactNode;
  label: string;
  hint?: string;
};

export function ChoiceCard({ name, selected, onSelect, icon, label, hint }: Props) {
  return (
    <label
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl p-4 shadow-sm transition-all cursor-pointer",
        selected
          ? "bg-sf-primary-light/40 ring-2 ring-sf-primary"
          : "border border-sf-border-divider bg-sf-surface hover:bg-sf-surface-container-low",
      )}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            selected ? "bg-sf-primary text-sf-on-primary" : "bg-sf-surface-container text-sf-text-muted",
          )}
        >
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block font-sf-body text-sm font-bold text-sf-on-surface">{label}</span>
          {hint && <span className="block truncate font-sf-body text-xs text-sf-text-muted">{hint}</span>}
        </span>
      </span>
      <input
        type="radio"
        name={name}
        checked={selected}
        onChange={onSelect}
        className="h-5 w-5 shrink-0 cursor-pointer accent-sf-primary"
      />
    </label>
  );
}
