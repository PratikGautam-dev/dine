import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { portalFetch } from "@/lib/portalAuth";
import { toast } from "@/lib/toast";

export type Patient = {
  id: number;
  phone: string;
  name: string | null;
  patient_display_id: string | null;
  mrn: string | null;
  last_visit: string | null;
  visit_count: number;
  visited_count: number;
  // Customers page (migration 0044): email is staff-editable; loyalty_tier/loyalty_points/
  // total_orders/total_spend_paise/favorite_item are demo-seeded only, no write path exists for them.
  email: string | null;
  loyalty_tier: string | null;
  loyalty_points: number;
  total_orders: number;
  total_spend_paise: number;
  favorite_item: string | null;
  created_at: string;
};

export type PatientDetail = Patient & {
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  created_at: string;
  status: string;
  dietary_preference: string | null;
  allergies: string | null;
  notes: string | null;
};

async function fetchPatients(search: string) {
  return portalFetch(`/api/portal/patients?search=${encodeURIComponent(search)}`);
}

async function deletePatients(patientIds: number[]) {
  return portalFetch("/api/portal/patients/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patient_ids: patientIds }),
  });
}

export type NewCustomerFields = { name: string; phone: string };

/** Loads + searches the portal's patients list, and owns row selection and
 * delete (single or bulk) for the /portal/patients page. */
export function usePatients(ready: boolean) {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[] | null>(null);
  // The whole directory (no search applied): the summary tiles and charts describe everyone, not the search results.
  const [directory, setDirectory] = useState<Patient[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<Patient[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  // The "Customer Details" side panel's own selection -- distinct from `selected` above (row checkboxes).
  const [activeId, setActiveId] = useState<number | null>(null);
  const [profile, setProfile] = useState<PatientDetail | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [creating, setCreating] = useState(false);

  const load = useCallback(
    async (query: string) => {
      const result = await fetchPatients(query);
      if (!result.ok) {
        if (result.unauthorized) router.push("/portal/login");
        else setError(result.error);
        return;
      }
      const list = (result.data as { patients: Patient[] }).patients;
      setPatients(list);
      if (!query.trim()) setDirectory(list);
    },
    [router],
  );

  useEffect(() => {
    if (ready) load(search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, load]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => load(search), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const toggleSelected = (id: number, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAll = (checked: boolean) => {
    setSelected(checked ? new Set((patients ?? []).map((p) => p.id)) : new Set());
  };

  const runDelete = async (targets: Patient[]) => {
    setDeleting(true);
    const result = await deletePatients(targets.map((p) => p.id));
    setDeleting(false);
    setPendingDelete(null);
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else {
        setError(result.error);
        toast.error("Couldn't delete guest" + (targets.length > 1 ? "s" : ""), result.error);
      }
      return;
    }
    const deletedIds = new Set((result.data as { deleted: number[] }).deleted);
    toast.success(deletedIds.size > 1 ? `${deletedIds.size} guests deleted` : "Guest deleted");
    setPatients((prev) => (prev ? prev.filter((p) => !deletedIds.has(p.id)) : prev));
    setDirectory((prev) => (prev ? prev.filter((p) => !deletedIds.has(p.id)) : prev));
    setSelected((prev) => {
      const next = new Set(prev);
      deletedIds.forEach((id) => next.delete(id));
      return next;
    });
  };

  const selectedPatients = (patients ?? []).filter((p) => selected.has(p.id));
  const allSelected = (patients?.length ?? 0) > 0 && selected.size === patients?.length;

  const openProfile = useCallback(
    async (id: number) => {
      setActiveId(id);
      setProfile(null);
      setProfileLoading(true);
      const result = await portalFetch(`/api/portal/patients/${id}`);
      setProfileLoading(false);
      if (!result.ok) {
        if (result.unauthorized) router.push("/portal/login");
        else toast.error("Couldn't load customer", result.error);
        return;
      }
      setProfile((result.data as { patient: PatientDetail }).patient);
    },
    [router],
  );

  const closeProfile = () => {
    setActiveId(null);
    setProfile(null);
  };

  const saveProfileFields = async (fields: { email?: string; dietary_preference?: string; allergies?: string; notes?: string }) => {
    if (activeId === null) return;
    setSavingProfile(true);
    const result = await portalFetch(`/api/portal/patients/${activeId}/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    setSavingProfile(false);
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else toast.error("Couldn't save", result.error);
      return;
    }
    const updated = (result.data as { patient: PatientDetail }).patient;
    setProfile(updated);
    toast.success("Saved");
    load(search);
  };

  const createCustomer = async (fields: NewCustomerFields): Promise<boolean> => {
    setCreating(true);
    const result = await portalFetch("/api/portal/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    setCreating(false);
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else toast.error("Couldn't add customer", result.error);
      return false;
    }
    toast.success("Customer added");
    load(search);
    return true;
  };

  return {
    patients,
    directory,
    error,
    search,
    setSearch,
    selected,
    toggleSelected,
    toggleSelectAll,
    selectedPatients,
    allSelected,
    pendingDelete,
    setPendingDelete,
    deleting,
    runDelete,
    activeId,
    profile,
    profileLoading,
    savingProfile,
    openProfile,
    closeProfile,
    saveProfileFields,
    creating,
    createCustomer,
  };
}
