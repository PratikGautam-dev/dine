"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { ROLE_OPTIONS } from "@/lib/staffRoles";
import type { Section, StaffFormValues, StaffMember } from "@/hooks/useStaffManagement";
import { emptyStaffForm } from "@/hooks/useStaffManagement";

const SELECT_CLASS = "h-10 w-full rounded-md border border-line bg-card px-space-3 text-[13px] text-ink-900";

type Props = {
  /** null = adding someone new; a member = editing them. */
  member: StaffMember | null;
  /** Their own account: role and active state can't be changed from here. */
  isSelf: boolean;
  sections: Section[];
  /** Active teammates the person could report to (already excludes the person being edited). */
  managers: { id: number; name: string }[];
  onSubmit: (values: StaffFormValues) => Promise<string | null>;
  onClose: () => void;
};

/** Add or edit a team member. Email and password are only asked for when adding (a password is reset
 * separately, and the email is their sign-in). The server has the final say on every rule. */
export function StaffFormDialog({ member, isSelf, sections, managers, onSubmit, onClose }: Props) {
  const [form, setForm] = useState<StaffFormValues>(
    member
      ? {
          ...emptyStaffForm(), name: member.name, role: member.role, phone: member.phone ?? "",
          address: member.address ?? "", department_id: member.department_id ?? "",
          reports_to_id: member.reports_to_id ? String(member.reports_to_id) : "",
        }
      : emptyStaffForm(),
  );
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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-space-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="staff-form-title"
        className="my-auto w-full max-w-[560px] rounded-lg bg-card p-space-5 shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="staff-form-title" className="text-[16px] font-semibold text-ink-900">
          {adding ? "Add staff member" : `Edit ${member.name}`}
        </h2>
        <form onSubmit={handleSubmit} className="mt-space-4">
          <div className="grid grid-cols-1 gap-x-space-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="sf-name" required className="sm:col-span-2">
              <Input id="sf-name" value={form.name} onChange={(e) => set({ name: e.target.value })} required />
            </Field>
            {adding && (
              <>
                <Field label="Email (their sign-in)" htmlFor="sf-email" required>
                  <Input id="sf-email" type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} required />
                </Field>
                <Field label="Password" htmlFor="sf-password" required hint="At least 8 characters. They can be given a new one later.">
                  <Input id="sf-password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => set({ password: e.target.value })} required minLength={8} />
                </Field>
              </>
            )}
            <Field label="Role" htmlFor="sf-role" hint={isSelf ? "You can't change your own role." : blurb} className="sm:col-span-2">
              <select id="sf-role" className={SELECT_CLASS} value={form.role} disabled={isSelf} onChange={(e) => set({ role: e.target.value as StaffFormValues["role"] })}>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Phone" htmlFor="sf-phone">
              <Input id="sf-phone" inputMode="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
            </Field>
            <Field label="Section" htmlFor="sf-section" hint={sections.length === 0 ? "No sections set up yet." : undefined}>
              <select id="sf-section" className={SELECT_CLASS} value={form.department_id} onChange={(e) => set({ department_id: e.target.value })}>
                <option value="">— None —</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Reports to" htmlFor="sf-manager" className="sm:col-span-2">
              <select id="sf-manager" className={SELECT_CLASS} value={form.reports_to_id} onChange={(e) => set({ reports_to_id: e.target.value })}>
                <option value="">— Nobody —</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Address" htmlFor="sf-address" className="sm:col-span-2">
              <Textarea id="sf-address" rows={2} value={form.address} onChange={(e) => set({ address: e.target.value })} />
            </Field>
          </div>
          {error && <p role="alert" className="mb-space-3 text-[12.5px] font-medium text-error">{error}</p>}
          <div className="flex justify-end gap-space-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || !form.name.trim() || (adding && (!form.email.trim() || form.password.length < 8))}>
              {saving ? "Saving…" : adding ? "Add staff member" : "Save changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
