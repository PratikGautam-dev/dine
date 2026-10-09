"use client";

import { useCallback, useEffect, useState } from "react";
import { publicFetch } from "@/lib/customerAuth";
import { toast } from "@/lib/toast";

export type SavedAddress = { id: number; address: string; created_at: string };

export type RealProfile = {
  phone: string;
  name: string | null;
  email: string | null;
  date_of_birth: string | null;
  addresses: SavedAddress[];
  loyalty_tier: string | null;
  loyalty_points: number;
  created_at: string | null;
};

/** The Account page's real profile + saved-address data (GET/PUT /api/public/profile,
 * POST/DELETE /api/public/profile/addresses) -- replaces what used to be entirely static mock
 * data from src/lib/account.ts for name/email/DOB/address/loyalty. `slug` scopes which
 * restaurant's own patient record this resolves to (the backend falls back to the most recently
 * ordered-from restaurant when omitted); pass the active cart's restaurant when known. */
export function useAccountProfile(ready: boolean, slug?: string | null) {
  const [profile, setProfile] = useState<RealProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingAddress, setAddingAddress] = useState(false);
  const [deletingAddressId, setDeletingAddressId] = useState<number | null>(null);

  const query = slug ? `?slug=${encodeURIComponent(slug)}` : "";

  const load = useCallback(async () => {
    setLoading(true);
    const result = await publicFetch<{ profile: RealProfile }>(`/api/public/profile${query}`);
    setLoading(false);
    if (!result.ok) return;
    setProfile(result.data.profile);
  }, [query]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function saveProfile(fields: { name?: string; date_of_birth?: string; email?: string }): Promise<boolean> {
    setSaving(true);
    const result = await publicFetch<{ profile: RealProfile }>(`/api/public/profile${query}`, {
      method: "PUT",
      body: JSON.stringify(fields),
    });
    setSaving(false);
    if (!result.ok) {
      toast.error("Couldn't save your profile", result.error);
      return false;
    }
    setProfile(result.data.profile);
    toast.success("Profile saved");
    return true;
  }

  async function addAddress(address: string): Promise<boolean> {
    setAddingAddress(true);
    const result = await publicFetch<{ address: SavedAddress }>("/api/public/profile/addresses", {
      method: "POST",
      body: JSON.stringify({ slug: slug || "", address }),
    });
    setAddingAddress(false);
    if (!result.ok) {
      toast.error("Couldn't save address", result.error);
      return false;
    }
    toast.success("Address saved");
    load();
    return true;
  }

  async function deleteAddress(id: number) {
    setDeletingAddressId(id);
    const result = await publicFetch(`/api/public/profile/addresses/${id}/delete${query}`, { method: "POST" });
    setDeletingAddressId(null);
    if (!result.ok) {
      toast.error("Couldn't remove address", result.error);
      return;
    }
    setProfile((p) => (p ? { ...p, addresses: p.addresses.filter((a) => a.id !== id) } : p));
  }

  return { profile, loading, saving, saveProfile, addingAddress, addAddress, deletingAddressId, deleteAddress };
}
