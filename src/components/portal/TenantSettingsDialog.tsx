"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";
import { CURRENCIES, DATE_FORMATS, type TenantSettings } from "@/hooks/useTenantSettings";

type Props = {
  settings: TenantSettings;
  onSubmit: (patch: Partial<TenantSettings>) => Promise<string | null>;
  onClose: () => void;
  saving: boolean;
};

/** General business settings -- currency, date format, tax fields, branding (migration 0061).
 * Centered modal, same pattern BranchFormDialog/StaffFormDialog already use. */
export function TenantSettingsDialog({ settings, onSubmit, onClose, saving }: Props) {
  const [currency, setCurrency] = useState(settings.currency);
  const [dateFormat, setDateFormat] = useState(settings.date_format);
  const [taxInclusive, setTaxInclusive] = useState(settings.tax_inclusive_prices);
  const [taxRate, setTaxRate] = useState(settings.default_tax_rate.toString());
  const [primaryColor, setPrimaryColor] = useState(settings.branding.primary_color ?? "");
  const [invoiceFooter, setInvoiceFooter] = useState(settings.branding.invoice_footer_text ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const problem = await onSubmit({
      currency,
      date_format: dateFormat,
      tax_inclusive_prices: taxInclusive,
      default_tax_rate: taxRate ? Number(taxRate) : 0,
      branding: {
        ...settings.branding,
        primary_color: primaryColor || undefined,
        invoice_footer_text: invoiceFooter || undefined,
      },
    });
    if (problem) setError(problem);
    else onClose();
  }

  return (
    <Modal onClose={onClose} labelledBy="tenant-settings-title" maxWidthClass="max-w-[520px]">
      <h2 id="tenant-settings-title" className="mb-space-1 text-[16px] font-semibold text-ink-900">
        General Settings
      </h2>
      <p className="mb-space-4 text-[12.5px] text-ink-600">
        Currency, date format, tax and branding for this account.
      </p>
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-x-space-4 sm:grid-cols-2">
          <Field label="Currency" htmlFor="ts-currency">
            <select
              id="ts-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="h-11 w-full rounded-md border border-line bg-card px-space-3 text-[14px] text-ink-900"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Date format" htmlFor="ts-date-format">
            <select
              id="ts-date-format"
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
              className="h-11 w-full rounded-md border border-line bg-card px-space-3 text-[14px] text-ink-900"
            >
              {DATE_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Default tax rate (%)"
            htmlFor="ts-tax-rate"
            hint="Stored for reference -- no tax engine applies this yet"
          >
            <Input
              id="ts-tax-rate"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
            />
          </Field>
          <div className="flex items-end pb-space-2">
            <label className="flex items-center gap-space-2">
              <Switch
                checked={taxInclusive}
                onChange={() => setTaxInclusive(!taxInclusive)}
                aria-label="Prices include tax"
              />
              <span className="text-[13px] font-medium text-ink-700">Prices include tax</span>
            </label>
          </div>
          <Field
            label="Brand color"
            htmlFor="ts-brand-color"
            hint="Stored for reference -- not yet applied to the storefront theme"
          >
            <Input
              id="ts-brand-color"
              type="text"
              placeholder="#E21220"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
            />
          </Field>
          <Field
            label="Invoice footer text"
            htmlFor="ts-invoice-footer"
            className="sm:col-span-2"
            hint="Stored for reference -- no invoice/receipt rendering exists yet"
          >
            <Input
              id="ts-invoice-footer"
              value={invoiceFooter}
              onChange={(e) => setInvoiceFooter(e.target.value)}
              placeholder="Thank you for your order!"
            />
          </Field>
        </div>
        {error && <p className="mt-space-3 text-[12.5px] font-medium text-error">{error}</p>}
        <div className="mt-space-5 flex justify-end gap-space-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
