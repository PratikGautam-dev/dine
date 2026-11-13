"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Clock, MapPin, ShieldCheck, Settings as SettingsIcon, Store } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { FormSkeleton, ListSkeleton } from "@/components/ui/Skeleton";
import { SettingsPageFrame } from "@/components/portal/settings/SettingsPageFrame";
import { TenantSettingsDialog } from "@/components/portal/TenantSettingsDialog";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { usePermission } from "@/lib/staffAuth";
import { usePortalSettings } from "@/hooks/usePortalSettings";
import { useRestaurantHours } from "@/hooks/useRestaurantHours";
import { usePortalAuditLog } from "@/hooks/usePortalAuditLog";
import { useTenantSettings } from "@/hooks/useTenantSettings";
import { useStorefrontSettings } from "@/hooks/useStorefrontSettings";
import { CreditCard, Mail, MessageSquare, Printer } from "lucide-react";

function DetailRow({
  icon,
  title,
  text,
  empty,
  canWrite,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  text: string | null;
  empty: string;
  canWrite: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!canWrite}
      onClick={onClick}
      className="flex w-full items-center gap-space-3 px-space-3 py-space-3 text-left enabled:hover:bg-paper"
    >
      <span className="text-ink-600">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-ink-900">{title}</span>
        <span className={`block text-[13px] ${text ? "text-ink-600" : "text-ink-400"}`}>{text || empty}</span>
      </span>
      {canWrite && <span className="text-[12.5px] font-semibold text-brand-700">Edit</span>}
    </button>
  );
}

/** Restaurant name/address/city -- basic identity/location info, immediate save (not a cosmetic
 * draft/preview thing the way Online Storefront's tagline/logo/cover are). Same "clickable row
 * opens a shared modal with every field, any row opens the same draft" pattern
 * ShopConnect-tenant's own Settings > General "Store contact details" card uses. */
function RestaurantDetailsCard({ ready }: { ready: boolean }) {
  const canWrite = usePermission("settings", "write");
  const { storefront, saving, saveIdentity } = useStorefrontSettings(ready);
  const [draft, setDraft] = useState<{ name: string; address_line: string; city: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function openEdit() {
    if (!storefront) return;
    setError(null);
    setDraft({
      name: storefront.name,
      address_line: storefront.address_line ?? "",
      city: storefront.city ?? "",
    });
  }

  async function save() {
    if (!draft) return;
    const problem = await saveIdentity(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setDraft(null);
  }

  const address = [storefront?.address_line, storefront?.city].filter(Boolean).join(", ");

  return (
    <Card className="p-space-4">
      <h2 className="mb-space-3 text-[15px] font-bold text-ink-900">Restaurant details</h2>
      <div className="divide-y divide-line rounded-md border border-line">
        <DetailRow
          icon={<Store size={16} />}
          title="Restaurant name"
          text={storefront?.name ?? null}
          empty="Not set"
          canWrite={canWrite}
          onClick={openEdit}
        />
        <DetailRow
          icon={<MapPin size={16} />}
          title="Address"
          text={address || null}
          empty="Not set"
          canWrite={canWrite}
          onClick={openEdit}
        />
      </div>

      {draft && (
        <Modal onClose={() => setDraft(null)} labelledBy="restaurant-details-title" maxWidthClass="max-w-[520px]">
          <h2 id="restaurant-details-title" className="mb-space-4 text-[16px] font-semibold text-ink-900">
            Restaurant details
          </h2>
          <div className="grid grid-cols-1 gap-x-space-4 sm:grid-cols-2">
            <Field label="Restaurant name" htmlFor="rd-name" className="sm:col-span-2">
              <Input id="rd-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label="Address" htmlFor="rd-address" className="sm:col-span-2">
              <Input
                id="rd-address"
                value={draft.address_line}
                onChange={(e) => setDraft({ ...draft, address_line: e.target.value })}
              />
            </Field>
            <Field label="City" htmlFor="rd-city">
              <Input id="rd-city" value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} />
            </Field>
          </div>
          {error && <p className="mt-space-2 text-[13px] font-medium text-error">{error}</p>}
          <div className="mt-space-4 flex justify-end gap-space-2">
            <Button type="button" variant="secondary" onClick={() => setDraft(null)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </Modal>
      )}
    </Card>
  );
}

// Everything this app actually connects to today is the WhatsApp bot itself -- shown as genuinely
// Active below. The rest (payments, a kitchen printer, email/SMS delivery) has no real integration
// behind it yet, so they're shown as not-connected placeholders rather than invented "Connected"
// states -- a restaurant owner relying on a fake "Connected" payment status would be a real problem.
const PLANNED_INTEGRATIONS = [
  { name: "Razorpay", blurb: "Payment gateway for online orders", icon: CreditCard },
  { name: "Kitchen printer", blurb: "Print orders to the kitchen", icon: Printer },
  { name: "Email service", blurb: "Send booking confirmations", icon: Mail },
  { name: "SMS service", blurb: "Send order & booking updates", icon: MessageSquare },
];

/** Settings > General: the business profile, operating hours summary, integrations and recent activity. */
export default function PortalSettingsGeneralPage() {
  const { restaurant, ready } = usePortalGuard();
  const { settings, setSettings, error, saving, saved, handleSave } = usePortalSettings(ready);
  const hoursForm = useRestaurantHours(ready);
  const {
    settings: tenantSettings,
    saving: tenantSaving,
    update: updateTenantSettings,
  } = useTenantSettings(ready);
  const [tenantDialogOpen, setTenantDialogOpen] = useState(false);
  const { entries: auditEntries } = usePortalAuditLog(ready);

  return (
    <SettingsPageFrame
      restaurant={restaurant}
      title="General"
      icon={<SettingsIcon size={20} />}
      description="Configure your restaurant, integrations and operational preferences."
      actions={
        <Button href="/portal/settings/messages-automations" variant="secondary">
          Messages &amp; Automations <ArrowRight size={14} />
        </Button>
      }
    >
      {!settings ? (
        <FormSkeleton fields={5} />
      ) : (
      <div className="grid grid-cols-1 gap-space-4 xl:grid-cols-[1.3fr_1fr]">
        <div className="min-w-0 space-y-space-4">
          <RestaurantDetailsCard ready={ready} />

          <Card className="p-space-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[15px] font-bold text-ink-900">
                  General Business Settings
                </h2>
                <p className="text-hint">
                  Currency, date format, tax and branding for this account.
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="md"
                disabled={!tenantSettings}
                onClick={() => setTenantDialogOpen(true)}
              >
                Edit
              </Button>
            </div>
            {tenantSettings && (
              <div className="mt-space-4 grid grid-cols-2 gap-space-3 text-[13px] sm:grid-cols-4">
                <div>
                  <p className="text-label mb-0.5 font-medium text-ink-600">Currency</p>
                  <p className="text-ink-900">{tenantSettings.currency}</p>
                </div>
                <div>
                  <p className="text-label mb-0.5 font-medium text-ink-600">Date format</p>
                  <p className="text-ink-900">{tenantSettings.date_format}</p>
                </div>
                <div>
                  <p className="text-label mb-0.5 font-medium text-ink-600">Tax rate</p>
                  <p className="text-ink-900">
                    {tenantSettings.default_tax_rate}% (
                    {tenantSettings.tax_inclusive_prices ? "inclusive" : "exclusive"})
                  </p>
                </div>
                <div>
                  <p className="text-label mb-0.5 font-medium text-ink-600">Brand color</p>
                  <p className="flex items-center gap-1 text-ink-900">
                    {tenantSettings.branding.primary_color && (
                      <span
                        className="h-3 w-3 rounded-full border border-line"
                        style={{ backgroundColor: tenantSettings.branding.primary_color }}
                      />
                    )}
                    {tenantSettings.branding.primary_color || "—"}
                  </p>
                </div>
              </div>
            )}
          </Card>

          <form onSubmit={handleSave}>
            <Card className="p-space-5">
              <h2 className="mb-space-3 text-[15px] font-bold text-ink-900">
                WhatsApp Bot Messages
              </h2>
              <Field label="Welcome message text" htmlFor="welcome_message_text">
                <Textarea
                  id="welcome_message_text"
                  rows={2}
                  value={settings.welcome_message_text}
                  onChange={(e) =>
                    setSettings({ ...settings, welcome_message_text: e.target.value })
                  }
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
                    onChange={(e) =>
                      setSettings({ ...settings, reminder_offsets_hours: e.target.value })
                    }
                  />
                </Field>
                <Field label="Reminder template name" htmlFor="reminder_template_name">
                  <Input
                    id="reminder_template_name"
                    value={settings.reminder_template_name}
                    onChange={(e) =>
                      setSettings({ ...settings, reminder_template_name: e.target.value })
                    }
                  />
                </Field>
              </div>
              {error && (
                <p className="mt-space-2 text-[12.5px] font-medium text-error">{error}</p>
              )}
              {saved && (
                <p className="mt-space-2 text-[12.5px] font-medium text-success">Saved.</p>
              )}
              <Button type="submit" disabled={saving} className="mt-space-4">
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </Card>
          </form>

          <Card className="p-space-5">
            <div className="mb-space-3 flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-ink-900">Operating Hours</h2>
              <Link
                href="/portal/settings/booking"
                className="text-[12.5px] font-semibold text-brand-600 hover:underline"
              >
                Edit
              </Link>
            </div>
            {hoursForm.form.operating_days.length === 0 || !hoursForm.form.start_time ? (
              <p className="text-[13px] text-ink-400">
                Not set yet — table booking shows no availability until this is set on the
                Booking rules page.
              </p>
            ) : (
              <div className="flex items-center justify-between rounded-md border border-line px-space-3 py-space-2">
                <div>
                  <p className="text-[13px] font-semibold text-ink-900">
                    {hoursForm.form.operating_days.join(", ")}
                  </p>
                  <p className="text-[12.5px] text-ink-600">
                    {hoursForm.form.start_time} – {hoursForm.form.end_time}
                  </p>
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
            <h2 className="mb-space-1 text-[15px] font-bold text-ink-900">
              Quick Integrations
            </h2>
            <p className="mb-space-3 text-[12.5px] text-ink-400">
              Connect and manage your services.
            </p>
            <div className="space-y-space-2">
              <div className="flex items-center gap-space-3 rounded-md border border-line p-space-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-success-tint">
                  <WhatsAppIcon size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-ink-900">
                    WhatsApp Business
                  </p>
                  <p className="text-[12px] text-ink-600">
                    Customer chat & order management
                  </p>
                </div>
                <span className="flex items-center gap-1 whitespace-nowrap text-[11.5px] font-semibold text-success">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" /> Active
                </span>
              </div>
              {PLANNED_INTEGRATIONS.map((integration) => {
                const Icon = integration.icon;
                return (
                  <div
                    key={integration.name}
                    className="flex items-center gap-space-3 rounded-md border border-line p-space-3"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-black/4 text-ink-400">
                      <Icon size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-ink-900">
                        {integration.name}
                      </p>
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
              <ListSkeleton rows={3} />
            ) : auditEntries === null || auditEntries.length === 0 ? (
              <p className="text-[12.5px] text-ink-400">No recent activity recorded yet.</p>
            ) : (
              <ul className="space-y-space-2">
                {auditEntries.slice(0, 3).map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-md bg-paper px-space-3 py-space-2 text-[12.5px]"
                  >
                    <p className="font-semibold text-ink-900">{entry.action}</p>
                    <p className="text-ink-600">
                      {entry.actor_label || "Staff"} · {entry.created_at}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <Button
              href="/portal/settings/activity"
              variant="secondary"
              size="md"
              className="mt-space-3 w-full"
            >
              View full activity log <ArrowRight size={14} />
            </Button>
          </Card>
        </div>
      </div>
      )}
      {tenantDialogOpen && tenantSettings && (
        <TenantSettingsDialog
          settings={tenantSettings}
          saving={tenantSaving}
          onSubmit={updateTenantSettings}
          onClose={() => setTenantDialogOpen(false)}
        />
      )}
    </SettingsPageFrame>
  );
}
