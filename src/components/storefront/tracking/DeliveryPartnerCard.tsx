// Ported from dine-client's components/tracking/DeliveryPartnerCard.tsx. DECORATIVE ONLY: there
// is no real delivery-partner assignment system behind this -- the name/photo/vehicle below are
// static flavor text, not a real courier, and the Call/Chat buttons are disabled rather than wired
// to anything. Deliberately no ETA/countdown here (nothing it could truthfully claim to track).
import { Card } from "@/components/ui/Card";

const PLACEHOLDER_PARTNER = {
  name: "Delivery partner",
  vehicle: "Two-wheeler",
};

export function DeliveryPartnerCard() {
  return (
    <Card className="flex flex-col gap-space-4 p-space-5">
      <div className="flex items-center justify-between">
        <span className="font-sf-body text-[11px] font-semibold uppercase tracking-wide text-sf-text-muted">
          Delivery partner
        </span>
        <span className="font-sf-body text-[11px] text-sf-text-muted">Illustrative only</span>
      </div>

      <div className="flex items-center gap-space-4">
        <div className="relative shrink-0">
          <div
            aria-hidden="true"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-sf-surface-container text-sf-text-muted shadow-sm"
          >
            <span className="material-symbols-outlined text-[26px]">person</span>
          </div>
          <span className="absolute -right-0.5 -bottom-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-sf-surface-container-high text-sf-text-muted shadow">
            <span className="material-symbols-outlined text-[12px]">two_wheeler</span>
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-sf-body text-[14px] font-bold text-sf-on-surface">
            {PLACEHOLDER_PARTNER.name}
          </h2>
          <p className="mt-0.5 font-sf-body text-[12.5px] text-sf-text-body">
            {PLACEHOLDER_PARTNER.vehicle}
          </p>
          <p className="mt-0.5 font-sf-body text-[11px] text-sf-text-muted">
            Assigned once your order is ready
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-space-2">
        <button
          type="button"
          disabled
          className="flex h-11 cursor-not-allowed items-center justify-center gap-1 rounded-lg border border-sf-border-divider bg-sf-surface font-sf-body text-[13px] font-semibold text-sf-text-muted opacity-60"
        >
          <span className="material-symbols-outlined text-[18px]">call</span>
          Call
        </button>
        <button
          type="button"
          disabled
          className="flex h-11 cursor-not-allowed items-center justify-center gap-1 rounded-lg border border-sf-border-divider bg-sf-surface font-sf-body text-[13px] font-semibold text-sf-text-muted opacity-60"
        >
          <span className="material-symbols-outlined text-[18px]">chat</span>
          Chat
        </button>
      </div>
    </Card>
  );
}
