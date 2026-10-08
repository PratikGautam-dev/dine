"use client";

// Re-skinned onto dine-client's checkout visual language via the section components in
// src/components/storefront/checkout/*. Every piece of state, every API call, and the exact
// bill math/order-placement routing below is byte-identical to the previous version of this
// page -- only the JSX changed (now composed from CheckoutSection-based components instead of
// inline markup).
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { getCustomerToken, publicFetch } from "@/lib/customerAuth";
import { rupees } from "@/lib/foodOrders";
import { OrderItemsSection } from "@/components/storefront/checkout/OrderItemsSection";
import { FulfillmentSection } from "@/components/storefront/checkout/FulfillmentSection";
import { PaymentSection } from "@/components/storefront/checkout/PaymentSection";
import { CouponSection } from "@/components/storefront/checkout/CouponSection";
import { BillSummary } from "@/components/storefront/checkout/BillSummary";
import type { CouponPreview, FulfillmentType, PaymentMethod } from "@/components/storefront/checkout/types";

export default function CartPage() {
  const router = useRouter();
  const { cart, setQuantity, subtotalPaise, clearCart } = useCart();
  const [fulfillment, setFulfillment] = useState<FulfillmentType>("pickup");
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState<PaymentMethod>("online");
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<CouponPreview | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [deliveryFeePaise, setDeliveryFeePaise] = useState(0);
  const [minOrderPaise, setMinOrderPaise] = useState(0);
  const [avgPrepMinutes, setAvgPrepMinutes] = useState<number | null>(null);
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);

  useEffect(() => {
    if (!cart.slug) return;
    publicFetch<{
      restaurant: { min_order_paise: number; avg_prep_minutes: number | null };
      delivery_fee_paise: { pickup: number; delivery: number | null };
    }>(`/api/public/restaurants/${cart.slug}`).then((result) => {
      if (!result.ok) return;
      setDeliveryFeePaise(result.data.delivery_fee_paise[fulfillment] || 0);
      setMinOrderPaise(result.data.restaurant.min_order_paise || 0);
      setAvgPrepMinutes(result.data.restaurant.avg_prep_minutes ?? null);
    });
  }, [cart.slug, fulfillment]);

  async function applyCoupon() {
    if (!cart.slug || !couponInput.trim()) return;
    setCouponError(null);
    const result = await publicFetch<{ preview: CouponPreview }>(
      `/api/public/restaurants/${cart.slug}/coupon-preview`,
      {
        method: "POST",
        body: JSON.stringify({ code: couponInput.trim(), subtotal_paise: subtotalPaise, fulfillment_type: fulfillment }),
      },
    );
    if (result.ok) setCoupon(result.data.preview);
    else {
      setCoupon(null);
      setCouponError(result.error);
    }
  }

  const discountPaise = coupon?.discount_paise || 0;
  const totalPaise = Math.max(0, subtotalPaise + deliveryFeePaise - discountPaise);
  const belowMin = minOrderPaise > 0 && subtotalPaise < minOrderPaise;

  async function placeOrder() {
    if (!cart.slug) return;
    if (!getCustomerToken()) {
      router.push(`/order/login?next=/order/cart`);
      return;
    }
    if (fulfillment === "delivery" && !address.trim()) {
      setPlaceError("A delivery address is required.");
      return;
    }
    setPlacing(true);
    setPlaceError(null);
    const result = await publicFetch<{ order: { id: number; public_id: string }; next: string }>(
      "/api/public/orders",
      {
        method: "POST",
        body: JSON.stringify({
          slug: cart.slug,
          items: cart.items.map((i) => ({ menu_item_id: i.menu_item_id, quantity: i.quantity })),
          fulfillment_type: fulfillment,
          delivery_address: fulfillment === "delivery" ? address.trim() : null,
          payment_method: payment,
          coupon_code: coupon?.coupon_code || null,
          branch_id: cart.branchId,
        }),
      },
    );
    setPlacing(false);
    if (!result.ok) {
      if (result.status === 401) {
        router.push(`/order/login?next=/order/cart`);
        return;
      }
      setPlaceError(result.error);
      return;
    }
    clearCart();
    router.push(
      result.data.next === "pay" ? `/order/pay/${result.data.order.public_id}` : `/order/orders/${result.data.order.public_id}`,
    );
  }

  if (!cart.slug || cart.items.length === 0) {
    return (
      <div className="mx-auto flex max-w-[600px] flex-col items-center gap-3 px-4 py-16 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-sf-primary-light text-sf-primary">
          <span className="material-symbols-outlined text-[28px]">shopping_bag</span>
        </span>
        <p className="font-sf-headline text-[16px] font-extrabold text-sf-on-surface">Your cart is empty</p>
        <p className="font-sf-body text-[13px] text-sf-text-muted">Add something delicious and it will show up here.</p>
        <Link
          href={cart.slug ? `/order/${cart.slug}` : "/order"}
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-sf-primary px-5 py-3 font-sf-body text-[14px] font-bold text-sf-on-primary hover:bg-sf-secondary"
        >
          {cart.slug ? "Back to menu" : "Browse restaurants"}
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[640px] px-4 pt-4 pb-[150px]">
      <div className="mb-5 flex items-center gap-3">
        <Link
          href={`/order/${cart.slug}`}
          aria-label="Back to menu"
          className="flex h-10 w-10 items-center justify-center rounded-full text-sf-on-surface hover:bg-black/5"
        >
          <span className="material-symbols-outlined text-[22px]">arrow_back</span>
        </Link>
        <div className="min-w-0">
          <h1 className="font-sf-headline text-[22px] font-extrabold leading-tight text-sf-on-surface">Checkout</h1>
          <p className="truncate font-sf-body text-[13px] text-sf-text-muted">from {cart.restaurantName}</p>
        </div>
      </div>

      <OrderItemsSection slug={cart.slug} items={cart.items} onQuantityChange={setQuantity} />
      <FulfillmentSection
        fulfillment={fulfillment}
        onFulfillmentChange={setFulfillment}
        address={address}
        onAddressChange={setAddress}
        avgPrepMinutes={avgPrepMinutes}
      />
      <PaymentSection payment={payment} onPaymentChange={setPayment} fulfillment={fulfillment} />
      <CouponSection
        couponInput={couponInput}
        onCouponInputChange={setCouponInput}
        onApply={applyCoupon}
        couponError={couponError}
        coupon={coupon}
      />
      <BillSummary
        subtotalPaise={subtotalPaise}
        deliveryFeePaise={fulfillment === "delivery" ? deliveryFeePaise : 0}
        discountPaise={discountPaise}
        totalPaise={totalPaise}
        fulfillment={fulfillment}
        minOrderPaise={minOrderPaise}
        belowMin={belowMin}
      />

      {placeError && (
        <p className="mb-3 rounded-xl bg-sf-danger-soft px-3 py-2 font-sf-body text-[13px] font-medium text-sf-danger">
          {placeError}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-sf-border-divider bg-sf-surface/95 px-3 pt-3 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur">
        <button
          type="button"
          onClick={placeOrder}
          disabled={placing || belowMin}
          className="mx-auto flex w-full max-w-[640px] items-center justify-between rounded-2xl bg-sf-primary px-5 py-3 text-sf-on-primary shadow-lg transition-colors hover:bg-sf-secondary disabled:opacity-60"
        >
          <span className="text-left leading-tight">
            <span className="block font-sf-headline text-[17px] font-extrabold">{rupees(totalPaise)}</span>
            <span className="block font-sf-body text-[12px] text-white/85">
              {payment === "online" ? "Pay online" : fulfillment === "delivery" ? "Pay on delivery" : "Pay at restaurant"}
            </span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 font-sf-body text-[14.5px] font-bold text-sf-primary">
            {placing ? "Placing…" : "Place order"}
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </span>
        </button>
      </div>
    </div>
  );
}
