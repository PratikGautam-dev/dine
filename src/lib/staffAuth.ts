import { useMemo, useSyncExternalStore } from "react";
import axios, { isAxiosError } from "axios";
import { requestInitToAxiosConfig } from "@/lib/apiClient";
import type { PortalHospital } from "@/lib/portalAuth";

const ACCESS_KEY = "staff_access_token";
const REFRESH_KEY = "staff_refresh_token";
const SESSION_KEY = "staff_session";

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

export function saveStaffSession(accessToken: string, refreshToken: string, session: StaffSession) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  emitSessionChange();
}

export function getStaffAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getStaffRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
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

export function clearStaffSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(SESSION_KEY);
  emitSessionChange();
}

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type FetchResult =
  | { ok: true; data: unknown }
  | { ok: false; unauthorized: true }
  | { ok: false; unauthorized: false; error: string };

/** Attempts one silent refresh via /api/portal/staff/refresh, storing the
 * rotated tokens on success. Returns the new access token, or null if the
 * refresh itself failed (refresh token missing/expired/revoked). */
async function tryRefresh(): Promise<string | null> {
  const refreshToken = getStaffRefreshToken();
  if (!refreshToken) return null;
  try {
    const res = await axios.post(`${API_BASE_URL}/api/portal/staff/refresh`, {
      refresh_token: refreshToken,
    });
    const data = res.data;
    const existing = getStaffSession();
    const session: StaffSession = {
      id: data.staff.id,
      name: data.staff.name,
      role: data.staff.role,
      hospital: data.staff.hospital || existing?.hospital,
      permissions: data.permissions,
    };
    saveStaffSession(data.access_token, data.refresh_token, session);
    return data.access_token as string;
  } catch {
    return null;
  }
}

/** axios wrapper for staff-authenticated requests. Unlike portalFetch
 * (24h shared-hospital token, bare "401 -> logout" is fine there), staff
 * access tokens are ~15min JWTs, so a 401 here first tries ONE silent
 * refresh before giving up and clearing the session -- otherwise routine
 * token expiry during normal use would log people out constantly. */
export async function staffFetch(path: string, init?: RequestInit): Promise<FetchResult> {
  let token = getStaffAccessToken();
  if (!token) return { ok: false, unauthorized: true };

  const config = requestInitToAxiosConfig(init);
  const request = (authToken: string) =>
    axios.request({
      ...config,
      url: `${API_BASE_URL}${path}`,
      headers: { ...config.headers, Authorization: `Bearer ${authToken}` },
    });

  let res;
  try {
    res = await request(token);
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

    token = await tryRefresh();
    if (!token) {
      clearStaffSession();
      return { ok: false, unauthorized: true };
    }
    try {
      res = await request(token);
    } catch (retryErr) {
      if (!isAxiosError(retryErr) || !retryErr.response) {
        return { ok: false, unauthorized: false, error: "Network error — check your connection." };
      }
      if (retryErr.response.status === 401) {
        clearStaffSession();
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
