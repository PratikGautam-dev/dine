"use client";

import { Armchair, Ban, Calendar, CheckCircle2, Edit3, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { formatTimeOnly } from "@/lib/formatDate";
import type { RestaurantTable } from "@/hooks/useRestaurantTables";

const STATUS_BADGE: Record<RestaurantTable["status"], "success" | "brand" | "violet"> = {
  free: "success", occupied: "brand", needs_cleaning: "violet", blocked: "violet",
};

function statusBadgeTone(t: RestaurantTable): "success" | "brand" | "violet" | "warning" {
  if (t.status === "free" && t.is_reserved_soon) return "warning";
  return STATUS_BADGE[t.status];
}

function statusLabel(t: RestaurantTable): string {
  if (t.status === "free" && t.is_reserved_soon) return "Reserved";
  if (t.status === "free") return "Available";
  if (t.status === "occupied") return "Occupied";
  if (t.status === "needs_cleaning") return "Needs cleaning";
  return "Blocked";
}

function Row({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-space-2 py-space-2 text-[13px]">
      <span className="flex items-center gap-space-2 text-ink-600"><Icon size={14} className="text-ink-400" /> {label}</span>
      <span className="font-semibold text-ink-900">{value}</span>
    </div>
  );
}

export function TableDetailsPanel({
  table, canWrite, statusActingId, onSeat, onNeedsCleaning, onClear, onBlock, onUnblock, onEdit,
}: {
  table: RestaurantTable | null;
  canWrite: boolean;
  statusActingId: string | null;
  onSeat: (id: string) => void;
  onNeedsCleaning: (id: string) => void;
  onClear: (id: string) => void;
  onBlock: (id: string) => void;
  onUnblock: (id: string) => void;
  onEdit: (table: RestaurantTable) => void;
}) {
  if (!table) {
    return (
      <Card className="p-space-4">
        <h3 className="mb-space-2 text-[15px] font-bold text-ink-900">Table Details</h3>
        <p className="text-[13px] text-ink-400">Click a table on the floor map to see its details here.</p>
      </Card>
    );
  }

  const busy = statusActingId === table.id;
  const occ = table.current_occupant;

  return (
    <Card className="p-space-4">
      <div className="mb-space-3 flex items-center justify-between">
        <div className="flex items-center gap-space-2">
          <Armchair size={18} className="text-brand-600" />
          <div>
            <h3 className="text-[15px] font-bold text-ink-900">{table.name}</h3>
            <p className="text-hint">Table for {table.capacity} · {table.department_name}</p>
          </div>
        </div>
        <Badge tone={statusBadgeTone(table)}>{statusLabel(table)}</Badge>
      </div>

      <div className="divide-y divide-line border-t border-line">
        <Row icon={Users} label="Capacity" value={`${table.capacity} guests`} />
        <Row icon={Users} label="Current Guests" value={occ ? String(occ.party_size ?? "—") : "—"} />
        <Row icon={Calendar} label="Booking Reference" value={occ?.reference_id || "—"} />
        <Row icon={Calendar} label="Arrival Time" value={occ?.arrived_at ? formatTimeOnly(occ.arrived_at) : "—"} />
        <Row icon={Calendar} label="Expected Release" value={occ?.expected_release_at ? formatTimeOnly(occ.expected_release_at) : "—"} />
      </div>

      {table.notes && (
        <div className="mt-space-3 rounded-md bg-paper p-space-2 text-[12.5px] text-ink-600">{table.notes}</div>
      )}

      {canWrite && (
        <div className="mt-space-4 grid grid-cols-2 gap-space-2">
          {(table.status === "free") && (
            <button
              type="button" disabled={busy} onClick={() => onSeat(table.id)}
              className="col-span-2 flex items-center justify-center gap-1 rounded-md bg-brand-600 px-space-3 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <CheckCircle2 size={14} /> {table.is_reserved_soon ? "Seat reservation" : "Seat walk-in"}
            </button>
          )}
          {table.status === "occupied" && (
            <button
              type="button" disabled={busy} onClick={() => onClear(table.id)}
              className="col-span-2 flex items-center justify-center gap-1 rounded-md bg-brand-600 px-space-3 py-2 text-[12.5px] font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              <CheckCircle2 size={14} /> Clear table
            </button>
          )}
          {(table.status === "free" || table.status === "occupied") && (
            <button
              type="button" disabled={busy} onClick={() => onNeedsCleaning(table.id)}
              className="flex items-center justify-center gap-1 rounded-md border border-line bg-card px-space-2 py-2 text-[12px] font-semibold text-ink-600 hover:bg-paper disabled:opacity-50"
            >
              <Sparkles size={14} /> Needs cleaning
            </button>
          )}
          {table.status === "needs_cleaning" && (
            <button
              type="button" disabled={busy} onClick={() => onClear(table.id)}
              className="flex items-center justify-center gap-1 rounded-md border border-line bg-card px-space-2 py-2 text-[12px] font-semibold text-ink-600 hover:bg-paper disabled:opacity-50"
            >
              <Sparkles size={14} /> Mark cleaned
            </button>
          )}
          {table.status === "blocked" ? (
            <button
              type="button" disabled={busy} onClick={() => onUnblock(table.id)}
              className="flex items-center justify-center gap-1 rounded-md border border-line bg-card px-space-2 py-2 text-[12px] font-semibold text-ink-600 hover:bg-paper disabled:opacity-50"
            >
              <Ban size={14} /> Unblock
            </button>
          ) : (
            (table.status === "free" || table.status === "needs_cleaning") && (
              <button
                type="button" disabled={busy} onClick={() => onBlock(table.id)}
                className="flex items-center justify-center gap-1 rounded-md border border-line bg-card px-space-2 py-2 text-[12px] font-semibold text-ink-600 hover:bg-paper disabled:opacity-50"
              >
                <Ban size={14} /> Block table
              </button>
            )
          )}
          <button
            type="button" onClick={() => onEdit(table)}
            className="col-span-2 flex items-center justify-center gap-1 rounded-md border border-line bg-card px-space-2 py-2 text-[12px] font-semibold text-ink-600 hover:bg-paper"
          >
            <Edit3 size={14} /> Edit table
          </button>
        </div>
      )}
    </Card>
  );
}
