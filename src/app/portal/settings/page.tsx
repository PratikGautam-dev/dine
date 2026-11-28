"use client";

import { useState } from "react";
import { ArrowRight, Check, Copy, MapPin, Settings as SettingsIcon, Store } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SettingsPageFrame } from "@/components/portal/settings/SettingsPageFrame";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { usePermission } from "@/lib/staffAuth";
import { useTenantSettings } from "@/hooks/useTenantSettings";
import { useStorefrontSettings } from "@/hooks/useStorefrontSettings";
import { useBusinessProfile } from "@/hooks/useBusinessProfile";
import {
  ContactDetailsModal,
  type ContactDraft,
} from "@/components/portal/settings/ContactDetailsModal";
import { formatPhone } from "@/lib/erp/phone";

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
        <span className={`block text-[13px] ${text ? "text-ink-600" : "text-ink-400"}`}>
          {text || empty}
        </span>
      </span>
      {canWrite && <span className="text-[12.5px] font-semibold text-brand-700">Edit</span>}
    </button>
  );
}

/** Settings > General > "Store contact details": the business name with its email and phone, and the store address. Either row opens
 * one dialog with every field (email, phone, address, pincode, city, state), saved straight away -- same pattern as the ERP's
 * Settings > General card. */
function RestaurantDetailsCard({ ready }: { ready: boolean }) {
  const canWrite = usePermission("settings", "write");
  const { storefront, saving, saveIdentity } = useStorefrontSettings(ready);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openEdit() {
    if (!storefront) return;
    setError(null);
    setOpen(true);
  }

  async function save(draft: ContactDraft) {
    const problem = await saveIdentity(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setOpen(false);
  }

  const contact = [storefront?.email, formatPhone(storefront?.phone)].filter(Boolean).join(" · ");
  const address = [
    storefront?.address_line,
    [storefront?.city, storefront?.state].filter(Boolean).join(", "),
    storefront?.pincode,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="p-space-4">
      <h2 className="mb-space-3 text-[15px] font-bold text-ink-900">Store contact details</h2>
      <div className="divide-y divide-line rounded-md border border-line">
        <DetailRow
          icon={<Store size={16} />}
          title={storefront?.name ?? "Restaurant"}
          text={contact || null}
          empty="Email and phone not set"
          canWrite={canWrite}
          onClick={openEdit}
        />
        <DetailRow
          icon={<MapPin size={16} />}
          title="Store address"
          text={address || null}
          empty="Not set"
          canWrite={canWrite}
          onClick={openEdit}
        />
      </div>

      {open && storefront && (
        <ContactDetailsModal
          initial={{
            email: storefront.email ?? "",
            phone: storefront.phone ?? "",
            address_line: storefront.address_line ?? "",
            pincode: storefront.pincode ?? "",
            city: storefront.city ?? "",
            state: storefront.state ?? "",
          }}
          saving={saving}
          error={error}
          onSave={save}
          onClose={() => setOpen(false)}
        />
      )}
    </Card>
  );
}

function NotProvided() {
  return (
    <span className="inline-flex rounded-full bg-black/[0.05] px-space-3 py-1 text-[11.5px] font-semibold text-ink-600">
      Not provided
    </span>
  );
}

function ProfileField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">{label}</p>
      <div className="mt-1 text-[14px] font-medium text-ink-900">
        {value ? value : <NotProvided />}
      </div>
    </div>
  );
}

function formatMemberSince(iso: string | null | undefined) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" });
}

/** Settings > General > "Business details": the business as verified by us (read-only). */
function BusinessDetailsCard({
  ready,
  currency,
  fallbackId,
}: {
  ready: boolean;
  currency?: string;
  fallbackId?: string | null;
}) {
  const profile = useBusinessProfile(ready);
  const { storefront } = useStorefrontSettings(ready);
  const [copied, setCopied] = useState(false);
  const businessId = profile ? profile.display_id : (fallbackId ?? null);

  async function copyId() {
    if (!businessId) return;
    try {
      await navigator.clipboard.writeText(businessId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <Card className="p-space-4">
      <h2 className="text-[15px] font-bold text-ink-900">Business details</h2>
      <p className="mb-space-4 mt-0.5 text-[13px] text-ink-600">
        Your business as verified by us. To change any of these, contact support.
      </p>
      <div className="flex items-center gap-space-3 rounded-lg border border-line px-space-4 py-space-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
          <Store size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-ink-900">
            {profile?.name ?? storefront?.name ?? "—"}
          </p>
          <p className="text-[13px] text-ink-600">
            {currency === "INR" || !currency ? "India" : currency}
          </p>
        </div>
        {businessId && (
          <div className="flex items-center gap-space-2 text-[13px] text-ink-600">
            <span>Business ID</span>
            <span className="font-mono text-[13px] font-bold text-ink-900">{businessId}</span>
            <button
              type="button"
              onClick={copyId}
              aria-label="Copy business ID"
              className="rounded p-1 text-ink-600 hover:bg-paper"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        )}
      </div>
      <p className="mb-space-4 mt-space-2 text-[12.5px] text-ink-400">
        Your Business ID never changes. Mention it whenever you contact support.
      </p>
      <div className="grid grid-cols-1 gap-x-space-6 gap-y-space-4 sm:grid-cols-2">
        <ProfileField label="Legal name" value={profile?.name} />
        <ProfileField label="Display name" value={storefront?.name ?? profile?.name} />
        <ProfileField
          label="Shop address"
          value={[storefront?.address_line, storefront?.city].filter(Boolean).join(", ") || null}
        />
        <ProfileField label="Business type" />
        <ProfileField label="What you sell" />
        <ProfileField label="Owner" value={profile?.owner_name} />
        <ProfileField label="Owner mobile" />
        <ProfileField label="Owner email" value={profile?.owner_email} />
        <ProfileField label="PAN" />
        <ProfileField label="GSTIN" />
        <ProfileField
          label="Status"
          value={profile ? profile.status.charAt(0).toUpperCase() + profile.status.slice(1) : null}
        />
        <ProfileField label="Member since" value={formatMemberSince(profile?.created_at)} />
        <ProfileField label="Verified on" />
      </div>
    </Card>
  );
}

/** Settings > General > "Store defaults": fixed when the business was set up. */
function StoreDefaultsCard({ ready, currency }: { ready: boolean; currency?: string }) {
  const profile = useBusinessProfile(ready);
  const row = (title: string, text: string, value?: string) => (
    <div className="flex items-center justify-between gap-space-3 px-space-4 py-space-3">
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-ink-900">{title}</p>
        <p className="text-[13px] text-ink-600">{text}</p>
      </div>
      {value && (
        <span className="shrink-0 rounded-full bg-clay-100 px-space-3 py-1 text-[12px] font-semibold text-ink-900">
          {value}
        </span>
      )}
    </div>
  );
  return (
    <Card className="p-space-4">
      <h2 className="text-[15px] font-bold text-ink-900">Store defaults</h2>
      <p className="mb-space-3 mt-0.5 text-[13px] text-ink-600">
        Fixed when your business was set up. Contact support if one is wrong.
      </p>
      <div className="divide-y divide-line rounded-lg border border-line">
        {row(
          "Currency",
          "Every price and amount on your website, till and portal",
          currency ?? "INR",
        )}
        {row(
          "Time zone",
          "When a day starts and ends for reports, attendance, return windows and the till's day close",
          profile?.timezone,
        )}
      </div>
    </Card>
  );
}

/** Settings > General: the business profile and store defaults. */
export default function PortalSettingsGeneralPage() {
  const { restaurant, ready } = usePortalGuard();
  const { settings: tenantSettings } = useTenantSettings(ready);

  return (
    <SettingsPageFrame
      restaurant={restaurant}
      title="Settings"
      maxWidthClass="max-w-[880px]"
      icon={<SettingsIcon size={20} />}
      description="Company-wide configuration."
      actions={
        <Button href="/portal/settings/messages-automations" variant="secondary">
          Messages &amp; Automations <ArrowRight size={14} />
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-space-4">
        <div className="min-w-0 space-y-space-4">
          <BusinessDetailsCard
            ready={ready}
            currency={tenantSettings?.currency}
            fallbackId={restaurant?.display_id}
          />
          <RestaurantDetailsCard ready={ready} />
          <StoreDefaultsCard ready={ready} currency={tenantSettings?.currency} />
        </div>
      </div>
    </SettingsPageFrame>
  );
}
