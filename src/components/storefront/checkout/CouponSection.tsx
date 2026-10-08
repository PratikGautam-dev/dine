// Step 4: coupon code -- the coupon shown here only ever comes back from the real
// POST /api/public/restaurants/{slug}/coupon-preview call (applyCoupon in the page); nothing is
// hardcoded client-side.
import { CheckoutSection } from "./CheckoutSection";
import { rupees } from "@/lib/foodOrders";
import type { CouponPreview } from "./types";

type Props = {
  couponInput: string;
  onCouponInputChange: (value: string) => void;
  onApply: () => void;
  couponError: string | null;
  coupon: CouponPreview | null;
};

export function CouponSection({ couponInput, onCouponInputChange, onApply, couponError, coupon }: Props) {
  return (
    <CheckoutSection step={4} title="Have a coupon?">
      <div className="flex gap-2">
        <input
          value={couponInput}
          onChange={(e) => onCouponInputChange(e.target.value.toUpperCase())}
          placeholder="COUPON CODE"
          className="h-11 min-w-0 flex-1 rounded-xl border border-sf-border-divider bg-sf-surface px-3 font-sf-body text-sm font-bold tracking-wide text-sf-on-surface placeholder:text-sf-text-muted focus:border-sf-primary focus:outline-none"
        />
        <button
          type="button"
          onClick={onApply}
          disabled={!couponInput.trim()}
          className="h-11 cursor-pointer rounded-xl bg-sf-on-surface px-5 font-sf-body text-sm font-bold text-sf-on-primary transition-colors hover:bg-sf-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          Apply
        </button>
      </div>
      {couponError && (
        <p className="mt-2 font-sf-body text-xs font-medium text-sf-error">{couponError}</p>
      )}
      {coupon && (
        <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-sf-veg-green/10 px-3 py-2 font-sf-body text-xs font-bold text-sf-veg-green">
          <span className="material-symbols-outlined text-[16px]">celebration</span>
          {coupon.name} applied — you saved {rupees(coupon.discount_paise)}
        </p>
      )}
    </CheckoutSection>
  );
}
