"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { FormSkeleton } from "@/components/ui/Skeleton";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { usePermission } from "@/lib/staffAuth";
import { toForm, useStorefrontSettings, type StorefrontForm } from "@/hooks/useStorefrontSettings";
import { useStorefrontDraft } from "@/hooks/useStorefrontDraft";

/** A draft form mirrors StorefrontDraft -- min_order_paise/avg_prep_minutes moved to the Branches
 * settings page (migration 0096 cleanup), name/address_line/city moved to General settings
 * (migration 0097), so this no longer carries any of them. */
type DraftForm = {
  cuisine_tags: string;
  tagline: string;
  logo_url: string;
  cover_image_url: string;
  announcement_text: string;
};

function toDraftForm(d: {
  cuisine_tags: string | null;
  tagline: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  announcement_text: string | null;
}): DraftForm {
  return {
    cuisine_tags: d.cuisine_tags ?? "",
    tagline: d.tagline ?? "",
    logo_url: d.logo_url ?? "",
    cover_image_url: d.cover_image_url ?? "",
    announcement_text: d.announcement_text ?? "",
  };
}

/** The online storefront's ordering switch, store link and marketplace card. Shown at the bottom of the Website channel page (it used to live in Settings -> Online storefront). */
export function StorefrontSettings() {
  const canView = usePermission("settings", "view");
  const canWrite = usePermission("settings", "write");
  const { storefront, error, saving, save } = useStorefrontSettings(canView);
  const { draft, error: draftError } = useStorefrontDraft(canView);

  const [form, setForm] = useState<StorefrontForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const active = form ?? (storefront ? toForm(storefront) : null);
  const activeDraft = draft ? toDraftForm(draft) : null;

  function set(patch: Partial<StorefrontForm>) {
    setForm({ ...(active as StorefrontForm), ...patch });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    setFormError(null);
    const problem = await save(active);
    if (problem) setFormError(problem);
    else setForm(null);
  }

  if (!canView)
    return <p className="text-[13px] text-ink-400">You don&apos;t have access to Settings.</p>;

  return (
    <>
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}
      {draftError && <p className="mb-space-4 text-[13px] text-error">{draftError}</p>}

      {!active || !activeDraft ? (
        <FormSkeleton fields={5} />
      ) : (
        <div className="grid grid-cols-1 gap-space-4 lg:grid-cols-[1fr_320px]">
          <form onSubmit={handleSubmit}>
            <Card className="mb-space-4 flex items-center justify-between p-space-5">
              <div>
                <h2 className="text-[15px] font-bold text-ink-900">Accept orders on the website</h2>
                <p className="text-hint">
                  Off means today&apos;s behavior -- WhatsApp only, not listed on the marketplace.
                </p>
              </div>
              <Switch
                checked={active.web_ordering_enabled}
                onChange={() => set({ web_ordering_enabled: !active.web_ordering_enabled })}
                disabled={!canWrite}
                aria-label="Accept orders on the website"
              />
            </Card>

            <Card className="mb-space-4 p-space-5">
              <h2 className="mb-space-4 text-[15px] font-bold text-ink-900">Store link</h2>
              <Field
                label="Store link"
                htmlFor="sf-slug"
                hint="/<this> -- changes go live immediately"
              >
                <Input
                  id="sf-slug"
                  value={active.storefront_slug}
                  onChange={(e) => set({ storefront_slug: e.target.value })}
                  placeholder="e.g. spice-garden"
                  disabled={!canWrite}
                />
              </Field>
              {formError && (
                <p className="mt-space-2 text-[13px] font-medium text-error">{formError}</p>
              )}
              <PermissionGate page="settings" action="write">
                <div className="mt-space-4 flex gap-space-2">
                  <Button type="submit" disabled={saving || !form}>
                    {saving ? "Saving…" : "Save"}
                  </Button>
                  {form && (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setForm(null)}
                      disabled={saving}
                    >
                      Discard changes
                    </Button>
                  )}
                </div>
              </PermissionGate>
            </Card>
          </form>

          <div>
            <Card className="overflow-hidden p-0">
              <div
                className="h-28 bg-paper"
                style={
                  activeDraft.cover_image_url
                    ? {
                        backgroundImage: `url(${activeDraft.cover_image_url})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : undefined
                }
              />
              <div className="p-space-4">
                <div className="mb-space-2 flex items-center gap-space-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-brand-50 text-brand-600">
                    {activeDraft.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={activeDraft.logo_url}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.visibility = "hidden";
                        }}
                      />
                    ) : (
                      <Globe size={18} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13.5px] font-bold text-ink-900">
                      {storefront?.name}
                    </p>
                    {storefront?.city && (
                      <p className="text-[11.5px] text-ink-600">{storefront.city}</p>
                    )}
                  </div>
                  <span className="ml-auto shrink-0">
                    <Badge tone={active.web_ordering_enabled ? "success" : "neutral"}>
                      {active.web_ordering_enabled ? "Listed" : "Not listed"}
                    </Badge>
                  </span>
                </div>
                {activeDraft.tagline && (
                  <p className="mb-space-2 text-[12px] text-ink-600">{activeDraft.tagline}</p>
                )}
                {activeDraft.cuisine_tags && (
                  <p className="mb-space-2 flex flex-wrap gap-1">
                    {activeDraft.cuisine_tags
                      .split(",")
                      .map((c) => c.trim())
                      .filter(Boolean)
                      .map((c) => (
                        <span
                          key={c}
                          className="rounded-full bg-paper px-space-2 py-0.5 text-[11px] font-semibold text-ink-600"
                        >
                          {c}
                        </span>
                      ))}
                  </p>
                )}
              </div>
            </Card>
            <p className="text-hint mt-space-2">
              This is what your restaurant card looks like on the marketplace once published.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
