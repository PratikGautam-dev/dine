"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { GoogleIcon } from "@/components/ui/GoogleIcon";
import { Input } from "@/components/ui/Input";
import { saveStaffSession } from "@/lib/staffAuth";
import { googleLoginUrl } from "@/lib/userAuth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export default function PortalLoginPage() {
  const router = useRouter();

  const [staffEmail, setStaffEmail] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffSubmitting, setStaffSubmitting] = useState(false);

  async function handleStaffSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStaffSubmitting(true);
    setStaffError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/portal/staff/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: staffEmail, password: staffPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStaffError(data.error || "Incorrect email or password.");
        return;
      }
      saveStaffSession(data.access_token, data.refresh_token, {
        id: data.staff.id,
        name: data.staff.name,
        role: data.staff.role,
        restaurant: data.staff.restaurant,
        permissions: data.permissions,
      });
      // Every role (including doctor) lands in the same shared portal now --
      // what they see there is driven by the RBAC permission matrix, not by
      // which door they logged in through.
      router.push("/portal/dashboard");
    } catch {
      setStaffError("Couldn't reach the server. Please try again.");
    } finally {
      setStaffSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-card lg:grid lg:grid-cols-2">
      <aside className="relative hidden min-h-screen overflow-hidden bg-brand-50 p-space-8 lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-24 size-80 rounded-full bg-brand-100/80"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -right-20 size-96 rounded-full bg-clay-100/70"
        />

        <Image
          src="/logo.png"
          alt="DAAP DineConnect — Better Dining. Stronger Connection."
          width={270}
          height={84}
          priority
          className="relative h-auto w-[270px]"
        />

        <div className="relative mx-auto flex w-full max-w-[500px] flex-1 items-center justify-center py-space-6">
          <svg
            viewBox="0 0 520 390"
            role="img"
            aria-label="Illustration of a welcoming restaurant"
            className="w-full drop-shadow-sm"
          >
            <ellipse cx="260" cy="344" rx="205" ry="20" fill="#d9dfd1" />
            <circle cx="260" cy="190" r="155" fill="#e4eadd" />
            <rect
              x="127"
              y="154"
              width="266"
              height="180"
              rx="12"
              fill="#fff"
              stroke="#9eae98"
              strokeWidth="5"
            />
            <path d="M111 159h298l-24-61H135z" fill="#b30d18" />
            <path
              d="M111 159h298v18a18 18 0 0 1-36 0 18 18 0 0 1-36 0 18 18 0 0 1-36 0 18 18 0 0 1-36 0 18 18 0 0 1-36 0 18 18 0 0 1-36 0 18 18 0 0 1-36 0z"
              fill="#870a12"
            />
            <rect
              x="157"
              y="195"
              width="205"
              height="91"
              rx="5"
              fill="#f4efe9"
              stroke="#c9b9a9"
              strokeWidth="4"
            />
            <path d="M158 241h204M209 196v90m52-90v90m51-90v90" stroke="#c9b9a9" strokeWidth="4" />
            <rect x="207" y="211" width="23" height="22" rx="4" fill="#adb88b" />
            <rect x="240" y="217" width="23" height="16" rx="4" fill="#e5a076" />
            <rect x="274" y="205" width="23" height="28" rx="4" fill="#6b7a4f" />
            <rect x="307" y="212" width="34" height="21" rx="4" fill="#b9c6a7" />
            <circle cx="190" cy="263" r="11" fill="#d7835b" />
            <rect x="223" y="252" width="24" height="22" rx="4" fill="#adb88b" />
            <rect x="262" y="256" width="23" height="18" rx="4" fill="#6b7a4f" />
            <rect x="300" y="248" width="35" height="26" rx="4" fill="#e5a076" />
            <rect x="157" y="294" width="205" height="40" rx="4" fill="#3e4939" />
            <rect x="382" y="186" width="50" height="123" rx="13" fill="#2a211c" />
            <rect x="388" y="195" width="38" height="104" rx="8" fill="#fbf6f1" />
            <rect x="394" y="203" width="26" height="8" rx="4" fill="#6b7a4f" />
            <rect x="394" y="220" width="11" height="19" rx="3" fill="#adb88b" />
            <rect x="409" y="220" width="11" height="19" rx="3" fill="#e5a076" />
            <rect x="394" y="245" width="11" height="19" rx="3" fill="#e5a076" />
            <rect x="409" y="245" width="11" height="19" rx="3" fill="#adb88b" />
            <rect x="394" y="273" width="26" height="9" rx="4" fill="#b30d18" />
            <path d="M238 95V56m44 39V45" stroke="#9c9086" strokeWidth="4" />
            <path d="M221 56a17 17 0 0 1 34 0zm44-11a17 17 0 0 1 34 0z" fill="#d7835b" />
            <rect x="58" y="175" width="95" height="48" rx="20" fill="#b30d18" />
            <path d="M86 221l-5 19 25-17" fill="#b30d18" />
            <path d="M78 191h40m-40 13h27" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
            <circle cx="119" cy="83" r="8" fill="#d7835b" />
            <circle cx="402" cy="123" r="9" fill="#6b7a4f" />
          </svg>
        </div>

        <div className="relative max-w-lg">
          <h2 className="text-[28px] font-semibold leading-tight tracking-tight text-ink-900">
            Welcome back
          </h2>
          <p className="mt-space-2 text-[16px] leading-relaxed text-ink-600">
            Pick up where you left off: today&apos;s orders, guests and sales are waiting.
          </p>
        </div>
      </aside>

      <main className="flex min-h-screen flex-col px-space-4 py-space-6 sm:px-space-6 lg:px-space-8">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md">
            <Image
              src="/logo.png"
              alt="DAAP DineConnect — Better Dining. Stronger Connection."
              width={240}
              height={75}
              priority
              className="mb-space-6 h-auto w-[220px] lg:hidden"
            />
            <h1 className="text-display mb-space-1 !text-[26px]">Staff sign in</h1>
            <p className="text-body mb-space-5">Use your individual DineConnect login.</p>

            <a
              href={googleLoginUrl()}
              className="inline-flex h-12 w-full items-center justify-center gap-space-3 rounded-md border border-line bg-card text-[15px] font-semibold text-ink-900 shadow-[var(--shadow-sm)] transition-colors duration-150 hover:border-brand-300 hover:bg-brand-50 active:bg-brand-100"
            >
              <GoogleIcon size={20} />
              Continue with Google
            </a>

            <div className="my-space-5 flex items-center gap-space-3 text-[12px] font-medium text-ink-400">
              <span className="h-px flex-1 bg-line" />
              or
              <span className="h-px flex-1 bg-line" />
            </div>

            <form onSubmit={handleStaffSubmit}>
              <Field label="Email" htmlFor="staff_email">
                <Input
                  id="staff_email"
                  type="email"
                  autoFocus
                  autoComplete="username"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                />
              </Field>
              <Field label="Password" htmlFor="staff_password" error={staffError || undefined}>
                <Input
                  id="staff_password"
                  type="password"
                  autoComplete="current-password"
                  value={staffPassword}
                  invalid={!!staffError}
                  onChange={(e) => setStaffPassword(e.target.value)}
                />
              </Field>
              <Button
                type="submit"
                disabled={staffSubmitting || !staffEmail || !staffPassword}
                className="mt-space-2 w-full"
                size="lg"
              >
                {staffSubmitting ? "Signing in…" : "Sign in"}
              </Button>
            </form>

            <p className="mt-space-5 text-center text-[12.5px] text-ink-400">
              Don&apos;t have a restaurant account yet?{" "}
              <a href="/auth" className="font-semibold text-brand-700 hover:underline">
                Set one up
              </a>
            </p>
          </div>
        </div>
        <footer className="mt-space-6 flex items-center justify-center text-[12px] text-ink-400">
          © {new Date().getFullYear()} DAAP DineConnect
        </footer>
      </main>
    </div>
  );
}
