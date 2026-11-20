"use client";

import { useCallback, useEffect, useState } from "react";
import { staffFetch } from "@/lib/staffAuth";
import { toast } from "@/lib/toast";
import { applyBranding, cacheBranding, readCachedBranding, type Branding } from "@/lib/theme";

const EVENT = "portal-branding-changed";

/** Loads the portal's branding for the signed-in staff member, applies it to the page and keeps it cached so
 * the next page load paints in the right colours straight away. Mounted once by PortalShell. */
export function useApplyBranding() {
  const [branding, setBranding] = useState<Branding | null>(null);
  useEffect(() => {
    const cached = readCachedBranding();
    if (cached) {
      applyBranding(cached);
      // Read after mount (localStorage is client-only) so server and first client render match.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBranding(cached);
    }
    let cancelled = false;
    staffFetch("/api/portal/branding").then((r) => {
      if (cancelled || !r.ok) return;
      const next = r.data as Branding;
      applyBranding(next);
      cacheBranding(next);
      setBranding(next);
    });
    const onChange = (e: Event) => setBranding((e as CustomEvent<Branding>).detail);
    window.addEventListener(EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(EVENT, onChange);
    };
  }, []);
  return branding;
}

/** Settings > Theme and colours: the saved branding, a live preview while editing, and save/upload. */
export function useThemeSettings(ready: boolean) {
  const [saved, setSaved] = useState<Branding | null>(null);
  const [rawBranding, setRawBranding] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    staffFetch("/api/portal/settings/tenant").then((r) => {
      if (cancelled || !r.ok) return;
      const b = ((r.data as { branding?: Record<string, unknown> }).branding ?? {}) as Record<string, unknown>;
      setRawBranding(b);
      setSaved({
        primary_color: (b.primary_color as string) || null,
        sidebar_color: (b.sidebar_color as string) || null,
        logo_url: (b.logo_url as string) || null,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  /** Shows a draft on the page without saving it (null = back to the saved look). */
  const preview = useCallback((b: Branding | null) => applyBranding(b ?? saved), [saved]);

  async function save(next: Branding): Promise<string | null> {
    setSaving(true);
    const merged: Record<string, unknown> = { ...rawBranding, ...next };
    for (const k of Object.keys(merged)) if (merged[k] === null || merged[k] === "") delete merged[k];
    const result = await staffFetch("/api/portal/settings/tenant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branding: merged }),
    });
    setSaving(false);
    if (!result.ok) return result.unauthorized ? "Session expired -- please sign in again." : result.error;
    const b = ((result.data as { branding?: Record<string, unknown> }).branding ?? {}) as Record<string, unknown>;
    setRawBranding(b);
    const normalized: Branding = {
      primary_color: (b.primary_color as string) || null,
      sidebar_color: (b.sidebar_color as string) || null,
      logo_url: (b.logo_url as string) || null,
    };
    setSaved(normalized);
    applyBranding(normalized);
    cacheBranding(normalized);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: normalized }));
    toast.success("Theme saved");
    return null;
  }

  async function uploadLogo(file: File): Promise<string | null> {
    setUploading(true);
    const body = new FormData();
    body.append("file", file);
    const result = await staffFetch("/api/portal/settings/storefront/upload-image", { method: "POST", body });
    setUploading(false);
    if (!result.ok) {
      toast.error("Couldn't upload logo", result.unauthorized ? "Session expired — please log in again." : result.error);
      return null;
    }
    return (result.data as { image_url: string }).image_url;
  }

  return { saved, saving, uploading, preview, save, uploadLogo };
}
