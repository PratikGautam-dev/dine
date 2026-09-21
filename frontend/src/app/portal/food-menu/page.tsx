"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { CircleCheck, CirclePause, Layers, PackageX, Plus, Search, Soup, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { Switch } from "@/components/ui/Switch";
import { MenuItemPanel } from "@/components/portal/MenuItemPanel";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/portal/StatTile";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { useFoodOrders } from "@/hooks/useFoodOrders";
import { type MenuItem, useMenuItems } from "@/hooks/useMenuItems";
import { cn } from "@/lib/cn";
import { parseOrderTime, rupees } from "@/lib/foodOrders";
import { usePermission } from "@/lib/staffAuth";

const UNCATEGORISED = "__none__";
type AvailabilityView = "all" | "available" | "sold_out" | "out_of_stock";
const DAY_MS = 24 * 60 * 60 * 1000;

function availability(item: MenuItem): Exclude<AvailabilityView, "all"> {
  if (!item.is_available) return "sold_out";
  if (item.stock_count === 0) return "out_of_stock";
  return "available";
}

export default function PortalFoodMenuPage() {
  const { hospital, ready } = usePortalGuard();
  // Backend route guards already 403 the actual mutations for a tenant
  // lacking manage_food_ordering -- this is just a UI convenience, same
  // "fails open while hospital hasn't loaded" shape the Tables page's own
  // canManageDoctors check already uses. The person's role has to allow menu changes too.
  const canWriteMenu = usePermission("food_menu", "write");
  const canManage = (!hospital || hospital.admin_capabilities?.includes("manage_food_ordering")) && canWriteMenu;
  const {
    items, categories, error, busyId,
    showForm, editingId, form, setForm, formError, saving,
    openAddForm, openEditForm, cancelForm, handleSave, handleRestock, handleAvailability,
  } = useMenuItems(ready);

  // Popular dishes come from real order lines (last 30 days), only for people who may see orders.
  const canSeeOrders = usePermission("food_orders", "view");
  const { orders } = useFoodOrders(ready && canSeeOrders, "", 30);

  const [categoryFilter, setCategoryFilter] = useState("all");
  const [availabilityView, setAvailabilityView] = useState<AvailabilityView>("all");
  const [search, setSearch] = useState("");

  const stats = useMemo(() => {
    const all = items || [];
    return {
      total: all.length,
      available: all.filter((i) => availability(i) === "available").length,
      soldOut: all.filter((i) => availability(i) === "sold_out").length,
      outOfStock: all.filter((i) => availability(i) === "out_of_stock").length,
      categories: new Set(all.map((i) => (i.category || "").trim()).filter(Boolean)).size,
    };
  }, [items]);

  // The category tabs: every category in use with its count, plus "Uncategorised" only if something is in it.
  const tabs = useMemo(() => {
    const all = items || [];
    const counts = new Map<string, number>();
    for (const i of all) {
      const key = (i.category || "").trim() || UNCATEGORISED;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const named = [...counts.keys()].filter((k) => k !== UNCATEGORISED).sort((a, b) => a.localeCompare(b));
    return [
      { id: "all", label: "All", count: all.length },
      ...named.map((k) => ({ id: k, label: k, count: counts.get(k) || 0 })),
      ...(counts.has(UNCATEGORISED) ? [{ id: UNCATEGORISED, label: "Uncategorised", count: counts.get(UNCATEGORISED) || 0 }] : []),
    ];
  }, [items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items || []).filter((i) => {
      const cat = (i.category || "").trim() || UNCATEGORISED;
      if (categoryFilter !== "all" && cat !== categoryFilter) return false;
      if (availabilityView !== "all" && availability(i) !== availabilityView) return false;
      return !q || i.name.toLowerCase().includes(q) || (i.description || "").toLowerCase().includes(q) || (i.category || "").toLowerCase().includes(q);
    });
  }, [items, categoryFilter, availabilityView, search]);

  // Most-ordered dishes over the last 30 days, from the order lines themselves (cancelled orders left out).
  const popular = useMemo(() => {
    if (!orders) return null;
    const cutoff = new Date().getTime() - 30 * DAY_MS;
    const byItem = new Map<string, { name: string; orders: number; quantity: number; paise: number }>();
    for (const o of orders) {
      if (o.status === "cancelled" || parseOrderTime(o.created_at).getTime() < cutoff) continue;
      for (const line of o.items || []) {
        const row = byItem.get(line.menu_item_id) || { name: line.item_name_snapshot, orders: 0, quantity: 0, paise: 0 };
        row.orders += 1;
        row.quantity += line.quantity;
        row.paise += line.quantity * line.unit_price_paise_snapshot;
        byItem.set(line.menu_item_id, row);
      }
    }
    return [...byItem.values()].sort((a, b) => b.quantity - a.quantity || b.paise - a.paise).slice(0, 5);
  }, [orders]);

  const editingItem = useMemo(() => (editingId ? (items || []).find((i) => i.id === editingId) ?? null : null), [items, editingId]);

  const columns = useMemo<ColumnDef<MenuItem>[]>(
    () => [
      {
        id: "item",
        header: "Item",
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div className="flex min-w-[220px] items-center gap-space-3">
              {item.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image_url} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-md object-cover"
                  onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                />
              ) : (
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                  <Utensils size={18} />
                </span>
              )}
              <div className="min-w-0">
                <div className="font-semibold text-ink-900">{item.name}</div>
                {item.description && <div className="max-w-[260px] truncate text-[12px] text-ink-600">{item.description}</div>}
              </div>
            </div>
          );
        },
      },
      {
        id: "category",
        header: "Category",
        cell: ({ row }) =>
          row.original.category ? (
            <span className="whitespace-nowrap rounded-full bg-paper px-space-2 py-0.5 text-[12px] font-semibold text-ink-600">{row.original.category}</span>
          ) : (
            <span className="text-ink-400">—</span>
          ),
      },
      {
        id: "price",
        header: "Price",
        cell: ({ row }) => <span className="whitespace-nowrap font-semibold tabular-nums text-ink-900">{rupees(row.original.price_paise)}</span>,
      },
      {
        id: "stock",
        header: "Stock",
        cell: ({ row }) => {
          const item = row.original;
          if (item.stock_count === null) return <span className="whitespace-nowrap text-ink-600">Unlimited</span>;
          return (
            <div className="flex items-center gap-space-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
              <span className={cn("min-w-[52px] tabular-nums", item.stock_count === 0 ? "font-semibold text-destructive" : "text-ink-900")}>
                {item.stock_count} left
              </span>
              {canManage && [5, 10].map((n) => (
                <button
                  key={n} type="button" disabled={busyId === item.id} onClick={() => handleRestock(item, n)}
                  aria-label={`Add ${n} to ${item.name}`}
                  className="rounded-md border border-line bg-card px-space-2 py-0.5 text-[12px] font-semibold text-ink-900 hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50"
                >
                  +{n}
                </button>
              ))}
            </div>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => {
          const item = row.original;
          const state = availability(item);
          return (
            <div className="flex items-center gap-space-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
              <Switch
                tone="success"
                checked={item.is_available}
                onChange={() => handleAvailability(item, !item.is_available)}
                disabled={busyId === item.id || !canManage}
                aria-label={`${item.name} is available`}
              />
              <Badge tone={state === "available" ? "success" : state === "out_of_stock" ? "clay" : "neutral"}>
                {state === "available" ? "Available" : state === "out_of_stock" ? "Out of stock" : "Sold out"}
              </Badge>
            </div>
          );
        },
      },
    ],
    [busyId, canManage, handleAvailability, handleRestock],
  );

  return (
    <PortalShell hospital={hospital} active="food-menu">
      <PageHeader
        title="Menu"
        icon={<Soup size={22} />}
        description="What guests can order for takeaway or delivery through WhatsApp."
        actions={canManage && <Button size="md" onClick={openAddForm}><Plus size={14} /> Add item</Button>}
      />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}
      {!canManage && (
        <p className="mb-space-4 text-[13px] text-ink-400">
          Menu management isn&apos;t available for your account type. Contact support if you need changes made.
        </p>
      )}

      {items && (
        <div className="mb-space-4 grid grid-cols-1 gap-space-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <StatTile icon={<Soup size={22} />} label="Menu items" value={stats.total} deltaPct={null} hint="On your menu" />
          <StatTile icon={<CircleCheck size={22} />} label="Available" value={stats.available} deltaPct={null} hint="Guests can order" />
          <StatTile icon={<CirclePause size={22} />} label="Sold out" value={stats.soldOut} deltaPct={null} hint="Switched off" />
          <StatTile icon={<PackageX size={22} />} label="Out of stock" value={stats.outOfStock} deltaPct={null} hint="Stock count is 0" />
          <StatTile icon={<Layers size={22} />} label="Categories" value={stats.categories} deltaPct={null} hint="Guests browse by these" />
        </div>
      )}

      <div className={cn("grid grid-cols-1 items-start gap-space-4", showForm && "xl:grid-cols-[minmax(0,1fr)_380px]")}>
        {/* the add / edit panel: beside the list on wide screens, above it on narrower ones */}
        {showForm && (
          <div className="xl:col-start-2 xl:row-start-1">
            <MenuItemPanel
              key={editingId ?? "new"}
              form={form} setForm={setForm} item={editingItem}
              categories={categories} formError={formError} saving={saving} busy={busyId !== null}
              onSubmit={handleSave} onCancel={cancelForm} onRestock={handleRestock} onAvailability={handleAvailability}
            />
          </div>
        )}

        <div className="min-w-0 xl:col-start-1 xl:row-start-1">
          <div className="mb-space-3 flex flex-wrap gap-space-2">
            {tabs.map((t) => (
              <button
                key={t.id} type="button" onClick={() => setCategoryFilter(t.id)}
                className={cn(
                  "rounded-full border px-space-3 py-space-1 text-[12.5px] font-semibold transition-colors duration-150",
                  categoryFilter === t.id
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-line bg-card text-ink-600 hover:border-brand-300 hover:bg-brand-50",
                )}
              >
                {t.label}
                <span className={cn("ml-space-1 tabular-nums", categoryFilter === t.id ? "text-white/80" : "text-ink-400")}>{t.count}</span>
              </button>
            ))}
          </div>

          <div className="mb-space-3 flex flex-wrap items-center gap-space-3">
            <div className="relative min-w-[200px] flex-1">
              <Search size={14} className="pointer-events-none absolute left-space-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                type="text" placeholder="Search items…" value={search} onChange={(e) => setSearch(e.target.value)}
                className="h-10 w-full rounded-md border border-line bg-card pl-space-8 pr-space-3 text-[13px] text-ink-900 outline-none focus:border-brand-400"
              />
            </div>
            <select
              aria-label="Filter by availability" value={availabilityView} onChange={(e) => setAvailabilityView(e.target.value as AvailabilityView)}
              className="h-10 rounded-md border border-line bg-card px-space-3 text-[13px] text-ink-900"
            >
              <option value="all">All items</option>
              <option value="available">Available</option>
              <option value="sold_out">Sold out</option>
              <option value="out_of_stock">Out of stock</option>
            </select>
          </div>

          <Card className="p-space-4">
            {!items ? (
              <p className="py-space-4 text-center text-[13px] text-ink-400">Loading…</p>
            ) : items.length === 0 ? (
              <p className="py-space-4 text-center text-[13px] text-ink-400">No menu items yet. Add your first one above.</p>
            ) : visible.length === 0 ? (
              <p className="py-space-4 text-center text-[13px] text-ink-400">No items match your search or filter.</p>
            ) : (
              <DataTable
                columns={columns} data={visible} getRowId={(i) => i.id}
                onRowClick={canManage ? (i) => openEditForm(i) : undefined}
                rowClassName={(i) => cn(canManage && "cursor-pointer", editingId === i.id && "bg-brand-50")}
              />
            )}
          </Card>

          {popular && (
            <Card className="mt-space-4 p-space-4">
              <div className="mb-space-3">
                <h3 className="text-[15px] font-bold text-ink-900">Popular dishes</h3>
                <p className="text-hint">Most ordered in the last 30 days, from real orders</p>
              </div>
              {popular.length === 0 ? (
                <p className="py-space-4 text-center text-[13px] text-ink-400">No orders in the last 30 days.</p>
              ) : (
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] font-semibold tracking-[0.06em] text-ink-400 uppercase">
                      <th className="w-8 py-space-1">#</th>
                      <th className="py-space-1">Dish</th>
                      <th className="py-space-1 text-right">Orders</th>
                      <th className="py-space-1 text-right">Sold</th>
                      <th className="py-space-1 text-right">Order value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {popular.map((p, i) => (
                      <tr key={p.name} className="border-t border-line">
                        <td className="py-space-2 text-ink-400">{i + 1}</td>
                        <td className="py-space-2 font-semibold text-ink-900">{p.name}</td>
                        <td className="py-space-2 text-right tabular-nums text-ink-600">{p.orders}</td>
                        <td className="py-space-2 text-right tabular-nums text-ink-600">{p.quantity}</td>
                        <td className="py-space-2 text-right font-semibold tabular-nums text-ink-900">{rupees(p.paise)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          )}
        </div>
      </div>
    </PortalShell>
  );
}
