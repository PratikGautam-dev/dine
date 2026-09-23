"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Award, Crown, Medal, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/formatDate";
import { rupees } from "@/lib/foodOrders";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import type { Patient } from "@/hooks/usePatients";
import { PatientCellAction } from "./patients-cellaction";

// Demo-seeded (migration 0044's loyalty_tier column) -- no loyalty program exists in this app yet,
// so this map only ever renders whatever tier the row already has, never invents one client-side.
const LOYALTY_STYLES: Record<string, { icon: typeof Crown; className: string }> = {
  VIP: { icon: Crown, className: "bg-warning-tint text-warning" },
  Gold: { icon: Medal, className: "bg-warning-tint text-warning" },
  Silver: { icon: Star, className: "bg-black/[0.04] text-ink-600" },
  Bronze: { icon: Award, className: "bg-clay-100 text-clay-700" },
};

type CreatePatientColumnsOptions = {
  selected: Set<number>;
  toggleSelected: (id: number, checked: boolean) => void;
  toggleSelectAll: (checked: boolean) => void;
  allSelected: boolean;
  onDelete: (patient: Patient) => void;
};

// Same deterministic hash → color-cycle approach as the WhatsApp Inbox conversation list
// (frontend/src/app/portal/messages/page.tsx) so avatars aren't all the same flat brand color.
const AVATAR_TONES = [
  "bg-brand-50 text-brand-700",
  "bg-info-tint text-info",
  "bg-success-tint text-success",
  "bg-warning-tint text-warning",
  "bg-accent-violet-tint text-accent-violet",
  "bg-clay-100 text-clay-700",
];
function avatarTone(label: string): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

/** Column definitions for the /portal/patients DataTable. The row itself is
 * clickable (DataTable's onRowClick, navigates to /portal/patients/[id]);
 * the checkbox and actions-menu cells stop propagation so clicking them
 * doesn't also trigger that navigation. View Details/Delete are combined
 * into one trailing actions menu (PatientCellAction) rather than two
 * separate columns. */
export function createPatientColumns({
  selected, toggleSelected, toggleSelectAll, allSelected, onDelete,
}: CreatePatientColumnsOptions): ColumnDef<Patient>[] {
  return [
    {
      id: "select",
      header: () => (
        <input
          type="checkbox"
          checked={allSelected}
          onChange={(e) => toggleSelectAll(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 accent-brand-600"
          aria-label="Select all guests"
        />
      ),
      cell: ({ row }) => {
        const p = row.original;
        return (
          <input
            type="checkbox"
            checked={selected.has(p.id)}
            onChange={(e) => toggleSelected(p.id, e.target.checked)}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 accent-brand-600"
            aria-label={`Select ${p.name || p.phone}`}
          />
        );
      },
    },
    {
      id: "guest",
      header: "Name",
      cell: ({ row }) => {
        const p = row.original;
        const label = p.name || p.phone;
        return (
          <div className="flex min-w-[170px] items-center gap-space-3">
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold", avatarTone(label))}>
              {(label.trim()[0] || "?").toUpperCase()}
            </span>
            <div className="min-w-0">
              <span className="block truncate font-semibold text-ink-900">{p.name || "Guest"}</span>
              <div className="font-mono text-[11px] text-ink-400">{p.patient_display_id || `#${p.id}`}</div>
            </div>
          </div>
        );
      },
    },
    {
      id: "phone",
      header: "Phone / WhatsApp",
      cell: ({ row }) => (
        <span className="inline-flex items-center gap-space-1 whitespace-nowrap text-ink-600">
          <WhatsAppIcon size={14} />
          {row.original.phone}
        </span>
      ),
    },
    {
      id: "last_visit",
      header: "Last visit",
      cell: ({ row }) => <span className="text-ink-600">{formatDate(row.original.last_visit)}</span>,
    },
    {
      id: "total_orders",
      header: "Total Orders",
      cell: ({ row }) => <span className="tabular-nums text-ink-600">{row.original.total_orders}</span>,
    },
    {
      id: "total_spend",
      header: "Total Spend",
      cell: ({ row }) => <span className="font-semibold tabular-nums text-ink-900">{rupees(row.original.total_spend_paise)}</span>,
    },
    {
      id: "favorite_item",
      header: "Favorite Items",
      cell: ({ row }) => <span className="text-ink-600">{row.original.favorite_item || "—"}</span>,
    },
    {
      id: "loyalty_status",
      header: "Loyalty Status",
      cell: ({ row }) => {
        const tier = row.original.loyalty_tier;
        if (!tier) return <span className="text-ink-400">—</span>;
        const style = LOYALTY_STYLES[tier] ?? { icon: Star, className: "bg-black/[0.04] text-ink-600" };
        const Icon = style.icon;
        return (
          <span className={cn("inline-flex items-center gap-1 rounded-full px-space-2 py-0.5 text-[11.5px] font-bold", style.className)}>
            <Icon size={12} /> {tier}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="text-right">
          <PatientCellAction patient={row.original} onDelete={onDelete} />
        </div>
      ),
    },
  ];
}
