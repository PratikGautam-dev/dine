"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  CreditCard,
  Minus,
  Plus,
  ShoppingBag,
  Store,
  Tag,
  Trash2,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { Textarea } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import { useCart } from "@/lib/cart";
import { getCustomerToken, publicFetch } from "@/lib/customerAuth";
import { rupees } from "@/lib/foodOrders";

type FulfillmentType = "pickup" | "delivery";
type PaymentMethod = "online" | "pay_at_restaurant";
type CouponPreview = {
  offer_id: number;
  name: string;
  coupon_code: string;
  discount_paise: number;
};

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-space-4 rounded-2xl border border-line bg-card p-space-4 shadow-[var(--shadow-sm)]">
      <h2 className="mb-space-3 flex items-center gap-space-2 text-[15px] font-extrabold text-ink-900">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Choice({
  selected,
  onClick,
  icon,
  label,
  hint,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-space-3 rounded-xl border-2 p-space-3 text-left transition-colors",
        selected ? "border-brand-600 bg-brand-50" : "border-line bg-card hover:bg-paper",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          selected ? "bg-brand-600 text-white" : "bg-paper text-ink-600",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-bold text-ink-900">{label}</span>
        {hint && <span className="block truncate text-[11.5px] text-ink-500">{hint}</span>}
      </span>
    </button>
  );
}

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
  const [placing, setPlacing] = useState(false);
  const [placeError, setPlaceError] = useState<string | null>(null);

  useEffect(() => {
    if (!cart.slug) return;
    publicFetch<{
      restaurant: { min_order_paise: number };
      delivery_fee_paise: { pickup: number; delivery: number | null };
    }>(`/api/public/restaurants/${cart.slug}`).then((result) => {
      if (!result.ok) return;
      setDeliveryFeePaise(result.data.delivery_fee_paise[fulfillment] || 0);
      setMinOrderPaise(result.data.restaurant.min_order_paise || 0);
    });
  }, [cart.slug, fulfillment]);

  async function applyCoupon() {
    if (!cart.slug || !couponInput.trim()) return;
    setCouponError(null);
    const result = await publicFetch<{ preview: CouponPreview }>(
      `/api/public/restaurants/${cart.slug}/coupon-preview`,
      {
        method: "POST",
        body: JSON.stringify({
          code: couponInput.trim(),
          subtotal_paise: subtotalPaise,
          fulfillment_type: fulfillment,
        }),
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
      result.data.next === "pay"
        ? `/order/pay/${result.data.order.public_id}`
        : `/order/orders/${result.data.order.public_id}`,
    );
  }

  if (!cart.slug || cart.items.length === 0) {
    return (
      <div className="mx-auto flex max-w-[600px] flex-col items-center gap-space-3 px-space-4 py-space-9 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <ShoppingBag size={28} />
        </span>
        <p className="text-[16px] font-extrabold text-ink-900">Your cart is empty</p>
        <p className="text-[13px] text-ink-500">
          Add something delicious and it will show up here.
        </p>
        <Link
          href={cart.slug ? `/order/${cart.slug}` : "/order"}
          className="mt-space-2 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-space-5 py-space-3 text-[14px] font-bold text-white hover:bg-brand-700"
        >
          {cart.slug ? "Back to menu" : "Browse menu"} <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[640px] px-space-4 pt-space-4 pb-[140px]">
      <div className="mb-space-4 flex items-center gap-space-3">
        <Link
          href={`/order/${cart.slug}`}
          aria-label="Back to menu"
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink-900 hover:bg-black/5"
        >
          <ArrowLeft size={22} />
        </Link>
        <div className="min-w-0">
          <h1 className="font-display text-[22px] leading-tight font-extrabold text-ink-900">
            Checkout
          </h1>
          <p className="truncate text-[13px] text-ink-500">from {cart.restaurantName}</p>
        </div>
      </div>

      <Section title="Your order" icon={<UtensilsCrossed size={16} className="text-brand-600" />}>
        {cart.items.map((item) => (
          <div
            key={item.menu_item_id}
            className="flex items-center gap-space-3 border-b border-line py-space-3 first:pt-0 last:border-0 last:pb-0"
          >
            {item.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.image_url}
                alt=""
                className="h-14 w-14 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-300">
                <UtensilsCrossed size={20} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-bold text-ink-900">{item.name}</p>
              <p className="text-[12.5px] text-ink-500">{rupees(item.price_paise)}</p>
            </div>
            <div className="inline-flex items-center rounded-full bg-brand-600 text-white">
              <button
                type="button"
                onClick={() => setQuantity(item.menu_item_id, item.quantity - 1)}
                aria-label="Decrease quantity"
                className="flex h-8 w-8 items-center justify-center"
              >
                {item.quantity === 1 ? <Trash2 size={14} /> : <Minus size={14} />}
              </button>
              <span className="w-4 text-center text-[13px] font-bold">{item.quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity(item.menu_item_id, item.quantity + 1)}
                aria-label="Increase quantity"
                className="flex h-8 w-8 items-center justify-center"
              >
                <Plus size={14} />
              </button>
            </div>
            <span className="w-[62px] shrink-0 text-right text-[14px] font-extrabold text-ink-900">
              {rupees(item.price_paise * item.quantity)}
            </span>
          </div>
        ))}
        <Link
          href={`/order/${cart.slug}`}
          className="mt-space-3 inline-flex items-center gap-1 text-[13px] font-bold text-brand-600"
        >
          <Plus size={14} /> Add more items
        </Link>
      </Section>

      <Section title="How should we get it to you?">
        <div className="grid grid-cols-2 gap-space-2">
          <Choice
            selected={fulfillment === "pickup"}
            onClick={() => setFulfillment("pickup")}
            icon={<Store size={18} />}
            label="Pickup"
            hint="Collect at the restaurant"
          />
          <Choice
            selected={fulfillment === "delivery"}
            onClick={() => setFulfillment("delivery")}
            icon={<Bike size={18} />}
            label="Delivery"
            hint="To your address"
          />
        </div>
        {fulfillment === "delivery" && (
          <div className="mt-space-3">
            <label
              htmlFor="cart-address"
              className="mb-1 block text-[12.5px] font-semibold text-ink-700"
            >
              Delivery address <span className="text-error">*</span>
            </label>
            <Textarea
              id="cart-address"
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Flat, street, landmark…"
            />
          </div>
        )}
      </Section>

      <Section title="Payment method">
        <div className="grid grid-cols-2 gap-space-2">
          <Choice
            selected={payment === "online"}
            onClick={() => setPayment("online")}
            icon={<CreditCard size={18} />}
            label="Pay online"
            hint="Card, UPI & more"
          />
          <Choice
            selected={payment === "pay_at_restaurant"}
            onClick={() => setPayment("pay_at_restaurant")}
            icon={<Wallet size={18} />}
            label={fulfillment === "delivery" ? "Pay on delivery" : "Pay at restaurant"}
            hint="Cash or card, later"
          />
        </div>
      </Section>

      <Section title="Have a coupon?" icon={<Tag size={16} className="text-brand-600" />}>
        <div className="flex gap-space-2">
          <input
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
            placeholder="COUPON CODE"
            className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-card px-space-3 text-[14px] font-semibold tracking-wide text-ink-900 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 focus:outline-none"
          />
          <button
            type="button"
            onClick={applyCoupon}
            disabled={!couponInput.trim()}
            className="h-11 rounded-xl border-2 border-brand-600 px-space-5 text-[14px] font-bold text-brand-600 hover:bg-brand-50 disabled:opacity-40"
          >
            Apply
          </button>
        </div>
        {couponError && (
          <p className="mt-space-2 text-[12.5px] font-medium text-error">{couponError}</p>
        )}
        {coupon && (
          <p className="mt-space-2 rounded-lg bg-success-tint px-space-3 py-space-2 text-[12.5px] font-bold text-success">
            {coupon.name} applied — you saved {rupees(coupon.discount_paise)}
          </p>
        )}
      </Section>

      <Section title="Bill details">
        <div className="space-y-space-2 text-[13.5px]">
          <div className="flex justify-between text-ink-600">
            <span>Item total</span>
            <span>{rupees(subtotalPaise)}</span>
          </div>
          {fulfillment === "delivery" && (
            <div className="flex justify-between text-ink-600">
              <span>Delivery fee</span>
              <span className={deliveryFeePaise === 0 ? "font-semibold text-success" : ""}>
                {deliveryFeePaise === 0 ? "Free" : rupees(deliveryFeePaise)}
              </span>
            </div>
          )}
          {discountPaise > 0 && (
            <div className="flex justify-between font-semibold text-success">
              <span>Discount</span>
              <span>-{rupees(discountPaise)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-dashed border-line pt-space-3 text-[16px] font-extrabold text-ink-900">
            <span>To pay</span>
            <span>{rupees(totalPaise)}</span>
          </div>
        </div>
        {belowMin && (
          <p className="mt-space-3 rounded-lg bg-warning-tint px-space-3 py-space-2 text-[12.5px] font-semibold text-warning">
            Minimum order is {rupees(minOrderPaise)} — add {rupees(minOrderPaise - subtotalPaise)}{" "}
            more.
          </p>
        )}
      </Section>

      {placeError && (
        <p className="mb-space-3 rounded-lg bg-error-tint px-space-3 py-space-2 text-[13px] font-medium text-error">
          {placeError}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 px-space-3 pt-space-3 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur">
        <button
          type="button"
          onClick={placeOrder}
          disabled={placing || belowMin}
          className="mx-auto flex w-full max-w-[640px] items-center justify-between rounded-2xl bg-brand-600 px-space-5 py-space-3 text-white shadow-[var(--shadow-md)] transition-colors hover:bg-brand-700 disabled:opacity-60"
        >
          <span className="leading-tight text-left">
            <span className="block text-[17px] font-extrabold">{rupees(totalPaise)}</span>
            <span className="block text-[12px] text-white/85">
              {payment === "online"
                ? "Pay online"
                : fulfillment === "delivery"
                  ? "Pay on delivery"
                  : "Pay at restaurant"}
            </span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-xl bg-white px-space-4 py-2.5 text-[14.5px] font-bold text-brand-600">
            {placing ? "Placing…" : "Place order"} <ArrowRight size={16} />
          </span>
        </button>
      </div>
    </div>
  );
}
