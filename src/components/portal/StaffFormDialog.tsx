"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { WorkPatternSection } from "@/components/portal/WorkPatternSection";
import { useBranches } from "@/hooks/erp/useBranches";
import { roleLabel, ROLE_OPTIONS } from "@/lib/staffRoles";
import type { StaffFormValues, StaffMember } from "@/hooks/useStaffManagement";
import { emptyStaffForm } from "@/hooks/useStaffManagement";
import { Select } from "@/components/erp-ui/Select";

type Props = {
  /** null = adding someone new; a member = editing them. */
  member: StaffMember | null;
  /** Their own account: role and active state can't be changed from here. */
  isSelf: boolean;
  /** Active teammates the person could report to (already excludes the person being edited). */
  managers: { id: string; name: string }[];
  /** Restaurant-created custom role_keys (Staff & Access's "Add Role") beyond the 3 built-in
   * ROLE_OPTIONS -- shown with a computed label (roleLabel()), no blurb. */
  customRoles?: string[];
  /** "Give portal access" on a roster-only person: pre-fills the add form (name) without
   * treating this as an edit -- `member` stays null so email/password are still asked for. Ignored
   * when `member` is set. */
  initialValues?: Partial<StaffFormValues>;
  /** Overrides the dialog's title/submit button when adding (e.g. "Give portal access" instead of
   * "Add staff member") -- ignored when editing. */
  addTitle?: string;
  onSubmit: (values: StaffFormValues) => Promise<string | null>;
  onClose: () => void;
};

/** Add or edit a team member. Email and password are only asked for when adding (a password is reset
 * separately, and the email is their sign-in). The server has the final say on every rule. */
export function StaffFormDialog({
  member,
  isSelf,
  managers,
  customRoles = [],
  initialValues,
  addTitle,
  onSubmit,
  onClose,
}: Props) {
  const [form, setForm] = useState<StaffFormValues>(
    member
      ? {
          ...emptyStaffForm(),
          name: member.name,
          role: member.role,
          phone: member.phone ?? "",
          address: member.address ?? "",
          reports_to_id: member.reports_to_id ? String(member.reports_to_id) : "",
          working_days: member.working_days ?? [],
          shift_start: member.shift_start ?? "",
          shift_end: member.shift_end ?? "",
        }
      : { ...emptyStaffForm(), ...initialValues },
  );
  const { data: branches } = useBranches();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<StaffFormValues>) => setForm((f) => ({ ...f, ...patch }));
  const adding = member === null;
  const blurb = ROLE_OPTIONS.find((r) => r.value === form.role)?.blurb;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const problem = await onSubmit(form);
    setSaving(false);
    if (problem) setError(problem);
    else onClose();
  }

  return (
    <Modal onClose={onClose} labelledBy="staff-form-title" maxWidthClass="max-w-[560px]">
      <h2 id="staff-form-title" className="text-[16px] font-semibold text-ink-900">
        {adding ? (addTitle ?? "Add staff member") : `Edit ${member.name}`}
      </h2>
      <form onSubmit={handleSubmit} className="mt-space-4">
        <div className="grid grid-cols-1 gap-x-space-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="sf-name" required className="sm:col-span-2">
            <Input
              id="sf-name"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
              required
            />
          </Field>
          {adding && (
            <>
              <Field label="Email (their sign-in)" htmlFor="sf-email" required>
                <Input
                  id="sf-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => set({ email: e.target.value })}
                  required
                />
              </Field>
              <Field
                label="Password"
                htmlFor="sf-password"
                required
                hint="At least 8 characters. They can be given a new one later."
              >
                <Input
                  id="sf-password"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => set({ password: e.target.value })}
                  required
                  minLength={8}
                />
              </Field>
            </>
          )}
          <Field
            label="Role"
            htmlFor="sf-role"
            hint={isSelf ? "You can't change your own role." : blurb}
            className="sm:col-span-2"
          >
            <Select
              value={form.role}
              onValueChange={(v) => set({ role: v })}
              disabled={isSelf}
              id="sf-role"
            >
              {ROLE_OPTIONS.filter((r) => r.value !== "admin" || member?.role === "admin").map(
                (r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ),
              )}
              {customRoles.map((key) => (
                <option key={key} value={key}>
                  {roleLabel(key)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Phone" htmlFor="sf-phone">
            <Input
              id="sf-phone"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => set({ phone: e.target.value })}
            />
          </Field>
          <Field label="Reports to" htmlFor="sf-manager" className="sm:col-span-2">
            <Select
              value={form.reports_to_id}
              onValueChange={(v) => set({ reports_to_id: v })}
              id="sf-manager"
            >
              <option value="">— Nobody —</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          {member && (
            <div className="mb-space-4 sm:col-span-2">
              <WorkPatternSection userId={String(member.id)} branches={branches} />
            </div>
          )}
          <Field label="Address" htmlFor="sf-address" className="sm:col-span-2">
            <Textarea
              id="sf-address"
              rows={2}
              value={form.address}
              onChange={(e) => set({ address: e.target.value })}
            />
          </Field>
        </div>
        {error && (
          <p role="alert" className="mb-space-3 text-[12.5px] font-medium text-error">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-space-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              saving ||
              !form.name.trim() ||
              (adding && (!form.email.trim() || form.password.length < 8))
            }
          >
            {saving ? "Saving…" : adding ? (addTitle ?? "Add staff member") : "Save changes"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
