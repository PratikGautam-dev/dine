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
  // Multi-branch (migration 0055) -- operational overrides, null = inherit the hospital default.
  // service_charge_pct/delivery_radius_km are stored and shown in settings but not yet enforced
  // anywhere (no service-charge line item in order totals, no geocoding for a radius check).
  service_charge_pct: number | null;
  delivery_radius_km: number | null;
  min_order_paise: number | null;
  accepts_online: boolean | null;
  accepts_whatsapp: boolean | null;
  // The rest of the branch_settings reference schema (migration 0061), same nullable-override
  // convention. delivery_fee_paise and is_open_override are enforced for real (checkout's own
  // delivery fee, the storefront's open/closed state); tables_enabled/avg_prep_time_min are
  // stored/shown only for now.
  tables_enabled: boolean | null;
  is_open_override: boolean | null;
  avg_prep_time_min: number | null;
  delivery_fee_paise: number | null;
};

type BranchContextValue = {
  multiBranchEnabled: boolean;
  // Every branch the hospital has -- used by admin screens (Settings > Branches, the Offers
  // form's branch picker) that need to see/manage everything regardless of the caller's own
  // restriction.
  branches: Branch[];
  // The subset THIS caller may actually switch to (migration 0060) -- equals `branches` for an
  // unrestricted staff member, a narrower list for one Settings > Staff has restricted. The
  // topbar switcher reads this, not `branches`.
  accessibleBranches: Branch[];
  // True when this caller has been restricted to specific branches (staffBranchIds non-empty) --
  // the topbar switcher hides "All Branches" in that case, since picking it would mean "give me
  // everything," which the backend refuses for a restricted caller.
  isRestricted: boolean;
  // null = "All Branches" (the topbar switcher's default) -- every branch-filtered hook treats
  // null the same way the backend's own branch_id=None does: no filter, everything shown.
  selectedBranchId: string | null;
  setSelectedBranchId: (id: string | null) => void;
  reload: () => Promise<void>;
};

const BranchContext = createContext<BranchContextValue>({
  multiBranchEnabled: false,
  branches: [],
  accessibleBranches: [],
  isRestricted: false,
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
  const [staffBranchIds, setStaffBranchIds] = useState<string[]>([]);
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
    const data = result.data as {
      multi_branch_enabled: boolean;
      branches: Branch[];
      staff_branch_ids?: string[];
    };
    setMultiBranchEnabled(data.multi_branch_enabled);
    setBranches(data.branches.filter((b) => b.is_active));
    setStaffBranchIds(data.staff_branch_ids ?? []);
    // If the previously selected branch no longer exists/is inactive/is no longer accessible,
    // fall back to "All Branches" (or, if restricted, nothing selected yet) rather than silently
    // filtering by a branch_id the backend would 404/403 on.
    setSelectedBranchIdState((current) =>
      current && !data.branches.some((b) => b.id === current && b.is_active) ? null : current,
    );
  }, []);

  useEffect(() => {
    if (session) load();
  }, [session, load]);

  const isRestricted = staffBranchIds.length > 0;
  const accessibleBranches = useMemo(
    () => (isRestricted ? branches.filter((b) => staffBranchIds.includes(b.id)) : branches),
    [branches, isRestricted, staffBranchIds],
  );

  // A restricted caller can't use "All Branches" (null) -- default them straight to their one
  // accessible branch instead of leaving the switcher in a state the backend will 403 on.
  useEffect(() => {
    if (isRestricted && selectedBranchId === null && accessibleBranches.length > 0) {
      setSelectedBranchId(accessibleBranches[0].id);
    }
  }, [isRestricted, selectedBranchId, accessibleBranches, setSelectedBranchId]);

  const value = useMemo(
    () => ({
      multiBranchEnabled,
      branches,
      accessibleBranches,
      isRestricted,
      selectedBranchId,
      setSelectedBranchId,
      reload: load,
    }),
    [
      multiBranchEnabled,
      branches,
      accessibleBranches,
      isRestricted,
      selectedBranchId,
      setSelectedBranchId,
      load,
    ],
  );

  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

/** Read the currently selected branch anywhere under PortalShell -- a branch-scoped hook passes
 * `selectedBranchId` straight through as its own `branch_id` query param. */
export function useBranchFilter() {
  return useContext(BranchContext);
}
