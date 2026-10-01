import { useCallback, useEffect, useState } from "react";
import { staffFetch } from "@/lib/staffAuth";
import { toast } from "@/lib/toast";
import type { Branch } from "@/lib/branchContext";

export type BranchForm = {
  name: string;
  address_line: string;
  city: string;
  phone: string;
  operating_days: string[];
  operating_hours: string;
  turnover_minutes: string;
  booking_interval_minutes: string;
  service_charge_pct: string;
  delivery_radius_km: string;
  min_order_rupees: string;
  accepts_online: boolean | null;
  accepts_whatsapp: boolean | null;
};

export function emptyBranchForm(): BranchForm {
  return {
    name: "", address_line: "", city: "", phone: "", operating_days: [],
    operating_hours: "", turnover_minutes: "", booking_interval_minutes: "",
    service_charge_pct: "", delivery_radius_km: "", min_order_rupees: "",
    accepts_online: null, accepts_whatsapp: null,
  };
}

export function toBranchForm(b: Branch): BranchForm {
  return {
    name: b.name, address_line: b.address_line ?? "", city: b.city ?? "", phone: b.phone ?? "",
    operating_days: b.operating_days ? b.operating_days.split(",").filter(Boolean) : [],
    operating_hours: b.operating_hours ?? "", turnover_minutes: b.turnover_minutes?.toString() ?? "",
    booking_interval_minutes: b.booking_interval_minutes?.toString() ?? "",
    service_charge_pct: b.service_charge_pct?.toString() ?? "",
    delivery_radius_km: b.delivery_radius_km?.toString() ?? "",
    min_order_rupees: b.min_order_paise != null ? (b.min_order_paise / 100).toString() : "",
    accepts_online: b.accepts_online, accepts_whatsapp: b.accepts_whatsapp,
  };
}

function payloadFromForm(form: BranchForm) {
  return {
    name: form.name,
    address_line: form.address_line || null,
    city: form.city || null,
    phone: form.phone || null,
    operating_days: form.operating_days.length ? form.operating_days : null,
    operating_hours: form.operating_hours ? [form.operating_hours] : null,
    turnover_minutes: form.turnover_minutes ? Number(form.turnover_minutes) : null,
    booking_interval_minutes: form.booking_interval_minutes ? Number(form.booking_interval_minutes) : null,
    service_charge_pct: form.service_charge_pct ? Number(form.service_charge_pct) : null,
    delivery_radius_km: form.delivery_radius_km ? Number(form.delivery_radius_km) : null,
    min_order_paise: form.min_order_rupees ? Math.round(Number(form.min_order_rupees) * 100) : null,
    accepts_online: form.accepts_online,
    accepts_whatsapp: form.accepts_whatsapp,
  };
}

/** Settings > Branches (multi-branch plan, Phase 3) -- the toggle plus full branch CRUD. */
export function useBranchManagement(ready: boolean) {
  const [multiBranchEnabled, setMultiBranchEnabled] = useState(false);
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await staffFetch("/api/portal/branches");
    if (!result.ok) {
      if (!result.unauthorized) setError(result.error);
      return;
    }
    const data = result.data as { multi_branch_enabled: boolean; branches: Branch[] };
    setMultiBranchEnabled(data.multi_branch_enabled);
    setBranches(data.branches);
  }, []);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function toggleMultiBranch(enabled: boolean) {
    setSaving(true);
    const result = await staffFetch("/api/portal/branches/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ multi_branch_enabled: enabled }),
    });
    setSaving(false);
    if (!result.ok) {
      if (!result.unauthorized) toast.error("Couldn't update multi-branch setting", result.error);
      return;
    }
    setMultiBranchEnabled((result.data as { multi_branch_enabled: boolean }).multi_branch_enabled);
    toast.success(enabled ? "Multi-branch enabled" : "Multi-branch disabled");
  }

  async function createBranch(form: BranchForm): Promise<string | null> {
    setSaving(true);
    const result = await staffFetch("/api/portal/branches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadFromForm(form)),
    });
    setSaving(false);
    if (!result.ok) return result.unauthorized ? "Session expired -- please sign in again." : result.error;
    toast.success("Branch added");
    load();
    return null;
  }

  async function updateBranch(id: string, form: BranchForm): Promise<string | null> {
    setSaving(true);
    const result = await staffFetch(`/api/portal/branches/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadFromForm(form)),
    });
    setSaving(false);
    if (!result.ok) return result.unauthorized ? "Session expired -- please sign in again." : result.error;
    toast.success("Branch updated");
    load();
    return null;
  }

  async function setBranchActive(id: string, active: boolean) {
    setTogglingId(id);
    const result = await staffFetch(`/api/portal/branches/${id}/${active ? "activate" : "deactivate"}`, { method: "POST" });
    setTogglingId(null);
    if (!result.ok) {
      if (!result.unauthorized) toast.error("Couldn't update branch", result.error);
      return;
    }
    load();
  }

  return { multiBranchEnabled, branches, error, saving, togglingId, toggleMultiBranch, createBranch, updateBranch, setBranchActive };
}
