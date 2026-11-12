"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Globe, ImagePlus, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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
import { useStorefrontDraft, type DraftFields } from "@/hooks/useStorefrontDraft";
import { useRestaurantPhotos } from "@/hooks/useRestaurantPhotos";

/** See docs/DEPLOYMENT.md's env var table -- set NEXT_PUBLIC_STOREFRONT_URL in Vercel to override.
 * Falls back to the real deployed storefront so the live preview works even before that's set. */
const STOREFRONT_URL = process.env.NEXT_PUBLIC_STOREFRONT_URL || "https://dine-storefront.vercel.app";

/** A draft form mirrors StorefrontDraft, but with min_order_paise edited as rupees text, same
 * "paise on the wire, rupees in the input" convention useStorefrontSettings' old full form used. */
type DraftForm = {
  name: string;
  cuisine_tags: string;
  tagline: string;
  address_line: string;
  city: string;
  logo_url: string;
  cover_image_url: string;
  min_order_rupees: string;
  avg_prep_minutes: string;
};

function toDraftForm(d: {
  name: string;
  cuisine_tags: string | null;
  tagline: string | null;
  address_line: string | null;
  city: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  min_order_paise: number;
  avg_prep_minutes: number;
}): DraftForm {
  return {
    name: d.name,
    cuisine_tags: d.cuisine_tags ?? "",
    tagline: d.tagline ?? "",
    address_line: d.address_line ?? "",
    city: d.city ?? "",
    logo_url: d.logo_url ?? "",
    cover_image_url: d.cover_image_url ?? "",
    min_order_rupees: (d.min_order_paise / 100).toString(),
    avg_prep_minutes: d.avg_prep_minutes.toString(),
  };
}

function toDraftFields(f: DraftForm): DraftFields {
  return {
    name: f.name,
    cuisine_tags: f.cuisine_tags,
    tagline: f.tagline,
    address_line: f.address_line,
    city: f.city,
    logo_url: f.logo_url,
    cover_image_url: f.cover_image_url,
    min_order_paise: Math.round((Number(f.min_order_rupees) || 0) * 100),
    avg_prep_minutes: Number(f.avg_prep_minutes) || 0,
  };
}

/** The real storefront, drawn at desktop width and scaled down to fit (not clickable) -- exact
 * "scale an iframe down via ResizeObserver" technique as ShopConnect-tenant's own SitePreview
 * (src/components/portal/channels/OnlineStoreThemes.tsx), ported here since this product has one
 * storefront design, not an installable-theme catalog. */
function SitePreview({ src, title }: { src: string | null; title: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const DESKTOP = 1440;
  const scale = size.w ? size.w / DESKTOP : 0;

  return (
    <div ref={box} className="relative h-[480px] overflow-hidden rounded-md bg-paper" aria-hidden>
      {src && scale > 0 && (
        <iframe
          src={src}
          title={title}
          tabIndex={-1}
          loading="lazy"
          className="pointer-events-none absolute left-0 top-0 origin-top-left border-0 bg-white"
          style={{ width: DESKTOP, height: size.h / scale, transform: `scale(${scale})` }}
        />
      )}
    </div>
  );
}

export default function StorefrontSettingsPage() {
  const session = useStaffSession();
  const canView = usePermission("settings", "view");
  const canWrite = usePermission("settings", "write");
  const { storefront, error, saving, save, uploadingLogo, uploadingCover, uploadImage } = useStorefrontSettings(canView);
  const {
    draft, error: draftError, saving: savingDraft, publishing, discarding,
    saveDraft, publish, discardDraft, previewToken, fetchPreviewToken, hasUnpublishedChanges,
  } = useStorefrontDraft(canView);
  const { photos, uploading: uploadingPhoto, removingId, addPhoto, removePhoto } = useRestaurantPhotos(canView);

  const [form, setForm] = useState<StorefrontForm | null>(null);
  const [draftForm, setDraftForm] = useState<DraftForm | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [draftFormError, setDraftFormError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const active = form ?? (storefront ? toForm(storefront) : null);
  const activeDraft = draftForm ?? (draft ? toDraftForm(draft) : null);

  // The preview token (20-minute lifetime) only needs fetching once the panel can actually show
  // something -- there's no point asking for one before the draft itself has loaded.
  useEffect(() => {
    if (draft && !previewToken) fetchPreviewToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  async function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) await addPhoto(file);
  }

  function set(patch: Partial<StorefrontForm>) {
    setForm({ ...(active as StorefrontForm), ...patch });
  }

  function setDraftField(patch: Partial<DraftForm>) {
    setDraftForm({ ...(activeDraft as DraftForm), ...patch });
  }

  async function handleImageFile(e: React.ChangeEvent<HTMLInputElement>, kind: "logo" | "cover") {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = await uploadImage(file, kind);
    if (url) setDraftField(kind === "logo" ? { logo_url: url } : { cover_image_url: url });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    setFormError(null);
    const problem = await save(active);
    if (problem) setFormError(problem);
    else setForm(null);
  }

  async function handleDraftSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeDraft) return;
    setDraftFormError(null);
    const problem = await saveDraft(toDraftFields(activeDraft));
    if (problem) setDraftFormError(problem);
    else setDraftForm(null);
  }

  async function handlePublish() {
    if (draftForm) {
      // An unsaved edit in the form must be saved first -- Publish should never silently drop it.
      const problem = await saveDraft(toDraftFields(draftForm));
      if (problem) {
        setDraftFormError(problem);
        return;
      }
      setDraftForm(null);
    }
    await publish();
  }

  async function handleDiscard() {
    setConfirmDiscard(false);
    const ok = await discardDraft();
    if (ok) setDraftForm(null);
  }

  if (!canView) {
    return (
      <PortalShell restaurant={session?.restaurant || null} active="storefront">
        <p className="text-[13px] text-ink-400">You don&apos;t have access to Settings.</p>
      </PortalShell>
    );
  }

  const storeUrl = storefront?.public_url_path ? `${STOREFRONT_URL}${storefront.public_url_path}` : null;
  const previewSrc =
    storefront?.slug && previewToken
      ? `${STOREFRONT_URL}/${storefront.slug}?preview_token=${previewToken}&v=${encodeURIComponent(draft?.draft_updated_at ?? "")}`
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
              <Field label="Store link" htmlFor="sf-slug" hint="/<this> -- changes go live immediately">
                <Input
                  id="sf-slug"
                  value={active.storefront_slug}
                  onChange={(e) => set({ storefront_slug: e.target.value })}
                  placeholder="e.g. spice-garden"
                  disabled={!canWrite}
                />
              </Field>
              {formError && <p className="mt-space-2 text-[13px] font-medium text-error">{formError}</p>}
              <PermissionGate page="settings" action="write">
                <div className="mt-space-4 flex gap-space-2">
                  <Button type="submit" disabled={saving || !form}>
                    {saving ? "Saving…" : "Save"}
                  </Button>
                  {form && (
                    <Button type="button" variant="secondary" onClick={() => setForm(null)} disabled={saving}>
                      Discard changes
                    </Button>
                  )}
                </div>
              </PermissionGate>
            </Card>
          </form>

          <form onSubmit={handleDraftSubmit} className="lg:col-span-2">
            <Card className="p-space-5">
              <div className="mb-space-4 flex items-center justify-between">
                <h2 className="text-[15px] font-bold text-ink-900">Storefront profile</h2>
                {hasUnpublishedChanges && <Badge tone="warning">Unpublished changes</Badge>}
              </div>
              <p className="text-hint mb-space-4">
                Changes here save as a draft first -- preview them on the right, then Publish when ready. Shoppers keep
                seeing today&apos;s live version until you do.
              </p>
              <div className="grid grid-cols-1 gap-x-space-4 sm:grid-cols-2">
                <Field label="Restaurant name" htmlFor="sf-name" className="sm:col-span-2">
                  <Input
                    id="sf-name"
                    value={activeDraft.name}
                    onChange={(e) => setDraftField({ name: e.target.value })}
                    disabled={!canWrite}
                  />
                </Field>
                <Field label="City" htmlFor="sf-city">
                  <Input
                    id="sf-city"
                    value={activeDraft.city}
                    onChange={(e) => setDraftField({ city: e.target.value })}
                    disabled={!canWrite}
                  />
                </Field>
                <Field label="Cuisines" htmlFor="sf-cuisines" hint="Comma-separated">
                  <Input
                    id="sf-cuisines"
                    value={activeDraft.cuisine_tags}
                    onChange={(e) => setDraftField({ cuisine_tags: e.target.value })}
                    placeholder="North Indian, Biryani"
                    disabled={!canWrite}
                  />
                </Field>
                <Field label="Tagline" htmlFor="sf-tagline" className="sm:col-span-2">
                  <Input
                    id="sf-tagline"
                    value={activeDraft.tagline}
                    onChange={(e) => setDraftField({ tagline: e.target.value })}
                    disabled={!canWrite}
                  />
                </Field>
                <Field label="Address" htmlFor="sf-address" className="sm:col-span-2">
                  <Input
                    id="sf-address"
                    value={activeDraft.address_line}
                    onChange={(e) => setDraftField({ address_line: e.target.value })}
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
                    value={activeDraft.logo_url}
                    onChange={(e) => setDraftField({ logo_url: e.target.value })}
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
                    value={activeDraft.cover_image_url}
                    onChange={(e) => setDraftField({ cover_image_url: e.target.value })}
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
                    value={activeDraft.min_order_rupees}
                    onChange={(e) => setDraftField({ min_order_rupees: e.target.value })}
                    disabled={!canWrite}
                  />
                </Field>
                <Field label="Average prep time (min)" htmlFor="sf-prep">
                  <Input
                    id="sf-prep"
                    type="number"
                    min="0"
                    value={activeDraft.avg_prep_minutes}
                    onChange={(e) => setDraftField({ avg_prep_minutes: e.target.value })}
                    disabled={!canWrite}
                  />
                </Field>
              </div>
              {draftFormError && <p className="mt-space-2 text-[13px] font-medium text-error">{draftFormError}</p>}
              <PermissionGate page="settings" action="write">
                <div className="mt-space-4 flex flex-wrap gap-space-2">
                  <Button type="submit" disabled={savingDraft || !draftForm}>
                    {savingDraft ? "Saving…" : "Save draft"}
                  </Button>
                  {draftForm && (
                    <Button type="button" variant="secondary" onClick={() => setDraftForm(null)} disabled={savingDraft}>
                      Discard changes
                    </Button>
                  )}
                  <span className="ml-auto flex gap-space-2">
                    {hasUnpublishedChanges && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setConfirmDiscard(true)}
                        disabled={publishing || discarding}
                      >
                        Discard draft
                      </Button>
                    )}
                    <Button
                      type="button"
                      onClick={handlePublish}
                      disabled={publishing || discarding || (!hasUnpublishedChanges && !draftForm)}
                    >
                      {publishing ? "Publishing…" : "Publish"}
                    </Button>
                  </span>
                </div>
              </PermissionGate>
            </Card>
          </form>

          <Card className="p-space-5 lg:col-span-2">
            <h2 className="mb-1 text-[15px] font-bold text-ink-900">Live preview</h2>
            <p className="text-hint mb-space-4">
              Your real storefront, with the saved draft above overlaid -- shoppers keep seeing the published version
              until you Publish.
            </p>
            <SitePreview key={draft?.draft_updated_at ?? "initial"} src={previewSrc} title="Storefront preview" />
          </Card>

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
                      {activeDraft.name || draft?.name}
                    </p>
                    {activeDraft.city && <p className="text-[11.5px] text-ink-600">{activeDraft.city}</p>}
                  </div>
                  <span className="ml-auto shrink-0">
                    <Badge tone={active.web_ordering_enabled ? "success" : "neutral"}>
                      {active.web_ordering_enabled ? "Listed" : "Not listed"}
                    </Badge>
                  </span>
                </div>
                {activeDraft.tagline && <p className="mb-space-2 text-[12px] text-ink-600">{activeDraft.tagline}</p>}
                {activeDraft.cuisine_tags && (
                  <p className="mb-space-2 flex flex-wrap gap-1">
                    {activeDraft.cuisine_tags
                      .split(",")
                      .map((c) => c.trim())
                      .filter(Boolean)
                      .map((c) => (
                        <span key={c} className="rounded-full bg-paper px-space-2 py-0.5 text-[11px] font-semibold text-ink-600">
                          {c}
                        </span>
                      ))}
                  </p>
                )}
                <p className="text-[11.5px] text-ink-600">
                  Min. order {rupees(Math.round((Number(activeDraft.min_order_rupees) || 0) * 100))} · ~
                  {activeDraft.avg_prep_minutes || 0} min
                </p>
              </div>
            </Card>
            <p className="text-hint mt-space-2">
              This is what your restaurant card looks like on the marketplace once published.
            </p>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard draft changes?"
        message="This throws away every unpublished edit on this page -- your live storefront is unaffected either way."
        confirmLabel="Discard draft"
        destructive
        busy={discarding}
        onConfirm={handleDiscard}
        onCancel={() => setConfirmDiscard(false)}
      />
    </PortalShell>
  );
}
