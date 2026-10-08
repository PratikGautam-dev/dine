// Step 3: payment method -- dine-connect's real backend only supports exactly two methods
// (`online`, `pay_at_restaurant`), so unlike dine-client's richer UPI-apps/netbanking/wallet/COD
// picker, this stays a 2-card choice. No fake sub-methods are rendered.
import { ChoiceCard } from "./ChoiceCard";
import { CheckoutSection } from "./CheckoutSection";
import type { FulfillmentType, PaymentMethod } from "./types";

type Props = {
  payment: PaymentMethod;
  onPaymentChange: (value: PaymentMethod) => void;
  fulfillment: FulfillmentType;
};

export function PaymentSection({ payment, onPaymentChange, fulfillment }: Props) {
  return (
    <CheckoutSection step={3} title="Payment method" subtitle="Choose how you'll pay">
      <div className="grid grid-cols-2 gap-3">
        <ChoiceCard
          name="payment"
          selected={payment === "online"}
          onSelect={() => onPaymentChange("online")}
          icon={<span className="material-symbols-outlined text-[20px]">credit_card</span>}
          label="Pay online"
          hint="Card, UPI & more"
        />
        <ChoiceCard
          name="payment"
          selected={payment === "pay_at_restaurant"}
          onSelect={() => onPaymentChange("pay_at_restaurant")}
          icon={<span className="material-symbols-outlined text-[20px]">payments</span>}
          label={fulfillment === "delivery" ? "Pay on delivery" : "Pay at restaurant"}
          hint="Cash or card, later"
        />
      </div>
    </CheckoutSection>
  );
}
