"use client";

import { toast } from "@/lib/toast";
import { Card } from "./Card";
import { CREDITS_POINTS } from "@/lib/account";

interface CreditsCardProps {
  onOpenLedger: () => void;
}

export function CreditsCard({ onOpenLedger }: CreditsCardProps) {
  return (
    <Card className="lg:col-span-3 p-6 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="font-sf-body text-[11px] uppercase tracking-wider font-semibold text-sf-text-muted">
            Daap Dine Credits
          </span>
          <span className="w-8 h-8 rounded-full bg-sf-primary-light flex items-center justify-center text-sf-primary">
            <span className="material-symbols-outlined text-[18px]">account_balance_wallet</span>
          </span>
        </div>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="font-sf-headline text-3xl font-bold text-sf-primary">
            {CREDITS_POINTS.toLocaleString("en-IN")}
          </span>
          <span className="font-sf-body text-sm text-sf-text-muted font-medium">Pts</span>
        </div>
        <p className="font-sf-body text-xs text-sf-text-body mt-0.5">
          Worth <strong className="text-sf-on-surface">₹{CREDITS_POINTS.toLocaleString("en-IN")}</strong> on upcoming
          orders
        </p>
      </div>
      <div className="space-y-1 mt-4">
        <button
          type="button"
          onClick={() => toast.success("Credits will be applied to your next order")}
          className="w-full h-11 px-4 rounded-lg bg-sf-primary hover:bg-sf-secondary text-sf-on-primary font-sf-body text-sm font-semibold flex items-center justify-center gap-1 shadow-sm transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">redeem</span>
          Redeem on Next Order
        </button>
        <div className="grid grid-cols-2 gap-1 pt-1">
          <button
            type="button"
            onClick={onOpenLedger}
            className="h-9 rounded-lg bg-sf-surface-container-low hover:bg-sf-surface-container text-sf-on-surface font-sf-body text-xs font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">history</span>
            Ledger
          </button>
          <button
            type="button"
            onClick={() => toast.success("Gift cards are coming soon")}
            className="h-9 rounded-lg bg-sf-surface-container-low hover:bg-sf-surface-container text-sf-on-surface font-sf-body text-xs font-medium flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[14px]">card_giftcard</span>
            Add Card
          </button>
        </div>
      </div>
    </Card>
  );
}
