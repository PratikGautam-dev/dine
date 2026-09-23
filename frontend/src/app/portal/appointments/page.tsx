"use client";

import { useMemo, useState } from "react";
import {
  CalendarCheck, CalendarClock, CalendarDays, CircleCheck, Plus, Search, Send, Trash2, UserRound, UserX, X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { QuickActionsBar } from "@/components/portal/QuickActionsBar";
import { usePermission } from "@/lib/staffAuth";
import { BookingCalendar } from "@/components/portal/BookingCalendar";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/portal/StatTile";
import { TodayScheduleCard } from "@/components/portal/TodayScheduleCard";
import { WaitlistQueueCard } from "@/components/portal/WaitlistQueueCard";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { cn } from "@/lib/cn";
import { TYPE_LABELS, type Appointment, type ViewFilter, useAppointments } from "@/hooks/useAppointments";
import { createAppointmentColumns } from "./_components/appointments-columns";

const TYPE_TAB_ORDER = ["all", "new", "followup", "other"];

// The quick views above the list; empty rare ones (Rescheduled) only appear once something is in them.
// "Pending" (Table Bookings follow-up) only ever has rows when the hospital opted into
// require_booking_confirmation -- always shown, but reads as "0" for every other hospital.
const VIEW_TABS: { id: ViewFilter; label: string; always: boolean }[] = [
  { id: "all", label: "All", always: true },
  { id: "today", label: "Today", always: true },
  { id: "upcoming", label: "Upcoming", always: true },
  { id: "pending", label: "Pending", always: false },
  { id: "attended", label: "Attended", always: true },
  { id: "cancelled", label: "Cancelled", always: true },
  { id: "no_show", label: "No-show", always: true },
  { id: "rescheduled", label: "Rescheduled", always: false },
];

export default function PortalAppointmentsPage() {
  const { hospital, ready } = usePortalGuard();
  const canWrite = usePermission("appointments", "write");
  const [activeId, setActiveId] = useState<number | null>(null);
  const {
    appointments, error, filteredAppointments, typeCounts, viewCounts, todaySchedule, occupiedTableIds,
    confirmBooking, sendReminder, viewFilter, setViewFilter,
    searchQuery, setSearchQuery, typeFilter, setTypeFilter,
    cancellingId, cancelPanelId, cancelMessage, setCancelMessage, openCancelPanel, closeCancelPanel, handleCancel,
    reschedulePanelId, reschedulingId, rescheduleCtx, rescheduleErrors, rescheduleMessage, setRescheduleMessage,
    rDepartmentId, setRDepartmentId, rDoctorId, setRDoctorId, rDate, setRDate, rSlotId, setRSlotId,
    rDoctors, rDatesForDoctor, rSlotsForDate, rTableSlots, rTableDates, rTableSlotsForDate,
    openReschedulePanel, closeReschedulePanel, handleReschedule,
    reassignPanelId, reassigningId, reassignTables, reassignTableId, setReassignTableId, reassignErrors,
    openReassignPanel, closeReassignPanel, handleReassignTable,
    markingAttendanceId, handleAttendance,
    deletingId, handleDelete,
    selected, toggleSelected, toggleSelectAll, deletableAppointments, selectedAppointments, allSelected,
    pendingDelete, setPendingDelete, bulkDeleting, runBulkDelete,
  } = useAppointments(ready);

  const columns = useMemo(
    () =>
      createAppointmentColumns({
        canWrite, selected, toggleSelected, toggleSelectAll, allSelected,
        deletableCount: deletableAppointments.length,
        markingAttendanceId, onAttendance: handleAttendance, occupiedTableIds, onConfirm: confirmBooking,
        cancelPanelId, reschedulePanelId, reassignPanelId,
        onOpenReschedule: openReschedulePanel, onOpenCancel: openCancelPanel, onOpenReassign: openReassignPanel,
        deletingId, onDelete: handleDelete,
      }),
    [
      canWrite, selected, toggleSelected, toggleSelectAll, allSelected, deletableAppointments.length,
      markingAttendanceId, handleAttendance, occupiedTableIds, confirmBooking,
      cancelPanelId, reschedulePanelId, reassignPanelId,
      openReschedulePanel, openCancelPanel, openReassignPanel, deletingId, handleDelete,
    ],
  );

  // Today's reservations, broken down for the KPI strip -- all derived from the already-loaded
  // todaySchedule (no extra fetch, no invented numbers).
  const todayStats = useMemo(() => ({
    pending: todaySchedule.filter((a) => a.status === "pending").length,
    confirmed: todaySchedule.filter((a) => a.status === "booked").length,
    walkins: todaySchedule.filter((a) => a.source === "staff").length,
    noShows: todaySchedule.filter((a) => a.status === "no_show").length,
  }), [todaySchedule]);

  function renderRowDetail(a: Appointment) {
    if (reschedulePanelId === a.id && a.table_id) {
      return (
        <div className="rounded-lg border border-line bg-paper p-space-3">
          <p className="mb-space-2 text-[12.5px] text-ink-600">
            New date and time for {a.party_size ? `a party of ${a.party_size}` : "this reservation"} — a table is assigned automatically.
          </p>
          {rTableSlots === null ? (
            <p className="mb-space-2 text-[12.5px] text-ink-400">Loading availability…</p>
          ) : rTableDates.length === 0 ? (
            <p className="mb-space-2 text-[12.5px] text-ink-400">No tables are available for this party size.</p>
          ) : (
            <>
              <div className="mb-space-2">
                <label className="mb-space-1 block text-[12px] font-semibold text-ink-600">Date</label>
                <div className="flex flex-wrap gap-space-2">
                  {rTableDates.map((d) => (
                    <button
                      type="button" key={d}
                      onClick={() => { setRDate(d); setRSlotId(""); }}
                      className={cn(
                        "rounded-md border px-space-2 py-space-1 text-[12px] font-semibold",
                        rDate === d ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-card text-ink-600",
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              {rDate && (
                <div className="mb-space-3">
                  <label className="mb-space-1 block text-[12px] font-semibold text-ink-600">Time</label>
                  <div className="flex flex-wrap gap-space-2">
                    {rTableSlotsForDate.map((s) => (
                      <button
                        type="button" key={s.id}
                        onClick={() => setRSlotId(s.id)}
                        className={cn(
                          "rounded-md border px-space-2 py-space-1 text-[12px] font-semibold",
                          rSlotId === s.id ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-card text-ink-600",
                        )}
                      >
                        {s.time}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <label htmlFor={`reschedule-msg-${a.id}`} className="mb-space-2 block text-[12px] font-semibold text-ink-600">
            Message to send {a.phone} on WhatsApp (optional)
          </label>
          <textarea
            id={`reschedule-msg-${a.id}`}
            value={rescheduleMessage}
            onChange={(e) => setRescheduleMessage(e.target.value)}
            rows={2}
            className="mb-space-2 h-16 w-full resize-none rounded-md border border-line bg-card px-space-3 py-space-2 text-[13px] text-ink-900 outline-none focus:border-brand-400"
          />

          {rescheduleErrors.length > 0 && (
            <div className="mb-space-2 rounded-md border border-error bg-error-tint p-space-2 text-[12px] text-error">
              <ul className="list-disc pl-space-4">
                {rescheduleErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          <div className="flex gap-space-2">
            <Button size="md" onClick={() => handleReschedule(a.id)} disabled={reschedulingId === a.id || !rSlotId}>
              <CalendarClock size={13} /> {reschedulingId === a.id ? "Rescheduling…" : "Send & reschedule"}
            </Button>
            <Button size="md" variant="secondary" onClick={closeReschedulePanel} disabled={reschedulingId === a.id}>
              <X size={13} /> Dismiss
            </Button>
          </div>
        </div>
      );
    }

    if (reschedulePanelId === a.id) {
      return (
        <div className="rounded-lg border border-line bg-paper p-space-3">
          <div className="mb-space-3 grid grid-cols-1 gap-x-space-3 gap-y-space-2 md:grid-cols-2">
            <div>
              <label className="mb-space-1 block text-[12px] font-semibold text-ink-600">Section</label>
              <select
                value={rDepartmentId}
                onChange={(e) => { setRDepartmentId(e.target.value); setRDoctorId(""); setRDate(""); setRSlotId(""); }}
                className="h-10 w-full rounded-md border border-line bg-card px-space-3 text-[13px] text-ink-900"
              >
                <option value="">Choose…</option>
                {(rescheduleCtx?.departments || []).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-space-1 block text-[12px] font-semibold text-ink-600">Doctor</label>
              <select
                value={rDoctorId}
                onChange={(e) => { setRDoctorId(e.target.value); setRDate(""); setRSlotId(""); }}
                disabled={!rDepartmentId}
                className="h-10 w-full rounded-md border border-line bg-card px-space-3 text-[13px] text-ink-900 disabled:cursor-not-allowed disabled:bg-paper"
              >
                <option value="">Choose…</option>
                {rDoctors.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          {rDoctorId && (
            <div className="mb-space-2">
              <label className="mb-space-1 block text-[12px] font-semibold text-ink-600">Date</label>
              {rDatesForDoctor.length === 0 ? (
                <p className="text-[12.5px] text-ink-400">No available dates for this table.</p>
              ) : (
                <div className="flex flex-wrap gap-space-2">
                  {rDatesForDoctor.map((d) => (
                    <button
                      type="button" key={d}
                      onClick={() => { setRDate(d); setRSlotId(""); }}
                      className={cn(
                        "rounded-md border px-space-2 py-space-1 text-[12px] font-semibold",
                        rDate === d ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-card text-ink-600",
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {rDate && (
            <div className="mb-space-3">
              <label className="mb-space-1 block text-[12px] font-semibold text-ink-600">Time slot</label>
              {rSlotsForDate.length === 0 ? (
                <p className="text-[12.5px] text-ink-400">No slots available on this date.</p>
              ) : (
                <div className="flex flex-wrap gap-space-2">
                  {rSlotsForDate.map((s) => (
                    <button
                      type="button" key={s.id}
                      onClick={() => setRSlotId(s.id)}
                      className={cn(
                        "rounded-md border px-space-2 py-space-1 text-[12px] font-semibold",
                        rSlotId === s.id ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-card text-ink-600",
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <label htmlFor={`reschedule-msg-${a.id}`} className="mb-space-2 block text-[12px] font-semibold text-ink-600">
            Message to send {a.phone} on WhatsApp (optional)
          </label>
          <textarea
            id={`reschedule-msg-${a.id}`}
            value={rescheduleMessage}
            onChange={(e) => setRescheduleMessage(e.target.value)}
            rows={2}
            className="mb-space-2 h-16 w-full resize-none rounded-md border border-line bg-card px-space-3 py-space-2 text-[13px] text-ink-900 outline-none focus:border-brand-400"
          />

          {rescheduleErrors.length > 0 && (
            <div className="mb-space-2 rounded-md border border-error bg-error-tint p-space-2 text-[12px] text-error">
              <ul className="list-disc pl-space-4">
                {rescheduleErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          <div className="flex gap-space-2">
            <Button
              size="md"
              onClick={() => handleReschedule(a.id)}
              disabled={reschedulingId === a.id || !rSlotId}
            >
              <CalendarClock size={13} /> {reschedulingId === a.id ? "Rescheduling…" : "Send & reschedule"}
            </Button>
            <Button size="md" variant="secondary" onClick={closeReschedulePanel} disabled={reschedulingId === a.id}>
              <X size={13} /> Dismiss
            </Button>
          </div>
        </div>
      );
    }

    if (cancelPanelId === a.id) {
      return (
        <div className="rounded-lg border border-line bg-paper p-space-3">
          <label htmlFor={`cancel-msg-${a.id}`} className="mb-space-2 block text-[12px] font-semibold text-ink-600">
            Message to send {a.phone} on WhatsApp
          </label>
          <textarea
            id={`cancel-msg-${a.id}`}
            value={cancelMessage}
            onChange={(e) => setCancelMessage(e.target.value)}
            rows={2}
            className="mb-space-2 h-16 w-full resize-none rounded-md border border-line bg-card px-space-3 py-space-2 text-[13px] text-ink-900 outline-none focus:border-brand-400"
          />
          <div className="flex gap-space-2">
            <Button
              size="md"
              variant="destructive"
              onClick={() => handleCancel(a.id)}
              disabled={cancellingId === a.id}
            >
              <Send size={13} /> {cancellingId === a.id ? "Cancelling…" : "Send & cancel"}
            </Button>
            <Button size="md" variant="secondary" onClick={closeCancelPanel} disabled={cancellingId === a.id}>
              <X size={13} /> Dismiss
            </Button>
          </div>
        </div>
      );
    }

    if (reassignPanelId === a.id) {
      const tablesForDepartment = (reassignTables || []).filter(
        (t) => t.is_active && (!a.table_id || t.department_id === reassignTables?.find((rt) => rt.id === a.table_id)?.department_id),
      );
      return (
        <div className="rounded-lg border border-line bg-paper p-space-3">
          <label className="mb-space-1 block text-[12px] font-semibold text-ink-600">
            Move to table
          </label>
          {!reassignTables ? (
            <p className="mb-space-2 text-[12.5px] text-ink-400">Loading tables…</p>
          ) : (
            <select
              value={reassignTableId}
              onChange={(e) => setReassignTableId(e.target.value)}
              className="mb-space-2 h-10 w-full rounded-md border border-line bg-card px-space-3 text-[13px] text-ink-900"
            >
              <option value="">Choose…</option>
              {tablesForDepartment
                .filter((t) => t.id !== a.table_id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} (seats {t.capacity})
                  </option>
                ))}
            </select>
          )}

          {reassignErrors.length > 0 && (
            <div className="mb-space-2 rounded-md border border-error bg-error-tint p-space-2 text-[12px] text-error">
              <ul className="list-disc pl-space-4">
                {reassignErrors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          <div className="flex gap-space-2">
            <Button
              size="md"
              onClick={() => handleReassignTable(a.id)}
              disabled={reassigningId === a.id || !reassignTableId}
            >
              {reassigningId === a.id ? "Moving…" : "Move reservation"}
            </Button>
            <Button size="md" variant="secondary" onClick={closeReassignPanel} disabled={reassigningId === a.id}>
              <X size={13} /> Dismiss
            </Button>
          </div>
        </div>
      );
    }

    return null;
  }

  return (
    <PortalShell hospital={hospital} active="appointments">
        <PageHeader
          title="Table Bookings"
          icon={<CalendarCheck size={22} />}
          description="Manage reservations, walk-ins and table assignments."
          actions={
            <>
              {selectedAppointments.length > 0 && (
                <PermissionGate page="appointments" action="delete">
                  <Button
                    variant="destructive"
                    size="md"
                    onClick={() => setPendingDelete(selectedAppointments)}
                  >
                    <Trash2 size={15} />
                      Delete selected ({selectedAppointments.length})
                  </Button>
                </PermissionGate>
              )}
              <Button href="/portal/new-booking">
                <Plus size={15} /> New reservation
              </Button>
            </>
          }
        />

        {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

        {appointments && (
          <>
            {/* Status-coded, solid-fill tiles on this page specifically (per direct request) -- every other
                page keeps the default tinted-square look; these reuse the shared success/warning/info/violet/
                brand tokens every badge on this page already draws from, not new one-off colors. */}
            <div className="mb-space-4 grid grid-cols-1 gap-space-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <StatTile tone="success" filled icon={<CalendarDays size={22} />} label="Today's Reservations" value={viewCounts.today} deltaPct={null} hint="On today's schedule" />
              <StatTile tone="warning" filled icon={<CalendarClock size={22} />} label="Pending Confirmation" value={todayStats.pending} deltaPct={null} hint="Awaiting staff confirmation" />
              <StatTile tone="info" filled icon={<CircleCheck size={22} />} label="Confirmed" value={todayStats.confirmed} deltaPct={null} hint="Today, confirmed" />
              <StatTile tone="violet" filled icon={<UserRound size={22} />} label="Walk-ins" value={todayStats.walkins} deltaPct={null} hint="Staff-entered today" />
              <StatTile tone="brand" filled icon={<UserX size={22} />} label="No-shows" value={todayStats.noShows} deltaPct={null} upIsGood={false} hint="Booked but didn't come" />
            </div>
            {appointments.length >= 500 && (
              <p className="mb-space-3 text-[12px] text-ink-400">Counts and the list cover your latest 500 reservations.</p>
            )}
          </>
        )}

        <div>
          <div className="min-w-0">
            {/* Underline tabs, matching the reference layout -- same VIEW_TABS/setViewFilter this page
                already had, just restyled from pills to an underline-active style. */}
            <div className="mb-space-3 flex flex-wrap gap-space-5 border-b border-line">
              {VIEW_TABS.filter((t) => t.always || viewCounts[t.id] > 0 || viewFilter === t.id).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setViewFilter(t.id)}
                  className={cn(
                    "-mb-px border-b-2 pb-space-2 text-[13.5px] font-semibold transition-colors duration-150",
                    viewFilter === t.id
                      ? "border-brand-600 text-brand-600"
                      : "border-transparent text-ink-600 hover:text-ink-900",
                  )}
                >
                  {t.label}
                  <span className="ml-space-1 tabular-nums text-ink-400">{viewCounts[t.id]}</span>
                </button>
              ))}
            </div>

            {/* A tab per reservation type only when more than one type actually has rows (a restaurant that only
                takes plain table reservations never sees these). */}
            {TYPE_TAB_ORDER.filter((id) => id !== "all" && (typeCounts[id] || 0) > 0).length > 1 && (
              <div className="mb-space-3 flex flex-wrap gap-space-2">
                {TYPE_TAB_ORDER.filter((id) => id === "all" || (typeCounts[id] || 0) > 0 || typeFilter === id).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTypeFilter(id)}
                    className={cn(
                      "rounded-md border px-space-2 py-0.5 text-[12px] font-semibold",
                      typeFilter === id ? "border-ink-900 bg-ink-900 text-white" : "border-line bg-card text-ink-600 hover:border-ink-400",
                    )}
                  >
                    {id === "all" ? "Any type" : id === "other" ? "Other" : TYPE_LABELS[id]}
                    <span className="ml-space-1 tabular-nums opacity-70">{typeCounts[id] || 0}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="mb-space-3 flex items-center gap-space-2">
              <div className="relative flex-1">
                <Search size={14} className="pointer-events-none absolute left-space-3 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="text"
                  placeholder="Search by name, phone or booking ID…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 w-full rounded-md border border-line bg-card pl-space-8 pr-space-3 text-[13px] text-ink-900 outline-none focus:border-brand-400"
                />
              </div>
            </div>

            <Card className="p-space-4">
              {!appointments ? (
                <p className="py-space-4 text-center text-[13px] text-ink-400">Loading…</p>
              ) : appointments.length === 0 ? (
                <p className="py-space-4 text-center text-[13px] text-ink-400">No reservations yet.</p>
              ) : filteredAppointments && filteredAppointments.length === 0 ? (
                <p className="py-space-4 text-center text-[13px] text-ink-400">No reservations match your search/filter.</p>
              ) : (
                <DataTable
                  columns={columns}
                  data={filteredAppointments || []}
                  getRowId={(a) => String(a.id)}
                  isRowExpanded={(a) => reschedulePanelId === a.id || cancelPanelId === a.id || reassignPanelId === a.id}
                  renderRowDetail={renderRowDetail}
                  onRowClick={(a) => setActiveId(a.id)}
                  rowClassName={(a) => (a.id === activeId ? "bg-brand-50" : "")}
                />
              )}
            </Card>

            <QuickActionsBar
              appointment={(appointments || []).find((a) => a.id === activeId) || null}
              canWrite={canWrite}
              onConfirm={confirmBooking}
              onReschedule={openReschedulePanel}
              onReassign={openReassignPanel}
              onSendReminder={sendReminder}
              onCancel={openCancelPanel}
            />
          </div>

          <div className="mt-space-4 grid grid-cols-1 gap-space-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <TodayScheduleCard
                items={todaySchedule} canWrite={canWrite}
                markingAttendanceId={markingAttendanceId} onAttendance={handleAttendance}
                occupiedTableIds={occupiedTableIds} onConfirm={confirmBooking}
              />
            </div>
            <BookingCalendar appointments={appointments || []} />
          </div>

          <div className="mt-space-4">
            <WaitlistQueueCard ready={ready} canWrite={canWrite} />
          </div>
        </div>

        <ConfirmDialog
          open={pendingDelete !== null}
          title={pendingDelete && pendingDelete.length > 1 ? `Delete ${pendingDelete.length} reservations?` : "Delete reservation?"}
          message={
            pendingDelete
              ? `This will permanently delete ${
                  pendingDelete.length > 1 ? `${pendingDelete.length} reservation records` : `the ${pendingDelete[0].reference_id || "selected"} reservation`
                }. This action is irreversible.`
              : ""
          }
          confirmLabel="Delete"
          destructive
          busy={bulkDeleting}
          onConfirm={() => pendingDelete && runBulkDelete(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />
    </PortalShell>
  );
}
