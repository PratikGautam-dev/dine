"use client";

import { useState } from "react";
import { Select } from "@/components/erp-ui/Select";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { type PosSettings, usePosSettings, useSavePosSettings } from "@/hooks/usePosMenu";
import { useTaxRules } from "@/hooks/useTaxes";
import { fromMinor, toMinor } from "@/lib/erp/erp";
import { usePermission } from "@/lib/staffAuth";
import { toast } from "@/lib/toast";

/** Settings > Channels > POS: how the till prices and prints a bill. Restaurant-wide values first; a branch can override some of them. */
export function PosSettingsPanel({ branchId }: { branchId: string | null }) {
  const settings = usePosSettings();
  const canWrite = usePermission("settings", "write");
  if (settings.isPending) return <Skeleton className="h-40 w-full" />;
  if (settings.error) return <p className="text-[13px] text-error">{settings.error.message}</p>;
  const branch = settings.data.branches.find((b) => b.id === branchId) ?? null;
  return (
    <>
      <Card className="mt-space-5 min-w-0 p-space-3 md:p-space-4">
        <h2 className="text-[15px] font-bold text-ink-900">Billing settings</h2>
        <p className="mb-space-3 text-[13px] text-ink-600">
          For every branch, unless a branch sets its own below.
        </p>
        <RestaurantForm
          key={JSON.stringify(settings.data.restaurant)}
          value={settings.data.restaurant}
          canWrite={canWrite}
        />
      </Card>
      {branch && (
        <Card className="mt-space-4 min-w-0 p-space-3 md:p-space-4">
          <h3 className="text-[15px] font-bold text-ink-900">
            {branch.name}{" "}
            {branch.code && (
              <span className="text-[12.5px] font-medium text-ink-500">({branch.code})</span>
            )}
          </h3>
          <p className="mb-space-3 text-[13px] text-ink-600">
            Blank fields use the restaurant&apos;s setting. Service charge:{" "}
            {branch.service_charge_pct ? `${branch.service_charge_pct}%` : "none"} (set on the
            branch&apos;s page; the cashier can always remove it).
          </p>
          <BranchForm
            key={`${branch.id}-${JSON.stringify(branch)}`}
            branch={branch}
            canWrite={canWrite}
          />
        </Card>
      )}
    </>
  );
}

function RestaurantForm({
  value,
  canWrite,
}: {
  value: PosSettings["restaurant"];
  canWrite: boolean;
}) {
  const taxes = useTaxRules();
  const save = useSavePosSettings();
  const [form, setForm] = useState({
    prices_include_tax: value.prices_include_tax ? "yes" : "no",
    default_tax_code: value.default_tax_code ?? "",
    fssai_number: value.fssai_number ?? "",
    takeaway_pay_first: value.takeaway_pay_first ? "yes" : "no",
    packaging_fee: fromMinor(value.packaging_fee_paise),
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const fee = form.packaging_fee.trim() === "" ? 0 : toMinor(form.packaging_fee);
    if (fee === null) return toast.error("Enter the packaging fee as an amount, like 20 or 20.50.");
    try {
      await save.mutateAsync({
        body: {
          prices_include_tax: form.prices_include_tax === "yes",
          default_tax_code: form.default_tax_code || null,
          fssai_number: form.fssai_number.trim() || null,
          takeaway_pay_first: form.takeaway_pay_first === "yes",
          packaging_fee_paise: fee,
        },
      });
      toast.success("Billing settings saved");
    } catch (err) {
      toast.error("Couldn't save the settings", (err as Error).message);
    }
  }

  const ro = !canWrite;
  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-1 gap-x-space-4 sm:grid-cols-2">
        <Field
          label="Menu prices"
          htmlFor="pos-incl"
          hint="Most restaurants show prices before GST."
        >
          <Select
            id="pos-incl"
            className="w-full"
            value={form.prices_include_tax}
            disabled={ro}
            onValueChange={(v) => setForm({ ...form, prices_include_tax: v })}
          >
            <option value="no">Before GST (GST added on the bill)</option>
            <option value="yes">Include GST</option>
          </Select>
        </Field>
        <Field
          label="Default GST"
          htmlFor="pos-tax"
          hint="For items and categories without their own. Restaurants: usually 5%."
        >
          <Select
            id="pos-tax"
            className="w-full"
            value={form.default_tax_code}
            disabled={ro}
            onValueChange={(v) => setForm({ ...form, default_tax_code: v })}
          >
            <option value="">None</option>
            {(taxes.data ?? []).map((t) => (
              <option key={t.code} value={t.code}>
                {t.name} ({t.rate_bps / 100}%)
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="FSSAI licence number"
          htmlFor="pos-fssai"
          hint="14 digits. Printed on every bill, as the law requires."
        >
          <Input
            id="pos-fssai"
            inputMode="numeric"
            maxLength={20}
            value={form.fssai_number}
            disabled={ro}
            onChange={(e) => setForm({ ...form, fssai_number: e.target.value })}
          />
        </Field>
        <Field label="Takeaway" htmlFor="pos-tpf">
          <Select
            id="pos-tpf"
            className="w-full"
            value={form.takeaway_pay_first}
            disabled={ro}
            onValueChange={(v) => setForm({ ...form, takeaway_pay_first: v })}
          >
            <option value="yes">Guest pays when ordering</option>
            <option value="no">Guest pays on pickup</option>
          </Select>
        </Field>
        <Field
          label="Packaging fee (₹)"
          htmlFor="pos-pack"
          hint="Per takeaway or delivery bill. Blank or 0 = none."
        >
          <Input
            id="pos-pack"
            inputMode="decimal"
            value={form.packaging_fee}
            disabled={ro}
            onChange={(e) => setForm({ ...form, packaging_fee: e.target.value })}
          />
        </Field>
      </div>
      {canWrite && (
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save billing settings"}
        </Button>
      )}
    </form>
  );
}

function BranchForm({
  branch,
  canWrite,
}: {
  branch: PosSettings["branches"][number];
  canWrite: boolean;
}) {
  const save = useSavePosSettings();
  const [form, setForm] = useState({
    fssai_number: branch.fssai_number ?? "",
    takeaway_pay_first:
      branch.takeaway_pay_first === null ? "" : branch.takeaway_pay_first ? "yes" : "no",
    packaging_fee: fromMinor(branch.packaging_fee_paise),
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const fee = form.packaging_fee.trim() === "" ? null : toMinor(form.packaging_fee);
    if (form.packaging_fee.trim() !== "" && fee === null)
      return toast.error("Enter the packaging fee as an amount, like 20 or 20.50.");
    try {
      await save.mutateAsync({
        branchId: branch.id,
        body: {
          fssai_number: form.fssai_number.trim() || null,
          takeaway_pay_first:
            form.takeaway_pay_first === "" ? null : form.takeaway_pay_first === "yes",
          packaging_fee_paise: fee,
        },
      });
      toast.success("Branch settings saved");
    } catch (err) {
      toast.error("Couldn't save the branch settings", (err as Error).message);
    }
  }

  const ro = !canWrite;
  return (
    <form onSubmit={submit}>
      <div className="grid grid-cols-1 gap-x-space-4 sm:grid-cols-3">
        <Field label="FSSAI licence number" htmlFor="pos-b-fssai">
          <Input
            id="pos-b-fssai"
            inputMode="numeric"
            maxLength={20}
            value={form.fssai_number}
            disabled={ro}
            onChange={(e) => setForm({ ...form, fssai_number: e.target.value })}
          />
        </Field>
        <Field label="Takeaway" htmlFor="pos-b-tpf">
          <Select
            id="pos-b-tpf"
            className="w-full"
            value={form.takeaway_pay_first}
            disabled={ro}
            onValueChange={(v) => setForm({ ...form, takeaway_pay_first: v })}
          >
            <option value="">Restaurant&apos;s setting</option>
            <option value="yes">Guest pays when ordering</option>
            <option value="no">Guest pays on pickup</option>
          </Select>
        </Field>
        <Field label="Packaging fee (₹)" htmlFor="pos-b-pack">
          <Input
            id="pos-b-pack"
            inputMode="decimal"
            value={form.packaging_fee}
            disabled={ro}
            onChange={(e) => setForm({ ...form, packaging_fee: e.target.value })}
          />
        </Field>
      </div>
      {canWrite && (
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save branch settings"}
        </Button>
      )}
    </form>
  );
}
