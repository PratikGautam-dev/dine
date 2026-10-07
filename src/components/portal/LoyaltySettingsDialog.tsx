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

/** Loyalty rules for the restaurant: when points are earned, the three spend thresholds a
 * customer's tier (Silver/Gold/Platinum) is computed from, and what each tier's benefit and
 * redeeming points are worth. */
export function LoyaltySettingsDialog({ settings, saving, onSave, onClose }: Props) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [spendPerPoint, setSpendPerPoint] = useState(String(settings.paise_per_point / 100));
  const [redeemPoints, setRedeemPoints] = useState(String(settings.redeem_points));
  const [redeemValue, setRedeemValue] = useState(String(settings.redeem_value_paise / 100));
  const [silverSpend, setSilverSpend] = useState(String(settings.silver_spend_threshold_paise / 100));
  const [silverBenefit, setSilverBenefit] = useState(settings.silver_benefit);
  const [goldSpend, setGoldSpend] = useState(String(settings.gold_spend_threshold_paise / 100));
  const [goldBenefit, setGoldBenefit] = useState(settings.gold_benefit);
  const [platinumSpend, setPlatinumSpend] = useState(String(settings.platinum_spend_threshold_paise / 100));
  const [platinumBenefit, setPlatinumBenefit] = useState(settings.platinum_benefit);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const message = await onSave({
      enabled,
      paise_per_point: Math.round(Number(spendPerPoint) * 100),
      redeem_points: Math.round(Number(redeemPoints)),
      redeem_value_paise: Math.round(Number(redeemValue) * 100),
      silver_spend_threshold_paise: Math.round(Number(silverSpend) * 100),
      silver_benefit: silverBenefit.trim(),
      gold_spend_threshold_paise: Math.round(Number(goldSpend) * 100),
      gold_benefit: goldBenefit.trim(),
      platinum_spend_threshold_paise: Math.round(Number(platinumSpend) * 100),
      platinum_benefit: platinumBenefit.trim(),
    });
    if (message) setError(message);
    else onClose();
  }

  return (
    <Modal onClose={onClose} labelledBy="loyalty-settings-title" maxWidthClass="max-w-[520px]">
      <h2 id="loyalty-settings-title" className="mb-space-4 text-[16px] font-semibold text-ink-900">
        Loyalty settings
      </h2>
      <form onSubmit={handleSave}>
        <div className="mb-space-4 flex items-center justify-between">
          <span className="text-[13.5px] font-medium text-ink-900">Loyalty points on</span>
          <Switch
            checked={enabled}
            onChange={() => setEnabled((v) => !v)}
            aria-label="Loyalty points on"
          />
        </div>
        <Field
          label="Spend per point (₹)"
          htmlFor="loyalty-spend-per-point"
          hint="A customer earns 1 point for each amount spent. Default ₹100."
        >
          <Input
            id="loyalty-spend-per-point"
            type="number"
            min={1}
            step="0.01"
            value={spendPerPoint}
            onChange={(e) => setSpendPerPoint(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-1 gap-x-space-4 sm:grid-cols-2">
          <Field label="Points to redeem" htmlFor="loyalty-redeem-points">
            <Input
              id="loyalty-redeem-points"
              type="number"
              min={1}
              step="1"
              value={redeemPoints}
              onChange={(e) => setRedeemPoints(e.target.value)}
            />
          </Field>
          <Field label="Worth (₹ off)" htmlFor="loyalty-redeem-value">
            <Input
              id="loyalty-redeem-value"
              type="number"
              min={0}
              step="0.01"
              value={redeemValue}
              onChange={(e) => setRedeemValue(e.target.value)}
            />
          </Field>
        </div>

        <p className="mb-space-2 mt-space-4 text-[13px] font-semibold text-ink-900">Tiers</p>
        <p className="mb-space-3 text-hint">
          A customer&apos;s tier is whichever threshold their lifetime spend has reached. Each must be
          at least the one before it: Silver ≤ Gold ≤ Platinum.
        </p>
        <div className="mb-space-3 grid grid-cols-1 gap-x-space-4 sm:grid-cols-2">
          <Field label="Silver at total spend (₹)" htmlFor="loyalty-silver-spend">
            <Input
              id="loyalty-silver-spend"
              type="number"
              min={0}
              step="1"
              value={silverSpend}
              onChange={(e) => setSilverSpend(e.target.value)}
            />
          </Field>
          <Field label="Silver benefit" htmlFor="loyalty-silver-benefit">
            <Input
              id="loyalty-silver-benefit"
              maxLength={200}
              value={silverBenefit}
              onChange={(e) => setSilverBenefit(e.target.value)}
            />
          </Field>
        </div>
        <div className="mb-space-3 grid grid-cols-1 gap-x-space-4 sm:grid-cols-2">
          <Field label="Gold at total spend (₹)" htmlFor="loyalty-gold-spend">
            <Input
              id="loyalty-gold-spend"
              type="number"
              min={0}
              step="1"
              value={goldSpend}
              onChange={(e) => setGoldSpend(e.target.value)}
            />
          </Field>
          <Field label="Gold benefit" htmlFor="loyalty-gold-benefit">
            <Input
              id="loyalty-gold-benefit"
              maxLength={200}
              value={goldBenefit}
              onChange={(e) => setGoldBenefit(e.target.value)}
            />
          </Field>
        </div>
        <div className="mb-space-3 grid grid-cols-1 gap-x-space-4 sm:grid-cols-2">
          <Field label="Platinum at total spend (₹)" htmlFor="loyalty-platinum-spend">
            <Input
              id="loyalty-platinum-spend"
              type="number"
              min={0}
              step="1"
              value={platinumSpend}
              onChange={(e) => setPlatinumSpend(e.target.value)}
            />
          </Field>
          <Field label="Platinum benefit" htmlFor="loyalty-platinum-benefit">
            <Input
              id="loyalty-platinum-benefit"
              maxLength={200}
              value={platinumBenefit}
              onChange={(e) => setPlatinumBenefit(e.target.value)}
            />
          </Field>
        </div>
        {error && <p className="mb-space-3 text-[13px] font-medium text-error">{error}</p>}
        <div className="flex justify-end gap-space-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
