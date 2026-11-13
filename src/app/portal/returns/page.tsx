"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Ban, CheckCircle2, Search, Undo2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { OrderDetailDrawer } from "@/components/portal/OrderDetailDrawer";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/portal/StatTile";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { type FoodOrder, STATUS_LABELS, useFoodOrders } from "@/hooks/useFoodOrders";
import { useBranchFilter } from "@/lib/branchContext";
import { RETURN_PERIODS, formatRange, inRange, usePagePeriod } from "@/lib/globalFilter";
import { formatOrderTime, parseOrderTime, rupees } from "@/lib/foodOrders";

// Returns for a restaurant = money back on an order, not stock coming back. A guest is refunded
// after a cancelled paid order, or after a complaint about a completed one. The backend records
// refunds per order (POST /api/portal/food-orders/{id}/refund, shown in OrderDetailDrawer), so this
// page is the working queue of orders that can be refunded; the refund itself is issued in the drawer.
type Tab = "cancelled" | "completed";
const TABS: { key: Tab; label: string; hint: string }[] = [
  {
    key: "cancelled",
    label: "Cancelled orders",
    hint: "Cancelled after payment may need money back.",
  },
  { key: "completed", label: "Completed orders", hint: "Refund for a complaint or a wrong item." },
];

export default function ReturnsPage() {
  const { ready, restaurant } = usePortalGuard();
  const { selectedBranchId } = useBranchFilter();
  // the period comes from the header's global filter
  const { days: windowDays, range, label: periodLabel } = usePagePeriod(RETURN_PERIODS);
  const { orders, error } = useFoodOrders(ready, "", windowDays, undefined, selectedBranchId);
  const windowLabel = `${periodLabel} (${formatRange(range)})`;

  const [tab, setTab] = useState<Tab>("cancelled");
  const [search, setSearch] = useState("");
  const [openOrderId, setOpenOrderId] = useState<number | null>(null);

  // the list is fetched by "days back"; trim it to the exact dates chosen in the header
  const inPeriod = useMemo(
    () => (orders ?? []).filter((o) => inRange(parseOrderTime(o.created_at), range)),
    [orders, range],
  );

  const counts = useMemo(() => {
    const all = inPeriod;
    return {
      cancelled: all.filter((o) => o.status === "cancelled").length,
      completed: all.filter((o) => o.status === "completed").length,
      paidCancelled: all.filter((o) => o.status === "cancelled" && o.payment_method === "online")
        .length,
    };
  }, [inPeriod]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inPeriod.filter((o) => {
      if (o.status !== tab) return false;
      if (!q) return true;
      return [o.reference_id, o.patient_name, o.phone].some((v) => v?.toLowerCase().includes(q));
    });
  }, [inPeriod, tab, search]);

  const columns = useMemo<ColumnDef<FoodOrder>[]>(
    () => [
      {
        header: "Order",
        cell: ({ row }) => (
          <span className="font-semibold text-ink-900">
            {row.original.reference_id ?? `#${row.original.id}`}
          </span>
        ),
      },
      {
        header: "Customer",
        cell: ({ row }) => (
          <div className="leading-tight">
            <p className="text-ink-900">{row.original.patient_name ?? "Guest"}</p>
            <p className="text-[12px] text-ink-400">{row.original.phone}</p>
          </div>
        ),
      },
      { header: "Total", cell: ({ row }) => rupees(row.original.total_paise) },
      {
        header: "Payment",
        cell: ({ row }) =>
          row.original.payment_method === "online" ? (
            <Badge tone="success">Paid online</Badge>
          ) : (
            <Badge tone="neutral">At restaurant</Badge>
          ),
      },
      {
        header: "Status",
        cell: ({ row }) => (
          <Badge tone={row.original.status === "cancelled" ? "brand" : "violet"}>
            {STATUS_LABELS[row.original.status] ?? row.original.status}
          </Badge>
        ),
      },
      { header: "Placed", cell: ({ row }) => formatOrderTime(row.original.created_at) },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button variant="secondary" onClick={() => setOpenOrderId(row.original.id)}>
            <Undo2 size={14} /> Refund
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <PortalShell restaurant={restaurant} active="returns">
      <PageHeader
        title="Returns"
        icon={<Undo2 size={22} />}
        description={`Refund guests for cancelled or problem orders (${windowLabel.toLowerCase()}).`}
      />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

      <div className="mb-space-4 grid grid-cols-1 gap-space-3 sm:grid-cols-3">
        <StatTile
          tone="brand"
          icon={<Ban size={22} />}
          label="Cancelled orders"
          value={counts.cancelled}
          deltaPct={null}
          upIsGood={false}
          hint={windowLabel}
        />
        <StatTile
          tone="warning"
          icon={<Undo2 size={22} />}
          label="Cancelled, paid online"
          value={counts.paidCancelled}
          deltaPct={null}
          upIsGood={false}
          hint="Likely need a refund"
        />
        <StatTile
          tone="success"
          icon={<CheckCircle2 size={22} />}
          label="Completed orders"
          value={counts.completed}
          deltaPct={null}
          hint={windowLabel}
        />
      </div>

      <Card className="p-space-4">
        <div className="mb-space-3 flex flex-wrap items-center justify-between gap-space-3">
          <div role="tablist" className="flex gap-space-1 rounded-md bg-black/[0.04] p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                role="tab"
                type="button"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={
                  "rounded px-space-3 py-1.5 text-[13px] font-semibold transition-colors " +
                  (tab === t.key
                    ? "bg-card text-ink-900 shadow-[var(--shadow-sm)]"
                    : "text-ink-600 hover:text-ink-900")
                }
              >
                {t.label}
              </button>
            ))}
          </div>
          <label className="relative">
            <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order, name or phone"
              className="h-9 w-64 rounded-md border border-line bg-card pr-3 pl-9 text-[13px] focus:ring-2 focus:ring-brand-400 focus:outline-none"
            />
          </label>
        </div>
        <p className="mb-space-3 text-[12.5px] text-ink-600">
          {TABS.find((t) => t.key === tab)?.hint}
        </p>

        {!orders ? (
          <TableSkeleton rows={6} columns={6} />
        ) : (
          <DataTable
            columns={columns}
            data={visible}
            getRowId={(o) => String(o.id)}
            emptyMessage="No orders to refund here."
          />
        )}
      </Card>

      {openOrderId != null && (
        <OrderDetailDrawer orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
      )}
    </PortalShell>
  );
}
