"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clearCustomerSession } from "@/lib/customerAuth";
import { Card } from "./Card";
import type { RealProfile } from "@/lib/useAccountProfile";

interface SettingsTabProps {
  profile: RealProfile;
  saving: boolean;
  onSave: (fields: { name?: string; date_of_birth?: string; email?: string }) => Promise<boolean>;
}

const inputClass =
  "w-full h-11 px-4 rounded-lg bg-sf-surface-container-low text-sf-on-surface font-sf-body text-sm placeholder:text-sf-text-muted focus:bg-sf-surface focus:outline-none focus:ring-2 focus:ring-sf-primary disabled:opacity-60 disabled:cursor-not-allowed transition-all";

export function SettingsTab({ profile, saving, onSave }: SettingsTabProps) {
  const router = useRouter();
  const [name, setName] = useState(profile.name ?? "");
  const [dob, setDob] = useState(profile.date_of_birth ?? "");
  const [email, setEmail] = useState(profile.email ?? "");

  const dirty = name !== (profile.name ?? "") || dob !== (profile.date_of_birth ?? "") || email !== (profile.email ?? "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ name: name.trim(), date_of_birth: dob || undefined, email: email.trim() });
  };

  function handleLogout() {
    clearCustomerSession();
    router.push("/order");
  }

  return (
    <Card className="p-6">
      <h3 className="font-sf-headline text-xl font-semibold text-sf-on-surface">Profile Settings</h3>
      <p className="font-sf-body text-xs text-sf-text-muted mt-0.5 mb-5">Keep your contact details up to date.</p>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4" noValidate>
        <div className="sm:col-span-2">
          <label htmlFor="settings-name" className="block font-sf-body text-xs font-semibold text-sf-on-surface mb-1">
            Full name
          </label>
          <input
            id="settings-name"
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="settings-phone" className="block font-sf-body text-xs font-semibold text-sf-on-surface mb-1">
            Mobile number
          </label>
          <input
            id="settings-phone"
            type="tel"
            value={profile.phone ? `+${profile.phone}` : ""}
            disabled
            className={inputClass}
          />
          <p className="font-sf-body text-xs text-sf-text-muted mt-1">
            Your mobile number is how you log in and can&apos;t be changed here.
          </p>
        </div>
        <div>
          <label htmlFor="settings-dob" className="block font-sf-body text-xs font-semibold text-sf-on-surface mb-1">
            Date of birth
          </label>
          <input
            id="settings-dob"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="settings-email" className="block font-sf-body text-xs font-semibold text-sf-on-surface mb-1">
            Email
          </label>
          <input
            id="settings-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2 flex items-center justify-between gap-2 pt-2">
          <button
            type="button"
            onClick={handleLogout}
            className="px-4 h-10 rounded-lg font-sf-body text-sm font-semibold text-sf-error hover:bg-sf-surface-container-low transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            Log out
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={() => {
                setName(profile.name ?? "");
                setDob(profile.date_of_birth ?? "");
                setEmail(profile.email ?? "");
              }}
              className="px-4 h-10 rounded-lg font-sf-body text-sm font-semibold text-sf-text-body hover:bg-sf-surface-container-high transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={!dirty || saving}
              className="px-5 h-10 rounded-lg bg-sf-primary hover:bg-sf-secondary text-sf-on-primary font-sf-body text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </Card>
  );
}
