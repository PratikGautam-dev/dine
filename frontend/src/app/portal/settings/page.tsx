"use client";

import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckboxRow } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { AppointmentTypeToggles } from "@/components/portal/AppointmentTypeToggles";
import { PortalShell } from "@/components/portal/PortalShell";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { usePortalSettings } from "@/hooks/usePortalSettings";
import { OPERATING_DAYS, useRestaurantHours } from "@/hooks/useRestaurantHours";

function PortalSettingsPageContent() {
  const { hospital, ready } = usePortalGuard();
  // Backend route guards already 403 the actual mutations for a clinic
  // tenant lacking manage_appointment_types -- same UI-convenience-only
  // gating as PortalDoctorsPage's canManageDoctors. Fails open (renders the
  // section) while hospital hasn't loaded yet.
  const canManageAppointmentTypes = !hospital || hospital.admin_capabilities?.includes("manage_appointment_types");
  const { settings, setSettings, error, saving, saved, handleSave } = usePortalSettings(ready);
  const hoursForm = useRestaurantHours(ready);

  return (
    <PortalShell hospital={hospital} active="settings">
        <PageHeader
          title="Restaurant settings"
          actions={<Button href="/portal/settings/activity" variant="secondary">Activity log <ArrowRight size={14} /></Button>}
        />

        {!settings ? (
          <p className="text-[13px] text-ink-400">Loading…</p>
        ) : (
          <form onSubmit={handleSave} className="flex flex-col gap-space-5">
            <div className="grid grid-cols-1 gap-space-5 lg:grid-cols-2">
              <Card className="p-space-5">
                <h2 className="mb-space-3 text-[15px] font-bold text-ink-900">General</h2>
                <Field label="Restaurant name" htmlFor="name" hint="Contact the platform team to change this — it's tied to your Meta WhatsApp connection.">
                  <Input id="name" value={settings.name} disabled />
                </Field>
                <Field label="Welcome message text" htmlFor="welcome_message_text">
                  <Textarea
                    id="welcome_message_text"
                    rows={2}
                    value={settings.welcome_message_text}
                    onChange={(e) => setSettings({ ...settings, welcome_message_text: e.target.value })}
                  />
                </Field>
                <div className="grid grid-cols-1 gap-x-space-4 sm:grid-cols-2">
                  <Field
                    label="Reminder offsets (comma-separated hours)"
                    htmlFor="reminder_offsets_hours"
                    hint="e.g. 24,1 sends a reminder one day before and one hour before."
                  >
                    <Input
                      id="reminder_offsets_hours"
                      value={settings.reminder_offsets_hours}
                      onChange={(e) => setSettings({ ...settings, reminder_offsets_hours: e.target.value })}
                    />
                  </Field>
                  <Field label="Reminder template name" htmlFor="reminder_template_name">
                    <Input
                      id="reminder_template_name"
                      value={settings.reminder_template_name}
                      onChange={(e) => setSettings({ ...settings, reminder_template_name: e.target.value })}
                    />
                  </Field>
                </div>
              </Card>

              <Card className="p-space-5">
                <h2 className="mb-space-1 text-[15px] font-bold text-ink-900">Messaging</h2>
                <p className="mb-space-3 text-[12.5px] text-ink-400">
                  Extra text guests see: appended after a reservation/cancellation/reschedule completes, shown as an informational
                  line in the &quot;Restaurant Information&quot; reply, and shown on the &quot;Consent &amp; Privacy&quot; menu item.
                </p>
                <Field label="Closing / thank-you message" htmlFor="closing_message_text" hint='e.g. "Thank you for choosing City Bistro. We look forward to seeing you again."'>
                  <Textarea
                    id="closing_message_text"
                    rows={2}
                    value={settings.closing_message_text}
                    onChange={(e) => setSettings({ ...settings, closing_message_text: e.target.value })}
                  />
                </Field>
                <Field label="Operating hours" htmlFor="business_hours_text" hint="e.g. Mon-Sat, 9am-10pm">
                  <Input
                    id="business_hours_text"
                    value={settings.business_hours_text}
                    onChange={(e) => setSettings({ ...settings, business_hours_text: e.target.value })}
                  />
                </Field>
                <Field label="Privacy notice text" htmlFor="privacy_notice_text" hint="Leave blank to show a generic default notice.">
                  <Textarea
                    id="privacy_notice_text"
                    rows={4}
                    value={settings.privacy_notice_text}
                    onChange={(e) => setSettings({ ...settings, privacy_notice_text: e.target.value })}
                  />
                </Field>
              </Card>

              <Card className="p-space-5">
                <h2 className="mb-space-1 text-[15px] font-bold text-ink-900">Language</h2>
                <p className="mb-space-3 text-[12.5px] text-ink-400">
                  Which language a fresh conversation defaults to, and whether guests are asked to choose at all.
                </p>
                <Field label="Default language" htmlFor="default_language">
                  <select
                    id="default_language"
                    value={settings.default_language}
                    onChange={(e) => setSettings({ ...settings, default_language: e.target.value as "en" | "hi" })}
                    className="h-10 w-full rounded-md border border-line bg-card px-space-3 text-[13.5px] text-ink-900"
                  >
                    <option value="en">English</option>
                    <option value="hi">हिन्दी (Hindi)</option>
                  </select>
                </Field>
                <CheckboxRow
                  checked={settings.language_prompt_enabled}
                  onChange={(checked) => setSettings({ ...settings, language_prompt_enabled: checked })}
                  className="mt-space-1"
                >
                  Ask guests to choose a language at the start of every fresh conversation
                </CheckboxRow>
                {!settings.language_prompt_enabled && (
                  <p className="mt-space-2 text-[12px] text-ink-400">
                    Guests will go straight to the menu in {settings.default_language === "hi" ? "हिन्दी" : "English"} — the
                    language picker won&apos;t be shown.
                  </p>
                )}
              </Card>

              <Card className="p-space-5">
                <h2 className="mb-space-1 text-[15px] font-bold text-ink-900">Conversation behavior</h2>
                <p className="mb-space-3 text-[12.5px] text-ink-400">
                  Session timeout, handoff auto-resolve, and whether a single linked guest still needs to confirm.
                </p>
                <div className="grid grid-cols-1 gap-x-space-4 sm:grid-cols-2">
                  <Field label="Session timeout (minutes)" htmlFor="session_timeout_minutes" hint="Between 2 and 120 minutes.">
                    <Input
                      id="session_timeout_minutes"
                      type="number"
                      min={2}
                      max={120}
                      value={settings.session_timeout_minutes}
                      onChange={(e) => setSettings({ ...settings, session_timeout_minutes: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Handoff auto-resolve (hours)" htmlFor="handoff_auto_resolve_hours" hint="Between 1 and 168 hours.">
                    <Input
                      id="handoff_auto_resolve_hours"
                      type="number"
                      min={1}
                      max={168}
                      value={settings.handoff_auto_resolve_hours}
                      onChange={(e) => setSettings({ ...settings, handoff_auto_resolve_hours: Number(e.target.value) })}
                    />
                  </Field>
                </div>
                <CheckboxRow
                  checked={settings.require_patient_confirmation}
                  onChange={(checked) => setSettings({ ...settings, require_patient_confirmation: checked })}
                >
                  Require explicit confirmation before entering the menu, even for a single linked guest
                </CheckboxRow>
              </Card>

              <Card className="p-space-5 lg:col-span-2">
                <h2 className="mb-space-1 text-[15px] font-bold text-ink-900">Follow-up reservations</h2>
                <p className="mb-space-3 text-[12.5px] text-ink-400">
                  How long after a visit a guest can still book a Follow-up for it, and the fees shown on booking
                  confirmation messages. Leave a fee blank to omit that line entirely rather than showing ₹0.
                </p>
                <div className="grid grid-cols-1 gap-x-space-4 sm:grid-cols-2 xl:grid-cols-4">
                  <Field
                    label="Follow-up eligibility window (days)"
                    htmlFor="followup_validity_days"
                    hint="Between 1 and 365 days after the visit."
                  >
                    <Input
                      id="followup_validity_days"
                      type="number"
                      min={1}
                      max={365}
                      value={settings.followup_validity_days}
                      onChange={(e) => setSettings({ ...settings, followup_validity_days: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Follow-up fee (₹)" htmlFor="followup_fee">
                    <Input
                      id="followup_fee"
                      type="number"
                      min={0}
                      value={settings.followup_fee}
                      onChange={(e) => setSettings({ ...settings, followup_fee: e.target.value === "" ? "" : Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="New reservation deposit (₹)" htmlFor="new_consultation_fee" hint="Not shown to guests yet.">
                    <Input
                      id="new_consultation_fee"
                      type="number"
                      min={0}
                      value={settings.new_consultation_fee}
                      onChange={(e) => setSettings({ ...settings, new_consultation_fee: e.target.value === "" ? "" : Number(e.target.value) })}
                    />
                  </Field>
                  <Field
                    label="Delivery fee (₹)"
                    htmlFor="home_collection_charge"
                    hint="Added to WhatsApp food orders placed for delivery. Leave blank for no delivery fee."
                  >
                    <Input
                      id="home_collection_charge"
                      type="number"
                      min={0}
                      value={settings.home_collection_charge}
                      onChange={(e) => setSettings({ ...settings, home_collection_charge: e.target.value === "" ? "" : Number(e.target.value) })}
                    />
                  </Field>
                </div>
              </Card>
            </div>

            {error && <p className="text-[12.5px] font-medium text-error">{error}</p>}
            {saved && <p className="text-[12.5px] font-medium text-success">Saved.</p>}

            <Button type="submit" disabled={saving} className="self-start">
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </form>
        )}

        {canManageAppointmentTypes && (
          <div className="mt-space-5 grid grid-cols-1 gap-space-5 lg:grid-cols-2">
            <Card className="p-space-5">
              <h2 className="mb-space-1 text-[15px] font-bold text-ink-900">Reservation types</h2>
              <p className="mb-space-3 text-[12.5px] text-ink-400">
                Turn on/off which of your allowed reservation types show up in the WhatsApp booking menu.
                A type greyed out below hasn&apos;t been enabled for your account by the platform — contact
                support to request it.
              </p>
              <AppointmentTypeToggles canManage={canManageAppointmentTypes} />
            </Card>
          </div>
        )}

        <div className="mt-space-5 grid grid-cols-1 gap-space-5 lg:grid-cols-2">
          <Card className="p-space-5">
            <h2 className="mb-space-1 text-[15px] font-bold text-ink-900">Table booking hours</h2>
            <p className="mb-space-3 text-[12.5px] text-ink-400">
              When guests can book a table via WhatsApp. Table booking shows no availability at all until
              this is set.
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
                    id="rh-start" type="time" value={hoursForm.form.start_time}
                    onChange={(e) => hoursForm.setForm({ ...hoursForm.form, start_time: e.target.value })}
                  />
                </Field>
                <Field label="Closes at" htmlFor="rh-end">
                  <Input
                    id="rh-end" type="time" value={hoursForm.form.end_time}
                    onChange={(e) => hoursForm.setForm({ ...hoursForm.form, end_time: e.target.value })}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-x-space-4 sm:grid-cols-2">
                <Field label="Turnover per table (minutes)" htmlFor="rh-turnover" hint="How long a party typically occupies a table.">
                  <Input
                    id="rh-turnover" type="number" min="1" value={hoursForm.form.default_turnover_minutes}
                    onChange={(e) => hoursForm.setForm({ ...hoursForm.form, default_turnover_minutes: e.target.value })}
                  />
                </Field>
                <Field label="Booking interval (minutes)" htmlFor="rh-interval" hint="How far apart bookable time slots are.">
                  <Input
                    id="rh-interval" type="number" min="1" value={hoursForm.form.booking_interval_minutes}
                    onChange={(e) => hoursForm.setForm({ ...hoursForm.form, booking_interval_minutes: e.target.value })}
                  />
                </Field>
              </div>
              {hoursForm.error && <p className="text-[12.5px] font-medium text-error">{hoursForm.error}</p>}
              <Button type="submit" disabled={hoursForm.saving} className="self-start">
                {hoursForm.saving ? "Saving…" : "Save table hours"}
              </Button>
            </form>
          </Card>
        </div>
    </PortalShell>
  );
}

export default function PortalSettingsPage() {
  return (
    <Suspense>
      <PortalSettingsPageContent />
    </Suspense>
  );
}
