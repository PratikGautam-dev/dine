"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { FormSkeleton } from "@/components/ui/Skeleton";
import { CheckboxRow } from "@/components/ui/Checkbox";
import { usePortalSettings } from "@/hooks/usePortalSettings";
import { SettingsPageFrame } from "@/components/portal/settings/SettingsPageFrame";
import { usePortalGuard } from "@/components/portal/usePortalGuard";

export default function ConversationSettingsPage() {
  const { restaurant, ready } = usePortalGuard();
  const { settings, setSettings, error, saving, saved, handleSave } = usePortalSettings(ready);

  return (
    <SettingsPageFrame
      restaurant={restaurant}
      title="Conversation"
      icon={<SlidersHorizontal size={20} />}
      description="Session timeout and handoff behaviour of the WhatsApp bot."
    >
      <div className="max-w-2xl">
      {!settings ? <FormSkeleton fields={4} /> : (
      <form onSubmit={handleSave}>
        <Card className="p-space-5">
          <h2 className="mb-space-1 text-[15px] font-bold text-ink-900">
            Conversation behavior
          </h2>
          <p className="mb-space-3 text-[12.5px] text-ink-400">
            Session timeout, handoff auto-resolve, and whether a single linked guest still
            needs to confirm.
          </p>
          <div className="grid grid-cols-1 gap-x-space-4 sm:grid-cols-2">
            <Field
              label="Session timeout (minutes)"
              htmlFor="session_timeout_minutes"
              hint="Between 2 and 120 minutes."
            >
              <Input
                id="session_timeout_minutes"
                type="number"
                min={2}
                max={120}
                value={settings.session_timeout_minutes}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    session_timeout_minutes: Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field
              label="Handoff auto-resolve (hours)"
              htmlFor="handoff_auto_resolve_hours"
              hint="Between 1 and 168 hours."
            >
              <Input
                id="handoff_auto_resolve_hours"
                type="number"
                min={1}
                max={168}
                value={settings.handoff_auto_resolve_hours}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    handoff_auto_resolve_hours: Number(e.target.value),
                  })
                }
              />
            </Field>
          </div>
          <CheckboxRow
            checked={settings.require_patient_confirmation}
            onChange={(checked) =>
              setSettings({ ...settings, require_patient_confirmation: checked })
            }
          >
            Require explicit confirmation before entering the menu, even for a single linked
            guest
          </CheckboxRow>
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
