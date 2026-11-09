import { useMemo, useSyncExternalStore } from "react";
import axios, { isAxiosError } from "axios";
import { requestInitToAxiosConfig } from "@/lib/apiClient";

// Deliberately NOT staffAuth.ts's keys/shape -- a super admin is a separate identity
// (admin/super_auth.py), not a restaurant-scoped staff account, per the user's explicit ask
// (plan section 0.4/6). No refresh-token key: super_auth.py's own docstring says there's no
// refresh-token dance here -- log in again after the 15-minute access-token TTL.
const ACCESS_KEY = "super_admin_access_token";
const SESSION_KEY = "super_admin_session";

// Same cross-component-reactivity fix staffAuth.ts/customerAuth.ts already use -- lets an
// already-mounted component (the admin shell) react to a login/logout that happens elsewhere,
// not just on its own next mount.
const listeners = new Set<() => void>();
function emitSessionChange() {
  listeners.forEach((l) => l());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export type SuperAdminSession = {
  id: number;
  name: string;
  email: string;
};

export function saveSuperAdminSession(accessToken: string, session: SuperAdminSession) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  emitSessionChange();
}

export function getSuperAdminAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getSuperAdminSession(): SuperAdminSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearSuperAdminSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(SESSION_KEY);
  emitSessionChange();
}

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type FetchResult =
  | { ok: true; data: unknown }
  | { ok: false; unauthorized: true }
  | { ok: false; unauthorized: false; error: string };

/** axios wrapper for super-admin-authenticated requests. Unlike staffFetch, there is no refresh
 * token to fall back to -- a 401 here just clears the session and reports unauthorized; callers
 * redirect to /admin/login. */
export async function superAdminFetch(path: string, init?: RequestInit): Promise<FetchResult> {
  const token = getSuperAdminAccessToken();
  if (!token) return { ok: false, unauthorized: true };

  const config = requestInitToAxiosConfig(init);
  try {
    const res = await axios.request({
      ...config,
      url: `${API_BASE_URL}${path}`,
      headers: { ...config.headers, Authorization: `Bearer ${token}` },
    });
    return { ok: true, data: res.data };
  } catch (err) {
    if (!isAxiosError(err) || !err.response) {
      return { ok: false, unauthorized: false, error: "Network error — check your connection." };
    }
    if (err.response.status === 401) {
      clearSuperAdminSession();
      return { ok: false, unauthorized: true };
    }
    return { ok: false, unauthorized: false, error: err.response.data?.error || "Something went wrong." };
  }
}

const SERVER_SNAPSHOT = "__server__";

/** SSR-hydration-safe AND reactive read of the cached super-admin session -- same
 * useSyncExternalStore pattern staffAuth.ts's useStaffSession() uses. */
export function useSuperAdminSession(): SuperAdminSession | null {
  const raw = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(SESSION_KEY) ?? "",
    () => SERVER_SNAPSHOT,
  );
  return useMemo(() => {
    if (raw === SERVER_SNAPSHOT || !raw) return null;
    try {
      return JSON.parse(raw) as SuperAdminSession;
    } catch {
      return null;
    }
  }, [raw]);
}
