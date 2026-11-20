"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Bike, Building2, Eye, Globe, Plus, Power, Store } from "lucide-react";
import { Badge } from "@/components/erp-ui/Badge";
import { DataTable } from "@/components/erp-ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { BranchFormDialog } from "@/components/portal/BranchFormDialog";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/portal/StatTile";
import { usePermission, useStaffSession } from "@/lib/staffAuth";
import {
  emptyBranchForm,
  useBranchManagement,
  type BranchForm,
} from "@/hooks/useBranchManagement";
import type { Branch } from "@/lib/branchContext";
import { formatPhone } from "@/lib/erp/phone";

/** What a branch takes on: the "Does" column. */
function branchDoes(b: Branch): string[] {
  return [
    b.accepts_online !== false && "Takes website orders",
    b.accepts_whatsapp !== false && "Takes WhatsApp orders",
    b.tables_enabled && "Dine-in tables",
  ].filter((x): x is string => Boolean(x));
}

export default function BranchesSettingsPage() {
  const router = useRouter();
  const session = useStaffSession();
  const canView = usePermission("settings", "view");
  const {
    branches,
    error,
    saving,
    createBranch,
  } = useBranchManagement(canView);

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<BranchForm>(emptyBranchForm());
  const [formError, setFormError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const all = branches ?? [];
    return {
      total: all.length,
      active: all.filter((b) => b.is_active).length,
      online: all.filter((b) => b.is_active && b.accepts_online !== false).length,
      whatsapp: all.filter((b) => b.is_active && b.accepts_whatsapp !== false).length,
    };
  }, [branches]);

  function openAdd() {
    setForm(emptyBranchForm());
    setFormError(null);
    setAdding(true);
  }

  async function handleSubmit() {
    setFormError(null);
    const problem = await createBranch(form);
    if (problem) setFormError(problem);
    else setAdding(false);
  }

  // Cells don't wrap (whitespace-nowrap), so a narrow window scrolls the table sideways instead of squeezing the columns.
  const columns = useMemo<ColumnDef<Branch, unknown>[]>(
    () => [
      {
        header: "Branch",
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            <p className="font-semibold text-ink-900">
              {row.original.name}
              {row.original.is_default && (
                <Badge tone="brand" className="ml-1.5">
                  Default
                </Badge>
              )}
            </p>
            <p className="text-[12px] text-ink-400">
              {[row.original.address_line, formatPhone(row.original.phone)].filter(Boolean).join(" · ")}
            </p>
          </div>
        ),
      },
      {
        header: "Location",
        cell: ({ row }) => (
          <span className="whitespace-nowrap">
            {row.original.city || <span className="text-ink-400">—</span>}
          </span>
        ),
      },
      {
        header: "Does",
        cell: ({ row }) => {
          const does = branchDoes(row.original);
          return (
            <span className="whitespace-nowrap">
              {does.length ? does.join(" · ") : <span className="text-ink-400">Nothing switched on</span>}
            </span>
          );
        },
      },
      {
        header: "Status",
        cell: ({ row }) => (
          <Badge tone={row.original.is_active ? "success" : "neutral"}>
            {row.original.is_active ? "active" : "inactive"}
          </Badge>
        ),
      },
      {
        header: "",
        id: "actions",
        cell: ({ row }) => (
          <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <Link href={`/portal/settings/branches/${row.original.id}`} aria-label={`View ${row.original.name}`}>
              <Button variant="ghost" tabIndex={-1}>
                <Eye size={15} /> View
              </Button>
            </Link>
          </div>
        ),
      },
    ],
    [],
  );

  if (!canView) {
    return (
      <PortalShell restaurant={session?.restaurant || null} active="branches">
        <p className="text-[13px] text-ink-400">You don&apos;t have access to Settings.</p>
      </PortalShell>
    );
  }

  return (
    <PortalShell restaurant={session?.restaurant || null} active="branches">
      <PageHeader
        icon={<Building2 size={20} />}
        title="Branches"
        description="Your stores and locations. Use the branch switcher at the top to filter the portal by branch."
        actions={
          <PermissionGate page="settings" action="write">
            <Button onClick={openAdd}>
              <Plus size={16} /> Add branch
            </Button>
          </PermissionGate>
        }
      />
      {error && <p className="mb-space-3 text-[13px] font-medium text-error">{error}</p>}
      <div className="mb-space-4 grid grid-cols-2 gap-space-3 xl:grid-cols-4">
        <StatTile
          icon={<Store size={22} />}
          label="Total Branches"
          value={counts.total}
          deltaPct={null}
          hint="Across this account"
          tone="brand"
          filled
        />
        <StatTile
          icon={<Power size={22} />}
          label="Active Branches"
          value={counts.active}
          deltaPct={null}
          hint={`${counts.total - counts.active} inactive`}
          tone="info"
          filled
        />
        <StatTile
          icon={<Globe size={22} />}
          label="Accepting Website Orders"
          value={counts.online}
          deltaPct={null}
          hint="Of active branches"
          tone="warning"
          filled
        />
        <StatTile
          icon={<Bike size={22} />}
          label="Offered on WhatsApp"
          value={counts.whatsapp}
          deltaPct={null}
          hint="Of active branches"
          tone="violet"
          filled
        />
      </div>

      <Card className="p-space-2">
        <DataTable
          columns={columns}
          data={branches ?? []}
          getRowId={(b) => b.id}
          onRowClick={(b) => router.push(`/portal/settings/branches/${b.id}`)}
          loading={!branches}
          emptyMessage={!branches ? "Loading branches…" : "No branches yet."}
        />
      </Card>
      <p className="mt-space-3 text-[12.5px] text-ink-400">
        Branches are never deleted, because orders, bookings and reports refer to them. Deactivate a
        branch to retire it.
      </p>

      {adding && (
        <BranchFormDialog
          title="Add a branch"
          form={form}
          onChange={(patch) => setForm({ ...form, ...patch })}
          onSubmit={handleSubmit}
          onClose={() => setAdding(false)}
          saving={saving}
          error={formError}
        />
      )}
    </PortalShell>
  );
}
