"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Bike, Globe, MapPin, Pencil, Phone, Plus, Power, Search, Store,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Switch } from "@/components/ui/Switch";
import { BranchFormDialog } from "@/components/portal/BranchFormDialog";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/portal/StatTile";
import { usePermission, useStaffSession } from "@/lib/staffAuth";
import {
  emptyBranchForm, toBranchForm, useBranchManagement, type BranchForm,
} from "@/hooks/useBranchManagement";
import type { Branch } from "@/lib/branchContext";
import { rupees } from "@/lib/foodOrders";

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-label mb-0.5 font-medium text-ink-600">{label}</p>
      <p className="text-[13.5px] text-ink-900">{value || "—"}</p>
    </div>
  );
}

export default function BranchesSettingsPage() {
  const session = useStaffSession();
  const canView = usePermission("settings", "view");
  const canWrite = usePermission("settings", "write");
  const {
    multiBranchEnabled, branches, error, saving, togglingId,
    toggleMultiBranch, createBranch, updateBranch, setBranchActive,
  } = useBranchManagement(canView);

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [dialog, setDialog] = useState<{ kind: "add" } | { kind: "edit"; branch: Branch } | null>(null);
  const [form, setForm] = useState<BranchForm>(emptyBranchForm());
  const [formError, setFormError] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return branches ?? [];
    return (branches ?? []).filter((b) => [b.name, b.city ?? "", b.address_line ?? ""].some((v) => v.toLowerCase().includes(q)));
  }, [branches, search]);

  const selected = useMemo(() => (branches ?? []).find((b) => b.id === selectedId) ?? visible[0] ?? null, [branches, visible, selectedId]);

  const counts = useMemo(() => {
    const all = branches ?? [];
    return {
      total: all.length,
      active: all.filter((b) => b.is_active).length,
      online: all.filter((b) => b.is_active && b.accepts_online !== false).length,
      whatsapp: all.filter((b) => b.is_active && b.accepts_whatsapp !== false).length,
    };
  }, [branches]);

  if (!canView) {
    return (
      <PortalShell hospital={session?.hospital || null} active="branches">
        <p className="text-[13px] text-ink-400">You don&apos;t have access to Settings.</p>
      </PortalShell>
    );
  }

  function openAdd() {
    setForm(emptyBranchForm());
    setFormError(null);
    setDialog({ kind: "add" });
  }

  function openEdit(branch: Branch) {
    setForm(toBranchForm(branch));
    setFormError(null);
    setDialog({ kind: "edit", branch });
  }

  async function handleSubmit() {
    setFormError(null);
    const problem = dialog?.kind === "edit" ? await updateBranch(dialog.branch.id, form) : await createBranch(form);
    if (problem) setFormError(problem);
    else setDialog(null);
  }

  const columns = useMemo<ColumnDef<Branch>[]>(
    () => [
      {
        id: "name",
        header: "Branch Name",
        cell: ({ row }) => (
          <div className="flex items-center gap-space-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
              <Store size={16} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-space-2">
                <p className="truncate text-[13.5px] font-bold text-ink-900">{row.original.name}</p>
                {row.original.is_default && <Badge tone="brand">Default</Badge>}
              </div>
              {row.original.address_line && <p className="truncate text-[12px] text-ink-500">{row.original.address_line}</p>}
            </div>
          </div>
        ),
      },
      { id: "city", header: "City", cell: ({ row }) => <span className="text-[13px] text-ink-700">{row.original.city || "—"}</span> },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => <Badge tone={row.original.is_active ? "success" : "neutral"}>{row.original.is_active ? "Active" : "Inactive"}</Badge>,
      },
      {
        id: "online",
        header: "Website",
        cell: ({ row }) => (
          <Badge tone={row.original.accepts_online !== false ? "success" : "clay"}>{row.original.accepts_online !== false ? "Enabled" : "Disabled"}</Badge>
        ),
      },
      {
        id: "whatsapp",
        header: "WhatsApp",
        cell: ({ row }) => (
          <Badge tone={row.original.accepts_whatsapp !== false ? "success" : "clay"}>{row.original.accepts_whatsapp !== false ? "Enabled" : "Disabled"}</Badge>
        ),
      },
      {
        id: "min_order",
        header: "Min. Order",
        cell: ({ row }) => <span className="text-[13px] tabular-nums text-ink-700">{row.original.min_order_paise != null ? rupees(row.original.min_order_paise) : "—"}</span>,
      },
    ],
    [],
  );

  return (
    <PortalShell hospital={session?.hospital || null} active="branches">
      <PageHeader
        title="Branches"
        icon={<Store size={22} />}
        description="Manage this restaurant's physical locations, onboarding across WhatsApp and the website."
        actions={
          <PermissionGate page="settings" action="write">
            <Button onClick={openAdd}>
              <Plus size={14} /> Add New Branch
            </Button>
          </PermissionGate>
        }
      />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

      <Card className="mb-space-4 flex items-center justify-between p-space-5">
        <div>
          <h2 className="text-[15px] font-bold text-ink-900">Enable multiple branches</h2>
          <p className="text-hint">
            Off means today&apos;s behavior -- one location, no branch question on WhatsApp, no switcher in the portal.
          </p>
        </div>
        <Switch
          checked={multiBranchEnabled}
          onChange={() => toggleMultiBranch(!multiBranchEnabled)}
          disabled={!canWrite || saving}
          aria-label="Enable multiple branches"
        />
      </Card>

      <div className="mb-space-4 grid grid-cols-1 gap-space-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={<Store size={22} />} label="Total Branches" value={counts.total} deltaPct={null} hint="Across this account" tone="brand" filled />
        <StatTile icon={<Power size={22} />} label="Active Branches" value={counts.active} deltaPct={null} hint={`${counts.total - counts.active} inactive`} tone="info" filled />
        <StatTile icon={<Globe size={22} />} label="Accepting Website Orders" value={counts.online} deltaPct={null} hint="Of active branches" tone="warning" filled />
        <StatTile icon={<Bike size={22} />} label="Offered on WhatsApp" value={counts.whatsapp} deltaPct={null} hint="Of active branches" tone="violet" filled />
      </div>

      <div className="grid grid-cols-1 gap-space-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div className="mb-space-3 flex flex-wrap items-center gap-space-2">
            <div className="relative min-w-[220px] flex-1">
              <Search size={14} className="pointer-events-none absolute left-space-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <Input
                aria-label="Search branches" placeholder="Search branches, city, address…" className="pl-9"
                value={search} onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <Card className="p-space-2">
            <h2 className="px-space-2 pt-space-1 pb-space-2 text-[15px] font-bold text-ink-900">Branch Directory ({counts.total})</h2>
            {!branches ? (
              <p className="p-space-4 text-[13px] text-ink-400">Loading…</p>
            ) : (
              <DataTable
                columns={columns}
                data={visible}
                getRowId={(b) => b.id}
                pageSize={10}
                onRowClick={(b) => setSelectedId(b.id)}
                rowClassName={(b) => (selected?.id === b.id ? "cursor-pointer bg-brand-50/60" : "cursor-pointer")}
                emptyMessage={branches.length === 0 ? "No branches yet." : "No branches match that search."}
              />
            )}
          </Card>
        </div>

        <div>
          <Card className="h-fit p-space-5">
            {!selected ? (
              <p className="text-[13px] text-ink-400">Select a branch to see its details.</p>
            ) : (
              <>
                <div className="mb-space-3 flex items-center justify-between">
                  <h2 className="text-[15px] font-bold text-ink-900">Branch Profile</h2>
                  <Badge tone={selected.is_active ? "success" : "neutral"}>{selected.is_active ? "Active" : "Inactive"}</Badge>
                </div>
                <div className="mb-space-4 flex items-center gap-space-3">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                    <Store size={22} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-space-1">
                      <h3 className="truncate text-[15px] font-bold text-ink-900">{selected.name}</h3>
                      {selected.is_default && <Badge tone="brand">Default</Badge>}
                    </div>
                    {(selected.address_line || selected.city) && (
                      <p className="flex items-center gap-1 text-[12.5px] text-ink-600">
                        <MapPin size={12} /> {[selected.address_line, selected.city].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mb-space-4 space-y-space-2 text-[13px]">
                  {selected.phone && <p className="flex items-center gap-space-2 text-ink-700"><Phone size={14} className="text-ink-400" /> {selected.phone}</p>}
                </div>
                <div className="grid grid-cols-1 gap-space-3">
                  <Detail label="Operating Hours" value={selected.operating_hours} />
                  <Detail label="Operating Days" value={selected.operating_days} />
                  <Detail label="Minimum Order" value={selected.min_order_paise != null ? rupees(selected.min_order_paise) : null} />
                  <Detail label="Service Charge" value={selected.service_charge_pct != null ? `${selected.service_charge_pct}%` : null} />
                  <Detail label="Delivery Radius" value={selected.delivery_radius_km != null ? `${selected.delivery_radius_km} km` : null} />
                </div>
                <div className="mt-space-4 flex flex-wrap gap-space-4 border-t border-line pt-space-4 text-[12.5px]">
                  <span className="flex items-center gap-1 font-semibold text-ink-700">
                    <Globe size={13} className={selected.accepts_online !== false ? "text-success" : "text-ink-300"} />
                    Website {selected.accepts_online !== false ? "enabled" : "disabled"}
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-ink-700">
                    <Bike size={13} className={selected.accepts_whatsapp !== false ? "text-success" : "text-ink-300"} />
                    WhatsApp {selected.accepts_whatsapp !== false ? "enabled" : "disabled"}
                  </span>
                </div>
                <PermissionGate page="settings" action="write">
                  <div className="mt-space-5 flex flex-wrap gap-space-2">
                    <Button onClick={() => openEdit(selected)}>
                      <Pencil size={14} /> Edit Branch
                    </Button>
                    {!selected.is_default && (
                      <Button
                        variant={selected.is_active ? "destructive" : "secondary"}
                        disabled={togglingId === selected.id}
                        onClick={() => setBranchActive(selected.id, !selected.is_active)}
                      >
                        <Power size={14} /> {selected.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    )}
                  </div>
                </PermissionGate>
              </>
            )}
          </Card>
        </div>
      </div>

      {dialog && (
        <BranchFormDialog
          title={dialog.kind === "edit" ? `Edit ${dialog.branch.name}` : "Add a branch"}
          form={form}
          onChange={(patch) => setForm({ ...form, ...patch })}
          onSubmit={handleSubmit}
          onClose={() => setDialog(null)}
          saving={saving}
          error={formError}
        />
      )}
    </PortalShell>
  );
}
