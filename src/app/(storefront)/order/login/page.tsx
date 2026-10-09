"use client";

// Re-skinned onto the "Daap Dine" (dine-client) visual language -- dine-client has no login UI
// of its own at all (no auth exists there), so there is nothing to port here; this flow was
// already fully real (OTP request/verify, saveCustomerSession) and keeps that logic identical,
// only the JSX/classes changed to sf-* tokens + Material Symbols.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { publicFetch, saveCustomerSession } from "@/lib/customerAuth";

// Reads the redirect target directly off window.location.search instead of
// next/navigation's useSearchParams(), which requires a <Suspense> boundary
// to statically prerender -- this codebase already hit that exact build
// break once (the portal's role-filter deep link) and fixed it the same way.
export default function CustomerLoginPage() {
  const router = useRouter();
  const [next, setNext] = useState("/order");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [mockCode, setMockCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const n = new URLSearchParams(window.location.search).get("next");
    if (n) setNext(n);
  }, []);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await publicFetch<{ sent: boolean; mock_code?: string }>(
      "/api/public/auth/otp/request",
      { method: "POST", body: JSON.stringify({ phone }) },
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMockCode(result.data.mock_code || null);
    setStep("code");
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = await publicFetch<{
      token: string;
      customer: { phone: string; name: string | null; date_of_birth: string | null; email: string | null };
    }>(
      "/api/public/auth/otp/verify",
      {
        method: "POST",
        body: JSON.stringify({
          phone, code, name: name.trim() || undefined,
          date_of_birth: dob || undefined, email: email.trim() || undefined,
        }),
      },
    );
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    saveCustomerSession(result.data.token, result.data.customer);
    router.push(next);
  }

  return (
    <div className="mx-auto flex max-w-[420px] flex-col items-center px-4 py-12">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-sf-primary-light text-sf-primary">
        <span className="material-symbols-outlined text-[26px]">
          {step === "phone" ? "call" : "verified_user"}
        </span>
      </div>
      <h1 className="font-sf-headline mb-1 text-center text-[22px] font-extrabold text-sf-on-surface">
        {step === "phone" ? "Log in to order" : "Enter the code we sent"}
      </h1>
      <p className="mb-6 text-center font-sf-body text-[13px] text-sf-text-muted">
        {step === "phone" ? "We'll text you a one-time code." : `Sent to ${phone}`}
      </p>

      <div className="w-full rounded-2xl border border-sf-border-divider bg-sf-surface p-6 shadow-sm">
        {step === "phone" ? (
          <form onSubmit={requestOtp}>
            <label htmlFor="login-phone" className="mb-1.5 block font-sf-body text-[12.5px] font-bold text-sf-on-surface">
              Phone number
            </label>
            <input
              id="login-phone"
              type="tel"
              inputMode="numeric"
              placeholder="98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoFocus
              className="mb-4 h-12 w-full rounded-xl border border-sf-border-divider bg-sf-surface px-4 font-sf-body text-[14px] text-sf-on-surface placeholder:text-sf-text-muted focus:border-sf-primary focus:outline-none"
            />
            {error && <p className="mb-3 font-sf-body text-[13px] font-medium text-sf-error">{error}</p>}
            <button
              type="submit"
              disabled={busy || !phone.trim()}
              className="w-full rounded-xl bg-sf-primary py-3.5 font-sf-body text-sm font-bold text-sf-on-primary shadow-md transition-colors hover:bg-sf-secondary disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send OTP"}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOtp}>
            {mockCode && (
              <div className="mb-4 rounded-xl border border-sf-primary/30 bg-sf-primary-light p-3 text-center font-sf-body text-[13px] font-semibold text-sf-primary">
                Test mode — your code is <span className="font-mono text-[15px]">{mockCode}</span>
              </div>
            )}
            <label htmlFor="login-code" className="mb-1.5 block font-sf-body text-[12.5px] font-bold text-sf-on-surface">
              6-digit code
            </label>
            <input
              id="login-code"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              autoFocus
              className="mb-3 h-12 w-full rounded-xl border border-sf-border-divider bg-sf-surface px-4 font-sf-body text-[14px] tracking-[0.3em] text-sf-on-surface placeholder:text-sf-text-muted focus:border-sf-primary focus:outline-none"
            />
            <label htmlFor="login-name" className="mb-1.5 block font-sf-body text-[12.5px] font-bold text-sf-on-surface">
              Your name (optional)
            </label>
            <input
              id="login-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="For the restaurant"
              className="mb-4 h-12 w-full rounded-xl border border-sf-border-divider bg-sf-surface px-4 font-sf-body text-[14px] text-sf-on-surface placeholder:text-sf-text-muted focus:border-sf-primary focus:outline-none"
            />
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="login-dob" className="mb-1.5 block font-sf-body text-[12.5px] font-bold text-sf-on-surface">
                  Date of birth (optional)
                </label>
                <input
                  id="login-dob"
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className="h-12 w-full rounded-xl border border-sf-border-divider bg-sf-surface px-3 font-sf-body text-[14px] text-sf-on-surface focus:border-sf-primary focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="login-email" className="mb-1.5 block font-sf-body text-[12.5px] font-bold text-sf-on-surface">
                  Email (optional)
                </label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="h-12 w-full rounded-xl border border-sf-border-divider bg-sf-surface px-3 font-sf-body text-[14px] text-sf-on-surface placeholder:text-sf-text-muted focus:border-sf-primary focus:outline-none"
                />
              </div>
            </div>
            {error && <p className="mb-3 font-sf-body text-[13px] font-medium text-sf-error">{error}</p>}
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="w-full rounded-xl bg-sf-primary py-3.5 font-sf-body text-sm font-bold text-sf-on-primary shadow-md transition-colors hover:bg-sf-secondary disabled:opacity-50"
            >
              {busy ? "Verifying…" : "Verify & continue"}
            </button>
            <button
              type="button"
              onClick={() => setStep("phone")}
              className="mt-3 w-full text-center font-sf-body text-[12.5px] font-semibold text-sf-text-muted hover:text-sf-on-surface"
            >
              Change phone number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
