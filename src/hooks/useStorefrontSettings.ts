import { useCallback, useEffect, useState } from "react";
import { staffFetch } from "@/lib/staffAuth";
import { toast } from "@/lib/toast";

export type Storefront = {
  restaurant_id: number;
  name: string;
  web_ordering_enabled: boolean;
  slug: string | null;
  cuisines: string[];
  tagline: string | null;
  address_line: string | null;
  city: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  min_order_paise: number;
  avg_prep_minutes: number;
  public_url_path: string | null;
};

/** Just the two fields that stay immediate/live -- draft/publish (migration 0090) moved the other
 * 9 cosmetic fields (name/cuisines/tagline/address/city/logo/cover/min order/prep time) onto
 * useStorefrontDraft.ts instead. Toggling visibility and changing the URL are operational actions,
 * not cosmetic previews, so they still save straight through this route unchanged. */
export type StorefrontForm = {
  web_ordering_enabled: boolean;
  storefront_slug: string;
};

export function toForm(s: Storefront): StorefrontForm {
  return {
    web_ordering_enabled: s.web_ordering_enabled,
    storefront_slug: s.slug ?? "",
  };
}

/** Loads + saves /portal/settings/storefront -- Web Storefront's toggle and store link only now
 * (see StorefrontForm's own comment); the GET response still carries every other field too, read
 * elsewhere on the page as the live (published) values. */
export function useStorefrontSettings(ready: boolean) {
  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const load = useCallback(async () => {
    const result = await staffFetch("/api/portal/settings/storefront");
    if (!result.ok) {
      if (!result.unauthorized) setError(result.error);
      return;
    }
    setError(null);
    setStorefront(result.data as Storefront);
  }, []);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function save(form: StorefrontForm): Promise<string | null> {
    setSaving(true);
    const result = await staffFetch("/api/portal/settings/storefront", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        web_ordering_enabled: form.web_ordering_enabled,
        storefront_slug: form.storefront_slug,
      }),
    });
    setSaving(false);
    if (!result.ok) {
      return result.unauthorized ? "Session expired -- please sign in again." : result.error;
    }
    toast.success("Online Storefront saved");
    setStorefront(result.data as Storefront);
    return null;
  }

  /** Uploads a logo/cover photo file to the same public image bucket menu-item photos already
   * use (core/menu_image_storage.py) and returns its url -- a separate step from Save, same
   * "upload now, reference the url when the form itself is saved" shape the Food Menu panel's
   * own upload already established (src/hooks/useMenuItems.ts's handleImageUpload). */
  async function uploadImage(file: File, kind: "logo" | "cover"): Promise<string | null> {
    const setUploading = kind === "logo" ? setUploadingLogo : setUploadingCover;
    setUploading(true);
    const body = new FormData();
    body.append("file", file);
    const result = await staffFetch("/api/portal/settings/storefront/upload-image", { method: "POST", body });
    setUploading(false);
    if (!result.ok) {
      toast.error(
        "Couldn't upload photo",
        result.unauthorized ? "Session expired — please log in again." : result.error,
      );
      return null;
    }
    return (result.data as { image_url: string }).image_url;
  }

  return { storefront, error, saving, save, uploadingLogo, uploadingCover, uploadImage };
}
