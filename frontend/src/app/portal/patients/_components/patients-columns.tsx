"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/formatDate";
import type { Patient } from "@/hooks/usePatients";
import { PatientCellAction } from "./patients-cellaction";

type CreatePatientColumnsOptions = {
  selected: Set<number>;
  toggleSelected: (id: number, checked: boolean) => void;
  toggleSelectAll: (checked: boolean) => void;
  allSelected: boolean;
  onDelete: (patient: Patient) => void;
};

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
      header: "Guest",
      cell: ({ row }) => {
        const p = row.original;
        const label = p.name || p.phone;
        return (
          <div className="flex min-w-[170px] items-center gap-space-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[13px] font-bold text-brand-700">
              {(label.trim()[0] || "?").toUpperCase()}
            </span>
            <div className="min-w-0">
              <Link
                href={`/portal/patients/${p.id}`}
                onClick={(e) => e.stopPropagation()}
                className="font-semibold text-ink-900 hover:underline"
              >
                {p.name || "Guest"}
              </Link>
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
          <MessageCircle size={14} className="text-ink-400" />
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
      id: "visit_count",
      header: "Booked",
      cell: ({ row }) => <span className="tabular-nums text-ink-600">{row.original.visit_count}</span>,
    },
    {
      id: "visited_count",
      header: "Visited",
      cell: ({ row }) => <span className="tabular-nums text-ink-600">{row.original.visited_count}</span>,
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
