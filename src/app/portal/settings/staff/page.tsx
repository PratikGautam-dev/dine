"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { KeyRound, Plus, ShieldCheck, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/erp-ui/Badge";
import { Button } from "@/components/erp-ui/Button";
import { DataTable } from "@/components/erp-ui/DataTable";
import { Field } from "@/components/erp-ui/Field";
import { Input } from "@/components/erp-ui/Input";
import { Modal } from "@/components/erp-ui/Modal";
import { Select } from "@/components/erp-ui/Select";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Field as PlainField } from "@/components/ui/Field";
import { Input as PlainInput } from "@/components/ui/Input";
import { Modal as PlainModal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { PortalShell } from "@/components/portal/PortalShell";
import { EditStaffBranchesDialog } from "@/components/portal/EditStaffBranchesDialog";
import { StaffFormDialog } from "@/components/portal/StaffFormDialog";
import { usePortalRoles } from "@/hooks/usePortalRoles";
import { useStaffManagement, type MergedRow, type StaffMember } from "@/hooks/useStaffManagement";
import { useBranchFilter } from "@/lib/branchContext";
import { formatDateTime } from "@/lib/erp/erp";
import { usePermission, useStaffSession } from "@/lib/staffAuth";
import { BUILT_IN_ROLES, orderedRoles, roleLabel, roleTone } from "@/lib/staffRoles";
import { toast } from "@/lib/toast";

const MIN_PASSWORD = 8;
const EMPTY_FORM = { name: "", email: "", phone: "", password: "", role: "", branch_id: "" };
const SELECT_CLASS =
  "h-11 w-full rounded-md border border-line bg-card px-space-3 text-[14px] text-ink-900 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";

/** Team & Access: who can sign in, and what they can do in which branch. Click a person to change their role, branches or password. */
export default function TeamAccessPage() {
  const session = useStaffSession();
  const canView = usePermission("staff", "view");
  const canManage = usePermission("staff", "write");
  const canSeeRoles = usePermission("roles", "view");
  const {
    staff,
    merged,
    sections,
    error,
    dialog,
    setDialog,
    createPerson,
    changeRole,
    addStaff,
    editStaff,
    setActive,
    resetPassword,
    setStaffBranches,
    addRosterMember,
    setRosterActive,
    addSection,
  } = useStaffManagement(canView);
  const { branches } = useBranchFilter();
  const { matrix } = usePortalRoles(canSeeRoles);
  const roles = useMemo(() => (matrix ? orderedRoles(matrix) : [...BUILT_IN_ROLES]), [matrix]);
  const openBranches = useMemo(() => branches.filter((b) => b.is_active), [branches]);
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? `Branch #${id}`;

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [newRole, setNewRole] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [rosterName, setRosterName] = useState("");
  const [rosterDept, setRosterDept] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [sectionOpen, setSectionOpen] = useState(false);

  const opened = merged.find((r) => r.key === openKey) ?? null;
  const selfId = session?.id ?? null;
  const managersFor = (personId: number | null) =>
    (staff ?? []).filter((m) => m.is_active && m.id !== personId).map((m) => ({ id: m.id, name: m.name }));
  const customRoles = roles.filter((r) => !(BUILT_IN_ROLES as readonly string[]).includes(r));

  const columns = useMemo<ColumnDef<MergedRow, unknown>[]>(
    () => [
      {
        header: "Person",
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div>
              <p className="font-semibold text-ink-900">{r.has_login ? r.staff.name : r.roster.name}</p>
              <p className={r.has_login ? "text-[12px] text-ink-400" : "text-[12px] italic text-ink-400"}>
                {r.has_login ? r.staff.email : "No portal login yet"}
              </p>
            </div>
          );
        },
      },
      {
        header: "Access",
        cell: ({ row }) => {
          const r = row.original;
          if (!r.has_login) return <span className="text-ink-400">No access</span>;
          const where = r.staff.branch_ids.length === 0 ? ["all"] : r.staff.branch_ids.map(branchName);
          return (
            <div className="flex flex-wrap gap-1">
              {where.slice(0, 3).map((w) => (
                <Badge key={w} tone={roleTone(r.staff.role)}>
                  {roleLabel(r.staff.role)} · {w}
                </Badge>
              ))}
              {where.length > 3 && <Badge tone="neutral">+{where.length - 3} more</Badge>}
            </div>
          );
        },
      },
      {
        header: "Status",
        cell: ({ row }) => {
          const r = row.original;
          const active = r.has_login ? r.staff.is_active : r.roster.is_active;
          return <Badge tone={active ? "success" : "neutral"}>{active ? "active" : "disabled"}</Badge>;
        },
      },
      {
        header: "Last sign-in",
        cell: ({ row }) => {
          const r = row.original;
          if (!r.has_login) return <span className="text-ink-400">—</span>;
          return (
            <span className="text-ink-600">{r.staff.last_login_at ? formatDateTime(r.staff.last_login_at) : "Never"}</span>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [branches],
  );

  if (!canView) {
    return (
      <PortalShell restaurant={session?.restaurant || null} active="staff">
        <p className="text-[13px] text-ink-400">You don&apos;t have access to Users.</p>
      </PortalShell>
    );
  }

  async function run(call: () => Promise<string | null>, failure: string, after?: () => void) {
    setBusy(true);
    const problem = await call();
    setBusy(false);
    if (problem) return toast.error(failure, problem);
    after?.();
  }

  const addPerson = () =>
    run(
      () => createPerson({ ...form, name: form.name.trim(), email: form.email.trim(), role: form.role || roles[0] }),
      "Couldn't add the person",
      () => {
        setAdding(false);
        setForm(EMPTY_FORM);
      },
    );

  const person: StaffMember | null = opened?.has_login ? opened.staff : null;

  return (
    <PortalShell restaurant={session?.restaurant || null} active="staff">
      <PageHeader
        icon={<Users size={20} />}
        title="Users"
        description="Who can sign in, and what they can do in which branch."
        actions={
          <PermissionGate page="staff" action="write">
            <Button variant="secondary" onClick={() => setDialog({ kind: "addRoster" })}>
              <Users size={16} /> Add to roster
            </Button>
            <Button onClick={() => setAdding(true)}>
              <UserPlus size={16} /> Add user
            </Button>
          </PermissionGate>
        }
      />
      {error && <p className="mb-space-3 text-[13px] font-medium text-error">{error}</p>}
      <Card className="p-space-2">
        <DataTable
          columns={columns}
          data={merged}
          getRowId={(r) => r.key}
          onRowClick={(r) => {
            setOpenKey(r.key);
            setNewRole(r.has_login ? r.staff.role : "");
            setNewPassword("");
          }}
          loading={staff === null}
          emptyMessage={staff === null ? "Loading…" : "No people yet."}
        />
      </Card>

      <Card className="mt-space-4 p-space-4">
        <div className="flex items-center justify-between gap-space-3">
          <div>
            <h2 className="text-[15px] font-bold text-ink-900">Sections</h2>
            <p className="text-[12.5px] text-ink-400">
              {sections.length} section{sections.length === 1 ? "" : "s"} the team is organised by.
            </p>
          </div>
          <PermissionGate page="staff" action="write">
            <Button variant="secondary" onClick={() => setSectionOpen(true)}>
              <Plus size={14} /> Add section
            </Button>
          </PermissionGate>
        </div>
        <ul className="mt-space-3 flex flex-wrap gap-space-2">
          {sections.map((s) => (
            <li key={s.id} className="rounded-full bg-paper px-space-3 py-1 text-[12.5px] font-semibold text-ink-700">
              {s.name}
            </li>
          ))}
          {sections.length === 0 && <li className="text-[13px] text-ink-400">No sections yet.</li>}
        </ul>
      </Card>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        width="lg"
        title="Add a person"
        description="They sign in with this email and the temporary password."
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy || !form.name.trim() || !form.email.trim() || form.password.length < MIN_PASSWORD}
              onClick={addPerson}
            >
              Add user
            </Button>
          </>
        }
      >
        <div className="grid gap-x-space-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="u_name" required>
            <Input id="u_name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Email" htmlFor="u_email" required>
            <Input id="u_email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Phone" htmlFor="u_phone" hint="Mobile number.">
            <Input id="u_phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field label="Temporary password" htmlFor="u_pw" hint={`At least ${MIN_PASSWORD} characters.`} required>
            <Input id="u_pw" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <Field label="Role" htmlFor="u_role">
            <Select id="u_role" value={form.role || roles[0]} onValueChange={(value) => setForm({ ...form, role: value })}>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Branch" htmlFor="u_branch" hint="“All branches” gives the role everywhere.">
            <Select id="u_branch" value={form.branch_id} onValueChange={(value) => setForm({ ...form, branch_id: value })}>
              <option value="">All branches</option>
              {openBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>

      <Modal
        open={opened !== null}
        onClose={() => setOpenKey(null)}
        width="lg"
        title={opened ? (opened.has_login ? opened.staff.name : opened.roster.name) : ""}
        description={opened?.has_login ? opened.staff.email : "No portal login yet"}
      >
        {opened && !person && !opened.has_login && (
          <div className="space-y-space-3">
            <p className="text-[13px] text-ink-600">
              {opened.roster.department_name}. On the roster, but not able to sign in.
            </p>
            {canManage && (
              <div className="flex flex-wrap gap-space-2">
                <Button
                  onClick={() => {
                    setDialog({ kind: "grant", member: opened.roster });
                    setOpenKey(null);
                  }}
                >
                  <ShieldCheck size={15} /> Give portal access
                </Button>
                <Button
                  variant={opened.roster.is_active ? "destructive" : "secondary"}
                  onClick={() =>
                    run(() => setRosterActive(opened.roster, !opened.roster.is_active), "Couldn't update")
                  }
                >
                  {opened.roster.is_active ? "Deactivate" : "Reactivate"}
                </Button>
              </div>
            )}
          </div>
        )}
        {person && (
          <div className="space-y-space-4">
            <div>
              <h3 className="mb-space-2 text-[14px] font-bold text-ink-900">Access</h3>
              <p className="text-[14px]">
                <strong>{roleLabel(person.role)}</strong>{" "}
                <span className="text-ink-600">
                  — {person.branch_ids.length === 0 ? "All branches" : person.branch_ids.map(branchName).join(", ")}
                </span>
              </p>
              {canManage && (
                <div className="mt-space-3 flex flex-wrap items-end gap-space-2">
                  <Select aria-label="Role" value={newRole} onValueChange={setNewRole} className="w-56">
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {roleLabel(r)}
                      </option>
                    ))}
                  </Select>
                  <Button
                    variant="secondary"
                    disabled={busy || newRole === person.role || person.id === selfId}
                    onClick={() => run(() => changeRole(person, newRole), "Couldn't change the role")}
                  >
                    Change role
                  </Button>
                  <Button variant="secondary" onClick={() => setDialog({ kind: "branches", member: person })}>
                    Branch access…
                  </Button>
                </div>
              )}
              {person.id === selfId && (
                <p className="mt-space-2 text-[12px] text-ink-400">You can&apos;t change your own role.</p>
              )}
            </div>

            <dl className="grid grid-cols-[auto_1fr] gap-x-space-4 gap-y-1 text-[13px]">
              <dt className="text-ink-600">Employee ID</dt>
              <dd className="font-medium">{person.employee_id ?? "—"}</dd>
              <dt className="text-ink-600">Phone</dt>
              <dd className="font-medium">{person.phone ?? "—"}</dd>
              <dt className="text-ink-600">Section</dt>
              <dd className="font-medium">{person.department_name ?? "—"}</dd>
              <dt className="text-ink-600">Reports to</dt>
              <dd className="font-medium">{person.reports_to_name ?? "—"}</dd>
              <dt className="text-ink-600">Shift</dt>
              <dd className="font-medium">
                {person.shift_start && person.shift_end
                  ? `${person.shift_start}–${person.shift_end}${person.working_days.length ? ` · ${person.working_days.join(", ")}` : ""}`
                  : "—"}
              </dd>
              <dt className="text-ink-600">Last sign-in</dt>
              <dd className="font-medium">{person.last_login_at ? formatDateTime(person.last_login_at) : "Never"}</dd>
            </dl>

            <div className="flex flex-wrap gap-space-2">
              {canSeeRoles && (
                <Button variant="secondary" href={`/portal/settings/roles/${person.role}`}>
                  <ShieldCheck size={15} /> Permissions of this role
                </Button>
              )}
              {canManage && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDialog({ kind: "edit", member: person });
                    setOpenKey(null);
                  }}
                >
                  Edit details
                </Button>
              )}
            </div>

            {canManage && (
              <div className="flex flex-wrap items-end justify-between gap-space-3 border-t border-line pt-space-3">
                <div className="flex items-end gap-space-2">
                  <Field label="Reset password" htmlFor="u_reset" className="!mb-0">
                    <Input
                      id="u_reset"
                      type="password"
                      placeholder={`New password (${MIN_PASSWORD}+ characters)`}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-64"
                    />
                  </Field>
                  <Button
                    variant="secondary"
                    disabled={busy || newPassword.length < MIN_PASSWORD}
                    onClick={() => run(() => resetPassword(person, newPassword), "Couldn't reset the password", () => setNewPassword(""))}
                  >
                    <KeyRound size={15} /> Reset
                  </Button>
                </div>
                {person.is_active ? (
                  <Button
                    variant="destructive"
                    disabled={busy || person.id === selfId}
                    onClick={() => setDialog({ kind: "toggle", member: person })}
                  >
                    Disable
                  </Button>
                ) : (
                  <Button
                    disabled={busy}
                    onClick={() => run(() => setActive(person, true), "Couldn't re-enable")}
                  >
                    Re-enable
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {dialog?.kind === "grant" && (
        <StaffFormDialog
          member={null}
          isSelf={false}
          sections={sections}
          managers={managersFor(null)}
          customRoles={customRoles}
          initialValues={{ name: dialog.member.name, department_id: dialog.member.department_id }}
          addTitle="Give portal access"
          onSubmit={(values) => addStaff(values, dialog.member.id)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "edit" && (
        <StaffFormDialog
          member={dialog.member}
          isSelf={dialog.member.id === selfId}
          sections={sections}
          managers={managersFor(dialog.member.id)}
          customRoles={customRoles}
          onSubmit={(values) => editStaff(dialog.member, values)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "branches" && (
        <EditStaffBranchesDialog
          name={dialog.member.name}
          branches={branches}
          initialBranchIds={dialog.member.branch_ids}
          onSubmit={(branchIds) => setStaffBranches(dialog.member, branchIds)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "addRoster" && (
        <PlainModal onClose={() => setDialog(null)} labelledBy="add-roster-title" maxWidthClass="max-w-[400px]">
          <h2 id="add-roster-title" className="mb-space-4 text-[16px] font-semibold text-ink-900">
            Add to roster
          </h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const err = await addRosterMember(rosterName.trim(), rosterDept);
              if (err) return toast.error("Couldn't add to the roster", err);
              setRosterName("");
              setRosterDept("");
              setDialog(null);
            }}
          >
            <PlainField label="Full name" htmlFor="roster-name" required>
              <PlainInput id="roster-name" value={rosterName} onChange={(e) => setRosterName(e.target.value)} autoFocus />
            </PlainField>
            <PlainField label="Section" htmlFor="roster-section" required hint="They can be given a portal login later, any time.">
              <select id="roster-section" className={SELECT_CLASS} value={rosterDept} onChange={(e) => setRosterDept(e.target.value)}>
                <option value="">Choose…</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </PlainField>
            <div className="flex justify-end gap-space-2">
              <Button type="button" variant="ghost" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!rosterName.trim() || !rosterDept}>
                Add to roster
              </Button>
            </div>
          </form>
        </PlainModal>
      )}
      {sectionOpen && (
        <PlainModal onClose={() => setSectionOpen(false)} labelledBy="add-section-title" maxWidthClass="max-w-[380px]">
          <h2 id="add-section-title" className="mb-space-4 text-[16px] font-semibold text-ink-900">
            Add section
          </h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const err = await addSection(sectionName.trim());
              if (err) return toast.error("Couldn't add section", err);
              setSectionName("");
              setSectionOpen(false);
            }}
          >
            <PlainField label="Section name" htmlFor="new-section-name" required>
              <PlainInput
                id="new-section-name"
                placeholder="e.g. Kitchen, Front of House"
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                autoFocus
              />
            </PlainField>
            <div className="mt-space-2 flex justify-end gap-space-2">
              <Button type="button" variant="ghost" onClick={() => setSectionOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!sectionName.trim()}>
                Add section
              </Button>
            </div>
          </form>
        </PlainModal>
      )}
      <ConfirmDialog
        open={dialog?.kind === "toggle"}
        title={dialog?.kind === "toggle" ? `Disable ${dialog.member.name}?` : ""}
        message="They will be signed out immediately and can't sign in again until you re-enable them. Their history stays."
        confirmLabel="Disable"
        destructive
        onCancel={() => setDialog(null)}
        onConfirm={async () => {
          if (dialog?.kind !== "toggle") return;
          const problem = await setActive(dialog.member, false);
          setDialog(null);
          if (problem) toast.error("Couldn't disable", problem);
        }}
      />
    </PortalShell>
  );
}
