"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { portalFetch } from "@/lib/portalAuth";
import { useStaffSession } from "@/lib/staffAuth";

export type Branch = {
  id: string;
  name: string;
  address_line: string | null;
  city: string | null;
  phone: string | null;
  operating_days: string | null;
  operating_hours: string | null;
  turnover_minutes: number | null;
  booking_interval_minutes: number | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
};

type BranchContextValue = {
  multiBranchEnabled: boolean;
  branches: Branch[];
  // null = "All Branches" (the topbar switcher's default) -- every branch-filtered hook treats
  // null the same way the backend's own branch_id=None does: no filter, everything shown.
  selectedBranchId: string | null;
  setSelectedBranchId: (id: string | null) => void;
  reload: () => Promise<void>;
};

const BranchContext = createContext<BranchContextValue>({
  multiBranchEnabled: false,
  branches: [],
  selectedBranchId: null,
  setSelectedBranchId: () => {},
  reload: async () => {},
});

const STORAGE_KEY = "dc_portal_selected_branch_id";

/** Global multi-branch state (migration 0053) -- mounted once in PortalShell so it's available on
 * every /portal/* page, including Menu and Staff (which stay unfiltered, since menu/staff are
 * shared across branches by design -- see the multi-branch plan's own scoping decisions). Only
 * the branch-scoped pages (Tables, Bookings, Food Orders, Waitlist, Chef Notes, Reports) actually
 * read selectedBranchId to filter their own fetches. The selection itself is a per-viewer
 * convenience (which branch a staff member is currently looking at), so it lives in localStorage,
 * not the backend -- a different device/tab starts back at "All Branches". */
export function BranchProvider({ children }: { children: React.ReactNode }) {
  const session = useStaffSession();
  const [multiBranchEnabled, setMultiBranchEnabled] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSelectedBranchIdState(stored);
    } catch {
      // private window / blocked storage -- falls back to "All Branches", same as a fresh viewer
    }
  }, []);

  const setSelectedBranchId = useCallback((id: string | null) => {
    setSelectedBranchIdState(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // per-viewer convenience only -- fine to silently not persist
    }
  }, []);

  const load = useCallback(async () => {
    const result = await portalFetch("/api/portal/branches");
    if (!result.ok) return;
    const data = result.data as { multi_branch_enabled: boolean; branches: Branch[] };
    setMultiBranchEnabled(data.multi_branch_enabled);
    setBranches(data.branches.filter((b) => b.is_active));
    // If the previously selected branch no longer exists/is inactive, fall back to "All Branches"
    // rather than silently filtering by a branch_id the backend would 404/ignore.
    setSelectedBranchIdState((current) => (current && !data.branches.some((b) => b.id === current && b.is_active) ? null : current));
  }, []);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

  const value = useMemo(
    () => ({ multiBranchEnabled, branches, selectedBranchId, setSelectedBranchId, reload: load }),
    [multiBranchEnabled, branches, selectedBranchId, setSelectedBranchId, load],
  );

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

/** Read the currently selected branch anywhere under PortalShell -- a branch-scoped hook passes
 * `selectedBranchId` straight through as its own `branch_id` query param. */
export function useBranchFilter() {
  return useContext(BranchContext);
}
