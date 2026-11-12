import { useCallback, useEffect, useState } from "react";
import { staffFetch } from "@/lib/staffAuth";
import { toast } from "@/lib/toast";

export type RestaurantPhoto = { id: number; image_url: string; sort_order: number };

/** Loads + manages the storefront's photo gallery (migration 0089) -- interior/food/ambience
 * shots, separate from the single logo/cover fields useStorefrontSettings.ts already covers.
 * Reuses the same upload-image endpoint those fields use (core/menu_image_storage.py); this
 * hook just records/removes the resulting urls in the ordered list. */
export function useRestaurantPhotos(ready: boolean) {
  const [photos, setPhotos] = useState<RestaurantPhoto[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const result = await staffFetch("/api/portal/settings/storefront/photos");
    if (result.ok) setPhotos((result.data as { photos: RestaurantPhoto[] }).photos);
  }, []);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function addPhoto(file: File) {
    setUploading(true);
    const body = new FormData();
    body.append("file", file);
    const uploaded = await staffFetch("/api/portal/settings/storefront/upload-image", { method: "POST", body });
    if (!uploaded.ok) {
      setUploading(false);
      toast.error("Couldn't upload photo", uploaded.unauthorized ? "Session expired — please log in again." : uploaded.error);
      return;
    }
    const { image_url } = uploaded.data as { image_url: string };
    const result = await staffFetch("/api/portal/settings/storefront/photos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url }),
    });
    setUploading(false);
    if (!result.ok) {
      toast.error("Couldn't add photo", result.unauthorized ? "Session expired — please log in again." : result.error);
      return;
    }
    const { photo } = result.data as { photo: RestaurantPhoto };
    setPhotos((prev) => [...(prev ?? []), photo]);
  }

  async function removePhoto(id: number) {
    setRemovingId(id);
    const result = await staffFetch(`/api/portal/settings/storefront/photos/${id}`, { method: "DELETE" });
    setRemovingId(null);
    if (!result.ok) {
      toast.error("Couldn't remove photo", result.unauthorized ? "Session expired — please log in again." : result.error);
      return;
    }
    setPhotos((prev) => (prev ?? []).filter((p) => p.id !== id));
  }

  return { photos, uploading, removingId, addPhoto, removePhoto };
}
