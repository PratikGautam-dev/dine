"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getPortalHospital, type PortalHospital } from "@/lib/portalAuth";

/** Redirects to /portal/login if there's no stored token, otherwise returns
 * the cached hospital summary from login -- individual pages still handle
 * their own data fetch (and their own 401 handling via portalFetch) since
 * what they fetch differs per page.
 *
 * A doctor session is allowed through like any other role -- every /portal/*
 * route is now RBAC-driven (portal/permissions.py) and the shared list/detail
 * endpoints scope themselves to the caller's own data when role=="doctor",
 * so there's no longer a reason to bounce doctors to a separate section. */
export function usePortalGuard() {
  const router = useRouter();
  const [hospital, setHospital] = useState<PortalHospital | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // The real credential is an httpOnly cookie now (unreadable to JS), so
    // this checks for the cached session summary instead of a token -- same
    // "is there a session" signal, staffFetch's own 401 handling is still
    // what actually enforces auth against the backend.
    const cached = getPortalHospital();
    if (!cached) {
      router.push("/portal/login");
      return;
    }
    setHospital(cached);
    setReady(true);
  }, [router]);

  return { hospital, ready };
}
