import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { portalFetch } from "@/lib/portalAuth";
import { toast } from "@/lib/toast";

export type Patient = {
  public_id: string;
  id: number;
  phone: string;
  name: string | null;
  patient_display_id: string | null;
  mrn: string | null;
  last_visit: string | null;
  visit_count: number;
  visited_count: number;
  // Customers page (migration 0044): email is staff-editable. loyalty_tier (migration 0066: real
  // Silver/Gold/Platinum spend tiers, not demo data)/loyalty_points/total_orders/total_spend_paise/
  // favorite_item are maintained caches, written by paid orders -- no portal write path for them.
  email: string | null;
  loyalty_tier: string | null;
  loyalty_points: number;
  total_orders: number;
  total_spend_paise: number;
  tags: string[];
  favorite_item: string | null;
  created_at: string;
  loyalty_tier_override: string | null;
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

export type LoyaltyTransaction = {
  id: number;
  order_id: number | null;
  kind: string;
  points: number;
  created_at: string;
};

export type CustomerMessage = {
  direction: "inbound" | "outbound";
  status: string | null;
  created_at: string;
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
  const [savingTags, setSavingTags] = useState(false);
  const [savingTierOverride, setSavingTierOverride] = useState(false);
  const [ledger, setLedger] = useState<LoyaltyTransaction[] | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [messages, setMessages] = useState<CustomerMessage[] | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);

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
      setLedger(null);
      setMessages(null);
      setProfileLoading(true);
      const result = await portalFetch(`/api/portal/patients/id/${id}`);
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
    setLedger(null);
    setMessages(null);
  };

  const saveProfileFields = async (fields: {
    email?: string;
    dietary_preference?: string;
    allergies?: string;
    notes?: string;
  }) => {
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

  /** Customers page's tag editor -- replaces the whole tag list (not a single add/remove), same
   * "caller sends the complete set" contract portal_update_menu_item() uses for combo lines. */
  const saveTags = async (tags: string[]): Promise<boolean> => {
    if (activeId === null) return false;
    setSavingTags(true);
    const result = await portalFetch(`/api/portal/patients/${activeId}/tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });
    setSavingTags(false);
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else toast.error("Couldn't save tags", result.error);
      return false;
    }
    const updated = (result.data as { patient: PatientDetail }).patient;
    setProfile(updated);
    load(search);
    return true;
  };

  /** Loyalty tab's tier-override control -- null clears it, going back to automatic. */
  const setTierOverride = async (tierOverride: string | null): Promise<boolean> => {
    if (activeId === null) return false;
    setSavingTierOverride(true);
    const result = await portalFetch(`/api/portal/patients/${activeId}/loyalty-tier`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tier_override: tierOverride }),
    });
    setSavingTierOverride(false);
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else toast.error("Couldn't update loyalty tier", result.error);
      return false;
    }
    const updated = (result.data as { patient: PatientDetail }).patient;
    setProfile(updated);
    toast.success(tierOverride ? `Tier set to ${tierOverride}` : "Back to automatic tier");
    load(search);
    return true;
  };

  const loadLedger = useCallback(async () => {
    if (activeId === null) return;
    setLedgerLoading(true);
    const result = await portalFetch(`/api/portal/patients/${activeId}/loyalty-ledger`);
    setLedgerLoading(false);
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else toast.error("Couldn't load loyalty history", result.error);
      return;
    }
    setLedger((result.data as { transactions: LoyaltyTransaction[] }).transactions);
  }, [activeId, router]);

  const loadMessages = useCallback(async () => {
    if (activeId === null) return;
    setMessagesLoading(true);
    const result = await portalFetch(`/api/portal/patients/${activeId}/messages`);
    setMessagesLoading(false);
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else toast.error("Couldn't load message history", result.error);
      return;
    }
    setMessages((result.data as { messages: CustomerMessage[] }).messages);
  }, [activeId, router]);

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
    savingTags,
    saveTags,
    savingTierOverride,
    setTierOverride,
    ledger,
    ledgerLoading,
    loadLedger,
    messages,
    messagesLoading,
    loadMessages,
  };
}
