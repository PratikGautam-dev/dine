"use client";

import { Upload } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/erp-ui/Button";
import { Field } from "@/components/erp-ui/Field";
import { Input } from "@/components/erp-ui/Input";
import { Switch } from "@/components/erp-ui/Switch";
import { useUploadPosLogo } from "@/hooks/usePosBranding";
import { cn } from "@/lib/erp/cn";
import {
  BRAND_PRESETS,
  contrast,
  isHex,
  MAX_APP_NAME,
  type PosBrandingInput,
} from "@/lib/posBranding";
import { toast } from "@/lib/toast";

const MAX_LOGO_BYTES = 1024 * 1024;

export type BrandDraft = Required<Pick<PosBrandingInput, "app_name" | "primary_color">> & {
  sidebar_color: string | null;
  logo_url: string | null;
};

/** What is wrong with the draft before it is sent (the server checks the same). */
export function brandProblems(d: BrandDraft): Record<string, string> {
  const out: Record<string, string> = {};
  const name = d.app_name.trim();
  if (!name || name.length > MAX_APP_NAME) out.app_name = `Use 1 to ${MAX_APP_NAME} characters.`;
  if (!isHex(d.primary_color)) out.primary_color = "Use a colour like #2F6FED.";
  else if (contrast(d.primary_color, "#FFFFFF") < 3)
    out.primary_color = "Too light: white button text would be hard to read.";
  if (d.sidebar_color !== null) {
    if (!isHex(d.sidebar_color)) out.sidebar_color = "Use a colour like #0B1739.";
    else if (contrast(d.sidebar_color, "#FFFFFF") < 4.5)
      out.sidebar_color = "Too light: the sidebar's white text would be hard to read.";
  }
  return out;
}

/** The Brand node of the POS editor: the tills' name, colours, logo and the DAAP mark. */
export function PosBrandPanel({
  draft,
  onChange,
  poweredBy,
}: {
  draft: BrandDraft;
  onChange: (patch: Partial<BrandDraft>) => void;
  /** Set by DAAP for this business (super admin), shown here read-only. */
  poweredBy: boolean;
}) {
  const upload = useUploadPosLogo();
  const file = useRef<HTMLInputElement>(null);
  const problems = brandProblems(draft);
  const custom = !BRAND_PRESETS.some(
    (p) => p.key.toLowerCase() === draft.primary_color.toLowerCase(),
  );

  return (
    <>
      <Field
        label="Name on the till"
        htmlFor="pos-app-name"
        hint="Shown in the sidebar, on the login screen and as the window title."
        error={problems.app_name}
      >
        <Input
          id="pos-app-name"
          value={draft.app_name}
          maxLength={MAX_APP_NAME}
          invalid={!!problems.app_name}
          onChange={(e) => onChange({ app_name: e.target.value })}
        />
      </Field>

      <Field
        label="Brand colour"
        hint="Buttons, links and highlights."
        error={problems.primary_color}
      >
        <div className="mb-space-2 flex flex-wrap gap-space-2">
          {BRAND_PRESETS.map((a) => (
            <button
              key={a.key}
              type="button"
              aria-label={a.name}
              title={a.name}
              onClick={() => onChange({ primary_color: a.key })}
              className={cn(
                "size-8 rounded-full border-2",
                draft.primary_color.toLowerCase() === a.key.toLowerCase()
                  ? "border-ink-900"
                  : "border-transparent",
              )}
              style={{ background: a.key }}
            />
          ))}
        </div>
        <div className="flex items-center gap-space-2">
          <input
            type="color"
            aria-label="Pick a custom colour"
            value={isHex(draft.primary_color) ? draft.primary_color : "#2f6fed"}
            onChange={(e) => onChange({ primary_color: e.target.value.toUpperCase() })}
            className={cn(
              "h-9 w-10 cursor-pointer rounded border border-line bg-card",
              custom && "ring-2 ring-ink-900",
            )}
          />
          <Input
            aria-label="Brand colour"
            value={draft.primary_color}
            maxLength={7}
            invalid={!!problems.primary_color}
            onChange={(e) => onChange({ primary_color: e.target.value.trim() })}
          />
        </div>
      </Field>

      <Field
        label="Sidebar colour"
        hint="Leave on automatic for a dark shade of the brand colour."
        error={problems.sidebar_color}
      >
        <label className="mb-space-2 flex items-center justify-between gap-space-3 text-[13.5px] text-ink-900">
          Automatic
          <Switch
            checked={draft.sidebar_color === null}
            onChange={() =>
              onChange({
                sidebar_color: draft.sidebar_color === null ? "#0B1739" : null,
              })
            }
          />
        </label>
        {draft.sidebar_color !== null && (
          <div className="flex items-center gap-space-2">
            <input
              type="color"
              aria-label="Pick a sidebar colour"
              value={isHex(draft.sidebar_color) ? draft.sidebar_color : "#0b1739"}
              onChange={(e) => onChange({ sidebar_color: e.target.value.toUpperCase() })}
              className="h-9 w-10 cursor-pointer rounded border border-line bg-card"
            />
            <Input
              aria-label="Sidebar colour"
              value={draft.sidebar_color}
              maxLength={7}
              invalid={!!problems.sidebar_color}
              onChange={(e) => onChange({ sidebar_color: e.target.value.trim() })}
            />
          </div>
        )}
      </Field>

      <Field
        label="Logo"
        hint="JPEG, PNG or WebP up to 1 MB. Without one the till uses the business logo."
      >
        <div className="flex items-center gap-space-3">
          <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-white">
            {draft.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.logo_url} alt="" className="size-full object-contain" />
            ) : (
              <span className="text-[11px] text-ink-400">None</span>
            )}
          </div>
          <Button
            type="button"
            variant="secondary"
            disabled={upload.isPending}
            onClick={() => file.current?.click()}
          >
            <Upload size={14} /> {upload.isPending ? "Uploading…" : "Upload"}
          </Button>
          {draft.logo_url && (
            <button
              type="button"
              onClick={() => onChange({ logo_url: null })}
              className="text-[12.5px] text-ink-600 hover:underline"
            >
              Remove
            </button>
          )}
        </div>
        <input
          ref={file}
          type="file"
          className="hidden"
          accept="image/jpeg,image/png,image/webp"
          aria-label="Logo file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            if (f.size > MAX_LOGO_BYTES) {
              toast.error("Choose an image up to 1 MB");
              return;
            }
            upload.mutate(f, {
              onSuccess: (r) => onChange({ logo_url: r.image_url }),
              onError: (error) => toast.error("Couldn't upload the logo", error.message),
            });
          }}
        />
      </Field>

      <p className="text-[13.5px] text-ink-900">
        &quot;Powered by DAAP&quot; on the tills: {poweredBy ? "shown" : "hidden"}
      </p>
      <p className="mt-1 text-[12.5px] text-ink-600">
        Set by DAAP for your business. Contact DAAP support to change it.
      </p>
    </>
  );
}
