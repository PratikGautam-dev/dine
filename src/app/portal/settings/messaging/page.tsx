"use client";

import { MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { FormSkeleton } from "@/components/ui/Skeleton";

import { usePortalSettings } from "@/hooks/usePortalSettings";
import { SettingsPageFrame } from "@/components/portal/settings/SettingsPageFrame";
import { usePortalGuard } from "@/components/portal/usePortalGuard";

export default function MessagingSettingsPage() {
  const { restaurant, ready } = usePortalGuard();
  const { settings, setSettings, error, saving, saved, handleSave } = usePortalSettings(ready);

  return (
    <SettingsPageFrame
      restaurant={restaurant}
      title="Messaging"
      icon={<MessagesSquare size={20} />}
      description="Extra text your guests see in WhatsApp replies."
    >
      <div className="max-w-2xl">
      {!settings ? <FormSkeleton fields={4} /> : (
      <form onSubmit={handleSave}>
        <Card className="p-space-5">
          <h2 className="mb-space-1 text-[15px] font-bold text-ink-900">Messaging</h2>
          <p className="mb-space-3 text-[12.5px] text-ink-400">
            Extra text guests see: appended after a reservation/cancellation/reschedule
            completes, shown as an informational line in the &quot;Restaurant
            Information&quot; reply, and shown on the &quot;Consent &amp; Privacy&quot; menu
            item.
          </p>
          <Field
            label="Closing / thank-you message"
            htmlFor="closing_message_text"
            hint='e.g. "Thank you for choosing City Bistro. We look forward to seeing you again."'
          >
            <Textarea
              id="closing_message_text"
              rows={2}
              value={settings.closing_message_text}
              onChange={(e) =>
                setSettings({ ...settings, closing_message_text: e.target.value })
              }
            />
          </Field>
          <Field
            label="Operating hours (shown to guests)"
            htmlFor="business_hours_text"
            hint="e.g. Mon-Sat, 9am-10pm. This is informational text only — it doesn't affect what WhatsApp actually lets guests book; that's set on the Booking rules page."
          >
            <Input
              id="business_hours_text"
              value={settings.business_hours_text}
              onChange={(e) =>
                setSettings({ ...settings, business_hours_text: e.target.value })
              }
            />
          </Field>
          <Field
            label="Privacy notice text"
            htmlFor="privacy_notice_text"
            hint="Leave blank to show a generic default notice."
          >
            <Textarea
              id="privacy_notice_text"
              rows={4}
              value={settings.privacy_notice_text}
              onChange={(e) =>
                setSettings({ ...settings, privacy_notice_text: e.target.value })
              }
            />
          </Field>
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
