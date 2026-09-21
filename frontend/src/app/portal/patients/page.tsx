"use client";

import { useMemo } from "react";
import { CalendarDays, CircleCheck, Repeat, Search, Ticket, Trash2, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { DepartmentDonut } from "@/components/portal/DepartmentDonut";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/portal/StatTile";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { usePatients, type Patient } from "@/hooks/usePatients";
import { createPatientColumns } from "./_components/patients-columns";

const DAY_MS = 24 * 60 * 60 * 1000;
// The list API returns at most this many guests (most recently seen first).
const DIRECTORY_LIMIT = 200;

export default function PortalPatientsPage() {
  const router = useRouter();
  const { hospital, ready } = usePortalGuard();
  const {
    patients,
    directory,
    error,
    search,
    setSearch,
    selected,
    toggleSelected,
    toggleSelectAll,
    selectedPatients,
    allSelected,
    pendingDelete,
    setPendingDelete,
    deleting,
    runDelete,
  } = usePatients(ready);

  const columns = useMemo(
    () =>
      createPatientColumns({
        selected, toggleSelected, toggleSelectAll, allSelected,
        onDelete: (p: Patient) => setPendingDelete([p]),
      }),
    [selected, toggleSelected, toggleSelectAll, allSelected, setPendingDelete],
  );

  // Everything below describes the whole directory (not the current search) and comes from the guests' own booking
  // counts and last-visit dates -- no loyalty tiers or spend, which this app doesn't track.
  const summary = useMemo(() => {
    const all = directory || [];
    const cutoff = new Date().getTime() - 30 * DAY_MS;
    const byBookings = [
      { department_name: "1 booking", count: all.filter((p) => p.visit_count === 1).length },
      { department_name: "2–3 bookings", count: all.filter((p) => p.visit_count >= 2 && p.visit_count <= 3).length },
      { department_name: "4 or more", count: all.filter((p) => p.visit_count >= 4).length },
    ].filter((s) => s.count > 0);
    return {
      total: all.length,
      returning: all.filter((p) => p.visit_count >= 2).length,
      visited: all.filter((p) => p.visited_count >= 1).length,
      active30: all.filter((p) => p.last_visit && new Date(p.last_visit).getTime() >= cutoff).length,
      bookings: all.reduce((sum, p) => sum + p.visit_count, 0),
      byBookings,
      top: [...all]
        .filter((p) => p.visited_count > 0 || p.visit_count > 1)
        .sort((a, b) => b.visited_count - a.visited_count || b.visit_count - a.visit_count)
        .slice(0, 5),
    };
  }, [directory]);

  return (
    <PortalShell hospital={hospital} active="patients">
        <PageHeader
          title="Guests"
          icon={<Users size={22} />}
          description="Everyone who has booked with you. Open a guest to see their full history."
        />
        {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

        {directory && (
          <>
            <div className="mb-space-4 grid grid-cols-1 gap-space-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <StatTile icon={<Users size={22} />} label="Guests" value={summary.total} deltaPct={null} hint="In your directory" />
              <StatTile icon={<Repeat size={22} />} label="Returning" value={summary.returning} deltaPct={null} hint="Booked 2 or more times" />
              <StatTile icon={<CircleCheck size={22} />} label="Have visited" value={summary.visited} deltaPct={null} hint="Marked as attended" />
              <StatTile icon={<CalendarDays size={22} />} label="Active, last 30 days" value={summary.active30} deltaPct={null} hint="Booked or visited recently" />
              <StatTile icon={<Ticket size={22} />} label="Bookings" value={summary.bookings} deltaPct={null} hint="Made by these guests" />
            </div>
            {directory.length >= DIRECTORY_LIMIT && (
              <p className="mb-space-3 text-[12px] text-ink-400">
                Showing your {DIRECTORY_LIMIT} most recently seen guests; the counts below cover those.
              </p>
            )}
          </>
        )}

        <div className="mb-space-3 flex flex-col gap-space-3 sm:flex-row sm:items-center sm:justify-between sm:gap-space-4">
          <div className="relative w-full flex-1 sm:max-w-[360px]">
            <Search size={15} className="absolute top-1/2 left-space-3 -translate-y-1/2 text-ink-400" />
            <Input
              placeholder="Search by name or phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {selectedPatients.length > 0 && (
            <PermissionGate page="patients" action="delete">
              <Button
                variant="destructive"
                size="md"
                onClick={() => setPendingDelete(selectedPatients)}
              >
                <Trash2 size={15} />
                Delete selected ({selectedPatients.length})
              </Button>
            </PermissionGate>
          )}
        </div>

        <Card className="p-space-4">
          {!patients ? (
            <p className="text-[13px] text-ink-400">Loading…</p>
          ) : patients.length === 0 ? (
            <div className="py-space-6 text-center">
              <UserRound size={28} className="mx-auto mb-space-2 text-ink-300" />
              <p className="text-[13px] text-ink-400">
                {search ? "No guests match that search." : "No guests yet — they appear here after a first booking."}
              </p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={patients}
              getRowId={(p) => String(p.id)}
              onRowClick={(p) => router.push(`/portal/patients/${p.id}`)}
            />
          )}
        </Card>

        {directory && (
          <div className="mt-space-4 grid grid-cols-1 gap-space-4 lg:grid-cols-2">
            <DepartmentDonut
              data={summary.byBookings}
              title="Guests by number of bookings"
              subtitle="How often your guests come back"
              unit="guests"
              emptyText="No guests yet."
            />
            <Card className="p-space-4">
              <div className="mb-space-3">
                <h3 className="text-[15px] font-bold text-ink-900">Most frequent guests</h3>
                <p className="text-hint">By visits, then bookings</p>
              </div>
              {summary.top.length === 0 ? (
                <div className="flex h-[200px] items-center justify-center text-[13px] text-ink-400">
                  No repeat or visiting guests yet.
                </div>
              ) : (
                <ol className="divide-y divide-line">
                  {summary.top.map((p, i) => (
                    <li key={p.id}>
                      <Link href={`/portal/patients/${p.id}`} className="flex items-center gap-space-3 py-space-2 hover:opacity-80">
                        <span className="w-5 text-[12px] font-semibold text-ink-400">{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold text-ink-900">{p.name || p.phone}</span>
                          {p.name && <span className="block text-[12px] text-ink-600">{p.phone}</span>}
                        </span>
                        <span className="text-right text-[12.5px] tabular-nums text-ink-600">
                          <span className="font-semibold text-ink-900">{p.visited_count}</span> visited · {p.visit_count} booked
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>
        )}

        <ConfirmDialog
          open={pendingDelete !== null}
          title={pendingDelete && pendingDelete.length > 1 ? `Delete ${pendingDelete.length} guests?` : "Delete guest?"}
          message={
            pendingDelete
              ? `This will permanently delete ${
                  pendingDelete.length > 1 ? `${pendingDelete.length} guest records` : pendingDelete[0].name || pendingDelete[0].phone
                }. This action is irreversible.`
              : ""
          }
          confirmLabel="Delete"
          destructive
          busy={deleting}
          onConfirm={() => pendingDelete && runDelete(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
    </PortalShell>
  );
}
