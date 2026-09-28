// Web Storefront customer identity -- deliberately separate from staffAuth.ts
// (restaurant staff logins) and userAuth.ts (Google-account owner identity).
// A guest ordering on /order never has a staff_users row; this is its own
// small auth domain: a phone-number + mock-OTP login, a 30-day JWT
// (auth/customer_session.py), stored under its own localStorage keys so it
// can never collide with or be confused for either of the other two.
import { useMemo, useSyncExternalStore } from "react";

const TOKEN_KEY = "customer_token";
const SESSION_KEY = "customer_session";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export type CustomerSession = { phone: string; name: string | null };

// Lets already-mounted components (the shared header) react to a login/logout that happens on
// another page -- the /order layout persists across navigations, so reading localStorage once on
// mount left the header stale until a full reload.
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

export function saveCustomerSession(token: string, customer: CustomerSession) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(SESSION_KEY, JSON.stringify(customer));
  emitSessionChange();
}

export function getCustomerToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getCustomerSession(): CustomerSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearCustomerSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_KEY);
  emitSessionChange();
}

const SERVER_SNAPSHOT = "__server__";

/** undefined while rendering on the server / first client pass, then null (logged out) or the
 * session -- and it updates live when saveCustomerSession/clearCustomerSession run. */
export function useCustomerSession(): CustomerSession | null | undefined {
  const raw = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(SESSION_KEY) ?? "",
    () => SERVER_SNAPSHOT,
  );
  return useMemo(() => {
    if (raw === SERVER_SNAPSHOT) return undefined;
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CustomerSession;
    } catch {
      return null;
    }
  }, [raw]);
}

type FetchResult<T = unknown> = { ok: true; data: T } | { ok: false; status: number; error: string };

/** Plain fetch + manual Bearer header (this codebase's established pattern
 * for a standalone auth domain, e.g. userAuth.ts) against /api/public/*.
 * A 401 here means "log in again" -- callers redirect to /order/login rather
 * than trying a silent refresh (customer tokens are long-lived, 30 days;
 * there is no refresh-token dance to retry). */
export async function publicFetch<T = unknown>(path: string, init?: RequestInit): Promise<FetchResult<T>> {
  const token = getCustomerToken();
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init?.headers as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) clearCustomerSession();
      return { ok: false, status: res.status, error: (data as { error?: string }).error || "Something went wrong." };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, status: 0, error: "Couldn't reach the server. Check your connection and try again." };
  }
}
