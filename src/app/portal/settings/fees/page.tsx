"use client";

import { Banknote } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { FormSkeleton } from "@/components/ui/Skeleton";

import { usePortalSettings } from "@/hooks/usePortalSettings";
import { SettingsPageFrame } from "@/components/portal/settings/SettingsPageFrame";
import { usePortalGuard } from "@/components/portal/usePortalGuard";

export default function FeesSettingsPage() {
  const { restaurant, ready } = usePortalGuard();
  const { settings, setSettings, error, saving, saved, handleSave } = usePortalSettings(ready);

  return (
    <SettingsPageFrame
      restaurant={restaurant}
      title="Fees"
      icon={<Banknote size={20} />}
      description="Amounts shown on WhatsApp booking and order messages."
    >
      <div className="max-w-2xl">
      {!settings ? <FormSkeleton fields={4} /> : (
      <form onSubmit={handleSave}>
        <Card className="p-space-5">
          <h2 className="mb-space-1 text-[15px] font-bold text-ink-900">Fees</h2>
          <p className="mb-space-3 text-[12.5px] text-ink-400">
            Amounts shown on WhatsApp booking and order messages. Leave a fee blank to omit
            that line entirely rather than showing ₹0.
          </p>
          <div className="grid grid-cols-1 gap-x-space-4 sm:grid-cols-2">
            <Field
              label="New reservation deposit (₹)"
              htmlFor="new_consultation_fee"
              hint="Not shown to guests yet."
            >
              <Input
                id="new_consultation_fee"
                type="number"
                min={0}
                value={settings.new_consultation_fee}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    new_consultation_fee:
                      e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
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
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    home_collection_charge:
                      e.target.value === "" ? "" : Number(e.target.value),
                  })
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
      )}
      </div>
    </SettingsPageFrame>
  );
}
