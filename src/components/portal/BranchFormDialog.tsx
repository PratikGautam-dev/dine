"use client";

import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";
import type { BranchForm } from "@/hooks/useBranchManagement";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Props = {
  title: string;
  form: BranchForm;
  onChange: (patch: Partial<BranchForm>) => void;
  onSubmit: () => void;
  onClose: () => void;
  saving: boolean;
  error: string | null;
};

/** Add/Edit branch -- a modal, same pattern StaffFormDialog/EditStaffBranchesDialog already use,
 * replacing the old always-expanded inline card so the Branches page can show a real directory +
 * detail-panel layout instead. */
export function BranchFormDialog({
  title,
  form,
  onChange,
  onSubmit,
  onClose,
  saving,
  error,
}: Props) {
  function toggleDay(day: string) {
    onChange({
      operating_days: form.operating_days.includes(day)
        ? form.operating_days.filter((d) => d !== day)
        : [...form.operating_days, day],
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  return (
    <Modal onClose={onClose} labelledBy="branch-form-title" maxWidthClass="max-w-[640px]">
      <h2 id="branch-form-title" className="mb-space-4 text-[16px] font-semibold text-ink-900">
        {title}
      </h2>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-x-space-4 sm:grid-cols-2">
          <Field label="Branch name" htmlFor="br-name" required>
            <Input
              id="br-name"
              value={form.name}
              onChange={(e) => onChange({ name: e.target.value })}
            />
          </Field>
          <Field label="City" htmlFor="br-city">
            <Input
              id="br-city"
              value={form.city}
              onChange={(e) => onChange({ city: e.target.value })}
            />
          </Field>
          <Field label="Address" htmlFor="br-address" className="sm:col-span-2">
            <Input
              id="br-address"
              value={form.address_line}
              onChange={(e) => onChange({ address_line: e.target.value })}
            />
          </Field>
          <Field label="Phone" htmlFor="br-phone">
            <Input
              id="br-phone"
              value={form.phone}
              onChange={(e) => onChange({ phone: e.target.value })}
            />
          </Field>
          <Field
            label="Operating hours"
            htmlFor="br-hours"
            hint="e.g. 11:00-23:00 -- leave blank to use the restaurant's own hours"
          >
            <Input
              id="br-hours"
              value={form.operating_hours}
              onChange={(e) => onChange({ operating_hours: e.target.value })}
              placeholder="11:00-23:00"
            />
          </Field>
          <Field
            label="Turnover (min)"
            htmlFor="br-turnover"
            hint="Leave blank to use the restaurant's own setting"
          >
            <Input
              id="br-turnover"
              type="number"
              min="0"
              value={form.turnover_minutes}
              onChange={(e) => onChange({ turnover_minutes: e.target.value })}
            />
          </Field>
          <Field
            label="Booking interval (min)"
            htmlFor="br-interval"
            hint="Leave blank to use the restaurant's own setting"
          >
            <Input
              id="br-interval"
              type="number"
              min="0"
              value={form.booking_interval_minutes}
              onChange={(e) => onChange({ booking_interval_minutes: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <p className="mb-space-2 text-[12.5px] font-semibold text-ink-700">Operating days</p>
            <div className="flex flex-wrap gap-space-2">
              {WEEKDAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`rounded-md border px-space-3 py-1 text-[12.5px] font-semibold transition-colors ${
                    form.operating_days.includes(day)
                      ? "border-brand-400 bg-brand-50 text-brand-700"
                      : "border-line text-ink-600"
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
          <Field
            label="Minimum order (₹)"
            htmlFor="br-min-order"
            hint="Leave blank to use the restaurant's own minimum"
          >
            <Input
              id="br-min-order"
              type="number"
              min="0"
              value={form.min_order_rupees}
              onChange={(e) => onChange({ min_order_rupees: e.target.value })}
            />
          </Field>
          <Field
            label="Service charge (%)"
            htmlFor="br-service-charge"
            hint="Stored for reference -- not yet added to order totals"
          >
            <Input
              id="br-service-charge"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={form.service_charge_pct}
              onChange={(e) => onChange({ service_charge_pct: e.target.value })}
            />
          </Field>
          <Field
            label="Delivery radius (km)"
            htmlFor="br-delivery-radius"
            hint="Stored for reference -- not yet enforced on checkout"
          >
            <Input
              id="br-delivery-radius"
              type="number"
              min="0"
              step="0.1"
              value={form.delivery_radius_km}
              onChange={(e) => onChange({ delivery_radius_km: e.target.value })}
            />
          </Field>
          <Field
            label="Delivery fee (₹)"
            htmlFor="br-delivery-fee"
            hint="Leave blank to use the restaurant's own fee"
          >
            <Input
              id="br-delivery-fee"
              type="number"
              min="0"
              value={form.delivery_fee_rupees}
              onChange={(e) => onChange({ delivery_fee_rupees: e.target.value })}
            />
          </Field>
          <Field
            label="Avg. prep time (min)"
            htmlFor="br-prep-time"
            hint="Stored for reference -- not yet shown to guests"
            className="sm:col-span-2"
          >
            <Input
              id="br-prep-time"
              type="number"
              min="0"
              value={form.avg_prep_time_min}
              onChange={(e) => onChange({ avg_prep_time_min: e.target.value })}
            />
          </Field>
          <Field
            label="Open/closed override"
            htmlFor="br-open-override"
            hint="Force this branch open or closed regardless of its hours"
            className="sm:col-span-2"
          >
            <select
              id="br-open-override"
              value={
                form.is_open_override === null ? "" : form.is_open_override ? "open" : "closed"
              }
              onChange={(e) =>
                onChange({
                  is_open_override: e.target.value === "" ? null : e.target.value === "open",
                })
              }
              className="h-11 w-full rounded-md border border-line bg-card px-space-3 text-[14px] text-ink-900"
            >
              <option value="">Follow operating hours</option>
              <option value="open">Force open</option>
              <option value="closed">Force closed</option>
            </select>
          </Field>
          <div className="sm:col-span-2 flex flex-wrap gap-space-6 border-t border-line pt-space-4">
            <label className="flex items-center gap-space-2">
              <Switch
                checked={form.accepts_online !== false}
                onChange={() =>
                  onChange({ accepts_online: form.accepts_online === false ? null : false })
                }
                aria-label="Accept website orders at this branch"
              />
              <span className="text-[13px] font-medium text-ink-700">Accept website orders</span>
            </label>
            <label className="flex items-center gap-space-2">
              <Switch
                checked={form.accepts_whatsapp !== false}
                onChange={() =>
                  onChange({ accepts_whatsapp: form.accepts_whatsapp === false ? null : false })
                }
                aria-label="Offer this branch on WhatsApp"
              />
              <span className="text-[13px] font-medium text-ink-700">Offer on WhatsApp</span>
            </label>
            <label className="flex items-center gap-space-2">
              <Switch
                checked={form.tables_enabled === true}
                onChange={() =>
                  onChange({ tables_enabled: form.tables_enabled === true ? false : true })
                }
                aria-label="Enable dine-in tables at this branch"
              />
              <span className="text-[13px] font-medium text-ink-700">Dine-in tables enabled</span>
            </label>
          </div>
        </div>
        {error && <p className="mt-space-3 text-[12.5px] font-medium text-error">{error}</p>}
        <div className="mt-space-5 flex justify-end gap-space-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || !form.name.trim()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
