import { useMemo, useSyncExternalStore } from "react";
import axios, { isAxiosError } from "axios";
import { requestInitToAxiosConfig } from "@/lib/apiClient";
import type { PortalHospital } from "@/lib/portalAuth";

const SESSION_KEY = "staff_session";

// Staff access/refresh tokens travel as httpOnly cookies now (backend's
// portal/routes/staff_auth.py), set by the browser itself on every
// login/refresh/logout response -- this file never sees, stores, or
// attaches them. SESSION_KEY below still holds the non-sensitive session
// summary (role/permissions/hospital) in localStorage purely for display
// (sidebar name, permission gates); leaking it to XSS doesn't grant any
// real access the way the old raw bearer tokens did, since the actual
// credential is now unreadable to JS.
const CSRF_COOKIE = "csrf_token";

/** Reads the readable (non-httpOnly) csrf_token cookie the backend sets
 * alongside the httpOnly auth cookies -- echoed back as X-CSRF-Token on
 * every mutating request (auth/csrf.py's module docstring on the backend
 * explains the double-submit scheme this implements). */
function getCsrfToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// Lets already-mounted components (PortalSidebar, BranchProvider, anything reading
// useStaffSession) react to a login/refresh that happens elsewhere -- the /portal layout
// persists across a client-side navigation (e.g. the login form's redirect to /portal/dashboard),
// so reading localStorage once on mount left every one of them stuck on a stale/null session
// until a full page reload. Same fix customerAuth.ts's useCustomerSession() already has.
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

// Owner/Manager, Front of House, Kitchen Staff. "doctor" is the legacy linked-table-manager login,
// no longer offered for new staff but still a valid stored value.
export type StaffRole = "admin" | "receptionist" | "kitchen" | "doctor";
export type StaffPermissions = Record<string, { view: boolean; write: boolean; delete: boolean }>;

export type StaffSession = {
  id: number;
  name: string;
  role: StaffRole;
  hospital: PortalHospital;
  permissions: StaffPermissions;
};

export function saveStaffSession(session: StaffSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  emitSessionChange();
}

export function getStaffSession(): StaffSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Revokes the refresh-token cookie server-side (so it can't be replayed)
 * and clears every staff cookie via the response's Set-Cookie headers --
 * best-effort: a network failure here still clears the local session below,
 * same as the old client-only clear did, since the cookies' own TTLs are
 * the fallback if this call never reaches the server. Must be awaited by
 * the caller before relying on the cookies being gone (e.g. before
 * redirecting to a page that would otherwise still look signed in). */
export async function clearStaffSession() {
  try {
    await axios.post(`${API_BASE_URL}/api/portal/staff/logout`, undefined, { withCredentials: true });
  } catch {
    // best-effort -- see docstring above
  }
  localStorage.removeItem(SESSION_KEY);
  emitSessionChange();
}

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type FetchResult =
  | { ok: true; data: unknown }
  | { ok: false; unauthorized: true }
  | { ok: false; unauthorized: false; error: string };

/** Attempts one silent refresh via /api/portal/staff/refresh, updating the
 * cached session summary on success. The rotated access/refresh tokens
 * themselves travel back as Set-Cookie headers on this same response --
 * axios never sees their values, withCredentials: true just lets the
 * browser apply them. Returns true on success, false if the refresh itself
 * failed (refresh-token cookie missing/expired/revoked). */
async function tryRefresh(): Promise<boolean> {
  try {
    const res = await axios.post(
      `${API_BASE_URL}/api/portal/staff/refresh`,
      undefined,
      { withCredentials: true },
    );
    const data = res.data;
    const existing = getStaffSession();
    const session: StaffSession = {
      id: data.staff.id,
      name: data.staff.name,
      role: data.staff.role,
      hospital: data.staff.hospital || existing?.hospital,
      permissions: data.permissions,
    };
    saveStaffSession(session);
    return true;
  } catch {
    return false;
  }
}

/** axios wrapper for staff-authenticated requests. The access-token cookie
 * is attached by the browser automatically (withCredentials: true); unlike
 * portalFetch (24h shared-hospital token, bare "401 -> logout" is fine
 * there), staff access tokens are ~15min JWTs, so a 401 here first tries
 * ONE silent refresh before giving up and clearing the session -- otherwise
 * routine token expiry during normal use would log people out constantly. */
export async function staffFetch(path: string, init?: RequestInit): Promise<FetchResult> {
  if (!getStaffSession()) return { ok: false, unauthorized: true };

  const config = requestInitToAxiosConfig(init);
  // CSRF: only mutating requests carry a body a forged cross-site request
  // could abuse -- a bare GET needs no header (auth/csrf.py's middleware
  // only checks non-GET/HEAD/OPTIONS methods anyway).
  const csrfHeaders =
    config.method.toUpperCase() === "GET" ? {} : { "X-CSRF-Token": getCsrfToken() || "" };
  const request = () =>
    axios.request({
      ...config,
      url: `${API_BASE_URL}${path}`,
      headers: { ...config.headers, ...csrfHeaders },
      withCredentials: true,
    });

  let res;
  try {
    res = await request();
  } catch (err) {
    if (!isAxiosError(err) || !err.response) {
      return { ok: false, unauthorized: false, error: "Network error — check your connection." };
    }
    if (err.response.status !== 401) {
      return {
        ok: false,
        unauthorized: false,
        error: err.response.data?.error || "Something went wrong.",
      };
    }

    const refreshed = await tryRefresh();
    if (!refreshed) {
      await clearStaffSession();
      return { ok: false, unauthorized: true };
    }
    try {
      res = await request();
    } catch (retryErr) {
      if (!isAxiosError(retryErr) || !retryErr.response) {
        return { ok: false, unauthorized: false, error: "Network error — check your connection." };
      }
      if (retryErr.response.status === 401) {
        await clearStaffSession();
        return { ok: false, unauthorized: true };
      }
      return {
        ok: false,
        unauthorized: false,
        error: retryErr.response.data?.error || "Something went wrong.",
      };
    }
  }

  return { ok: true, data: res.data };
}

const SERVER_SNAPSHOT = "__server__";

/** SSR-hydration-safe AND reactive read of the cached staff session: `null` on the server AND on
 * the client's own first (pre-hydration) render pass (avoiding the hydration-mismatch a
 * synchronous localStorage read on the server snapshot would cause -- same reasoning this
 * function's docstring already explained before this fix), but now also `null` -> the real
 * session the moment saveStaffSession()/clearStaffSession() runs ANYWHERE, including in an
 * already-mounted component that isn't the one that called them (e.g. the /portal layout
 * persisting across the login form's client-side redirect to /portal/dashboard -- the real bug
 * this fixes: every already-mounted useStaffSession() consumer, including the branch switcher
 * and every usePermission() check, used to stay stuck on whatever it read at first mount until
 * a full page reload). Same useSyncExternalStore pattern customerAuth.ts's useCustomerSession()
 * already uses. */
export function useStaffSession(): StaffSession | null {
  const raw = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(SESSION_KEY) ?? "",
    () => SERVER_SNAPSHOT,
  );
  return useMemo(() => {
    if (raw === SERVER_SNAPSHOT || !raw) return null;
    try {
      return JSON.parse(raw) as StaffSession;
    } catch {
      return null;
    }
  }, [raw]);
}

/** Reads permissions off the cached session (refreshed on every staff
 * login/refresh). No session -> fails open, same posture as PortalSidebar's
 * pre-existing capability check: the frontend hide is a convenience, the
 * backend's 403 is the real enforcement. A real hook (via useStaffSession)
 * -- call it directly in a component body or inside PermissionGate, never
 * inside a loop/callback (use the plain `hasPermission` function below for
 * that, e.g. NAV_ITEMS.filter in PortalSidebar). */
export function usePermission(pageKey: string, action: "view" | "write" | "delete"): boolean {
  const session = useStaffSession();
  return hasPermission(session, pageKey, action);
}

/** Same permission check as usePermission, but a plain function taking an
 * already-resolved session instead of reading one itself -- safe to call
 * from inside a loop/callback (e.g. NAV_ITEMS.filter in PortalSidebar),
 * which a real hook (usePermission above) cannot be, since hook call count/
 * order must stay fixed across renders. Callers get `session` once, from
 * their own top-level useStaffSession() call, and pass it in here per item. */
export function hasPermission(
  session: StaffSession | null,
  pageKey: string,
  action: "view" | "write" | "delete",
): boolean {
  if (!session) return true;
  return !!session.permissions[pageKey]?.[action];
}
