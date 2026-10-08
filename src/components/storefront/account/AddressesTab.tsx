"use client";

import { cn } from "@/lib/cn";
import { Card } from "./Card";
import { SAVED_ADDRESSES } from "@/lib/account";

interface AddressesTabProps {
  primaryId: string;
  onSetPrimary: (id: string) => void;
}

const ICONS = { Home: "home", Work: "work", Other: "location_on" } as const;

export function AddressesTab({ primaryId, onSetPrimary }: AddressesTabProps) {
  return (
    <div className="space-y-4">
      {SAVED_ADDRESSES.map((address) => {
        const isPrimary = address.id === primaryId;
        return (
          <Card
            key={address.id}
            className={cn("p-5 flex items-start justify-between gap-4", isPrimary && "ring-2 ring-sf-primary")}
          >
            <div className="flex items-start gap-3 min-w-0">
              <div
                className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                  isPrimary ? "bg-sf-primary text-sf-on-primary" : "bg-sf-surface-container text-sf-text-body",
                )}
              >
                <span className="material-symbols-outlined text-[20px]">{ICONS[address.label]}</span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-sf-body text-sm font-bold text-sf-on-surface">{address.label}</span>
                  {isPrimary && (
                    <span className="px-2 py-0.5 rounded-full bg-sf-primary text-sf-on-primary text-[10px] font-bold uppercase tracking-wider">
                      Primary
                    </span>
                  )}
                </div>
                <p className="font-sf-body text-sm text-sf-on-surface mt-1">{address.line}</p>
                {address.landmark && <p className="font-sf-body text-xs text-sf-text-muted mt-0.5">{address.landmark}</p>}
              </div>
            </div>
            {!isPrimary && (
              <button
                type="button"
                onClick={() => onSetPrimary(address.id)}
                className="h-9 px-3.5 rounded-lg bg-sf-surface-container hover:bg-sf-surface-container-high text-sf-on-surface font-sf-body text-xs font-semibold shrink-0 transition-colors cursor-pointer"
              >
                Set as primary
              </button>
            )}
          </Card>
        );
      })}
      <p className="font-sf-body text-xs text-sf-text-muted">
        You can add a new delivery address on the checkout page.
      </p>
    </div>
  );
}
