"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag, Tag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { useCart } from "@/lib/cart";
import { getCustomerToken, publicFetch } from "@/lib/customerAuth";
import { rupees } from "@/lib/foodOrders";

type FulfillmentType = "pickup" | "delivery";
type PaymentMethod = "online" | "pay_at_restaurant";

type CouponPreview = { offer_id: number; name: string; coupon_code: string; discount_paise: number };

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
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);

  useEffect(() => {
    if (!cart.slug) return;
    publicFetch<{ delivery_fee_paise: { pickup: number; delivery: number } }>(`/api/public/restaurants/${cart.slug}`).then(
      (result) => {
        if (result.ok) setDeliveryFeePaise(result.data.delivery_fee_paise[fulfillment] || 0);
      },
    );
  }, [cart.slug, fulfillment]);

  async function applyCoupon() {
    if (!cart.slug || !couponInput.trim()) return;
    setCouponError(null);
    const result = await publicFetch<{ preview: CouponPreview }>(`/api/public/restaurants/${cart.slug}/coupon-preview`, {
      method: "POST",
      body: JSON.stringify({ code: couponInput.trim(), subtotal_paise: subtotalPaise, fulfillment_type: fulfillment }),
    });
    if (result.ok) setCoupon(result.data.preview);
    else {
      setCoupon(null);
      setCouponError(result.error);
    }
  }

  const discountPaise = coupon?.discount_paise || 0;
  const totalPaise = Math.max(0, subtotalPaise + deliveryFeePaise - discountPaise);

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
    const result = await publicFetch<{ order: { id: number }; next: string }>("/api/public/orders", {
      method: "POST",
      body: JSON.stringify({
        slug: cart.slug,
        items: cart.items.map((i) => ({ menu_item_id: i.menu_item_id, quantity: i.quantity })),
        fulfillment_type: fulfillment,
        delivery_address: fulfillment === "delivery" ? address.trim() : null,
        payment_method: payment,
        coupon_code: coupon?.coupon_code || null,
      }),
    });
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
    router.push(result.data.next === "pay" ? `/order/pay/${result.data.order.id}` : `/order/orders/${result.data.order.id}`);
  }

  if (!cart.slug || cart.items.length === 0) {
    return (
      <div className="mx-auto flex max-w-[600px] flex-col items-center gap-space-3 px-space-4 py-space-9 text-center">
        <ShoppingBag size={32} className="text-ink-300" />
        <p className="text-[14px] font-semibold text-ink-600">Your cart is empty</p>
        <Button href="/order" variant="secondary">
          Browse restaurants
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[600px] px-space-4 py-space-6">
      <h1 className="text-display mb-space-1 text-[22px]">Your order</h1>
      <p className="mb-space-5 text-[13px] text-ink-500">from {cart.restaurantName}</p>

      <Card className="mb-space-4 p-space-4">
        {cart.items.map((item) => (
          <div key={item.menu_item_id} className="flex items-center gap-space-3 border-b border-line py-space-3 last:border-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold text-ink-900">{item.name}</p>
              <p className="text-[12.5px] text-ink-500">{rupees(item.price_paise)}</p>
            </div>
            <div className="flex items-center gap-space-2 rounded-md border border-brand-300 bg-brand-50">
              <button
                type="button"
                onClick={() => setQuantity(item.menu_item_id, item.quantity - 1)}
                className="flex h-7 w-7 items-center justify-center text-brand-700"
                aria-label="Decrease quantity"
              >
                {item.quantity === 1 ? <Trash2 size={13} /> : <Minus size={13} />}
              </button>
              <span className="w-4 text-center text-[12.5px] font-bold text-brand-700">{item.quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity(item.menu_item_id, item.quantity + 1)}
                className="flex h-7 w-7 items-center justify-center text-brand-700"
                aria-label="Increase quantity"
              >
                <Plus size={13} />
              </button>
            </div>
            <span className="w-16 shrink-0 text-right text-[13.5px] font-semibold text-ink-900">
              {rupees(item.price_paise * item.quantity)}
            </span>
          </div>
        ))}
      </Card>

      <Card className="mb-space-4 p-space-4">
        <h2 className="mb-space-3 text-[13.5px] font-bold text-ink-900">How should we get it to you?</h2>
        <div className="mb-space-3 grid grid-cols-2 gap-space-2">
          {(["pickup", "delivery"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFulfillment(type)}
              className={cn(
                "rounded-md border px-space-3 py-space-2 text-[13px] font-semibold capitalize transition-colors",
                fulfillment === type ? "border-brand-400 bg-brand-50 text-brand-700" : "border-line text-ink-600 hover:bg-paper",
              )}
            >
              {type}
            </button>
          ))}
        </div>
        {fulfillment === "delivery" && (
          <Field label="Delivery address" htmlFor="cart-address" required>
            <Textarea id="cart-address" rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Flat, street, landmark…" />
          </Field>
        )}
      </Card>

      <Card className="mb-space-4 p-space-4">
        <h2 className="mb-space-3 text-[13.5px] font-bold text-ink-900">Payment method</h2>
        <div className="grid grid-cols-2 gap-space-2">
          {([
            { value: "online" as const, label: "Pay online" },
            { value: "pay_at_restaurant" as const, label: "Pay at restaurant" },
          ]).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPayment(opt.value)}
              className={cn(
                "rounded-md border px-space-3 py-space-2 text-[13px] font-semibold transition-colors",
                payment === opt.value ? "border-brand-400 bg-brand-50 text-brand-700" : "border-line text-ink-600 hover:bg-paper",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="mb-space-4 p-space-4">
        <h2 className="mb-space-3 flex items-center gap-space-2 text-[13.5px] font-bold text-ink-900">
          <Tag size={15} /> Have a coupon?
        </h2>
        <div className="flex gap-space-2">
          <Input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="COUPON CODE" className="flex-1" />
          <Button type="button" variant="secondary" onClick={applyCoupon} disabled={!couponInput.trim()}>
            Apply
          </Button>
        </div>
        {couponError && <p className="mt-space-2 text-[12.5px] text-error">{couponError}</p>}
        {coupon && (
          <p className="mt-space-2 text-[12.5px] font-semibold text-success">
            {coupon.name} applied -- you saved {rupees(coupon.discount_paise)}
          </p>
        )}
      </Card>

      <Card className="mb-space-5 p-space-4">
        <h2 className="mb-space-3 text-[13.5px] font-bold text-ink-900">Bill details</h2>
        <div className="space-y-space-2 text-[13px]">
          <div className="flex justify-between text-ink-600">
            <span>Item total</span>
            <span>{rupees(subtotalPaise)}</span>
          </div>
          {fulfillment === "delivery" && (
            <div className="flex justify-between text-ink-600">
              <span>Delivery fee</span>
              <span>{deliveryFeePaise === 0 ? "Free" : rupees(deliveryFeePaise)}</span>
            </div>
          )}
          {discountPaise > 0 && (
            <div className="flex justify-between text-success">
              <span>Discount</span>
              <span>-{rupees(discountPaise)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-line pt-space-2 text-[14.5px] font-bold text-ink-900">
            <span>To pay</span>
            <span>{rupees(totalPaise)}</span>
          </div>
        </div>
      </Card>

      {placeError && <p className="mb-space-3 text-[13px] font-medium text-error">{placeError}</p>}

      <Button size="lg" className="w-full" onClick={placeOrder} disabled={placing}>
        {placing ? "Placing order…" : `Place order · ${rupees(totalPaise)}`}
      </Button>
    </div>
  );
}
