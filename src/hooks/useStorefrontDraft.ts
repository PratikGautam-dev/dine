import { useCallback, useEffect, useState } from "react";
import { staffFetch } from "@/lib/staffAuth";
import { toast } from "@/lib/toast";

/** A restaurant's own page's movable sections (migration 0091) -- "menu" can be reordered among
 * these three but its `enabled` is always true server-side even if sent false (the core function
 * can't be hidden); the hero isn't in this list at all since it's fixed first, always on. */
export type SectionKey = "gallery" | "menu" | "reviews";
export type HomepageSection = { key: SectionKey; enabled: boolean };

const SECTION_LABELS: Record<SectionKey, string> = {
  gallery: "Photo gallery",
  menu: "Menu",
  reviews: "Reviews",
};

export function sectionLabel(key: SectionKey): string {
  return SECTION_LABELS[key];
}

/** Just the 7 cosmetic "appearance" fields (migration 0090 backend) -- web_ordering_enabled and
 * storefront_slug stay on useStorefrontSettings' immediate/live save, and the photo gallery stays
 * on useRestaurantPhotos, both untouched by this draft/publish flow. min_order_paise/
 * avg_prep_minutes moved to the Branches settings page (migration 0096 cleanup) -- edited
 * per-branch there now, not as a restaurant-wide field here. */
export type StorefrontDraft = {
  restaurant_id: number;
  name: string;
  tagline: string | null;
  address_line: string | null;
  city: string | null;
  cuisine_tags: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  sections: HomepageSection[];
  has_unpublished_changes: boolean;
  draft_updated_at: string | null;
};

export type DraftFields = Partial<
  Pick<
    StorefrontDraft,
    "name" | "tagline" | "address_line" | "city" | "cuisine_tags" | "logo_url" | "cover_image_url"
  >
>;

/** Loads/saves the storefront's draft/publish appearance fields, plus a one-time preview token
 * for the live preview iframe (src/components/portal/... storefront settings page) -- modeled on
 * ShopConnect-tenant's ThemeEditor draft/publish/preview mechanics, pared down to this product's
 * single-design storefront (no theme catalog). */
export function useStorefrontDraft(ready: boolean) {
  const [draft, setDraft] = useState<StorefrontDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [previewToken, setPreviewToken] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await staffFetch("/api/portal/settings/storefront/draft");
    if (!result.ok) {
      if (!result.unauthorized) setError(result.error);
      return;
    }
    setError(null);
    setDraft(result.data as StorefrontDraft);
  }, []);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function saveDraft(fields: DraftFields): Promise<string | null> {
    setSaving(true);
    const result = await staffFetch("/api/portal/settings/storefront/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    setSaving(false);
    if (!result.ok) {
      return result.unauthorized ? "Session expired -- please sign in again." : result.error;
    }
    setDraft(result.data as StorefrontDraft);
    toast.success("Draft saved");
    return null;
  }

  /** Reorder/show-hide for the movable sections -- a whole-list replace (not a field-by-field
   * merge the way saveDraft's appearance fields work), since order only makes sense as one unit.
   * Optimistic: updates local state immediately so the sidebar reorder feels instant, then saves;
   * on failure, reloads from the server to correct any drift. */
  async function saveSections(sections: HomepageSection[]): Promise<void> {
    setDraft((prev) => (prev ? { ...prev, sections, has_unpublished_changes: true } : prev));
    const result = await staffFetch("/api/portal/settings/storefront/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sections }),
    });
    if (!result.ok) {
      toast.error("Couldn't save section order", result.unauthorized ? "Session expired -- please sign in again." : result.error);
      await load();
      return;
    }
    setDraft(result.data as StorefrontDraft);
  }

  async function publish(): Promise<boolean> {
    setPublishing(true);
    const result = await staffFetch("/api/portal/settings/storefront/publish", { method: "POST" });
    setPublishing(false);
    if (!result.ok) {
      toast.error("Couldn't publish", result.unauthorized ? "Session expired -- please sign in again." : result.error);
      return false;
    }
    toast.success("Published", "Your storefront is now live with these changes.");
    await load();
    return true;
  }

  async function discardDraft(): Promise<boolean> {
    setDiscarding(true);
    const result = await staffFetch("/api/portal/settings/storefront/discard-draft", { method: "POST" });
    setDiscarding(false);
    if (!result.ok) {
      toast.error("Couldn't discard draft", result.unauthorized ? "Session expired -- please sign in again." : result.error);
      return false;
    }
    setDraft(result.data as StorefrontDraft);
    toast.success("Draft discarded");
    return true;
  }

  /** Fetched once, lazily -- a simple "get it when the preview panel is first shown" is fine
   * given the token's 20-minute lifetime; refreshed only if a preview load fails/expires. */
  const fetchPreviewToken = useCallback(async () => {
    const result = await staffFetch("/api/portal/settings/storefront/preview-token", { method: "POST" });
    if (result.ok) {
      setPreviewToken((result.data as { token: string }).token);
    }
  }, []);

  return {
    draft,
    error,
    saving,
    publishing,
    discarding,
    saveDraft,
    saveSections,
    publish,
    discardDraft,
    previewToken,
    fetchPreviewToken,
    hasUnpublishedChanges: draft?.has_unpublished_changes ?? false,
  };
}
