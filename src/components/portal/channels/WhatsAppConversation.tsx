"use client";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { CheckboxRow } from "@/components/ui/Checkbox";
import { FormSkeleton } from "@/components/ui/Skeleton";
import { Select } from "@/components/erp-ui/Select";
import { usePortalSettings } from "@/hooks/usePortalSettings";

/** Language and conversation behaviour of the WhatsApp bot (formerly Settings → Language / Conversation). */
export function WhatsAppConversation({ ready }: { ready: boolean }) {
  const { settings, setSettings, error, saving, saved, handleSave } = usePortalSettings(ready);

  if (!settings) return <FormSkeleton fields={4} />;

  const feedback = (
    <>
      {error && <p className="mt-space-2 text-[12.5px] font-medium text-error">{error}</p>}
      {saved && <p className="mt-space-2 text-[12.5px] font-medium text-success">Saved.</p>}
    </>
  );

  return (
    <>
      <form onSubmit={handleSave}>
        <Card className="p-space-3 sm:p-space-4">
          <h2 className="mb-space-1 text-[15px] font-bold text-ink-900">Language</h2>
          <p className="mb-space-3 text-[12.5px] text-ink-400">
            Which language a fresh conversation defaults to, and whether guests are asked to choose
            at all.
          </p>
          <Field label="Default language" htmlFor="default_language">
            <Select
              value={settings.default_language}
              onValueChange={(v) =>
                setSettings({ ...settings, default_language: v as "en" | "hi" })
              }
              className="w-full !h-10"
              id="default_language"
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी (Hindi)</option>
            </Select>
          </Field>
          <CheckboxRow
            checked={settings.language_prompt_enabled}
            onChange={(checked) => setSettings({ ...settings, language_prompt_enabled: checked })}
            className="mt-space-1"
          >
            Ask guests to choose a language at the start of every fresh conversation
          </CheckboxRow>
          {!settings.language_prompt_enabled && (
            <p className="mt-space-2 text-[12px] text-ink-400">
              Guests will go straight to the menu in{" "}
              {settings.default_language === "hi" ? "हिन्दी" : "English"} — the language picker
              won&apos;t be shown.
            </p>
          )}
          {feedback}
          <Button type="submit" disabled={saving} className="mt-space-4">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </Card>
      </form>

      <form onSubmit={handleSave}>
        <Card className="p-space-3 sm:p-space-4">
          <h2 className="mb-space-1 text-[15px] font-bold text-ink-900">Conversation behavior</h2>
          <p className="mb-space-3 text-[12.5px] text-ink-400">
            Session timeout, handoff auto-resolve, and whether a single linked guest still needs to
            confirm.
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
                  setSettings({ ...settings, session_timeout_minutes: Number(e.target.value) })
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
                  setSettings({ ...settings, handoff_auto_resolve_hours: Number(e.target.value) })
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
            Require explicit confirmation before entering the menu, even for a single linked guest
          </CheckboxRow>
          {feedback}
          <Button type="submit" disabled={saving} className="mt-space-4">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </Card>
      </form>
    </>
  );
}
