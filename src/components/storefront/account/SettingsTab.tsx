"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { clearCustomerSession } from "@/lib/customerAuth";
import { Card } from "./Card";
import { EMAIL_PATTERN, isValidPhone, type Profile } from "@/lib/account";

interface SettingsTabProps {
  profile: Profile;
  onSave: (profile: Profile) => void;
}

const inputClass =
  "w-full h-11 px-4 rounded-lg bg-sf-surface-container-low text-sf-on-surface font-sf-body text-sm placeholder:text-sf-text-muted focus:bg-sf-surface focus:outline-none focus:ring-2 focus:ring-sf-primary aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-sf-error transition-all";

export function SettingsTab({ profile, onSave }: SettingsTabProps) {
  const router = useRouter();
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [email, setEmail] = useState(profile.email);
  const [touched, setTouched] = useState(false);

  const nameValid = name.trim().length > 0;
  const phoneValid = isValidPhone(phone);
  const emailValid = EMAIL_PATTERN.test(email);
  const dirty = name !== profile.name || phone !== profile.phone || email !== profile.email;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!nameValid || !phoneValid || !emailValid) return;
    onSave({ ...profile, name: name.trim(), phone, email: email.trim() });
    toast.success("Profile updated");
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
            aria-invalid={touched && !nameValid}
            className={inputClass}
          />
          {touched && !nameValid && <p className="font-sf-body text-xs text-sf-error mt-1">Enter your name.</p>}
        </div>
        <div>
          <label htmlFor="settings-phone" className="block font-sf-body text-xs font-semibold text-sf-on-surface mb-1">
            Mobile number
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-sf-body text-sm text-sf-text-muted pointer-events-none">
              +91
            </span>
            <input
              id="settings-phone"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              autoComplete="tel-national"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              aria-invalid={touched && !phoneValid}
              className={`${inputClass} pl-12`}
            />
          </div>
          {touched && !phoneValid && (
            <p className="font-sf-body text-xs text-sf-error mt-1">Enter a valid 10-digit number.</p>
          )}
        </div>
        <div>
          <label htmlFor="settings-email" className="block font-sf-body text-xs font-semibold text-sf-on-surface mb-1">
            Email
          </label>
          <input
            id="settings-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={touched && !emailValid}
            className={inputClass}
          />
          {touched && !emailValid && <p className="font-sf-body text-xs text-sf-error mt-1">Enter a valid email address.</p>}
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
              disabled={!dirty}
              onClick={() => {
                setName(profile.name);
                setPhone(profile.phone);
                setEmail(profile.email);
                setTouched(false);
              }}
              className="px-4 h-10 rounded-lg font-sf-body text-sm font-semibold text-sf-text-body hover:bg-sf-surface-container-high transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={!dirty}
              className="px-5 h-10 rounded-lg bg-sf-primary hover:bg-sf-secondary text-sf-on-primary font-sf-body text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Save changes
            </button>
          </div>
        </div>
      </form>
    </Card>
  );
}
