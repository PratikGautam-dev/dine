"use client";

import { useEffect, useRef, useState } from "react";
import { Palette, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { FormSkeleton } from "@/components/ui/Skeleton";
import { SettingsPageFrame } from "@/components/portal/settings/SettingsPageFrame";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { usePermission } from "@/lib/staffAuth";
import { useThemeSettings } from "@/hooks/useBranding";
import { BRAND_PRESETS, DEFAULT_BRAND, contrastWithWhite, normalizeHex, type Branding } from "@/lib/theme";

const MAX_LOGO_BYTES = 1024 * 1024;
const LOGO_TYPES = ["image/jpeg", "image/png", "image/webp"];

type ThemeApi = ReturnType<typeof useThemeSettings>;

/** Settings > Theme and colours: the brand colour, sidebar colour and logo used across the portal for everyone
 * in the business. Changes preview live on the page and only persist on Save. */
export default function ThemeSettingsPage() {
  const { restaurant, ready } = usePortalGuard();
  const canWrite = usePermission("settings", "write");
  const api = useThemeSettings(ready);
  return (
    <SettingsPageFrame
      restaurant={restaurant}
      title="Theme and colours"
      icon={<Palette size={20} />}
      description="Your brand colour and logo across the portal, for everyone in your business."
      maxWidthClass="max-w-[880px]"
    >
      {api.saved ? (
        <ThemeForm key={JSON.stringify(api.saved)} saved={api.saved} canWrite={canWrite} api={api} />
      ) : (
        <FormSkeleton fields={3} />
      )}
    </SettingsPageFrame>
  );
}

function ThemeForm({ saved, canWrite, api }: { saved: Branding; canWrite: boolean; api: ThemeApi }) {
  const { saving, uploading, preview, save, uploadLogo } = api;
  const [color, setColor] = useState(saved.primary_color ?? "");
  const [sidebarAuto, setSidebarAuto] = useState(!saved.sidebar_color);
  const [sidebarColor, setSidebarColor] = useState(saved.sidebar_color ?? "");
  const [logo, setLogo] = useState<string | null>(saved.logo_url ?? null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const brandHex = color ? normalizeHex(color) : null;
  const sidebarHex = !sidebarAuto && sidebarColor ? normalizeHex(sidebarColor) : null;
  const colorProblem = !color
    ? null
    : !brandHex
      ? "Enter a colour like #2f6fe4."
      : contrastWithWhite(brandHex) < 4.5
        ? "That colour is too light: white text on it wouldn't be readable. Pick a darker one."
        : null;
  const sidebarProblem =
    !sidebarAuto && sidebarColor
      ? !sidebarHex
        ? "Enter a colour like #1f2937."
        : contrastWithWhite(sidebarHex) < 4.5
          ? "That sidebar colour is too light for white text."
          : null
      : null;

  const draft: Branding = {
    primary_color: brandHex && !colorProblem ? brandHex : null,
    sidebar_color: sidebarHex && !sidebarProblem ? sidebarHex : null,
    logo_url: logo,
  };

  const dirty =
    (draft.primary_color ?? null) !== (saved.primary_color ?? null) ||
    (draft.sidebar_color ?? null) !== (saved.sidebar_color ?? null) ||
    (draft.logo_url ?? null) !== (saved.logo_url ?? null);

  // "The page shows your changes as you make them": preview the draft; leaving the page restores the saved look.
  useEffect(() => {
    preview(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.primary_color, draft.sidebar_color]);
  useEffect(() => () => preview(null), [preview]);

  function discard() {
    setError(null);
    setColor(saved.primary_color ?? "");
    setSidebarAuto(!saved.sidebar_color);
    setSidebarColor(saved.sidebar_color ?? "");
    setLogo(saved.logo_url ?? null);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!LOGO_TYPES.includes(file.type)) return setError("Logo must be a JPEG, PNG or WebP image.");
    if (file.size > MAX_LOGO_BYTES) return setError("Logo must be 1 MB or smaller.");
    const url = await uploadLogo(file);
    if (url) setLogo(url);
  }

  async function onSave() {
    if (colorProblem || sidebarProblem) return;
    setError(null);
    const problem = await save({
      primary_color: draft.primary_color,
      sidebar_color: draft.sidebar_color,
      logo_url: draft.logo_url,
    });
    if (problem) setError(problem);
  }

  const activePreset = brandHex ?? DEFAULT_BRAND;

  return (
    <>
      <Card className="p-space-5">
        <fieldset disabled={!canWrite} className="min-w-0 border-0 p-0">
          <h2 className="text-[14px] font-bold text-ink-900">Brand colour</h2>
          <div className="mt-space-3 flex flex-wrap gap-space-2">
            {BRAND_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-label={`Use ${preset}`}
                aria-pressed={activePreset === preset}
                onClick={() => setColor(preset === DEFAULT_BRAND ? "" : preset)}
                className={`h-6 w-6 rounded-full border-2 transition ${
                  activePreset === preset ? "border-ink-900 ring-2 ring-white ring-inset" : "border-transparent"
                }`}
                style={{ backgroundColor: preset }}
              />
            ))}
          </div>
          <div className="mt-space-3 flex items-center gap-space-3">
            <span
              className="h-8 w-8 shrink-0 rounded-md border border-line"
              style={{ backgroundColor: brandHex ?? DEFAULT_BRAND }}
            />
            <Input
              aria-label="Brand colour hex"
              placeholder="Default"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>
          <p className={`mt-space-2 text-[12.5px] ${colorProblem ? "font-medium text-error" : "text-ink-400"}`}>
            {colorProblem ?? "Buttons, links, highlights and the sidebar. White text must be readable on it."}
          </p>

          <h2 className="mt-space-5 text-[14px] font-bold text-ink-900">Sidebar colour</h2>
          <div className="mt-space-2 flex items-center justify-between gap-space-3">
            <span className="text-[14px] text-ink-900">Automatic</span>
            <Switch
              checked={sidebarAuto}
              onChange={() => setSidebarAuto(!sidebarAuto)}
              aria-label="Automatic sidebar colour"
            />
          </div>
          {!sidebarAuto && (
            <div className="mt-space-3 flex items-center gap-space-3">
              <span
                className="h-8 w-8 shrink-0 rounded-md border border-line"
                style={{ backgroundColor: sidebarHex ?? "transparent" }}
              />
              <Input
                aria-label="Sidebar colour hex"
                placeholder="#1f2937"
                value={sidebarColor}
                onChange={(e) => setSidebarColor(e.target.value)}
              />
            </div>
          )}
          <p className={`mt-space-2 text-[12.5px] ${sidebarProblem ? "font-medium text-error" : "text-ink-400"}`}>
            {sidebarProblem ?? "Leave on automatic for a dark shade of the brand colour."}
          </p>

          <h2 className="mt-space-5 text-[14px] font-bold text-ink-900">Logo</h2>
          <div className="mt-space-3 flex items-center gap-space-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-card text-[12px] text-ink-400">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                "None"
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button type="button" variant="secondary" disabled={uploading} onClick={() => fileRef.current?.click()}>
              <Upload size={15} /> {uploading ? "Uploading…" : "Upload"}
            </Button>
            {logo && (
              <Button type="button" variant="ghost" onClick={() => setLogo(null)}>
                Remove
              </Button>
            )}
          </div>
          <p className="mt-space-2 text-[12.5px] text-ink-400">
            JPEG, PNG or WebP up to 1 MB. Shown at the top of the sidebar; without one the portal shows your
            business&apos;s initial.
          </p>
        </fieldset>

        {error && <p className="mt-space-4 text-[13px] font-medium text-error">{error}</p>}

        <div className="mt-space-5 flex flex-wrap items-center gap-space-3 border-t border-line pt-space-4">
          <Button
            type="button"
            disabled={!canWrite || !dirty || saving || !!colorProblem || !!sidebarProblem}
            onClick={onSave}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button type="button" variant="secondary" disabled={!dirty || saving} onClick={discard}>
            Discard changes
          </Button>
          <span className="text-[13px] text-ink-600">The page shows your changes as you make them.</span>
        </div>
      </Card>
    </>
  );
}
