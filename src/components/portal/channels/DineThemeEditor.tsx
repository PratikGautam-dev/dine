"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronRight, Eye, EyeOff, ImagePlus, Images, Image as ImageIcon, Megaphone, Star, Type, UtensilsCrossed, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { FormSkeleton } from "@/components/ui/Skeleton";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { usePermission } from "@/lib/staffAuth";
import { useStorefrontSettings } from "@/hooks/useStorefrontSettings";
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

/** The customer-facing storefront's address, for the live preview and "View my store". NEXT_PUBLIC_STOREFRONT_URL wins (docs/DEPLOYMENT.md); otherwise
 * a portal opened on localhost uses the local storefront (http://localhost:3001, which talks to the same local backend and database), and anything else
 * uses the deployed one. Without the localhost rule a local portal previewed the deployed storefront, which reads the production database and says
 * "Restaurant not found" for a restaurant that only exists locally. A function, not a constant, because it reads `window`. */
export function storefrontUrl(): string {
  if (process.env.NEXT_PUBLIC_STOREFRONT_URL) return process.env.NEXT_PUBLIC_STOREFRONT_URL.replace(/\/$/, "");
  if (typeof window !== "undefined" && ["localhost", "127.0.0.1"].includes(window.location.hostname)) return "http://localhost:3001";
  return "https://dine-storefront.vercel.app";
}

const SECTION_ICON: Record<SectionKey, LucideIcon> = { gallery: Images, menu: UtensilsCrossed, reviews: Star };

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

function toDraftFields(f: DraftForm): DraftFields {
  return {
    cuisine_tags: f.cuisine_tags,
    tagline: f.tagline,
    logo_url: f.logo_url,
    cover_image_url: f.cover_image_url,
    announcement_text: f.announcement_text,
  };
}

/** The real storefront, drawn at desktop width and scaled down to fit (not clickable) -- exact
 * "scale an iframe down via ResizeObserver" technique as ShopConnect-tenant's own SitePreview
 * (src/components/portal/channels/OnlineStoreThemes.tsx), ported here since this product has one
 * storefront design, not an installable-theme catalog. */
export function SitePreview({ src, title }: { src: string | null; title: string }) {
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

export function DineThemeEditor() {
  const canView = usePermission("settings", "view");
  const canWrite = usePermission("settings", "write");
  const { storefront, error, uploadingLogo, uploadingCover, uploadImage } = useStorefrontSettings(canView);
  const {
    draft, error: draftError, saving: savingDraft, publishing, discarding,
    saveDraft, saveSections, publish, discardDraft, previewToken, fetchPreviewToken, hasUnpublishedChanges,
  } = useStorefrontDraft(canView);
  const { photos, uploading: uploadingPhoto, removingId, addPhoto, removePhoto } = useRestaurantPhotos(canView);

  const [draftForm, setDraftForm] = useState<DraftForm | null>(null);
  const [draftFormError, setDraftFormError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

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

  if (!canView) return <p className="text-[13px] text-ink-400">You don&apos;t have access to Settings.</p>;

  const previewSrc =
    storefront?.slug && previewToken
      ? `${storefrontUrl()}/${storefront.slug}?preview_token=${previewToken}&v=${encodeURIComponent(draft?.draft_updated_at ?? "")}`
      : null;


  return (
    <>
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}
      {draftError && <p className="mb-space-4 text-[13px] text-error">{draftError}</p>}
      {!activeDraft ? (
        <FormSkeleton fields={5} />
      ) : (
        <div className="grid grid-cols-1 gap-space-4 lg:grid-cols-2">
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
                <Field label="Cuisines" htmlFor="sf-cuisines" hint="Comma-separated" className="sm:col-span-2">
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
                Minimum order and average prep time are set per-branch on the{" "}
                <a href="/portal/settings/branches" className="font-semibold text-brand-700 hover:underline">
                  Branches settings page
                </a>
                . Restaurant name and address are set on the{" "}
                <a href="/portal/settings" className="font-semibold text-brand-700 hover:underline">
                  General settings page
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

          <div className="grid grid-cols-1 gap-space-4 lg:col-span-2 lg:grid-cols-[380px_minmax(0,1fr)]">
            <Card className="p-space-5 lg:self-start">
              <h2 className="text-[16px] font-bold text-ink-900">Page sections</h2>
              <p className="mb-space-4 mt-1 text-[13px] leading-relaxed text-ink-600">
                Reorder or hide sections on your restaurant&apos;s page. The menu can&apos;t be hidden.
              </p>

              <p className="mb-space-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-400">Top of every page</p>
              <ul className="mb-space-5 divide-y divide-line overflow-hidden rounded-lg border border-line bg-card">
                {[
                  { label: "Name", hint: "Set in General settings", href: "/portal/settings", icon: Type },
                  { label: "Logo", hint: "Upload in the profile above", href: "#storefront-profile", icon: ImageIcon },
                  { label: "Announcement bar", hint: "A thin banner above the page", href: "#storefront-profile", icon: Megaphone },
                ].map(({ label, hint, href, icon: Icon }) => (
                  <li key={label}>
                    <Link href={href} className="group flex items-center gap-space-3 px-space-3 py-space-3 transition-colors hover:bg-paper">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                        <Icon size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold text-ink-900">{label}</span>
                        <span className="block truncate text-[12px] text-ink-500">{hint}</span>
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-ink-400 transition-transform group-hover:translate-x-0.5 group-hover:text-ink-900" />
                    </Link>
                  </li>
                ))}
              </ul>

              <p className="mb-space-2 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-400">Your page, top to bottom</p>
              <ul className="space-y-space-2">
                {(draft?.sections ?? []).map((section, i) => {
                  const Icon = SECTION_ICON[section.key];
                  const count = draft?.sections.length ?? 0;
                  const hidden = section.key !== "menu" && !section.enabled;
                  return (
                    <li
                      key={section.key}
                      className={`flex items-center gap-space-3 rounded-lg border border-line bg-card px-space-3 py-space-3 transition-opacity ${hidden ? "opacity-60" : ""}`}
                    >
                      <span className="flex shrink-0 flex-col overflow-hidden rounded-md border border-line">
                        <button
                          type="button"
                          aria-label={`Move ${sectionLabel(section.key)} up`}
                          disabled={!canWrite || i === 0}
                          onClick={() => moveSection(i, -1)}
                          className="flex h-5 w-7 items-center justify-center text-ink-500 hover:bg-paper hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${sectionLabel(section.key)} down`}
                          disabled={!canWrite || i === count - 1}
                          onClick={() => moveSection(i, 1)}
                          className="flex h-5 w-7 items-center justify-center border-t border-line text-ink-500 hover:bg-paper hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ArrowDown size={13} />
                        </button>
                      </span>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-paper text-ink-600">
                        <Icon size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold text-ink-900">{sectionLabel(section.key)}</span>
                        <span className="block text-[12px] text-ink-500">{hidden ? "Hidden" : section.key === "menu" ? "Required" : "Visible"}</span>
                      </span>
                      {section.key === "menu" ? (
                        <span className="shrink-0 rounded-full bg-paper px-space-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-ink-500">Always on</span>
                      ) : (
                        <button
                          type="button"
                          aria-label={section.enabled ? `Hide ${sectionLabel(section.key)}` : `Show ${sectionLabel(section.key)}`}
                          title={section.enabled ? "Hide section" : "Show section"}
                          disabled={!canWrite}
                          onClick={() => toggleSection(section.key)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line text-ink-600 hover:bg-paper hover:text-ink-900 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {section.enabled ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                      )}
                      <Link
                        href={SECTION_CHEVRON_HREF[section.key]}
                        aria-label={`Manage ${sectionLabel(section.key)}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-400 hover:bg-paper hover:text-ink-900"
                      >
                        <ChevronRight size={16} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
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
    </>
  );
}
