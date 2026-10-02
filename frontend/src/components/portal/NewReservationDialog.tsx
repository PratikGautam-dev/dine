"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { useNewBooking } from "@/hooks/useNewBooking";

type Props = {
  hospitalName: string | undefined;
  onClose: () => void;
  onCreated: () => void;
};

/** The "New reservation" form, moved off its own /portal/new-booking route and into a centered
 * modal opened from the Table Bookings page, matching every other "Add X" flow in the portal. */
export function NewReservationDialog({ hospitalName, onClose, onCreated }: Props) {
  const {
    ctx, error, errors, submitting, success,
    patientName, setPatientName, patientPhone, setPatientPhone,
    specialRequest, setSpecialRequest,
    departmentId, setDepartmentId, slotId, setSlotId,
    partySize, setPartySize, tableSlots, loadingTableSlots, loadTableSlots,
    handleSubmit,
  } = useNewBooking(true);

  useEffect(() => {
    if (success) onCreated();
  }, [success, onCreated]);

  const canSubmit = !!slotId && !!partySize;

  return (
    <Modal onClose={onClose} labelledBy="new-reservation-title" maxWidthClass="max-w-[560px]">
      <h2 id="new-reservation-title" className="mb-space-4 text-[16px] font-semibold text-ink-900">New reservation</h2>
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

      {!ctx ? (
        <p className="text-[13px] text-ink-400">Loading…</p>
      ) : (
        <form onSubmit={handleSubmit}>
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
              <option>Main Venue — {hospitalName}</option>
            </select>
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

          {errors.length > 0 && (
            <div className="mb-space-3 rounded-md border border-error bg-error-tint p-space-3 text-[12.5px] text-error">
              <ul className="list-disc pl-space-4">
                {errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-space-2">
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting || !canSubmit} className="flex-1">
              {submitting ? "Booking…" : "Create booking"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
