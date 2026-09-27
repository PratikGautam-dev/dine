import { useCallback, useEffect, useState } from "react";
import { staffFetch } from "@/lib/staffAuth";
import { toast } from "@/lib/toast";

export type Storefront = {
  hospital_id: number;
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

export type StorefrontForm = {
  web_ordering_enabled: boolean;
  storefront_slug: string;
  cuisine_tags: string;
  tagline: string;
  address_line: string;
  city: string;
  logo_url: string;
  cover_image_url: string;
  min_order_rupees: string;
  avg_prep_minutes: string;
};

export function toForm(s: Storefront): StorefrontForm {
  return {
    web_ordering_enabled: s.web_ordering_enabled,
    storefront_slug: s.slug ?? "",
    cuisine_tags: s.cuisines.join(", "),
    tagline: s.tagline ?? "",
    address_line: s.address_line ?? "",
    city: s.city ?? "",
    logo_url: s.logo_url ?? "",
    cover_image_url: s.cover_image_url ?? "",
    min_order_rupees: (s.min_order_paise / 100).toString(),
    avg_prep_minutes: s.avg_prep_minutes.toString(),
  };
}

/** Loads + saves /portal/settings/storefront -- Web Storefront's toggle and marketplace profile. */
export function useStorefrontSettings(ready: boolean) {
  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
        cuisine_tags: form.cuisine_tags,
        tagline: form.tagline,
        address_line: form.address_line,
        city: form.city,
        logo_url: form.logo_url,
        cover_image_url: form.cover_image_url,
        min_order_paise: Math.round((Number(form.min_order_rupees) || 0) * 100),
        avg_prep_minutes: Number(form.avg_prep_minutes) || 0,
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

  return { storefront, error, saving, save };
}
