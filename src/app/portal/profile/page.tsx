"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, Pencil, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { PortalShell } from "@/components/portal/PortalShell";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { clearPortalSession } from "@/lib/portalAuth";
import {
  getStaffAccessToken,
  getStaffRefreshToken,
  getStaffSession,
  saveStaffSession,
  staffFetch,
} from "@/lib/staffAuth";
import { roleLabel } from "@/lib/staffRoles";
import { toast } from "@/lib/toast";

type Me = {
  id: number;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  employee_id: string | null;
  workspace: string;
};

const MIN_PASSWORD = 10;

function PasswordInput({ id, value, onChange, autoComplete }: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={shown ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-10"
        required
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-label={shown ? "Hide password" : "Show password"}
        className="absolute top-1/2 right-3 -translate-y-1/2 text-ink-400 hover:text-ink-700"
      >
        {shown ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function EditProfileDialog({ me, onClose, onSaved }: { me: Me; onClose: () => void; onSaved: (m: Me) => void }) {
  const [name, setName] = useState(me.name);
  const [phone, setPhone] = useState(me.phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await staffFetch("/api/portal/staff/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.unauthorized ? "Your session has ended. Please sign in again." : res.error);
      return;
    }
    onSaved(res.data as Me);
    onClose();
  }

  return (
    <Modal onClose={onClose} labelledBy="edit-profile-title" maxWidthClass="max-w-[440px]">
      <h2 id="edit-profile-title" className="text-[16px] font-semibold text-ink-900">
        Edit profile
      </h2>
      <form onSubmit={submit} className="mt-space-4">
        <Field label="Name" htmlFor="pf-name" required>
          <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
        </Field>
        <Field label="Phone" htmlFor="pf-phone">
          <Input id="pf-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
        </Field>
        <p className="mb-space-3 text-[12.5px] text-ink-600">
          Your email and role are managed by an Owner / Manager.
        </p>
        {error && (
          <p role="alert" className="mb-space-3 text-[12.5px] font-medium text-error">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-space-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function ProfilePage() {
  const { restaurant, ready } = usePortalGuard();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await staffFetch("/api/portal/staff/me");
    if (res.ok) setMe(res.data as Me);
    else setLoadError(res.unauthorized ? "Your session has ended. Please sign in again." : res.error);
  }, []);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  // keep the name shown in the header menu in step with an edit
  function onSaved(updated: Me) {
    setMe(updated);
    const session = getStaffSession();
    const access = getStaffAccessToken();
    const refresh = getStaffRefreshToken();
    if (session && access && refresh) saveStaffSession(access, refresh, { ...session, name: updated.name });
    toast.success("Profile updated.");
  }

  const mismatch = confirm !== "" && confirm !== next;
  const canChange = current !== "" && next.length >= MIN_PASSWORD && next === confirm && !pwSaving;

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwSaving(true);
    setPwError(null);
    const res = await staffFetch("/api/portal/staff/me/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current_password: current, new_password: next }),
    });
    setPwSaving(false);
    if (!res.ok) {
      setPwError(res.unauthorized ? "Your session has ended. Please sign in again." : res.error);
      return;
    }
    // every session, this one included, has just been ended
    toast.success("Password changed. Please sign in again.");
    clearPortalSession();
    router.push("/portal/login");
  }

  return (
    <PortalShell restaurant={restaurant} active="profile">
      <PageHeader
        title="Profile"
        description="Your account details and password."
        icon={<UserRound size={20} />}
      />
      <div className="grid gap-space-5 lg:grid-cols-2">
        <Card className="p-space-5">
          {!me ? (
            <p className="text-[13px] text-ink-600">{loadError ?? "Loading…"}</p>
          ) : (
            <>
              <div className="flex items-center gap-space-3 border-b border-line pb-space-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[16px] font-bold text-brand-700">
                  {(me.name.trim()[0] || "?").toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold text-ink-900">{me.name}</p>
                  <p className="text-[13px] text-ink-600">{roleLabel(me.role as never)}</p>
                </div>
                <Button variant="secondary" className="ml-auto" onClick={() => setEditing(true)}>
                  <Pencil size={14} /> Edit profile
                </Button>
              </div>
              <dl className="mt-space-2 divide-y divide-line text-[14px]">
                {[
                  ["Email", me.email],
                  ["Phone", me.phone || "—"],
                  ["Workspace", me.workspace],
                  ["Display ID", me.employee_id || "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-space-3 py-space-3">
                    <dt className="text-ink-600">{k}</dt>
                    <dd className="min-w-0 truncate font-medium text-ink-900">{v}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </Card>

        <Card className="p-space-5">
          <h2 className="mb-space-4 flex items-center gap-space-2 text-[15px] font-semibold text-ink-900">
            <KeyRound size={16} /> Change password
          </h2>
          <form onSubmit={changePassword}>
            <Field label="Current password" htmlFor="pw-current" required>
              <PasswordInput id="pw-current" value={current} onChange={setCurrent} autoComplete="current-password" />
            </Field>
            <Field label="New password" htmlFor="pw-new" required hint={`At least ${MIN_PASSWORD} characters.`}>
              <PasswordInput id="pw-new" value={next} onChange={setNext} autoComplete="new-password" />
            </Field>
            <Field
              label="Confirm new password"
              htmlFor="pw-confirm"
              required
              error={mismatch ? "The two passwords don't match." : undefined}
            >
              <PasswordInput id="pw-confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" />
            </Field>
            <p className="mb-space-3 text-[13px] text-ink-600">Changing your password signs you out on all devices.</p>
            {pwError && (
              <p role="alert" className="mb-space-3 text-[12.5px] font-medium text-error">
                {pwError}
              </p>
            )}
            <Button type="submit" disabled={!canChange}>
              {pwSaving ? "Changing…" : "Change password"}
            </Button>
          </form>
        </Card>
      </div>
      {editing && me && <EditProfileDialog me={me} onClose={() => setEditing(false)} onSaved={onSaved} />}
    </PortalShell>
  );
}
