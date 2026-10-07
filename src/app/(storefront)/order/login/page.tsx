"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
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
      {
        method: "POST",
        body: JSON.stringify({ phone }),
      },
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
      customer: { phone: string; name: string | null };
    }>("/api/public/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ phone, code, name: name.trim() || undefined }),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    saveCustomerSession(result.data.token, result.data.customer);
    router.push(next);
  }

  return (
    <div className="mx-auto flex max-w-[420px] flex-col items-center px-space-4 py-space-9">
      <div className="mb-space-5 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        {step === "phone" ? <Phone size={22} /> : <ShieldCheck size={22} />}
      </div>
      <h1 className="text-display mb-space-1 text-center text-[20px]">
        {step === "phone" ? "Log in to order" : "Enter the code we sent"}
      </h1>
      <p className="mb-space-6 text-center text-[13px] text-ink-500">
        {step === "phone" ? "We'll text you a one-time code." : `Sent to ${phone}`}
      </p>

      <Card className="w-full p-space-5">
        {step === "phone" ? (
          <form onSubmit={requestOtp}>
            <Field label="Phone number" htmlFor="login-phone" required className="mb-space-4">
              <Input
                id="login-phone"
                type="tel"
                inputMode="numeric"
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoFocus
              />
            </Field>
            {error && <p className="mb-space-3 text-[13px] font-medium text-error">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={busy || !phone.trim()}>
              {busy ? "Sending…" : "Send OTP"}
            </Button>
          </form>
        ) : (
          <form onSubmit={verifyOtp}>
            {mockCode && (
              <div className="mb-space-4 rounded-md border border-brand-200 bg-brand-50 p-space-3 text-center text-[13px] font-semibold text-brand-700">
                Test mode -- your code is <span className="font-mono text-[15px]">{mockCode}</span>
              </div>
            )}
            <Field label="6-digit code" htmlFor="login-code" required className="mb-space-3">
              <Input
                id="login-code"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                autoFocus
              />
            </Field>
            <Field label="Your name (optional)" htmlFor="login-name" className="mb-space-4">
              <Input
                id="login-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="For the restaurant"
              />
            </Field>
            {error && <p className="mb-space-3 text-[13px] font-medium text-error">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={busy || code.length !== 6}>
              {busy ? "Verifying…" : "Verify & continue"}
            </Button>
            <button
              type="button"
              onClick={() => setStep("phone")}
              className="mt-space-3 w-full text-center text-[12.5px] font-semibold text-ink-500 hover:text-ink-700"
            >
              Change phone number
            </button>
          </form>
        )}
      </Card>
    </div>
  );
}
