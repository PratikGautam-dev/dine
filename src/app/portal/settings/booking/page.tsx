"use client";

import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { BranchField } from "@/components/portal/settings/BranchField";
import { OpeningHoursEditor } from "@/components/portal/settings/OpeningHoursEditor";
import { useBranchBookingHours } from "@/hooks/useBranchBookingHours";
import { useSettingsBranch } from "@/hooks/useSettingsBranch";
import { SettingsPageFrame } from "@/components/portal/settings/SettingsPageFrame";
import { usePortalGuard } from "@/components/portal/usePortalGuard";

export default function BookingSettingsPage() {
  const { restaurant, ready } = usePortalGuard();
  // Table booking hours are kept per branch: the one picked here, else the top bar's, else the default branch.
  const { branches, branchId, branch, setBranchId } = useSettingsBranch();
  const hours = useBranchBookingHours(ready, branchId);

  return (
    <SettingsPageFrame
      restaurant={restaurant}
      title="Booking rules"
      maxWidthClass="max-w-[880px]"
      icon={<CalendarClock size={20} />}
      description="When guests can book a table."
    >
      <Card className="p-space-5">
        <h2 className="mb-space-1 text-[15px] font-bold text-ink-900">Table booking hours</h2>
        <p className="mb-space-3 text-[12.5px] text-ink-400">
          When guests can book a table at this branch. Each branch has its own weekly hours; table booking shows no
          availability at a branch until its hours are set.
        </p>
        <form onSubmit={hours.handleSave} className="flex flex-col gap-space-3">
          <BranchField branches={branches} branchId={branchId} branch={branch} onChange={setBranchId} />
          {hours.inherited && hours.loaded && (
            <p className="text-[12.5px] text-ink-600">
              This branch hasn&apos;t set its own hours yet, so it uses the restaurant-wide ones shown below. Save to
              give it its own.
            </p>
          )}
          <OpeningHoursEditor
            schedule={hours.form.schedule}
            onAdd={hours.addEntry}
            onRemove={hours.removeEntry}
            dirty={hours.dirty}
            hideSave
          />
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
                value={hours.form.turnover_minutes}
                onChange={(e) => hours.setForm({ turnover_minutes: e.target.value })}
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
                value={hours.form.booking_interval_minutes}
                onChange={(e) => hours.setForm({ booking_interval_minutes: e.target.value })}
              />
            </Field>
          </div>
          {hours.error && <p className="text-[12.5px] font-medium text-error">{hours.error}</p>}
          <Button type="submit" disabled={hours.saving || !hours.dirty} className="self-start">
            {hours.saving ? "Saving…" : "Save table hours"}
          </Button>
        </form>
      </Card>
    </SettingsPageFrame>
  );
}
