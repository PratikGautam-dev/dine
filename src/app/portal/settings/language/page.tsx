"use client";

import { Globe } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { FormSkeleton } from "@/components/ui/Skeleton";
import { CheckboxRow } from "@/components/ui/Checkbox";
import { usePortalSettings } from "@/hooks/usePortalSettings";
import { SettingsPageFrame } from "@/components/portal/settings/SettingsPageFrame";
import { usePortalGuard } from "@/components/portal/usePortalGuard";

export default function LanguageSettingsPage() {
  const { restaurant, ready } = usePortalGuard();
  const { settings, setSettings, error, saving, saved, handleSave } = usePortalSettings(ready);

  return (
    <SettingsPageFrame
      restaurant={restaurant}
      title="Language"
      icon={<Globe size={20} />}
      description="Default language and the language picker."
    >
      <div className="max-w-2xl">
      {!settings ? <FormSkeleton fields={4} /> : (
      <form onSubmit={handleSave}>
        <Card className="p-space-5">
          <h2 className="mb-space-1 text-[15px] font-bold text-ink-900">Language</h2>
          <p className="mb-space-3 text-[12.5px] text-ink-400">
            Which language a fresh conversation defaults to, and whether guests are asked to
            choose at all.
          </p>
          <Field label="Default language" htmlFor="default_language">
            <select
              id="default_language"
              value={settings.default_language}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  default_language: e.target.value as "en" | "hi",
                })
              }
              className="h-10 w-full rounded-md border border-line bg-card px-space-3 text-[13.5px] text-ink-900"
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी (Hindi)</option>
            </select>
          </Field>
          <CheckboxRow
            checked={settings.language_prompt_enabled}
            onChange={(checked) =>
              setSettings({ ...settings, language_prompt_enabled: checked })
            }
            className="mt-space-1"
          >
            Ask guests to choose a language at the start of every fresh conversation
          </CheckboxRow>
          {!settings.language_prompt_enabled && (
            <p className="mt-space-2 text-[12px] text-ink-400">
              Guests will go straight to the menu in{" "}
              {settings.default_language === "hi" ? "हिन्दी" : "English"} — the language
              picker won&apos;t be shown.
            </p>
          )}
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
