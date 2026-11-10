"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getPortalRestaurant, getPortalToken, type PortalRestaurant } from "@/lib/portalAuth";

/** Redirects to /portal/login if there's no stored token, otherwise returns
 * the cached restaurant summary from login -- individual pages still handle
 * their own data fetch (and their own 401 handling via portalFetch) since
 * what they fetch differs per page.
 *
 * A doctor session is allowed through like any other role -- every /portal/*
 * route is now RBAC-driven (portal/permissions.py) and the shared list/detail
 * endpoints scope themselves to the caller's own data when role=="doctor",
 * so there's no longer a reason to bounce doctors to a separate section. */
export function usePortalGuard() {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<PortalRestaurant | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getPortalToken()) {
      router.push("/portal/login");
      return;
    }
    setRestaurant(getPortalRestaurant());
    setReady(true);
  }, [router]);

  return { restaurant, ready };
}
