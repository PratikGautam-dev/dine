"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight, ExternalLink, Eye, EyeOff, Globe, ImagePlus, X } from "lucide-react";
import Link from "next/link";
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
import { usePermission, useStaffSession } from "@/lib/staffAuth";
import { toForm, useStorefrontSettings, type StorefrontForm } from "@/hooks/useStorefrontSettings";
import { useStorefrontDraft, sectionLabel, type DraftFields, type SectionKey } from "@/hooks/useStorefrontDraft";
import { useRestaurantPhotos } from "@/hooks/useRestaurantPhotos";

/** Where each section's chevron goes -- gallery scrolls to this same page's Photo gallery card,
 * menu/reviews link out to where that content actually lives (no on/off/reorder fields of their
 * own to show inline, unlike ShopConnect's schema-driven sections). */
const SECTION_CHEVRON_HREF: Record<SectionKey, string> = {
  gallery: "#photo-gallery",
  menu: "/portal/food-menu",
  reviews: "/portal/feedback",
};

/** See docs/DEPLOYMENT.md's env var table -- set NEXT_PUBLIC_STOREFRONT_URL in Vercel to override.
 * Falls back to the real deployed storefront so the live preview works even before that's set. */
const STOREFRONT_URL = process.env.NEXT_PUBLIC_STOREFRONT_URL || "https://dine-storefront.vercel.app";

/** A draft form mirrors StorefrontDraft -- min_order_paise/avg_prep_minutes moved to the Branches
 * settings page (migration 0096 cleanup), so this no longer carries them. */
type DraftForm = {
  name: string;
  cuisine_tags: string;
  tagline: string;
  address_line: string;
  city: string;
  logo_url: string;
  cover_image_url: string;
  announcement_text: string;
};

function toDraftForm(d: {
  name: string;
  cuisine_tags: string | null;
  tagline: string | null;
  address_line: string | null;
  city: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  announcement_text: string | null;
}): DraftForm {
  return {
    name: d.name,
    cuisine_tags: d.cuisine_tags ?? "",
    tagline: d.tagline ?? "",
    address_line: d.address_line ?? "",
    city: d.city ?? "",
    logo_url: d.logo_url ?? "",
    cover_image_url: d.cover_image_url ?? "",
    announcement_text: d.announcement_text ?? "",
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
    announcement_text: f.announcement_text,
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
    <div ref={box} className="relative h-[480px] overflow-hidden rounded-md bg-paper">
      {src && scale > 0 && (
        <iframe
          src={src}
          title={title}
          loading="lazy"
          className="absolute left-0 top-0 origin-top-left border-0 bg-white"
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
    saveDraft, saveSections, publish, discardDraft, previewToken, fetchPreviewToken, hasUnpublishedChanges,
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

  // Sections save immediately on each click (no separate "Save" step) -- same "every click here
  // is its own draft save" feel ShopConnect's own section reorder/toggle arrows have, distinct
  // from the appearance form above which batches edits behind an explicit Save draft button.
  function moveSection(index: number, direction: -1 | 1) {
    if (!draft) return;
    const target = index + direction;
    if (target < 0 || target >= draft.sections.length) return;
    const next = [...draft.sections];
    [next[index], next[target]] = [next[target], next[index]];
    void saveSections(next);
  }

  function toggleSection(key: SectionKey) {
    if (!draft || key === "menu") return;
    void saveSections(draft.sections.map((s) => (s.key === key ? { ...s, enabled: !s.enabled } : s)));
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
            <Card id="storefront-profile" className="scroll-mt-24 p-space-5">
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
                <Field
                  label="Announcement bar"
                  htmlFor="sf-announcement"
                  hint="A thin banner at the top of your page -- leave blank to hide it"
                  className="sm:col-span-2"
                >
                  <Input
                    id="sf-announcement"
                    value={activeDraft.announcement_text}
                    onChange={(e) => setDraftField({ announcement_text: e.target.value })}
                    placeholder="e.g. Festive menu now live!"
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
              </div>
              <p className="text-hint mt-space-2">
                Minimum order and average prep time are now set per-branch on the{" "}
                <a href="/portal/settings/branches" className="font-semibold text-brand-700 hover:underline">
                  Branches settings page
                </a>
                .
              </p>
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

          <div className="grid grid-cols-1 gap-space-4 lg:col-span-2 lg:grid-cols-[260px_1fr]">
            <Card className="p-space-4">
              <h2 className="mb-1 text-[15px] font-bold text-ink-900">Page sections</h2>
              <p className="text-hint mb-space-3">
                Reorder or hide sections on your restaurant&apos;s own page. The menu can&apos;t be hidden.
              </p>

              <p className="mb-space-1 text-[11px] font-bold uppercase tracking-wide text-ink-400">Top of every page</p>
              <div className="mb-space-3 space-y-space-2">
                <Link
                  href="#storefront-profile"
                  className="flex items-center justify-between rounded-md border border-line bg-paper px-space-3 py-space-2 text-[13px] font-semibold text-ink-900 hover:bg-paper/70"
                >
                  Logo &amp; name
                  <ChevronRight size={15} className="text-ink-400" />
                </Link>
                <Link
                  href="#storefront-profile"
                  className="flex items-center justify-between rounded-md border border-line bg-paper px-space-3 py-space-2 text-[13px] font-semibold text-ink-900 hover:bg-paper/70"
                >
                  Announcement bar
                  <ChevronRight size={15} className="text-ink-400" />
                </Link>
              </div>

              <p className="mb-space-1 text-[11px] font-bold uppercase tracking-wide text-ink-400">Your page</p>
              <div className="space-y-space-2">
                {(draft?.sections ?? []).map((section, i) => (
                  <div
                    key={section.key}
                    className="flex items-center gap-space-2 rounded-md border border-line bg-card px-space-3 py-space-2"
                  >
                    <div className="flex flex-col">
                      <button
                        type="button"
                        aria-label="Move up"
                        disabled={!canWrite || i === 0}
                        onClick={() => moveSection(i, -1)}
                        className="text-ink-400 hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        aria-label="Move down"
                        disabled={!canWrite || i === (draft?.sections.length ?? 0) - 1}
                        onClick={() => moveSection(i, 1)}
                        className="text-ink-400 hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <ArrowDown size={13} />
                      </button>
                    </div>
                    <span className="flex-1 text-[13px] font-semibold text-ink-900">
                      {sectionLabel(section.key)}
                    </span>
                    {section.key === "menu" ? (
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">Always on</span>
                    ) : (
                      <button
                        type="button"
                        aria-label={section.enabled ? "Hide section" : "Show section"}
                        disabled={!canWrite}
                        onClick={() => toggleSection(section.key)}
                        className="text-ink-500 hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {section.enabled ? <Eye size={15} /> : <EyeOff size={15} />}
                      </button>
                    )}
                    <Link href={SECTION_CHEVRON_HREF[section.key]} aria-label={`Manage ${sectionLabel(section.key)}`}>
                      <ChevronRight size={15} className="text-ink-400 hover:text-ink-900" />
                    </Link>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-space-5">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-[15px] font-bold text-ink-900">Live preview</h2>
                {hasUnpublishedChanges && <Badge tone="warning">Unpublished changes</Badge>}
              </div>
              <p className="text-hint mb-space-4">
                Your real storefront, with the saved draft above overlaid -- shoppers keep seeing the published version
                until you Publish.
              </p>
              <SitePreview key={draft?.draft_updated_at ?? "initial"} src={previewSrc} title="Storefront preview" />
            </Card>
          </div>

          <Card id="photo-gallery" className="scroll-mt-24 p-space-5 lg:col-span-2">
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
