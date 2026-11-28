"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Store } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckboxRow } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { FormSkeleton, TextSkeleton } from "@/components/ui/Skeleton";
import { formatDateTime } from "@/lib/formatDate";
import { toast } from "@/lib/toast";
import { useAdminTenantDetail, type TenantUpdatePayload } from "@/hooks/useAdminTenants";
import { useTenantAuditLog, type AuditLogEntry } from "@/hooks/useAdminAuditLog";
import { Select } from "@/components/erp-ui/Select";

// Edit-tenant form for an EXISTING restaurant -- mirrors admin/tenants_api.py's
// TenantUpdatePayload field-for-field (see that file's update_tenant() handler
// for the exact "blank = keep current" / "omit key = keep current,
// send even [] = set it" semantics this form has to respect on submit).
// Restaurants are created only by DAAP Core (erp-dine-backend daap/sync.py), and their owners sign in with DAAP.

const VALID_TIERS = ["tier1", "tier2", "tier3"] as const;
const TIER_LABELS: Record<string, string> = {
  tier1: "Tier 1 — WhatsApp catalog only",
  tier2: "Tier 2 — Connect my existing system's API",
  tier3: "Tier 3 — Fully custom integration",
};

type FormState = {
  name: string;
  whatsapp_phone_number_id: string;
  data_tier: string;
  api_base_url: string;
  api_key: string;
  access_token: string;
  app_secret: string;
  welcome_message_text: string;
  reminder_offsets_hours: string;
  reminder_template_name: string;
  admin_capabilities: string[];
  enabled_features: string[];
};

export default function AdminRestaurantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = String(params.id);
  const { tenant, loading, error, updateTenant } = useAdminTenantDetail(tenantId);
  const {
    entries: auditEntries,
    loading: auditLoading,
    error: auditError,
  } = useTenantAuditLog(tenantId);

  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Seed the editable form from the loaded tenant -- only once per load, so
  // a background reload() after a successful save doesn't clobber in-flight
  // edits (there isn't one right now, but matches the rest of this app's
  // detail-page convention of re-seeding only off the source data changing).
  const [seededFrom, setSeededFrom] = useState<typeof tenant>(null);
  if (tenant && tenant !== seededFrom) {
    setSeededFrom(tenant);
    setForm({
      name: tenant.name,
      whatsapp_phone_number_id: tenant.whatsapp_phone_number_id,
      data_tier: tenant.data_tier,
      api_base_url: tenant.external_api_base_url,
      api_key: tenant.external_api_key,
      access_token: "",
      app_secret: "",
      welcome_message_text: tenant.welcome_message_text,
      reminder_offsets_hours: tenant.reminder_offsets_hours,
      reminder_template_name: tenant.reminder_template_name,
      admin_capabilities: tenant.admin_capabilities,
      enabled_features: tenant.enabled_features,
    });
  }

  if (loading || !form || !tenant) {
    return (
      <>
        <PageHeader title="Restaurant" icon={<Store size={22} />} />
        <Card className="p-space-5">
          <FormSkeleton fields={6} />
        </Card>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Restaurant" icon={<Store size={22} />} />
        <p className="text-[13px] text-error">{error}</p>
      </>
    );
  }

  function toggleCapability(cap: string) {
    setForm((f) => {
      if (!f) return f;
      const has = f.admin_capabilities.includes(cap);
      return {
        ...f,
        admin_capabilities: has
          ? f.admin_capabilities.filter((c) => c !== cap)
          : [...f.admin_capabilities, cap],
      };
    });
  }

  function toggleFeature(key: string) {
    setForm((f) => {
      if (!f) return f;
      const has = f.enabled_features.includes(key);
      return {
        ...f,
        enabled_features: has
          ? f.enabled_features.filter((k) => k !== key)
          : [...f.enabled_features, key],
      };
    });
  }

  function resetCapabilitiesToDefaults() {
    setForm((f) => (f ? { ...f, admin_capabilities: tenant?.default_capabilities ?? [] } : f));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setFormErrors([]);
    setSuccessMessage(null);
    setSaving(true);

    const payload: TenantUpdatePayload = {
      name: form.name,
      whatsapp_phone_number_id: form.whatsapp_phone_number_id,
      data_tier: form.data_tier,
      api_base_url: form.data_tier === "tier2" ? form.api_base_url : "",
      api_key: form.data_tier === "tier2" ? form.api_key : "",
      access_token: form.access_token,
      app_secret: form.app_secret,
      welcome_message_text: form.welcome_message_text,
      reminder_offsets_hours: form.reminder_offsets_hours,
      reminder_template_name: form.reminder_template_name,
      // Explicitly sent (even when empty) -- this form is always a deliberate
      // edit of these two, never a "didn't touch it" partial call.
      admin_capabilities: form.admin_capabilities,
      enabled_features: form.enabled_features,
    };

    const errors = await updateTenant(payload);
    setSaving(false);
    if (errors) {
      setFormErrors(errors);
      toast.error("Couldn't save changes", errors[0]);
      return;
    }
    setForm((f) => (f ? { ...f, access_token: "", app_secret: "" } : f));
    setSuccessMessage("Changes saved.");
    toast.success("Restaurant updated");
  }

  return (
    <>
      <PageHeader
        title={tenant.name}
        icon={<Store size={22} />}
        description={`Restaurant #${tenant.id}`}
        actions={
          <Button variant="secondary" onClick={() => router.push("/admin/restaurants")}>
            <ArrowLeft size={14} /> Back to restaurants
          </Button>
        }
      />

      <form onSubmit={handleSave}>
        <Card className="mb-space-4 p-space-5">
          <h3 className="mb-space-4 text-[15px] font-bold text-ink-900">Identity</h3>
          <div className="grid grid-cols-1 gap-space-3 sm:grid-cols-2">
            <Field label="Restaurant Name" htmlFor="t-name" required>
              <Input
                id="t-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="WhatsApp Phone Number ID" htmlFor="t-phone" required>
              <Input
                id="t-phone"
                value={form.whatsapp_phone_number_id}
                onChange={(e) => setForm({ ...form, whatsapp_phone_number_id: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Data Connection Tier" htmlFor="t-tier" required>
            <Select
              value={form.data_tier}
              onValueChange={(v) => setForm({ ...form, data_tier: v })}
              className="w-full"
              id="t-tier"
            >
              {VALID_TIERS.map((tier) => (
                <option key={tier} value={tier}>
                  {TIER_LABELS[tier]}
                </option>
              ))}
            </Select>
          </Field>
          {form.data_tier === "tier2" && (
            <div className="grid grid-cols-1 gap-space-3 sm:grid-cols-2">
              <Field
                label="External API Base URL"
                htmlFor="t-api-base"
                required
                hint="Required for Tier 2"
              >
                <Input
                  id="t-api-base"
                  value={form.api_base_url}
                  onChange={(e) => setForm({ ...form, api_base_url: e.target.value })}
                />
              </Field>
              <Field
                label="External API Key"
                htmlFor="t-api-key"
                required
                hint="Required for Tier 2"
              >
                <Input
                  id="t-api-key"
                  value={form.api_key}
                  onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                />
              </Field>
            </div>
          )}
        </Card>

        <Card className="mb-space-4 p-space-5">
          <h3 className="mb-space-4 text-[15px] font-bold text-ink-900">Credentials</h3>
          <div className="grid grid-cols-1 gap-space-3 sm:grid-cols-2">
            <Field
              label="WhatsApp Access Token"
              htmlFor="t-token"
              hint={`Currently: ${tenant.access_token_masked} — leave blank to keep it`}
            >
              <Input
                id="t-token"
                type="password"
                placeholder={tenant.access_token_masked}
                value={form.access_token}
                onChange={(e) => setForm({ ...form, access_token: e.target.value })}
              />
            </Field>
            <Field
              label="App Secret"
              htmlFor="t-secret"
              hint={`Currently: ${tenant.app_secret_masked} — leave blank to keep it`}
            >
              <Input
                id="t-secret"
                type="password"
                placeholder={tenant.app_secret_masked}
                value={form.app_secret}
                onChange={(e) => setForm({ ...form, app_secret: e.target.value })}
              />
            </Field>
          </div>
        </Card>

        <Card className="mb-space-4 p-space-5">
          <h3 className="mb-space-4 text-[15px] font-bold text-ink-900">WhatsApp Bot Settings</h3>
          <Field label="Welcome Message" htmlFor="t-welcome">
            <Input
              id="t-welcome"
              value={form.welcome_message_text}
              onChange={(e) => setForm({ ...form, welcome_message_text: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-1 gap-space-3 sm:grid-cols-2">
            <Field
              label="Reminder Offsets (hours)"
              htmlFor="t-offsets"
              hint="Comma-separated, e.g. 24,2"
            >
              <Input
                id="t-offsets"
                value={form.reminder_offsets_hours}
                onChange={(e) => setForm({ ...form, reminder_offsets_hours: e.target.value })}
              />
            </Field>
            <Field label="Reminder Template Name" htmlFor="t-template">
              <Input
                id="t-template"
                value={form.reminder_template_name}
                onChange={(e) => setForm({ ...form, reminder_template_name: e.target.value })}
              />
            </Field>
          </div>
        </Card>

        <Card className="mb-space-4 p-space-5">
          <h3 className="mb-space-4 text-[15px] font-bold text-ink-900">Capabilities</h3>
          <div className="mb-space-2 flex items-center justify-between">
            <p className="text-label">Admin Capabilities</p>
            <button
              type="button"
              onClick={resetCapabilitiesToDefaults}
              className="text-[12px] font-semibold text-brand-600 hover:underline"
            >
              Reset to defaults
            </button>
          </div>
          <div className="grid grid-cols-1 gap-space-2 sm:grid-cols-2 md:grid-cols-3">
            {tenant.all_capabilities.map((cap) => (
              <CheckboxRow
                key={cap}
                checked={form.admin_capabilities.includes(cap)}
                onChange={() => toggleCapability(cap)}
              >
                {cap}
              </CheckboxRow>
            ))}
          </div>
        </Card>

        <Card className="mb-space-4 p-space-5">
          <h3 className="mb-space-4 text-[15px] font-bold text-ink-900">Enabled Features</h3>
          <div className="grid grid-cols-1 gap-space-2 sm:grid-cols-2 md:grid-cols-3">
            {Object.entries(tenant.feature_default_labels).map(([key, label]) => (
              <CheckboxRow
                key={key}
                checked={form.enabled_features.includes(key)}
                onChange={() => toggleFeature(key)}
              >
                {label}
              </CheckboxRow>
            ))}
          </div>
        </Card>

        <Card className="mb-space-4 p-space-5">
          <h3 className="mb-space-4 text-[15px] font-bold text-ink-900">DAAP business</h3>
          {tenant.daap ? (
            <dl className="grid grid-cols-[140px_1fr] gap-y-space-2 text-[13.5px]">
              <dt className="text-ink-500">Owner</dt>
              <dd className="text-ink-900">
                {tenant.daap.owner_name || "—"}{" "}
                <span className="text-ink-500">{tenant.daap.owner_email}</span>
              </dd>
              <dt className="text-ink-500">Business ID</dt>
              <dd className="font-mono text-ink-900">
                {tenant.daap.business_id || "Not verified yet"}
              </dd>
              <dt className="text-ink-500">Verification</dt>
              <dd>
                <Badge tone={tenant.daap.verification === "verified" ? "success" : "neutral"}>
                  {(tenant.daap.verification || "unknown").replace(/_/g, " ")}
                </Badge>
              </dd>
            </dl>
          ) : (
            <p className="text-[13px] text-ink-400">
              Not linked to a DAAP business (made before DAAP). Its owner and plan are managed in
              DAAP Admin once linked.
            </p>
          )}
        </Card>

        {formErrors.length > 0 && (
          <div className="mb-space-4 rounded-md border border-error/30 bg-error-tint p-space-3">
            {formErrors.map((err, i) => (
              <p key={i} className="text-[12.5px] font-medium text-error">
                {err}
              </p>
            ))}
          </div>
        )}
        {successMessage && (
          <p className="mb-space-4 text-[12.5px] font-medium text-success">{successMessage}</p>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>

      <Card className="mt-space-4 p-space-5">
        <h3 className="mb-space-4 text-[15px] font-bold text-ink-900">Activity Log</h3>
        {auditError && <p className="text-[13px] text-error">{auditError}</p>}
        {auditLoading ? (
          <TextSkeleton />
        ) : !auditEntries || auditEntries.length === 0 ? (
          <p className="text-[13px] text-ink-400">No activity recorded yet.</p>
        ) : (
          <ul className="space-y-space-2">
            {auditEntries.map((entry) => (
              <AuditLogRow key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

/** One audit-log row with a <details> toggle for the raw before/after JSON --
 * an operator debugging tool, not a polished diff view, so the raw objects
 * are good enough. */
function AuditLogRow({ entry }: { entry: AuditLogEntry }) {
  const hasDetail = entry.before_value !== null || entry.after_value !== null;
  return (
    <li className="rounded-md border border-line p-space-3 text-[13px]">
      <div className="flex flex-wrap items-center gap-space-2">
        <Badge tone={entry.actor_level === "platform_admin" ? "brand" : "neutral"}>
          {entry.actor_level === "platform_admin" ? "Platform Admin" : "Portal"}
        </Badge>
        <span className="font-semibold text-ink-900">{entry.action}</span>
        <span className="text-ink-600">{entry.actor_label}</span>
        <span className="ml-auto text-[12px] text-ink-400">{formatDateTime(entry.created_at)}</span>
      </div>
      {hasDetail && (
        <details className="mt-space-2">
          <summary className="cursor-pointer text-[12px] font-semibold text-brand-600">
            Show before/after
          </summary>
          <pre className="mt-space-2 overflow-x-auto rounded-md bg-black/[0.04] p-space-2 text-[11.5px] text-ink-700">
            {JSON.stringify({ before: entry.before_value, after: entry.after_value }, null, 2)}
          </pre>
        </details>
      )}
    </li>
  );
}
