"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { PortalShell } from "@/components/portal/PortalShell";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { cn } from "@/lib/cn";
import { useNewBooking } from "@/hooks/useNewBooking";

export default function NewBookingPage() {
  const { hospital, ready } = usePortalGuard();
  const {
    ctx, error, errors, submitting, success,
    bookingType, setBookingType,
    patientName, setPatientName, patientPhone, setPatientPhone,
    specialRequest, setSpecialRequest,
    departmentId, setDepartmentId, doctorId, setDoctorId, date, setDate, slotId, setSlotId,
    doctors, datesForDoctor, slotsForDate,
    partySize, setPartySize, tableSlots, loadingTableSlots, loadTableSlots,
    handleSubmit,
  } = useNewBooking(ready);

  const canSubmit = bookingType === "table" ? !!slotId && !!partySize : !!slotId;

  return (
    <PortalShell hospital={hospital} active="appointments">
        <PageHeader title="New reservation" />
        {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

        <Card className="max-w-xl p-space-5">
          {success ? (
            <div className="text-center">
              <p className="mb-space-3 text-[14px] font-semibold text-success">Reservation created.</p>
              <Button href="/portal/appointments">View reservations</Button>
            </div>
          ) : !ctx ? (
            <p className="text-[13px] text-ink-400">Loading…</p>
          ) : (
            <form onSubmit={handleSubmit}>
              <Field label="Booking type" htmlFor="booking_type">
                <div className="flex gap-space-2">
                  <button
                    type="button"
                    onClick={() => setBookingType("table")}
                    className={cn(
                      "rounded-md border px-space-3 py-space-2 text-[12.5px] font-semibold",
                      bookingType === "table" ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-card text-ink-600",
                    )}
                  >
                    Table Reservation
                  </button>
                  <button
                    type="button"
                    onClick={() => setBookingType("doctor")}
                    className={cn(
                      "rounded-md border px-space-3 py-space-2 text-[12.5px] font-semibold",
                      bookingType === "doctor" ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-card text-ink-600",
                    )}
                  >
                    Doctor Appointment
                  </button>
                </div>
              </Field>

              <div className="grid grid-cols-1 gap-x-space-4 md:grid-cols-2">
                <Field label="Guest name (optional)" htmlFor="patient_name">
                  <Input id="patient_name" value={patientName} onChange={(e) => setPatientName(e.target.value)} />
                </Field>
                <Field label="Guest phone" htmlFor="patient_phone" required>
                  <Input id="patient_phone" required value={patientPhone} onChange={(e) => setPatientPhone(e.target.value)} />
                </Field>
              </div>

              <Field label="Special request (optional)" htmlFor="special_request" hint="e.g. birthday, window seat, high chair needed">
                <Input id="special_request" value={specialRequest} onChange={(e) => setSpecialRequest(e.target.value)} />
              </Field>

              <Field label="Venue" htmlFor="branch" hint="Single-location restaurant — nothing to choose yet.">
                <select id="branch" disabled className="h-11 w-full cursor-not-allowed rounded-md border border-line bg-paper px-space-3 text-[14px] text-ink-600">
                  <option>Main Venue — {hospital?.name}</option>
                </select>
              </Field>

              {bookingType === "table" ? (
                <>
                  <div className="grid grid-cols-1 gap-x-space-4 md:grid-cols-2">
                    <Field label="Party size" htmlFor="party_size" required>
                      <Input
                        id="party_size"
                        type="number"
                        min={1}
                        required
                        value={partySize}
                        onChange={(e) => setPartySize(e.target.value ? Number(e.target.value) : "")}
                      />
                    </Field>
                    <Field label="Section preference (optional)" htmlFor="department">
                      <select
                        id="department"
                        value={departmentId}
                        onChange={(e) => setDepartmentId(e.target.value)}
                        className="h-11 w-full rounded-md border border-line bg-card px-space-3 text-[14px] text-ink-900"
                      >
                        <option value="">No preference</option>
                        {ctx.departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <Button type="button" variant="secondary" onClick={loadTableSlots} disabled={!partySize || loadingTableSlots} className="mb-space-4">
                    {loadingTableSlots ? "Checking availability…" : "Check availability"}
                  </Button>

                  {tableSlots && (
                    <Field label="Seating time" required>
                      {tableSlots.length === 0 ? (
                        <p className="text-[12.5px] text-ink-400">No tables available for this party size.</p>
                      ) : (
                        <div className="flex flex-wrap gap-space-2">
                          {tableSlots.map((s) => (
                            <button
                              type="button"
                              key={s.id}
                              onClick={() => setSlotId(s.id)}
                              className={cn(
                                "rounded-md border px-space-3 py-space-2 text-[12.5px] font-semibold",
                                slotId === s.id ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-card text-ink-600",
                              )}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </Field>
                  )}
                </>
              ) : (
                <>
                  <Field label="Section" htmlFor="department" required>
                    <select
                      id="department"
                      required
                      value={departmentId}
                      onChange={(e) => setDepartmentId(e.target.value)}
                      className="h-11 w-full rounded-md border border-line bg-card px-space-3 text-[14px] text-ink-900"
                    >
                      <option value="">Choose…</option>
                      {ctx.departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </Field>

                  {departmentId && (
                    <Field label="Doctor" htmlFor="doctor" required>
                      <select
                        id="doctor"
                        required
                        value={doctorId}
                        onChange={(e) => setDoctorId(e.target.value)}
                        className="h-11 w-full rounded-md border border-line bg-card px-space-3 text-[14px] text-ink-900"
                      >
                        <option value="">Choose…</option>
                        {doctors.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}

                  {doctorId && (
                    <Field label="Date">
                      {datesForDoctor.length === 0 ? (
                        <p className="text-[12.5px] text-ink-400">No available dates for this doctor.</p>
                      ) : (
                        <div className="flex flex-wrap gap-space-2">
                          {datesForDoctor.map((d) => (
                            <button
                              type="button"
                              key={d}
                              onClick={() => setDate(d)}
                              className={cn(
                                "rounded-md border px-space-3 py-space-2 text-[12.5px] font-semibold",
                                date === d ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-card text-ink-600",
                              )}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      )}
                    </Field>
                  )}

                  {date && (
                    <Field label="Time" required>
                      {slotsForDate.length === 0 ? (
                        <p className="text-[12.5px] text-ink-400">No slots available on this date.</p>
                      ) : (
                        <div className="flex flex-wrap gap-space-2">
                          {slotsForDate.map((s) => (
                            <button
                              type="button"
                              key={s.id}
                              onClick={() => setSlotId(s.id)}
                              className={cn(
                                "rounded-md border px-space-3 py-space-2 text-[12.5px] font-semibold",
                                slotId === s.id ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-card text-ink-600",
                              )}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </Field>
                  )}
                </>
              )}

              {errors.length > 0 && (
                <div className="mb-space-3 rounded-md border border-error bg-error-tint p-space-3 text-[12.5px] text-error">
                  <ul className="list-disc pl-space-4">
                    {errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              <Button type="submit" disabled={submitting || !canSubmit} className="mt-space-2">
                {submitting ? "Booking…" : "Create booking"}
              </Button>
            </form>
          )}
        </Card>
    </PortalShell>
  );
}
