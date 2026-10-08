// Step 2: pickup vs delivery -- dine-connect's real backend only ever supports these two
// fulfillment types (no "dine-in", unlike dine-client's FulfillmentBar), so this is a 2-card
// picker, not a 3-way mode bar. The "ASAP, ready in ~N mins" line is display-only (dine-client's
// TimingSection ported down to its non-interactive core): there is no scheduling field anywhere
// in POST /api/public/orders, so no slot picker is wired up here.
import { Textarea } from "@/components/ui/Input";
import { ChoiceCard } from "./ChoiceCard";
import { CheckoutSection } from "./CheckoutSection";
import type { FulfillmentType } from "./types";

type Props = {
  fulfillment: FulfillmentType;
  onFulfillmentChange: (value: FulfillmentType) => void;
  address: string;
  onAddressChange: (value: string) => void;
  avgPrepMinutes: number | null;
};

export function FulfillmentSection({
  fulfillment,
  onFulfillmentChange,
  address,
  onAddressChange,
  avgPrepMinutes,
}: Props) {
  return (
    <CheckoutSection step={2} title="How should we get it to you?">
      <div className="grid grid-cols-2 gap-3">
        <ChoiceCard
          name="fulfillment"
          selected={fulfillment === "pickup"}
          onSelect={() => onFulfillmentChange("pickup")}
          icon={<span className="material-symbols-outlined text-[20px]">shopping_bag</span>}
          label="Pickup"
          hint="Collect at the restaurant"
        />
        <ChoiceCard
          name="fulfillment"
          selected={fulfillment === "delivery"}
          onSelect={() => onFulfillmentChange("delivery")}
          icon={<span className="material-symbols-outlined text-[20px]">electric_moped</span>}
          label="Delivery"
          hint="To your address"
        />
      </div>

      <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-sf-surface-container-low px-3 py-2 font-sf-body text-xs font-semibold text-sf-text-body">
        <span className="material-symbols-outlined text-[16px] text-sf-primary">schedule</span>
        ASAP{avgPrepMinutes ? ` • ready in ~${avgPrepMinutes} mins` : ""}
      </div>

      {fulfillment === "delivery" && (
        <div className="mt-3">
          <label
            htmlFor="cart-address"
            className="mb-1.5 block font-sf-body text-xs font-bold uppercase tracking-wider text-sf-on-surface"
          >
            Delivery address <span className="text-sf-error">*</span>
          </label>
          <Textarea
            id="cart-address"
            rows={2}
            value={address}
            onChange={(e) => onAddressChange(e.target.value)}
            placeholder="Flat, street, landmark…"
          />
        </div>
      )}
    </CheckoutSection>
  );
}
