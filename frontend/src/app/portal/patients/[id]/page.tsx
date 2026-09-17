"use client";

import { ArrowLeft, Search } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Input";
import { PortalShell } from "@/components/portal/PortalShell";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/formatDate";
import { TYPE_LABELS } from "@/hooks/useAppointments";
import { usePatientDetail, type Visit } from "@/hooks/usePatientDetail";
import { createVisitHistoryColumns, STATUS_LABELS } from "./_components/visit-history-columns";

const TYPE_TAB_ORDER = ["all", "new", "followup", "tele", "second_opinion", "diagnostic", "lab", "daycare", "other"];

export default function PatientDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const patientId = params.id;
  const { hospital, ready } = usePortalGuard();

  const {
    data, error,
    dob, setDob, gender, setGender, address, setAddress, savingDemographics, handleSaveDemographics,
    savingStatus, handleSetStatus,
    visitSearch, setVisitSearch, visitTimeFilter, setVisitTimeFilter,
    visitStatusFilter, setVisitStatusFilter, visitTypeFilter, setVisitTypeFilter,
    visitTypeCounts, filteredVisits,
    followupPanelId, openFollowupPanel, closeFollowupPanel, followupError,
    extendDays, setExtendDays, extendingId, handleExtendFollowup,
    bookCtx, bookDate, setBookDate, bookSlotId, setBookSlotId, bookingId, handleBookFollowupNow,
  } = usePatientDetail(patientId, ready);

  if (!data) {
    return (
      <PortalShell hospital={hospital} active="patients">
          {error ? <p className="text-[13px] text-error">{error}</p> : <p className="text-[13px] text-ink-400">Loading…</p>}
      </PortalShell>
    );
  }

  const { patient, visit_history } = data;

  const columns = createVisitHistoryColumns({
    followupPanelId, onOpenFollowup: openFollowupPanel, onCloseFollowup: closeFollowupPanel,
  });

  function renderVisitRowDetail(v: Visit) {
    return (
      <>
        {followupPanelId === v.id && (
          <div className="rounded-lg border border-line bg-paper p-space-3">
            <p className="text-hint mb-space-3">
              Follow-up validity for this visit{" "}
              {v.followup_valid_until && new Date(v.followup_valid_until) >= new Date()
                ? `is open until ${formatDate(v.followup_valid_until)}`
                : "has closed"}
              . Grant extra days so the guest can book it themselves on WhatsApp, or book it directly right now.
            </p>

            <div className="mb-space-3 flex flex-wrap items-end gap-space-2">
              <div>
                <label className="mb-space-1 block text-[12px] font-semibold text-ink-600">Extend by (days)</label>
                <input
                  type="number"
                  min={1}
                  value={extendDays}
                  onChange={(e) => setExtendDays(e.target.value)}
                  className="h-9 w-24 rounded-md border border-line bg-card px-space-2 text-[13px] text-ink-900"
                />
              </div>
              <Button size="md" variant="secondary" onClick={() => handleExtendFollowup(v.id)} disabled={extendingId === v.id}>
                {extendingId === v.id ? "Granting…" : "Grant extension"}
              </Button>
            </div>

            <div className="border-t border-line pt-space-3">
              <p className="mb-space-2 text-[12px] font-semibold text-ink-600">
                Or book this reservation now (table {v.table_name || v.doctor_name}, {v.department_name})
              </p>
              {(() => {
                // Table reservations (migration 0030): v.doctor_id is null
                // for a table-reservation visit -- this doctor-slot rebook
                // panel has no equivalent for one (no per-doctor schedule to
                // look up), so it falls back to "no available dates" rather
                // than indexing with a null key.
                const dates = bookCtx && v.doctor_id ? Object.keys(bookCtx.slots_by_doctor[v.doctor_id] || {}).sort() : [];
                const slots = bookCtx && v.doctor_id && bookDate ? bookCtx.slots_by_doctor[v.doctor_id]?.[bookDate] || [] : [];
                return (
                  <>
                    {dates.length === 0 ? (
                      <p className="mb-space-2 text-[12.5px] text-ink-400">No available dates for this table.</p>
                    ) : (
                      <div className="mb-space-2 flex flex-wrap gap-space-2">
                        {dates.map((d) => (
                          <button
                            type="button"
                            key={d}
                            onClick={() => { setBookDate(d); setBookSlotId(""); }}
                            className={cn(
                              "rounded-md border px-space-2 py-space-1 text-[12px] font-semibold",
                              bookDate === d ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-card text-ink-600",
                            )}
                          >
                            {d}
                          </button>
                        ))}
                      </div>
                    )}
                    {bookDate &&
                      (slots.length === 0 ? (
                        <p className="mb-space-2 text-[12.5px] text-ink-400">No slots available on this date.</p>
                      ) : (
                        <div className="mb-space-2 flex flex-wrap gap-space-2">
                          {slots.map((s) => (
                            <button
                              type="button"
                              key={s.id}
                              onClick={() => setBookSlotId(s.id)}
                              className={cn(
                                "rounded-md border px-space-2 py-space-1 text-[12px] font-semibold",
                                bookSlotId === s.id ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-card text-ink-600",
                              )}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      ))}
                  </>
                );
              })()}
              <Button size="md" onClick={() => handleBookFollowupNow(v.id)} disabled={bookingId === v.id || !bookSlotId}>
                {bookingId === v.id ? "Booking…" : "Book reservation now"}
              </Button>
            </div>

            {followupError && <p className="mt-space-3 text-[12px] text-error">{followupError}</p>}
            <div className="mt-space-3">
              <Button size="md" variant="secondary" onClick={closeFollowupPanel}>
                Close
              </Button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <PortalShell hospital={hospital} active="patients">
        <button
          type="button"
          onClick={() => router.push("/portal/patients")}
          className="mb-space-3 flex items-center gap-space-1 text-[12.5px] font-semibold text-brand-600 hover:underline"
        >
            <ArrowLeft size={14} /> All guests
        </button>

        <div className="mb-space-5 flex items-center gap-space-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[18px] font-bold text-brand-700">
            {(patient.name || patient.phone).trim().charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-display !text-[24px]">{patient.name || patient.phone}</h1>
            <div className="flex flex-wrap items-center gap-space-2 text-[13px] text-ink-600">
              <span>{patient.phone}</span>
              {patient.patient_display_id && (
                <span className="rounded-full bg-brand-50 px-space-2 py-0.5 font-mono text-[11.5px] font-semibold text-brand-700">
                  {patient.patient_display_id}
                </span>
              )}
              {patient.status !== "active" && (
                <Badge tone={patient.status === "blocked" ? "clay" : "neutral"}>
                  {patient.status === "blocked" ? "Blocked" : "Inactive"}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

        <div className="grid grid-cols-1 gap-space-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-space-4">
            <Card className="p-space-4">
              <h3 className="text-label mb-space-3 font-bold text-ink-900">Visit history</h3>

              {visit_history.length === 0 ? (
                <p className="py-space-4 text-center text-[13px] text-ink-400">No visits yet.</p>
              ) : (
                <>
                  {/* Same filter shape as /portal/appointments: type tabs,
                      search, status dropdown -- plus an upcoming/past time
                      filter this single-patient view adds on top. */}
                  <div className="mb-space-3 flex flex-wrap gap-space-2">
                    {TYPE_TAB_ORDER.filter((id) => id === "all" || (visitTypeCounts[id] || 0) > 0 || visitTypeFilter === id).map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setVisitTypeFilter(id)}
                        className={cn(
                          "rounded-full border px-space-3 py-space-1 text-[12.5px] font-semibold transition-colors duration-150",
                          visitTypeFilter === id
                            ? "border-brand-600 bg-brand-600 text-white"
                            : "border-line bg-card text-ink-600 hover:border-brand-300 hover:bg-brand-50",
                        )}
                      >
                        {id === "all" ? "All" : id === "other" ? "Other" : TYPE_LABELS[id]}
                        <span className={cn("ml-space-1 tabular-nums", visitTypeFilter === id ? "text-white/80" : "text-ink-400")}>
                          {visitTypeCounts[id] || 0}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="mb-space-3 flex flex-wrap items-center gap-space-2">
                    <div className="flex gap-space-1 rounded-md border border-line bg-paper p-0.5">
                      {(["all", "upcoming", "past"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setVisitTimeFilter(t)}
                          className={cn(
                            "rounded px-space-2 py-1 text-[12px] font-semibold capitalize transition-colors duration-150",
                            visitTimeFilter === t ? "bg-card text-ink-900 shadow-[var(--shadow-sm)]" : "text-ink-400 hover:text-ink-700",
                          )}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <div className="relative min-w-[180px] flex-1">
                      <Search size={14} className="pointer-events-none absolute top-1/2 left-space-3 -translate-y-1/2 text-ink-400" />
                      <input
                        type="text"
                        placeholder="Search table, section, or reference…"
                        value={visitSearch}
                        onChange={(e) => setVisitSearch(e.target.value)}
                        className="h-9 w-full rounded-md border border-line bg-card pl-space-8 pr-space-3 text-[12.5px] text-ink-900 outline-none focus:border-brand-400"
                      />
                    </div>
                    <select
                      value={visitStatusFilter}
                      onChange={(e) => setVisitStatusFilter(e.target.value)}
                      className="h-9 rounded-md border border-line bg-card px-space-2 text-[12.5px] text-ink-900"
                    >
                      <option value="all">All statuses</option>
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </div>

                  {filteredVisits.length === 0 ? (
                    <p className="py-space-4 text-center text-[13px] text-ink-400">No visits match this filter.</p>
                  ) : (
                    <DataTable
                      columns={columns}
                      data={filteredVisits}
                      getRowId={(v) => String(v.id)}
                      isRowExpanded={(v) => followupPanelId === v.id}
                      renderRowDetail={renderVisitRowDetail}
                    />
                  )}
                </>
              )}
            </Card>
          </div>

          <Card className="h-fit p-space-4">
            <h3 className="text-label mb-space-1 font-bold text-ink-900">Record status</h3>
            <p className="text-hint mb-space-3">
              Blocking a guest stops them from being selected/booked against on WhatsApp -- their reservation
              history and Guest ID are untouched, and any phone still linked to them is unaffected.
            </p>
            {patient.status === "active" ? (
              <Button size="md" variant="secondary" onClick={() => handleSetStatus("blocked")} disabled={savingStatus} className="w-full">
                {savingStatus ? "Saving…" : "Block this guest"}
              </Button>
            ) : (
              <Button size="md" onClick={() => handleSetStatus("active")} disabled={savingStatus} className="w-full">
                {savingStatus ? "Saving…" : "Reactivate this guest"}
              </Button>
            )}
          </Card>

          <Card className="h-fit p-space-4">
            <h3 className="text-label mb-space-3 font-bold text-ink-900">Demographics</h3>
            <Field label="Date of birth" htmlFor="dob">
              <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </Field>
            <Field label="Gender" htmlFor="gender">
              <Input id="gender" value={gender} onChange={(e) => setGender(e.target.value)} placeholder="Optional" />
            </Field>
            <Field label="Address" htmlFor="address">
              <Textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} rows={3} placeholder="Optional" />
            </Field>
            <Button size="md" onClick={handleSaveDemographics} disabled={savingDemographics} className="w-full">
              {savingDemographics ? "Saving…" : "Save"}
            </Button>
          </Card>
        </div>
    </PortalShell>
  );
}
