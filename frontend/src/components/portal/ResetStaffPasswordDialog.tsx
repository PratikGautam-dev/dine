"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

type Props = {
  name: string;
  onSubmit: (newPassword: string) => Promise<string | null>;
  onClose: () => void;
};

/** Sets a new password for a team member. Ends every session they have, so they must sign in again. */
export function ResetStaffPasswordDialog({ name, onSubmit, onClose }: Props) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const mismatch = confirm !== "" && confirm !== password;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setSaving(true);
    setError(null);
    const problem = await onSubmit(password);
    setSaving(false);
    if (problem) setError(problem);
    else onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-space-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reset-pw-title"
        className="w-full max-w-[440px] rounded-lg bg-card p-space-5 shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="reset-pw-title" className="text-[16px] font-semibold text-ink-900">Reset password for {name}</h2>
        <p className="mt-space-2 text-[13px] text-ink-600">They will be signed out everywhere and need this new password to get back in.</p>
        <form onSubmit={handleSubmit} className="mt-space-4">
          <Field label="New password" htmlFor="rp-new" required hint="At least 8 characters.">
            <Input id="rp-new" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
          </Field>
          <Field label="Confirm new password" htmlFor="rp-confirm" required error={mismatch ? "The two passwords don't match." : undefined}>
            <Input id="rp-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
          </Field>
          {error && <p role="alert" className="mb-space-3 text-[12.5px] font-medium text-error">{error}</p>}
          <div className="flex justify-end gap-space-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving || password.length < 8 || password !== confirm}>{saving ? "Saving…" : "Reset password"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
