"use client";

import { SlotCalendar } from "@/components/portal/SlotCalendar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { FormSkeleton } from "@/components/ui/Skeleton";
import { PortalShell } from "@/components/portal/PortalShell";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { useNewBooking } from "@/hooks/useNewBooking";
import { Select } from "@/components/erp-ui/Select";

export default function NewBookingPage() {
  const { restaurant, ready } = usePortalGuard();
  const {
    ctx,
    error,
    errors,
    submitting,
    success,
    patientName,
    setPatientName,
    patientPhone,
    setPatientPhone,
    specialRequest,
    setSpecialRequest,
    departmentId,
    setDepartmentId,
    slotId,
    setSlotId,
    partySize,
    setPartySize,
    tableSlots,
    loadingTableSlots,
    loadTableSlots,
    handleSubmit,
  } = useNewBooking(ready);

  const canSubmit = !!slotId && !!partySize;

  return (
    <PortalShell restaurant={restaurant} active="appointments">
      <PageHeader title="New reservation" />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

      <Card className="max-w-xl p-space-5">
        {success ? (
          <div className="text-center">
            <p className="mb-space-3 text-[14px] font-semibold text-success">
              Reservation created.
            </p>
            <Button href="/portal/appointments">View reservations</Button>
          </div>
        ) : !ctx ? (
          <FormSkeleton fields={4} />
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-x-space-4 md:grid-cols-2">
              <Field label="Guest name (optional)" htmlFor="patient_name">
                <Input
                  id="patient_name"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                />
              </Field>
              <Field label="Guest phone" htmlFor="patient_phone" required>
                <Input
                  id="patient_phone"
                  required
                  value={patientPhone}
                  onChange={(e) => setPatientPhone(e.target.value)}
                />
              </Field>
            </div>

            <Field
              label="Special request (optional)"
              htmlFor="special_request"
              hint="e.g. birthday, window seat, high chair needed"
            >
              <Input
                id="special_request"
                value={specialRequest}
                onChange={(e) => setSpecialRequest(e.target.value)}
              />
            </Field>

            <Field
              label="Venue"
              htmlFor="branch"
              hint="Single-location restaurant — nothing to choose yet."
            >
              <Select className="w-full" disabled id="branch">
                <option>Main Venue — {restaurant?.name}</option>
              </Select>
            </Field>

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
                <Select
                  value={departmentId}
                  onValueChange={(v) => setDepartmentId(v)}
                  className="w-full"
                  id="department"
                >
                  <option value="">No preference</option>
                  {ctx.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Button
              type="button"
              variant="secondary"
              onClick={loadTableSlots}
              disabled={!partySize || loadingTableSlots}
              className="mb-space-4"
            >
              {loadingTableSlots ? "Checking availability…" : "Check availability"}
            </Button>

            {tableSlots && (
              <Field label="Seating time" required>
                {tableSlots.length === 0 ? (
                  <p className="text-[12.5px] text-ink-400">
                    No tables available for this party size.
                  </p>
                ) : (
                  <SlotCalendar
                    slots={tableSlots}
                    value={slotId}
                    onChange={(slot) => setSlotId(slot?.id ?? "")}
                  />
                )}
              </Field>
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
