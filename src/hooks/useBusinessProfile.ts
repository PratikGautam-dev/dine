import { useEffect, useState } from "react";
import {
  getStaffAccessToken,
  getStaffRefreshToken,
  getStaffSession,
  saveStaffSession,
  staffFetch,
} from "@/lib/staffAuth";

export type BusinessProfile = {
  name: string;
  display_id: string | null;
  status: string;
  created_at: string | null;
  timezone: string;
  owner_name: string | null;
  owner_email: string | null;
};

/** Read-only business facts for Settings > General's "Business details" card. */
export function useBusinessProfile(ready: boolean) {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    staffFetch("/api/portal/settings/business").then((r) => {
      if (cancelled || !r.ok) return;
      const next = r.data as BusinessProfile;
      setProfile(next);
      // The Business ID is also cached in the login session (it feeds the account menu). Keep that copy in
      // step with the database, so a renumbered ID shows everywhere without logging out and back in.
      const session = getStaffSession();
      const access = getStaffAccessToken();
      const refresh = getStaffRefreshToken();
      if (session && access && refresh && next.display_id && session.restaurant.display_id !== next.display_id) {
        saveStaffSession(access, refresh, { ...session, restaurant: { ...session.restaurant, display_id: next.display_id } });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);
  return profile;
}
