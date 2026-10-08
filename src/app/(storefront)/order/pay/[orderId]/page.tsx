"use client";

// Re-skinned onto the "Daap Dine" (dine-client) visual language -- dine-client has no payment
// page of its own (its checkout fakes payment inline with a setTimeout), so there's nothing to
// port here; this mock-gateway flow was already fully real and keeps that logic identical, only
// the JSX/classes changed to sf-* tokens + Material Symbols.
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getCustomerToken, publicFetch } from "@/lib/customerAuth";
import { rupees } from "@/lib/foodOrders";

type Order = {
  id: number;
  status: string;
  total_paise: number;
  restaurant: { name: string; slug: string | null } | null;
};

export default function MockPayPage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const orderId = params.orderId;
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"success" | "fail" | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!getCustomerToken()) {
      router.replace(`/order/login?next=/order/pay/${orderId}`);
      return;
    }
    publicFetch<{ order: Order }>(`/api/public/orders/${orderId}`).then((result) => {
      if (result.ok) {
        if (result.data.order.status !== "pending_payment") {
          router.replace(`/order/orders/${orderId}`);
          return;
        }
        setOrder(result.data.order);
      } else {
        setError(result.error);
      }
    });
  }, [orderId, router]);

  async function pay(outcome: "success" | "fail") {
    setBusy(outcome);
    setError(null);
    const result = await publicFetch<{ ok: boolean; order: Order; error?: string }>(
      `/api/public/orders/${orderId}/mock-pay`,
      { method: "POST", body: JSON.stringify({ outcome }) },
    );
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (!result.data.ok) {
      setFailed(true);
      return;
    }
    router.push(`/order/orders/${orderId}`);
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[440px] px-4 py-12 text-center font-sf-body text-[13.5px] text-sf-error">
        {error}
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-[440px] px-4 py-12">
        <div className="h-[220px] animate-pulse rounded-2xl bg-sf-surface-container-low" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[440px] flex-col items-center px-4 py-12">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sf-primary-light text-sf-primary">
        <span className="material-symbols-outlined text-[26px]">credit_card</span>
      </div>
      <h1 className="font-sf-headline mb-1 text-center text-[22px] font-extrabold text-sf-on-surface">DinePay</h1>
      <p className="mb-6 flex items-center gap-1 font-sf-body text-[12.5px] font-semibold text-sf-text-muted">
        <span className="material-symbols-outlined text-[15px]">verified_user</span>
        Test mode — no real money moves
      </p>

      <div className="w-full rounded-2xl border border-sf-border-divider bg-sf-surface p-6 text-center shadow-sm">
        <p className="font-sf-body text-[12.5px] text-sf-text-muted">Paying {order.restaurant?.name}</p>
        <p className="mt-1 font-sf-headline text-[32px] font-extrabold text-sf-on-surface">
          {rupees(order.total_paise)}
        </p>
        <p className="mt-1 font-sf-body text-[12px] text-sf-text-muted">Order #{order.id}</p>

        {failed && (
          <p className="mt-4 rounded-xl bg-sf-danger-soft p-3 font-sf-body text-[13px] font-medium text-sf-danger">
            Payment failed (simulated). You can try again below.
          </p>
        )}
        {error && <p className="mt-3 font-sf-body text-[13px] font-medium text-sf-error">{error}</p>}

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => pay("success")}
            disabled={busy !== null}
            className="w-full rounded-xl bg-sf-primary py-3.5 font-sf-body text-sm font-bold text-sf-on-primary shadow-md transition-colors hover:bg-sf-secondary disabled:opacity-50"
          >
            {busy === "success" ? "Processing…" : `Pay ${rupees(order.total_paise)}`}
          </button>
          <button
            type="button"
            onClick={() => pay("fail")}
            disabled={busy !== null}
            className="w-full rounded-xl border border-sf-border-divider bg-sf-surface py-3.5 font-sf-body text-sm font-bold text-sf-on-surface transition-colors hover:bg-sf-surface-container-low disabled:opacity-50"
          >
            {busy === "fail" ? "Processing…" : "Simulate failed payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
