"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";
import type { LoyaltySettings } from "@/hooks/useLoyaltySettings";

type Props = {
  settings: LoyaltySettings;
  saving: boolean;
  onSave: (patch: Partial<LoyaltySettings>) => Promise<string | null>;
  onClose: () => void;
};

/** Loyalty rules for the restaurant: when points are earned, when a customer becomes VIP, and what redeeming and the VIP pass are worth. */
export function LoyaltySettingsDialog({ settings, saving, onSave, onClose }: Props) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [spendPerPoint, setSpendPerPoint] = useState(String(settings.paise_per_point / 100));
  const [vipSpend, setVipSpend] = useState(String(settings.vip_spend_threshold_paise / 100));
  const [redeemPoints, setRedeemPoints] = useState(String(settings.redeem_points));
  const [redeemValue, setRedeemValue] = useState(String(settings.redeem_value_paise / 100));
  const [vipBenefit, setVipBenefit] = useState(settings.vip_benefit);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const message = await onSave({
      enabled,
      paise_per_point: Math.round(Number(spendPerPoint) * 100),
      vip_spend_threshold_paise: Math.round(Number(vipSpend) * 100),
      redeem_points: Math.round(Number(redeemPoints)),
      redeem_value_paise: Math.round(Number(redeemValue) * 100),
      vip_benefit: vipBenefit.trim(),
    });
    if (message) setError(message);
    else onClose();
  }

  return (
    <Modal onClose={onClose} labelledBy="loyalty-settings-title" maxWidthClass="max-w-[520px]">
      <h2 id="loyalty-settings-title" className="mb-space-4 text-[16px] font-semibold text-ink-900">Loyalty settings</h2>
      <form onSubmit={handleSave}>
        <div className="mb-space-4 flex items-center justify-between">
          <span className="text-[13.5px] font-medium text-ink-900">Loyalty points on</span>
          <Switch checked={enabled} onChange={() => setEnabled((v) => !v)} aria-label="Loyalty points on" />
        </div>
        <Field label="Spend per point (₹)" htmlFor="loyalty-spend-per-point" hint="A customer earns 1 point for each amount spent. Default ₹100.">
          <Input id="loyalty-spend-per-point" type="number" min={1} step="0.01" value={spendPerPoint} onChange={(e) => setSpendPerPoint(e.target.value)} />
        </Field>
        <Field label="VIP after total spend (₹)" htmlFor="loyalty-vip-spend" hint="Customers become VIP once their lifetime spend reaches this amount.">
          <Input id="loyalty-vip-spend" type="number" min={0} step="1" value={vipSpend} onChange={(e) => setVipSpend(e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-x-space-4 sm:grid-cols-2">
          <Field label="Points to redeem" htmlFor="loyalty-redeem-points">
            <Input id="loyalty-redeem-points" type="number" min={1} step="1" value={redeemPoints} onChange={(e) => setRedeemPoints(e.target.value)} />
          </Field>
          <Field label="Worth (₹ off)" htmlFor="loyalty-redeem-value">
            <Input id="loyalty-redeem-value" type="number" min={0} step="0.01" value={redeemValue} onChange={(e) => setRedeemValue(e.target.value)} />
          </Field>
        </div>
        <Field label="VIP pass benefit" htmlFor="loyalty-vip-benefit" hint="Shown to VIP customers, for example: free dessert on your birthday.">
          <Input id="loyalty-vip-benefit" maxLength={200} value={vipBenefit} onChange={(e) => setVipBenefit(e.target.value)} />
        </Field>
        {error && <p className="mb-space-3 text-[13px] font-medium text-error">{error}</p>}
        <div className="flex justify-end gap-space-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </div>
      </form>
    </Modal>
  );
}
