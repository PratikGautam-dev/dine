"use client";

import { useState } from "react";
import { ExternalLink, Globe, ImagePlus, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Switch } from "@/components/ui/Switch";
import { FormSkeleton } from "@/components/ui/Skeleton";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { PortalShell } from "@/components/portal/PortalShell";
import { rupees } from "@/lib/foodOrders";
import { usePermission, useStaffSession } from "@/lib/staffAuth";
import { toForm, useStorefrontSettings, type StorefrontForm } from "@/hooks/useStorefrontSettings";
import { useRestaurantPhotos } from "@/hooks/useRestaurantPhotos";

export default function StorefrontSettingsPage() {
  const session = useStaffSession();
  const canView = usePermission("settings", "view");
  const canWrite = usePermission("settings", "write");
  const { storefront, error, saving, save, uploadingLogo, uploadingCover, uploadImage } = useStorefrontSettings(canView);
  const { photos, uploading: uploadingPhoto, removingId, addPhoto, removePhoto } = useRestaurantPhotos(canView);
  const [form, setForm] = useState<StorefrontForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const active = form ?? (storefront ? toForm(storefront) : null);

  async function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) await addPhoto(file);
  }

  function set(patch: Partial<StorefrontForm>) {
    setForm({ ...(active as StorefrontForm), ...patch });
  }

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>, kind: "logo" | "cover") {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = await uploadImage(file, kind);
    if (url) set(kind === "logo" ? { logo_url: url } : { cover_image_url: url });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    setFormError(null);
    const problem = await save(active);
    if (problem) setFormError(problem);
    else setForm(null);
  }

  if (!canView) {
    return (
      <PortalShell restaurant={session?.restaurant || null} active="storefront">
        <p className="text-[13px] text-ink-400">You don&apos;t have access to Settings.</p>
      </PortalShell>
    );
  }

  const storeUrl = storefront?.public_url_path
    ? `${typeof window !== "undefined" ? window.location.origin : ""}${storefront.public_url_path}`
    : null;

  return (
    <PortalShell restaurant={session?.restaurant || null} active="storefront">
      <PageHeader
        title="Online Storefront"
        icon={<Globe size={22} />}
        description="A public ordering website, alongside the WhatsApp bot -- same menu, same orders."
        actions={
          storeUrl && (
            <Button variant="secondary" href={storeUrl} target="_blank" rel="noopener noreferrer">
              View my store <ExternalLink size={14} />
            </Button>
          )
        }
      />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

      {!active ? (
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

            <Card className="p-space-5">
              <h2 className="mb-space-4 text-[15px] font-bold text-ink-900">Storefront profile</h2>
              <div className="grid grid-cols-1 gap-x-space-4 sm:grid-cols-2">
                <Field label="Restaurant name" htmlFor="sf-name" className="sm:col-span-2">
                  <Input
                    id="sf-name"
                    value={active.name}
                    onChange={(e) => set({ name: e.target.value })}
                    disabled={!canWrite}
                  />
                </Field>
                <Field label="Store link" htmlFor="sf-slug" hint="/<this>">
                  <Input
                    id="sf-slug"
                    value={active.storefront_slug}
                    onChange={(e) => set({ storefront_slug: e.target.value })}
                    placeholder="e.g. spice-garden"
                    disabled={!canWrite}
                  />
                </Field>
                <Field label="City" htmlFor="sf-city">
                  <Input
                    id="sf-city"
                    value={active.city}
                    onChange={(e) => set({ city: e.target.value })}
                    disabled={!canWrite}
                  />
                </Field>
                <Field
                  label="Cuisines"
                  htmlFor="sf-cuisines"
                  hint="Comma-separated"
                  className="sm:col-span-2"
                >
                  <Input
                    id="sf-cuisines"
                    value={active.cuisine_tags}
                    onChange={(e) => set({ cuisine_tags: e.target.value })}
                    placeholder="North Indian, Biryani"
                    disabled={!canWrite}
                  />
                </Field>
                <Field label="Tagline" htmlFor="sf-tagline" className="sm:col-span-2">
                  <Input
                    id="sf-tagline"
                    value={active.tagline}
                    onChange={(e) => set({ tagline: e.target.value })}
                    disabled={!canWrite}
                  />
                </Field>
                <Field label="Address" htmlFor="sf-address" className="sm:col-span-2">
                  <Input
                    id="sf-address"
                    value={active.address_line}
                    onChange={(e) => set({ address_line: e.target.value })}
                    disabled={!canWrite}
                  />
                </Field>
                <Field label="Logo" htmlFor="sf-logo-upload">
                  <div className="flex items-center gap-space-2">
                    <input
                      id="sf-logo-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={!canWrite || uploadingLogo}
                      onChange={(e) => handleImageFile(e, "logo")}
                      className="text-[13px] text-ink-700 file:mr-space-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-space-3 file:py-space-2 file:text-[12.5px] file:font-semibold file:text-brand-700 hover:file:bg-brand-100"
                    />
                    {uploadingLogo && <span className="text-[12.5px] text-ink-500">Uploading…</span>}
                  </div>
                  <Input
                    id="sf-logo"
                    type="url"
                    value={active.logo_url}
                    onChange={(e) => set({ logo_url: e.target.value })}
                    placeholder="https://… (or upload a file above)"
                    disabled={!canWrite}
                    className="mt-space-2"
                  />
                </Field>
                <Field label="Cover image" htmlFor="sf-cover-upload">
                  <div className="flex items-center gap-space-2">
                    <input
                      id="sf-cover-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={!canWrite || uploadingCover}
                      onChange={(e) => handleImageFile(e, "cover")}
                      className="text-[13px] text-ink-700 file:mr-space-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-space-3 file:py-space-2 file:text-[12.5px] file:font-semibold file:text-brand-700 hover:file:bg-brand-100"
                    />
                    {uploadingCover && <span className="text-[12.5px] text-ink-500">Uploading…</span>}
                  </div>
                  <Input
                    id="sf-cover"
                    type="url"
                    value={active.cover_image_url}
                    onChange={(e) => set({ cover_image_url: e.target.value })}
                    placeholder="https://… (or upload a file above)"
                    disabled={!canWrite}
                    className="mt-space-2"
                  />
                </Field>
                <Field label="Minimum order (₹)" htmlFor="sf-min">
                  <Input
                    id="sf-min"
                    type="number"
                    min="0"
                    value={active.min_order_rupees}
                    onChange={(e) => set({ min_order_rupees: e.target.value })}
                    disabled={!canWrite}
                  />
                </Field>
                <Field label="Average prep time (min)" htmlFor="sf-prep">
                  <Input
                    id="sf-prep"
                    type="number"
                    min="0"
                    value={active.avg_prep_minutes}
                    onChange={(e) => set({ avg_prep_minutes: e.target.value })}
                    disabled={!canWrite}
                  />
                </Field>
              </div>
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

          <Card className="p-space-5 lg:col-span-2">
            <h2 className="mb-1 text-[15px] font-bold text-ink-900">Photo gallery</h2>
            <p className="text-hint mb-space-4">
              Interior, food and ambience shots shown on your restaurant&apos;s page, alongside the logo and cover photo above.
            </p>
            <div className="flex flex-wrap gap-space-3">
              {(photos ?? []).map((photo) => (
                <div key={photo.id} className="group relative h-24 w-32 overflow-hidden rounded-md border border-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photo.image_url} alt="" className="h-full w-full object-cover" />
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.id)}
                      disabled={removingId === photo.id}
                      aria-label="Remove photo"
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-100"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              {canWrite && (
                <label className="flex h-24 w-32 cursor-pointer flex-col items-center justify-center gap-space-1 rounded-md border border-dashed border-line text-ink-500 hover:border-brand-300 hover:text-brand-600">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploadingPhoto}
                    onChange={handlePhotoFile}
                  />
                  <ImagePlus size={20} />
                  <span className="text-[12px] font-semibold">{uploadingPhoto ? "Uploading…" : "Add photo"}</span>
                </label>
              )}
            </div>
          </Card>

          <div>
            <Card className="overflow-hidden p-0">
              <div
                className="h-28 bg-paper"
                style={
                  active.cover_image_url
                    ? {
                        backgroundImage: `url(${active.cover_image_url})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : undefined
                }
              />
              <div className="p-space-4">
                <div className="mb-space-2 flex items-center gap-space-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-brand-50 text-brand-600">
                    {active.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={active.logo_url}
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
                      {active.name || storefront?.name}
                    </p>
                    {active.city && <p className="text-[11.5px] text-ink-600">{active.city}</p>}
                  </div>
                  <span className="ml-auto shrink-0">
                    <Badge tone={active.web_ordering_enabled ? "success" : "neutral"}>
                      {active.web_ordering_enabled ? "Listed" : "Not listed"}
                    </Badge>
                  </span>
                </div>
                {active.tagline && (
                  <p className="mb-space-2 text-[12px] text-ink-600">{active.tagline}</p>
                )}
                {active.cuisine_tags && (
                  <p className="mb-space-2 flex flex-wrap gap-1">
                    {active.cuisine_tags
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
                <p className="text-[11.5px] text-ink-600">
                  Min. order {rupees(Math.round((Number(active.min_order_rupees) || 0) * 100))} · ~
                  {active.avg_prep_minutes || 0} min
                </p>
              </div>
            </Card>
            <p className="text-hint mt-space-2">
              This is what your restaurant card looks like on the marketplace.
            </p>
          </div>
        </div>
      )}
    </PortalShell>
  );
}
