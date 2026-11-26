"use client";

import Link from "next/link";
import { useState } from "react";
import { Select } from "@/components/erp-ui/Select";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { type PosSettings, usePosSettings, useSavePosSettings } from "@/hooks/usePosMenu";
import { fromMinor, toMinor } from "@/lib/erp/erp";
import { usePermission } from "@/lib/staffAuth";
import { toast } from "@/lib/toast";

/** When the business day can end: midnight (most restaurants) up to 6 am, for places open late. */
const DAY_ENDS = [0, 1, 2, 3, 4, 5, 6];
const dayEndsLabel = (h: number) => (h === 0 ? "Midnight (12 am)" : `${h} am`);
const DAY_ENDS_HINT =
  "Bills after midnight and before this hour count for the evening before: KOT numbers carry on and the Z report covers the whole night.";

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
  const save = useSavePosSettings();
  const [form, setForm] = useState({
    fssai_number: value.fssai_number ?? "",
    takeaway_pay_first: value.takeaway_pay_first ? "yes" : "no",
    packaging_fee: fromMinor(value.packaging_fee_paise),
    day_ends_hour: String(value.day_ends_hour),
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const fee = form.packaging_fee.trim() === "" ? 0 : toMinor(form.packaging_fee);
    if (fee === null) return toast.error("Enter the packaging fee as an amount, like 20 or 20.50.");
    try {
      await save.mutateAsync({
        body: {
          fssai_number: form.fssai_number.trim() || null,
          takeaway_pay_first: form.takeaway_pay_first === "yes",
          packaging_fee_paise: fee,
          day_ends_hour: Number(form.day_ends_hour),
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
      <p className="mb-space-3 rounded-md border border-line bg-paper px-space-3 py-space-2 text-[13px] text-ink-600">
        Menu prices{" "}
        {value.prices_include_tax ? "include GST" : "are before GST (GST is added on the bill)"};
        items without their own GST use {value.default_tax_bps / 100}%. Change these in{" "}
        <Link href="/portal/settings/taxes" className="font-semibold text-brand-700 underline">
          Settings &gt; Taxes
        </Link>
        .
      </p>
      <div className="grid grid-cols-1 gap-x-space-4 sm:grid-cols-2">
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
        <Field label="Business day ends at" htmlFor="pos-day-ends" hint={DAY_ENDS_HINT}>
          <Select
            id="pos-day-ends"
            className="w-full"
            value={form.day_ends_hour}
            disabled={ro}
            onValueChange={(v) => setForm({ ...form, day_ends_hour: v })}
          >
            {DAY_ENDS.map((h) => (
              <option key={h} value={String(h)}>
                {dayEndsLabel(h)}
              </option>
            ))}
          </Select>
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
    day_ends_hour: branch.day_ends_hour === null ? "" : String(branch.day_ends_hour),
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
          day_ends_hour: form.day_ends_hour === "" ? null : Number(form.day_ends_hour),
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
      <div className="grid grid-cols-1 gap-x-space-4 sm:grid-cols-2">
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
        <Field label="Business day ends at" htmlFor="pos-b-day-ends">
          <Select
            id="pos-b-day-ends"
            className="w-full"
            value={form.day_ends_hour}
            disabled={ro}
            onValueChange={(v) => setForm({ ...form, day_ends_hour: v })}
          >
            <option value="">Restaurant&apos;s setting</option>
            {DAY_ENDS.map((h) => (
              <option key={h} value={String(h)}>
                {dayEndsLabel(h)}
              </option>
            ))}
          </Select>
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
