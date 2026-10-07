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
  // Per-branch access (migration 0060) -- empty means unrestricted (every branch visible).
  branch_ids: string[];
};

export type Section = { id: string; name: string };

/** Team & Access merge: a real person with no portal login yet -- a `doctors` row (this
 * restaurant's roster/leftover-from-clinic table) with nothing in staff_details pointing at it.
 * "Give portal access" turns one of these into a real StaffMember, linked back to this same id. */
export type RosterMember = {
  id: string;
  name: string;
  department_id: string;
  department_name: string;
  is_active: boolean;
};

/** One row of the merged Team & Access list -- either a real login (StaffMember) or a roster-only
 * person (RosterMember), tagged so the table/actions can branch without field-shape gymnastics
 * (StaffMember.id is a number -- an identity id; RosterMember.id is a string -- a doctors row id;
 * they're never the same id space, hence the separate `key`). */
export type MergedRow =
  | { has_login: true; key: string; staff: StaffMember }
  | { has_login: false; key: string; roster: RosterMember };

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
  | { kind: "branches"; member: StaffMember }
  | { kind: "toggle"; member: StaffMember }
  // Team & Access merge: "Give portal access" on a roster-only person -- the same Add-Staff form,
  // pre-filled with their name/section, that on submit links the new login back to `member.id`.
  | { kind: "grant"; member: RosterMember }
  // Adding a person with no login yet -- name + section only, a `doctors` row.
  | { kind: "addRoster" }
  | null;

export const emptyStaffForm = (): StaffFormValues => ({
  name: "",
  email: "",
  password: "",
  role: "receptionist",
  phone: "",
  address: "",
  department_id: "",
  reports_to_id: "",
  working_days: [],
  shift_start: "",
  shift_end: "",
});

/** Loads and owns everything on /portal/settings/staff: the team list, the section list for the
 * "section" picker, search/filters, the selected row, and every mutation (add, edit incl. role,
 * activate/deactivate, reset password). Mutations return an error message (or null) so the dialog
 * that asked can show it in place. */
export function useStaffManagement(canView: boolean) {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [roster, setRoster] = useState<RosterMember[] | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [error, setError] = useState<string | null>(null);
  // A MergedRow's `key` (e.g. "s12" or "r7"), not a raw id -- staff ids and roster ids are different
  // id spaces (identities.id vs doctors.id) and can collide numerically.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
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
    const result = await staffFetch("/api/portal/departments");
    if (result.ok) setSections((result.data as { departments?: Section[] }).departments ?? []);
  }, []);

  const loadRoster = useCallback(async () => {
    const result = await staffFetch("/api/portal/staff/roster");
    if (result.ok) setRoster(result.data as RosterMember[]);
  }, []);

  useEffect(() => {
    if (!canView) return;
    load();
    loadSections();
    loadRoster();
  }, [canView, load, loadSections, loadRoster]);

  // Team & Access merge: every real login UNION every roster-only person -- one list, one row per
  // human, tagged has_login so the table/actions can branch (see MergedRow's own doc comment).
  const merged = useMemo<MergedRow[]>(() => {
    const staffRows: MergedRow[] = (staff ?? []).map((s) => ({
      has_login: true,
      key: `s${s.id}`,
      staff: s,
    }));
    const rosterRows: MergedRow[] = (roster ?? []).map((r) => ({
      has_login: false,
      key: `r${r.id}`,
      roster: r,
    }));
    return [...staffRows, ...rosterRows];
  }, [staff, roster]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return merged.filter((row) => {
      // A role filter only ever matches real logins -- a roster-only person has no role yet.
      if (roleFilter && (!row.has_login || row.staff.role !== roleFilter)) return false;
      const isActive = row.has_login ? row.staff.is_active : row.roster.is_active;
      if (statusFilter === "active" && !isActive) return false;
      if (statusFilter === "inactive" && isActive) return false;
      if (!q) return true;
      const haystack = row.has_login
        ? [
            row.staff.name,
            row.staff.email,
            row.staff.phone ?? "",
            row.staff.department_name ?? "",
            row.staff.employee_id ?? "",
          ]
        : [row.roster.name, row.roster.department_name];
      return haystack.some((v) => v.toLowerCase().includes(q));
    });
  }, [merged, search, roleFilter, statusFilter]);

  const counts = useMemo(() => {
    const allStaff = staff ?? [];
    const allRoster = roster ?? [];
    return {
      total: allStaff.length + allRoster.length,
      active:
        allStaff.filter((m) => m.is_active).length + allRoster.filter((m) => m.is_active).length,
      withLogin: allStaff.length,
      rosterOnly: allRoster.length,
      frontOfHouse: allStaff.filter((m) => m.role === "receptionist" && m.is_active).length,
      kitchen: allStaff.filter((m) => m.role === "kitchen" && m.is_active).length,
    };
  }, [staff, roster]);

  const selected = useMemo(() => {
    return merged.find((row) => row.key === selectedKey) ?? visible[0] ?? null;
  }, [merged, visible, selectedKey]);

  /** Runs one mutation; returns an error message (shown by the caller) or null on success.
   * `reloadRoster` also re-fetches the roster half -- needed for anything that can move someone
   * between "roster-only" and "has a login" (granting access, or an add that links from_doctor_id). */
  async function mutate(
    path: string,
    method: "POST" | "PATCH",
    body: unknown,
    success: string,
    reloadRoster = false,
  ): Promise<string | null> {
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
    if (reloadRoster) await loadRoster();
    return null;
  }

  const nullIfBlank = (v: string) => (v.trim() === "" ? null : v.trim());

  /** `fromDoctorId` set = this is "Give portal access" on a roster-only person -- the new login
   * gets linked back to that roster row, which then stops appearing as roster-only. */
  async function addStaff(f: StaffFormValues, fromDoctorId?: string) {
    const error = await mutate(
      "/api/portal/staff",
      "POST",
      {
        name: f.name,
        email: f.email,
        password: f.password,
        role: f.role,
        phone: nullIfBlank(f.phone),
        address: nullIfBlank(f.address),
        department_id: nullIfBlank(f.department_id),
        reports_to_id: f.reports_to_id ? Number(f.reports_to_id) : null,
        working_days: f.working_days,
        shift_start: nullIfBlank(f.shift_start),
        shift_end: nullIfBlank(f.shift_end),
        from_doctor_id: fromDoctorId ?? null,
      },
      fromDoctorId ? "Portal access granted" : "Staff member added",
      Boolean(fromDoctorId),
    );
    return error;
  }

  /** Adding a person with no login yet -- name + section only (a `doctors` row; the roster's own
   * booking-only fields -- slots, quotas, breaks -- are irrelevant here and left at their defaults). */
  async function addRosterMember(name: string, departmentId: string): Promise<string | null> {
    const error = await mutate(
      "/api/portal/doctors",
      "POST",
      { name, department_id: departmentId },
      "Added to the roster",
      true,
    );
    return error;
  }

  async function setRosterActive(member: RosterMember, isActive: boolean) {
    return mutate(
      `/api/portal/doctors/${member.id}/active`,
      "POST",
      { is_active: isActive },
      isActive ? "Reactivated" : "Deactivated",
      true,
    );
  }

  async function editStaff(member: StaffMember, f: StaffFormValues) {
    // Only what changed goes over the wire; a blank optional field is sent as null to clear it.
    const patch: Record<string, unknown> = {};
    if (f.name.trim() !== member.name) patch.name = f.name;
    if (f.role !== member.role) patch.role = f.role;
    if ((nullIfBlank(f.phone) ?? null) !== (member.phone ?? null))
      patch.phone = nullIfBlank(f.phone);
    if ((nullIfBlank(f.address) ?? null) !== (member.address ?? null))
      patch.address = nullIfBlank(f.address);
    if ((nullIfBlank(f.department_id) ?? null) !== (member.department_id ?? null))
      patch.department_id = nullIfBlank(f.department_id);
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
    return mutate(
      `/api/portal/staff/${member.id}`,
      "PATCH",
      { is_active: isActive },
      isActive ? "Staff member reactivated" : "Staff member deactivated",
    );
  }

  async function resetPassword(member: StaffMember, newPassword: string) {
    return mutate(
      `/api/portal/staff/${member.id}/password`,
      "POST",
      { new_password: newPassword },
      "Password reset -- they've been signed out everywhere",
    );
  }

  async function setStaffBranches(
    member: StaffMember,
    branchIds: string[],
  ): Promise<string | null> {
    return mutate(
      `/api/portal/staff/${member.id}/branches`,
      "POST",
      { branch_ids: branchIds },
      branchIds.length === 0
        ? "Branch access cleared -- every branch visible again"
        : "Branch access updated",
    );
  }

  async function addSection(name: string): Promise<string | null> {
    const result = await staffFetch("/api/portal/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!result.ok)
      return result.unauthorized ? "Session expired -- please sign in again." : result.error;
    toast.success(`"${name}" added`);
    await loadSections();
    return null;
  }

  return {
    staff,
    roster,
    merged,
    visible,
    counts,
    sections,
    error,
    selected,
    selectedKey,
    setSelectedKey,
    dialog,
    setDialog,
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    addStaff,
    editStaff,
    setActive,
    resetPassword,
    setStaffBranches,
    addRosterMember,
    setRosterActive,
    addSection,
  };
}
