import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { staffFetch } from "@/lib/staffAuth";
import { toast } from "@/lib/toast";

export type StaffMember = {
  id: number;
  name: string;
  email: string;
  // A plain string, not the fixed StaffRole union -- Staff & Access's "Add Role" means this can
  // be any hospital-created custom role_key, not just the 3 built-ins.
  role: string;
  is_active: boolean;
  employee_id: string | null;
  phone: string | null;
  address: string | null;
  department_id: string | null;
  department_name: string | null;
  reports_to_id: number | null;
  reports_to_name: string | null;
  working_days: string[];
  shift_start: string | null;
  shift_end: string | null;
};

export type Section = { id: string; name: string };

export type StaffFormValues = {
  name: string;
  email: string;
  password: string;
  role: string;
  phone: string;
  address: string;
  department_id: string;
  reports_to_id: string; // "" = nobody
  working_days: string[];
  shift_start: string; // "" = none
  shift_end: string;
};

export type StaffDialog =
  | { kind: "add" }
  | { kind: "edit"; member: StaffMember }
  | { kind: "password"; member: StaffMember }
  | { kind: "toggle"; member: StaffMember }
  | null;

export const emptyStaffForm = (): StaffFormValues => ({
  name: "", email: "", password: "", role: "receptionist", phone: "", address: "", department_id: "", reports_to_id: "",
  working_days: [], shift_start: "", shift_end: "",
});

/** Loads and owns everything on /portal/settings/staff: the team list, the section list for the
 * "section" picker, search/filters, the selected row, and every mutation (add, edit incl. role,
 * activate/deactivate, reset password). Mutations return an error message (or null) so the dialog
 * that asked can show it in place. */
export function useStaffManagement(canView: boolean) {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dialog, setDialog] = useState<StaffDialog>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");

  const load = useCallback(async () => {
    const result = await staffFetch("/api/portal/staff");
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else setError(result.error);
      return;
    }
    setError(null);
    setStaff(result.data as StaffMember[]);
  }, [router]);

  const loadSections = useCallback(async () => {
    // The same endpoint the Team page reads; a role without access simply gets no section picker.
    const result = await staffFetch("/api/portal/doctors");
    if (result.ok) setSections(((result.data as { departments?: Section[] }).departments) ?? []);
  }, []);

  useEffect(() => {
    if (!canView) return;
    load();
    loadSections();
  }, [canView, load, loadSections]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (staff ?? []).filter((m) => {
      if (roleFilter && m.role !== roleFilter) return false;
      if (statusFilter === "active" && !m.is_active) return false;
      if (statusFilter === "inactive" && m.is_active) return false;
      if (!q) return true;
      return [m.name, m.email, m.phone ?? "", m.department_name ?? "", m.employee_id ?? ""].some((v) => v.toLowerCase().includes(q));
    });
  }, [staff, search, roleFilter, statusFilter]);

  const counts = useMemo(() => {
    const all = staff ?? [];
    return {
      total: all.length,
      active: all.filter((m) => m.is_active).length,
      frontOfHouse: all.filter((m) => m.role === "receptionist" && m.is_active).length,
      kitchen: all.filter((m) => m.role === "kitchen" && m.is_active).length,
    };
  }, [staff]);

  const selected = useMemo(() => {
    const list = staff ?? [];
    return list.find((m) => m.id === selectedId) ?? visible[0] ?? null;
  }, [staff, visible, selectedId]);

  /** Runs one mutation; returns an error message (shown by the caller) or null on success. */
  async function mutate(path: string, method: "POST" | "PATCH", body: unknown, success: string): Promise<string | null> {
    const result = await staffFetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!result.ok) {
      if (result.unauthorized) {
        router.push("/portal/login");
        return "Session expired -- please sign in again.";
      }
      return result.error;
    }
    toast.success(success);
    await load();
    return null;
  }

  const nullIfBlank = (v: string) => (v.trim() === "" ? null : v.trim());

  async function addStaff(f: StaffFormValues) {
    const error = await mutate("/api/portal/staff", "POST", {
      name: f.name, email: f.email, password: f.password, role: f.role, phone: nullIfBlank(f.phone),
      address: nullIfBlank(f.address), department_id: nullIfBlank(f.department_id),
      reports_to_id: f.reports_to_id ? Number(f.reports_to_id) : null,
      working_days: f.working_days, shift_start: nullIfBlank(f.shift_start), shift_end: nullIfBlank(f.shift_end),
    }, "Staff member added");
    return error;
  }

  async function editStaff(member: StaffMember, f: StaffFormValues) {
    // Only what changed goes over the wire; a blank optional field is sent as null to clear it.
    const patch: Record<string, unknown> = {};
    if (f.name.trim() !== member.name) patch.name = f.name;
    if (f.role !== member.role) patch.role = f.role;
    if ((nullIfBlank(f.phone) ?? null) !== (member.phone ?? null)) patch.phone = nullIfBlank(f.phone);
    if ((nullIfBlank(f.address) ?? null) !== (member.address ?? null)) patch.address = nullIfBlank(f.address);
    if ((nullIfBlank(f.department_id) ?? null) !== (member.department_id ?? null)) patch.department_id = nullIfBlank(f.department_id);
    const reports = f.reports_to_id ? Number(f.reports_to_id) : null;
    if (reports !== (member.reports_to_id ?? null)) patch.reports_to_id = reports;
    const sameDays = f.working_days.join(",") === (member.working_days ?? []).join(",");
    if (!sameDays) patch.working_days = f.working_days;
    if (f.shift_start !== (member.shift_start ?? "") || f.shift_end !== (member.shift_end ?? "")) {
      patch.shift_start = nullIfBlank(f.shift_start);
      patch.shift_end = nullIfBlank(f.shift_end);
    }
    if (Object.keys(patch).length === 0) return null;
    return mutate(`/api/portal/staff/${member.id}`, "PATCH", patch, "Staff member updated");
  }

  async function setActive(member: StaffMember, isActive: boolean) {
    return mutate(`/api/portal/staff/${member.id}`, "PATCH", { is_active: isActive }, isActive ? "Staff member reactivated" : "Staff member deactivated");
  }

  async function resetPassword(member: StaffMember, newPassword: string) {
    return mutate(`/api/portal/staff/${member.id}/password`, "POST", { new_password: newPassword }, "Password reset -- they've been signed out everywhere");
  }

  return {
    staff, visible, counts, sections, error, selected, setSelectedId,
    dialog, setDialog, search, setSearch, roleFilter, setRoleFilter, statusFilter, setStatusFilter,
    addStaff, editStaff, setActive, resetPassword,
  };
}
