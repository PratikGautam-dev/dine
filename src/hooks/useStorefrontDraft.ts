import { useCallback, useEffect, useState } from "react";
import { staffFetch } from "@/lib/staffAuth";
import { toast } from "@/lib/toast";

/** Just the 9 cosmetic "appearance" fields (migration 0090 backend) -- web_ordering_enabled and
 * storefront_slug stay on useStorefrontSettings' immediate/live save, and the photo gallery stays
 * on useRestaurantPhotos, both untouched by this draft/publish flow. */
export type StorefrontDraft = {
  restaurant_id: number;
  name: string;
  tagline: string | null;
  address_line: string | null;
  city: string | null;
  cuisine_tags: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  min_order_paise: number;
  avg_prep_minutes: number;
  has_unpublished_changes: boolean;
  draft_updated_at: string | null;
};

export type DraftFields = Partial<
  Pick<
    StorefrontDraft,
    | "name"
    | "tagline"
    | "address_line"
    | "city"
    | "cuisine_tags"
    | "logo_url"
    | "cover_image_url"
    | "min_order_paise"
    | "avg_prep_minutes"
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
    publish,
    discardDraft,
    previewToken,
    fetchPreviewToken,
    hasUnpublishedChanges: draft?.has_unpublished_changes ?? false,
  };
}
