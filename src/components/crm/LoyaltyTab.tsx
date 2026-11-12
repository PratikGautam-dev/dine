"use client";

import { useState } from "react";
import { KpiTile, SegmentBadge } from "@/components/crm/shared";
import { Button } from "@/components/erp-ui/Button";
import { Card } from "@/components/erp-ui/Card";
import { DataTable } from "@/components/erp-ui/DataTable";
import { Field } from "@/components/erp-ui/Field";
import { Input } from "@/components/erp-ui/Input";
import { SkeletonLines } from "@/components/erp-ui/Skeleton";
import type { LoyaltyOverview } from "@/lib/erp/crm";
import { erp, formatDateTime, formatMoney, useErpQuery } from "@/lib/erp/erp";
import { toast } from "@/lib/toast";

export function LoyaltyTab({
  canConfigure,
  onOpenCustomer,
  onChanged,
}: {
  canConfigure: boolean;
  onOpenCustomer: (id: string) => void;
  onChanged: () => void;
}) {
  const data = useErpQuery<LoyaltyOverview>("/api/v1/crm/loyalty");
  const [rate, setRate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const d = data.data;

  async function save() {
    const n = Number.parseInt(rate ?? "", 10);
    if (!Number.isFinite(n) || n < 0)
      return toast.error(
        "Enter a number",
        "Points per ₹100 must be zero or more.",
      );
    setBusy(true);
    const res = await erp("/api/v1/crm/settings", "PUT", { points_per_100: n });
    setBusy(false);
    if (res.error) return toast.error("Couldn't save", res.error);
    toast.success("Loyalty rate saved");
    setRate(null);
    data.reload();
    onChanged();
  }

  if (!d)
    return data.error ? (
      <p className="text-[13px] font-medium text-error">{data.error}</p>
    ) : (
      <SkeletonLines rows={4} />
    );
  return (
    <div className="space-y-space-4">
      <div className="grid grid-cols-2 gap-space-3 md:grid-cols-3 max-md:[&>*:nth-child(3)]:col-span-2">
        <KpiTile stackOnMobile label="Members with points" value={d.members} />
        <KpiTile
          stackOnMobile
          label="Points earned from orders"
          value={d.points_earned.toLocaleString("en-IN")}
        />
        <KpiTile
          label="Points adjusted by staff"
          value={d.points_adjusted.toLocaleString("en-IN")}
        />
      </div>
      <Card className="p-space-4">
        <h2 className="mb-space-1 text-[15px] font-bold text-ink-900">
          How points are earned
        </h2>
        <p className="mb-space-4 max-w-3xl text-[13px] leading-relaxed text-ink-600">
          Customers earn points when orders are placed. Cancelled orders earn no
          points, and refunds reduce earned points. Staff can adjust points from
          the customer&apos;s profile.
        </p>
        <div className="flex w-full max-w-sm items-end gap-space-3">
          <Field
            label="Points per ₹100 spent"
            htmlFor="ppr"
            className="!mb-0 min-w-0 flex-1"
          >
            <Input
              id="ppr"
              className="block"
              inputMode="numeric"
              disabled={!canConfigure}
              value={rate ?? String(d.settings.points_per_100)}
              onChange={(e) => setRate(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
          {canConfigure && (
            <Button
              className="h-11 shrink-0"
              disabled={busy || rate === null}
              onClick={save}
            >
              {busy ? "Saving…" : "Save"}
            </Button>
          )}
        </div>
      </Card>
      <div className="grid gap-space-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card className="min-w-0 p-space-4">
          <h2 className="mb-space-2 text-[15px] font-bold text-ink-900">
            Top members
          </h2>
          <DataTable
            data={d.top}
            getRowId={(member) => member.id}
            paginate={false}
            emptyMessage="No enrolled members with points yet."
            columns={[
              {
                header: "Customer ID",
                cell: ({ row }) => (
                  <button
                    type="button"
                    className="whitespace-nowrap font-semibold text-brand-700 hover:underline"
                    onClick={() => onOpenCustomer(row.original.id)}
                  >
                    {row.original.customer_code ?? "View customer"}
                  </button>
                ),
              },
              {
                header: "Name",
                cell: ({ row }) => (
                  <button
                    type="button"
                    className="font-semibold text-ink-900 hover:underline"
                    onClick={() => onOpenCustomer(row.original.id)}
                  >
                    {row.original.name}
                  </button>
                ),
              },
              {
                header: "Membership",
                cell: ({ row }) => (
                  <SegmentBadge segment={row.original.segment} />
                ),
              },
              {
                id: "loyalty_points",
                header: () => <div className="text-right">Loyalty points</div>,
                cell: ({ row }) => (
                  <span className="block text-right font-semibold tabular-nums">
                    {row.original.loyalty_points.toLocaleString("en-IN")}
                  </span>
                ),
              },
              {
                id: "credit_balance",
                header: () => (
                  <div className="text-right">Credit balance (₹)</div>
                ),
                cell: ({ row }) => (
                  <span className="block text-right font-semibold tabular-nums">
                    {formatMoney(row.original.credit_balance_minor, "INR")}
                  </span>
                ),
              },
            ]}
          />
          <p className="mt-space-2 text-[12px] text-ink-600">
            Credit balance is the value of loyalty points at the current
            conversion rate. Checkout redemption limits apply.
          </p>
        </Card>
        <Card className="min-w-0 p-space-4">
          <h2 className="mb-space-2 text-[15px] font-bold text-ink-900">
            Recent adjustments
          </h2>
          {d.recent.length === 0 && (
            <p className="text-[13px] text-ink-400">No adjustments yet.</p>
          )}
          <ul className="divide-y divide-line">
            {d.recent.map((r) => (
              <li key={r.id} className="py-space-2 text-[13.5px]">
                <div className="flex justify-between">
                  <span className="font-medium text-ink-900">
                    {r.customer_name}
                  </span>
                  <span
                    className={
                      r.delta < 0
                        ? "font-bold text-error"
                        : "font-bold text-success"
                    }
                  >
                    {r.delta > 0 ? "+" : ""}
                    {r.delta}
                  </span>
                </div>
                <p className="text-[12px] text-ink-400">
                  {r.reason} · {formatDateTime(r.created_at)}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
