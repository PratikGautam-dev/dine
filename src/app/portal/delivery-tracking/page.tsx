"use client";

import { useMemo, useState } from "react";
import { Bike, PencilLine, Phone } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { DispatchModal } from "@/components/portal/DispatchModal";
import { PortalShell } from "@/components/portal/PortalShell";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { type FoodOrder, useFoodOrders } from "@/hooks/useFoodOrders";
import { useBranchFilter } from "@/lib/branchContext";
import { parseOrderTime } from "@/lib/foodOrders";
import { usePermission } from "@/lib/staffAuth";

const POLL_MS = 10_000;

function minutesSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - parseOrderTime(iso).getTime()) / 60000));
}

/** Orders a delivery partner has picked up (status out_for_delivery), with the partner's details. */
export default function PortalDeliveryTrackingPage() {
  const { restaurant, ready } = usePortalGuard();
  const { orders, error, actingId, runAction, dispatchOrder } = useFoodOrders(
    ready,
    "",
    1,
    POLL_MS,
    useBranchFilter().selectedBranchId,
  );
  const canWrite = usePermission("food_orders", "write");
  // the order whose delivery partner is being entered / corrected
  const [dispatching, setDispatching] = useState<FoodOrder | null>(null);

  const delivery = useMemo(
    () =>
      (orders || [])
        .filter((o) => o.status === "out_for_delivery")
        .sort(
          (a, b) => parseOrderTime(a.created_at).getTime() - parseOrderTime(b.created_at).getTime(),
        ),
    [orders],
  );

  return (
    <PortalShell restaurant={restaurant} active="delivery-tracking">
      <PageHeader
        title="Delivery Tracking"
        icon={<Bike size={22} />}
        description="Orders out with a delivery partner — refreshes automatically."
      />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

      {orders && (
        <Card className="mb-space-4 p-space-4" data-testid="delivery-status">
          <div className="mb-space-3 flex items-center gap-space-2">
            <Bike size={16} className="text-ink-600" />
            <h3 className="text-[15px] font-bold text-ink-900">Delivery Status</h3>
            <span className="text-hint">{delivery.length} out for delivery</span>
          </div>
          {delivery.length === 0 ? (
            <p className="rounded-lg border border-dashed border-line py-space-4 text-center text-[12.5px] text-ink-400">
              No deliveries on the road right now.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line text-[11.5px] font-semibold tracking-wide text-ink-400 uppercase">
                    <th className="py-space-2 pr-space-3">Order ID</th>
                    <th className="py-space-2 pr-space-3">Delivery partner</th>
                    <th className="py-space-2 pr-space-3">Partner number</th>
                    <th className="py-space-2 pr-space-3">Customer</th>
                    <th className="py-space-2 pr-space-3">Tracking ID</th>
                    <th className="py-space-2 pr-space-3">Picked up</th>
                    <th className="py-space-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {delivery.map((o) => (
                    <tr key={o.id} className="border-b border-line last:border-0">
                      <td className="py-space-3 pr-space-3 font-mono text-[12.5px] font-semibold text-ink-900">
                        {o.reference_id ?? `#${o.id}`}
                      </td>
                      <td className="py-space-3 pr-space-3 text-ink-900">
                        {o.delivery_partner_name || (
                          <span className="text-ink-400">Not assigned</span>
                        )}
                      </td>
                      <td className="py-space-3 pr-space-3">
                        {o.delivery_partner_phone ? (
                          <a
                            href={`tel:${o.delivery_partner_phone}`}
                            className="inline-flex items-center gap-1 text-brand-700 hover:underline"
                          >
                            <Phone size={12} /> {o.delivery_partner_phone}
                          </a>
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </td>
                      <td className="py-space-3 pr-space-3">
                        <div className="text-ink-900">{o.patient_name || "Guest"}</div>
                        <div className="text-[12px] text-ink-400">{o.phone}</div>
                      </td>
                      <td className="py-space-3 pr-space-3 font-mono text-[12.5px] text-ink-900">
                        {o.delivery_tracking_id || <span className="text-ink-400">—</span>}
                      </td>
                      <td className="py-space-3 pr-space-3 text-ink-600">
                        {minutesSince(o.dispatched_at || o.updated_at || o.created_at)} min ago
                      </td>
                      <td className="py-space-3 text-right">
                        {canWrite && (
                          <div className="flex justify-end gap-space-2">
                            <button
                              type="button"
                              onClick={() => setDispatching(o)}
                              className="flex items-center gap-1 rounded-md border border-line px-space-3 py-1.5 text-[12.5px] font-semibold text-ink-600 hover:bg-paper"
                            >
                              <PencilLine size={13} />{" "}
                              {o.delivery_partner_name ? "Edit details" : "Add partner"}
                            </button>
                            <button
                              type="button"
                              disabled={actingId === o.id}
                              onClick={() => runAction(o, "complete")}
                              className="rounded-md bg-brand-600 px-space-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                            >
                              {actingId === o.id ? "…" : "Mark delivered"}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {dispatching && (
        <DispatchModal
          order={dispatching}
          busy={actingId === dispatching.id}
          onClose={() => setDispatching(null)}
          onSubmit={(details) => dispatchOrder(dispatching, details)}
        />
      )}
    </PortalShell>
  );
}
