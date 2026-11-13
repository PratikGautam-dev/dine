"use client";

import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { CheckboxRow } from "@/components/ui/Checkbox";
import { Switch } from "@/components/ui/Switch";
import { OPERATING_DAYS, useRestaurantHours } from "@/hooks/useRestaurantHours";
import { useBookingConfirmationSetting } from "@/hooks/useBookingConfirmationSetting";
import { SettingsPageFrame } from "@/components/portal/settings/SettingsPageFrame";
import { usePortalGuard } from "@/components/portal/usePortalGuard";

export default function BookingSettingsPage() {
  const { restaurant, ready } = usePortalGuard();
  const hoursForm = useRestaurantHours(ready);
  const bookingConfirmation = useBookingConfirmationSetting(ready);

  return (
    <SettingsPageFrame
      restaurant={restaurant}
      title="Booking rules"
      icon={<CalendarClock size={20} />}
      description="When guests can book a table, and whether bookings need confirming."
    >
      <div className="max-w-2xl">
      <Card className="p-space-5">
        <h2 className="mb-space-1 text-[15px] font-bold text-ink-900">
          Table booking hours
        </h2>
        <p className="mb-space-3 text-[12.5px] text-ink-400">
          When guests can book a table via WhatsApp. Table booking shows no availability at
          all until this is set.
        </p>
        <form onSubmit={hoursForm.handleSave} className="flex flex-col gap-space-3">
          <Field label="Open days">
            <div className="flex flex-wrap gap-space-3">
              {OPERATING_DAYS.map((day) => (
                <CheckboxRow
                  key={day}
                  checked={hoursForm.form.operating_days.includes(day)}
                  onChange={() => hoursForm.toggleDay(day)}
                >
                  {day}
                </CheckboxRow>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-1 gap-x-space-4 sm:grid-cols-2">
            <Field label="Opens at" htmlFor="rh-start">
              <Input
                id="rh-start"
                type="time"
                value={hoursForm.form.start_time}
                onChange={(e) =>
                  hoursForm.setForm({ ...hoursForm.form, start_time: e.target.value })
                }
              />
            </Field>
            <Field label="Closes at" htmlFor="rh-end">
              <Input
                id="rh-end"
                type="time"
                value={hoursForm.form.end_time}
                onChange={(e) =>
                  hoursForm.setForm({ ...hoursForm.form, end_time: e.target.value })
                }
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-x-space-4 sm:grid-cols-2">
            <Field
              label="Turnover per table (minutes)"
              htmlFor="rh-turnover"
              hint="How long a party typically occupies a table."
            >
              <Input
                id="rh-turnover"
                type="number"
                min="1"
                value={hoursForm.form.default_turnover_minutes}
                onChange={(e) =>
                  hoursForm.setForm({
                    ...hoursForm.form,
                    default_turnover_minutes: e.target.value,
                  })
                }
              />
            </Field>
            <Field
              label="Booking interval (minutes)"
              htmlFor="rh-interval"
              hint="How far apart bookable time slots are."
            >
              <Input
                id="rh-interval"
                type="number"
                min="1"
                value={hoursForm.form.booking_interval_minutes}
                onChange={(e) =>
                  hoursForm.setForm({
                    ...hoursForm.form,
                    booking_interval_minutes: e.target.value,
                  })
                }
              />
            </Field>
          </div>
          {hoursForm.error && (
            <p className="text-[12.5px] font-medium text-error">{hoursForm.error}</p>
          )}
          <Button type="submit" disabled={hoursForm.saving} className="self-start">
            {hoursForm.saving ? "Saving…" : "Save table hours"}
          </Button>
        </form>
      </Card>

      <Card className="mt-space-4 p-space-5">
        <h2 className="mb-space-1 text-[15px] font-bold text-ink-900">
          Booking confirmation
        </h2>
        <p className="mb-space-3 text-[12.5px] text-ink-400">
          Off by default: a WhatsApp booking is confirmed instantly. Turn this on to require
          a staff member to confirm each new WhatsApp booking before the guest gets their
          confirmation message. Staff-created bookings are always confirmed immediately
          either way.
        </p>
        <div className="flex items-center gap-space-3">
          <Switch
            checked={bookingConfirmation.enabled}
            onChange={() => bookingConfirmation.toggle(!bookingConfirmation.enabled)}
            disabled={bookingConfirmation.saving}
            aria-label="Require staff confirmation for new WhatsApp bookings"
          />
          <span className="text-[13px] text-ink-900">
            Require staff to confirm new WhatsApp bookings
          </span>
        </div>
      </Card>
      </div>
    </SettingsPageFrame>
  );
}
