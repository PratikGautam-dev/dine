"use client";

import { Suspense, useState } from "react";
import {
  ArrowRight, Banknote, CalendarClock, Clock, CreditCard, Globe, ListChecks, Mail, MessageSquare, MessagesSquare,
  Printer, Settings as SettingsIcon, ShieldCheck, SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { CheckboxRow } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { AppointmentTypeToggles } from "@/components/portal/AppointmentTypeToggles";
import { PortalShell } from "@/components/portal/PortalShell";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { usePortalSettings } from "@/hooks/usePortalSettings";
import { OPERATING_DAYS, useRestaurantHours } from "@/hooks/useRestaurantHours";
import { useBookingConfirmationSetting } from "@/hooks/useBookingConfirmationSetting";
import { usePortalAuditLog } from "@/hooks/usePortalAuditLog";
import { cn } from "@/lib/cn";
import { usePermission } from "@/lib/staffAuth";

// Everything this app actually connects to today is the WhatsApp bot itself -- shown as genuinely
// Active below. The rest (payments, a kitchen printer, email/SMS delivery, Zomato/Swiggy sync) has
// no real integration behind it yet, so they're shown as not-connected placeholders rather than
// invented "Connected 2 min ago" states -- a restaurant owner relying on a fake "Connected" payment
// or delivery-platform status would be a real, not just cosmetic, problem.
const PLANNED_INTEGRATIONS = [
  { name: "Razorpay", blurb: "Payment gateway for online orders", icon: CreditCard },
  { name: "Kitchen printer", blurb: "Print orders to the kitchen", icon: Printer },
  { name: "Email service", blurb: "Send booking confirmations", icon: Mail },
  { name: "SMS service", blurb: "Send order & booking updates", icon: MessageSquare },
];

type TabId = "general" | "booking" | "types" | "messaging" | "language" | "conversation" | "fees";
type Tab = { id: TabId; label: string; icon: typeof SettingsIcon };

const TABS: Tab[] = [
  { id: "general", label: "General", icon: SettingsIcon },
  { id: "booking", label: "Booking Rules", icon: CalendarClock },
  { id: "types", label: "Reservation Types", icon: ListChecks },
  { id: "messaging", label: "Messaging", icon: MessagesSquare },
  { id: "language", label: "Language", icon: Globe },
  { id: "conversation", label: "Conversation", icon: SlidersHorizontal },
  { id: "fees", label: "Fees", icon: Banknote },
];

function PortalSettingsPageContent() {
  const { hospital, ready } = usePortalGuard();
  // Backend route guards already 403 the actual mutations for a clinic
  // tenant lacking manage_appointment_types -- same UI-convenience-only
  // gating as PortalDoctorsPage's canManageDoctors. Fails open (renders the
  // section) while hospital hasn't loaded yet.
  const canManageAppointmentTypes = !hospital || hospital.admin_capabilities?.includes("manage_appointment_types");
  const { settings, setSettings, error, saving, saved, handleSave } = usePortalSettings(ready);
  const hoursForm = useRestaurantHours(ready);
  const bookingConfirmation = useBookingConfirmationSetting(ready);
  const canSeeAttendanceSettings = usePermission("attendance_settings", "view");
  const { entries: auditEntries } = usePortalAuditLog(ready);
  const [tab, setTab] = useState<TabId>("general");

  const tabs = TABS.filter((t) => t.id !== "types" || canManageAppointmentTypes);

  return (
    <PortalShell hospital={hospital} active="settings">
        <PageHeader
          title="Settings"
          icon={<SettingsIcon size={22} />}
          description="Configure your restaurant, integrations and operational preferences."
          actions={
            <div className="flex flex-wrap gap-space-2">
              {canSeeAttendanceSettings && (
                <Button href="/portal/settings/attendance" variant="secondary">Attendance rules <ArrowRight size={14} /></Button>
              )}
              <Button href="/portal/settings/messages-automations" variant="secondary">Messages &amp; Automations <ArrowRight size={14} /></Button>
              <Button href="/portal/settings/activity" variant="secondary">Activity log <ArrowRight size={14} /></Button>
            </div>
          }
        />

        {!settings ? (
          <p className="text-[13px] text-ink-400">Loading…</p>
        ) : (
          <div className="grid grid-cols-1 items-start gap-space-4 xl:grid-cols-[220px_minmax(0,1fr)]">
            <nav className="flex gap-space-1 overflow-x-auto xl:flex-col xl:overflow-visible">
              {tabs.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    aria-current={tab === t.id ? "page" : undefined}
                    className={cn(
                      "flex shrink-0 items-center gap-space-2 rounded-md border px-space-3 py-2.5 text-left text-[13.5px] font-semibold transition-colors duration-150",
                      tab === t.id
                        ? "border-brand-200 bg-brand-50 text-brand-700"
                        : "border-transparent text-ink-600 hover:bg-paper hover:text-ink-900",
                    )}
                  >
                    <Icon size={16} className="shrink-0" />
                    {t.label}
                  </button>
                );
              })}
            </nav>

            <div className="min-w-0">
              {tab === "general" && (
                <div className="grid grid-cols-1 gap-space-4 lg:grid-cols-[1.3fr_1fr]">
                  <div className="min-w-0 space-y-space-4">
                    <form onSubmit={handleSave}>
                      <Card className="p-space-5">
                        <h2 className="mb-space-3 text-[15px] font-bold text-ink-900">Restaurant Profile</h2>
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
                        {error && <p className="mt-space-2 text-[12.5px] font-medium text-error">{error}</p>}
                        {saved && <p className="mt-space-2 text-[12.5px] font-medium text-success">Saved.</p>}
                        <Button type="submit" disabled={saving} className="mt-space-4">
                          {saving ? "Saving…" : "Save changes"}
                        </Button>
                      </Card>
                    </form>

                    <Card className="p-space-5">
                      <div className="mb-space-3 flex items-center justify-between">
                        <h2 className="text-[15px] font-bold text-ink-900">Operating Hours</h2>
                        <button type="button" onClick={() => setTab("booking")} className="text-[12.5px] font-semibold text-brand-600 hover:underline">
                          Edit
                        </button>
                      </div>
                      {hoursForm.form.operating_days.length === 0 || !hoursForm.form.start_time ? (
                        <p className="text-[13px] text-ink-400">
                          Not set yet — table booking shows no availability until this is set on the Booking Rules tab.
                        </p>
                      ) : (
                        <div className="flex items-center justify-between rounded-md border border-line px-space-3 py-space-2">
                          <div>
                            <p className="text-[13px] font-semibold text-ink-900">{hoursForm.form.operating_days.join(", ")}</p>
                            <p className="text-[12.5px] text-ink-600">{hoursForm.form.start_time} – {hoursForm.form.end_time}</p>
                          </div>
                          <span className="inline-flex items-center gap-1 rounded-full bg-success-tint px-space-2 py-0.5 text-[11px] font-bold text-success">
                            <Clock size={11} /> Open
                          </span>
                        </div>
                      )}
                    </Card>
                  </div>

                  <div className="min-w-0 space-y-space-4">
                    <Card className="p-space-5">
                      <h2 className="mb-space-1 text-[15px] font-bold text-ink-900">Quick Integrations</h2>
                      <p className="mb-space-3 text-[12.5px] text-ink-400">Connect and manage your services.</p>
                      <div className="space-y-space-2">
                        <div className="flex items-center gap-space-3 rounded-md border border-line p-space-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-success-tint">
                            <WhatsAppIcon size={18} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-[13px] font-semibold text-ink-900">WhatsApp Business</p>
                            <p className="text-[12px] text-ink-600">Customer chat & order management</p>
                          </div>
                          <span className="flex items-center gap-1 whitespace-nowrap text-[11.5px] font-semibold text-success">
                            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Active
                          </span>
                        </div>
                        {PLANNED_INTEGRATIONS.map((integration) => {
                          const Icon = integration.icon;
                          return (
                            <div key={integration.name} className="flex items-center gap-space-3 rounded-md border border-line p-space-3">
                              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-black/4 text-ink-400">
                                <Icon size={17} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[13px] font-semibold text-ink-900">{integration.name}</p>
                                <p className="text-[12px] text-ink-600">{integration.blurb}</p>
                              </div>
                              <span className="flex items-center gap-1 whitespace-nowrap text-[11.5px] font-semibold text-ink-400">
                                <span className="h-1.5 w-1.5 rounded-full bg-ink-300" /> Not connected
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </Card>

                    <Card className="p-space-5">
                      <div className="mb-space-3 flex items-center gap-space-2">
                        <ShieldCheck size={16} className="text-ink-600" />
                        <h2 className="text-[15px] font-bold text-ink-900">Security & Access</h2>
                      </div>
                      {auditEntries === undefined ? (
                        <p className="text-[12.5px] text-ink-400">Loading…</p>
                      ) : auditEntries === null || auditEntries.length === 0 ? (
                        <p className="text-[12.5px] text-ink-400">No recent activity recorded yet.</p>
                      ) : (
                        <ul className="space-y-space-2">
                          {auditEntries.slice(0, 3).map((entry) => (
                            <li key={entry.id} className="rounded-md bg-paper px-space-3 py-space-2 text-[12.5px]">
                              <p className="font-semibold text-ink-900">{entry.action}</p>
                              <p className="text-ink-600">{entry.actor_label || "Staff"} · {entry.created_at}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                      <Button href="/portal/settings/activity" variant="secondary" size="md" className="mt-space-3 w-full">
                        View full activity log <ArrowRight size={14} />
                      </Button>
                    </Card>
                  </div>
                </div>
              )}

              {tab === "booking" && (
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
              )}

              {tab === "booking" && (
                <Card className="mt-space-4 p-space-5">
                  <h2 className="mb-space-1 text-[15px] font-bold text-ink-900">Booking confirmation</h2>
                  <p className="mb-space-3 text-[12.5px] text-ink-400">
                    Off by default: a WhatsApp booking is confirmed instantly. Turn this on to require a staff
                    member to confirm each new WhatsApp booking before the guest gets their confirmation message.
                    Staff-created bookings are always confirmed immediately either way.
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
              )}

              {tab === "types" && canManageAppointmentTypes && (
                <Card className="p-space-5">
                  <h2 className="mb-space-1 text-[15px] font-bold text-ink-900">Reservation types</h2>
                  <p className="mb-space-3 text-[12.5px] text-ink-400">
                    Turn on/off which of your allowed reservation types show up in the WhatsApp booking menu.
                    A type greyed out below hasn&apos;t been enabled for your account by the platform — contact
                    support to request it.
                  </p>
                  <AppointmentTypeToggles canManage={canManageAppointmentTypes} />
                </Card>
              )}

              {tab === "messaging" && (
                <form onSubmit={handleSave}>
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
                    <Field label="Operating hours (shown to guests)" htmlFor="business_hours_text" hint="e.g. Mon-Sat, 9am-10pm. This is informational text only — it doesn't affect what WhatsApp actually lets guests book; that's set on the Booking Rules tab.">
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
                    {error && <p className="mt-space-2 text-[12.5px] font-medium text-error">{error}</p>}
                    {saved && <p className="mt-space-2 text-[12.5px] font-medium text-success">Saved.</p>}
                    <Button type="submit" disabled={saving} className="mt-space-4">
                      {saving ? "Saving…" : "Save changes"}
                    </Button>
                  </Card>
                </form>
              )}

              {tab === "language" && (
                <form onSubmit={handleSave}>
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
                    {error && <p className="mt-space-2 text-[12.5px] font-medium text-error">{error}</p>}
                    {saved && <p className="mt-space-2 text-[12.5px] font-medium text-success">Saved.</p>}
                    <Button type="submit" disabled={saving} className="mt-space-4">
                      {saving ? "Saving…" : "Save changes"}
                    </Button>
                  </Card>
                </form>
              )}

              {tab === "conversation" && (
                <form onSubmit={handleSave}>
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
                    {error && <p className="mt-space-2 text-[12.5px] font-medium text-error">{error}</p>}
                    {saved && <p className="mt-space-2 text-[12.5px] font-medium text-success">Saved.</p>}
                    <Button type="submit" disabled={saving} className="mt-space-4">
                      {saving ? "Saving…" : "Save changes"}
                    </Button>
                  </Card>
                </form>
              )}

              {tab === "fees" && (
                <form onSubmit={handleSave}>
                  <Card className="p-space-5">
                    <h2 className="mb-space-1 text-[15px] font-bold text-ink-900">Fees</h2>
                    <p className="mb-space-3 text-[12.5px] text-ink-400">
                      Amounts shown on WhatsApp booking and order messages. Leave a fee blank to omit that line entirely
                      rather than showing ₹0.
                    </p>
                    <div className="grid grid-cols-1 gap-x-space-4 sm:grid-cols-2">
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
                    {error && <p className="mt-space-2 text-[12.5px] font-medium text-error">{error}</p>}
                    {saved && <p className="mt-space-2 text-[12.5px] font-medium text-success">Saved.</p>}
                    <Button type="submit" disabled={saving} className="mt-space-4">
                      {saving ? "Saving…" : "Save changes"}
                    </Button>
                  </Card>
                </form>
              )}
            </div>
          </div>
        )}
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
