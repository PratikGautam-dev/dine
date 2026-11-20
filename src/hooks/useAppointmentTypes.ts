import { useCallback, useEffect, useState } from "react";
import { portalFetch } from "@/lib/portalAuth";
import { toast } from "@/lib/toast";

export type AppointmentTypeRow = {
  id: string;
  label: string;
  is_active: boolean;
  is_allowed: boolean;
  /** True when this branch set the type itself; false = it follows the restaurant-wide value. */
  own?: boolean;
};

/** Loads + toggles this restaurant's appointment-type allow-list (admin/
 * tenants_api.py's "Appointment types" section controls is_allowed per
 * tenant; this is where the tenant's own staff flip is_active within that
 * whitelist -- e.g. turning Daycare on after the platform admin has allowed
 * it). */
export function useAppointmentTypes(branchId: string | null) {
  const [types, setTypes] = useState<AppointmentTypeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!branchId) return;
    const result = await portalFetch(`/api/portal/appointment-types?branch_id=${encodeURIComponent(branchId)}`);
    if (!result.ok) {
      setTypes(null);
      return;
    }
    setTypes((result.data as { appointment_types: AppointmentTypeRow[] }).appointment_types);
  }, [branchId]);

  useEffect(() => {
    // Loads the picked branch's types from the server (the setState happens after the fetch resolves).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function toggleActive(type: AppointmentTypeRow) {
    if (!branchId) return;
    setPendingId(type.id);
    setError(null);
    const result = await portalFetch(`/api/portal/appointment-types/${type.id}/active`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !type.is_active, branch_id: branchId }),
    });
    setPendingId(null);
    if (!result.ok) {
      setError(result.unauthorized ? "Session expired — please log in again." : result.error);
      if (!result.unauthorized) toast.error("Couldn't update reservation type", result.error);
      return;
    }
    toast.success(type.is_active ? `${type.label} deactivated` : `${type.label} activated`);
    load();
  }

  return { types, error, pendingId, toggleActive };
}
