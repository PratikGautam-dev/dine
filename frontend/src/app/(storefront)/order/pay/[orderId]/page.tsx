"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CreditCard, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
    const result = await publicFetch<{ ok: boolean; order: Order; error?: string }>(`/api/public/orders/${orderId}/mock-pay`, {
      method: "POST",
      body: JSON.stringify({ outcome }),
    });
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
    return <div className="mx-auto max-w-[440px] px-space-4 py-space-9 text-center text-[13.5px] text-error">{error}</div>;
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-[440px] px-space-4 py-space-9">
        <div className="h-[220px] animate-pulse rounded-lg bg-line/40" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[440px] flex-col items-center px-space-4 py-space-9">
      <div className="mb-space-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        <CreditCard size={22} />
      </div>
      <h1 className="text-display mb-space-1 text-center text-[20px]">DinePay</h1>
      <p className="mb-space-6 flex items-center gap-space-1 text-[12.5px] font-semibold text-ink-400">
        <ShieldCheck size={14} /> Test mode -- no real money moves
      </p>

      <Card className="w-full p-space-5 text-center">
        <p className="text-[12.5px] text-ink-500">Paying {order.restaurant?.name}</p>
        <p className="mt-space-1 text-[30px] font-extrabold text-ink-900">{rupees(order.total_paise)}</p>
        <p className="mt-space-1 text-[12px] text-ink-400">Order #{order.id}</p>

        {failed && (
          <p className="mt-space-4 rounded-md bg-error-tint p-space-3 text-[13px] font-medium text-error">
            Payment failed (simulated). You can try again below.
          </p>
        )}

        {error && <p className="mt-space-3 text-[13px] font-medium text-error">{error}</p>}

        <div className="mt-space-5 flex flex-col gap-space-2">
          <Button size="lg" className="w-full" onClick={() => pay("success")} disabled={busy !== null}>
            {busy === "success" ? "Processing…" : `Pay ${rupees(order.total_paise)}`}
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => pay("fail")} disabled={busy !== null}>
            {busy === "fail" ? "Processing…" : "Simulate failed payment"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
