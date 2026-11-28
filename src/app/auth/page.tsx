"use client";

import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type DaapSignIn = { enabled: boolean; signup_url: string | null; account_url: string | null };

// erp-dine-backend daap/sign_in.py's refusals (?daap_error=...), in the owner's words.
const DAAP_ERRORS: Record<string, string> = {
  cancelled: "Sign-in with DAAP was cancelled.",
  expired: "That sign-in took too long. Please try again.",
  failed: "Something went wrong signing in with DAAP. Please try again.",
  unavailable: "DAAP sign-in isn't available right now. Please try again in a few minutes.",
  not_activated:
    "Your DAAP account hasn't activated Dine Connect yet. Finish setting it up in DAAP Account.",
  no_business:
    "This DAAP account doesn't have Dine Connect. Set up your restaurant in DAAP Account first.",
  removed: "Dine Connect was removed from this DAAP account. Contact DAAP support.",
  needs_link:
    "Your email already has a Dine login. Contact DAAP support to connect it to your DAAP account.",
  disabled: "This login is switched off. Contact your restaurant's owner or DAAP support.",
};

/** Whether "Sign in with DAAP" is set up on this Dine. undefined while asking; null when the API couldn't say. */
function useDaapSignIn(): DaapSignIn | null | undefined {
  const [state, setState] = useState<DaapSignIn | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/api/auth/daap/status`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && setState(d))
      .catch(() => !cancelled && setState(null));
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

/** Restaurant owners' way in: their DAAP account (erp-dine-backend daap/sign_in.py). New restaurants are set up in DAAP Account, never
 * here; staff use their own Dine login (/portal/login). */
function AuthContent() {
  const params = useSearchParams();
  const daapError = params.get("daap_error");
  const daap = useDaapSignIn();

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-space-4">
      <Card className="w-full max-w-sm p-space-6">
        <div className="mb-space-5">
          <Image
            src="/logo.png"
            alt="DAAP DineConnect — Better Dining. Stronger Connection."
            width={240}
            height={75}
            priority
            className="h-auto w-[240px]"
          />
        </div>

        <h1 className="text-display mb-space-1 !text-[22px]">Sign in</h1>
        <p className="text-body mb-space-5">
          Restaurant owners sign in with their DAAP account. Staff use their own login.
        </p>

        {daapError && (
          <p className="mb-space-4 rounded-md bg-error-tint p-space-3 text-[13px] font-medium text-error">
            {DAAP_ERRORS[daapError] ?? DAAP_ERRORS.failed}
          </p>
        )}

        {daap?.enabled && (
          <>
            <a
              href={`${API_BASE_URL}/api/auth/daap/login`}
              className="mb-space-3 inline-flex h-14 w-full items-center justify-center rounded-md bg-brand-600 text-[15px] font-semibold text-white shadow-[var(--shadow-sm)] transition-colors duration-150 hover:bg-brand-700"
            >
              Sign in with DAAP
            </a>
            {daap.signup_url && (
              <p className="text-center text-[13px] text-ink-600">
                New restaurant?{" "}
                <a href={daap.signup_url} className="font-semibold text-brand-600 hover:underline">
                  Set it up in DAAP Account
                </a>
              </p>
            )}
          </>
        )}

        {daap !== undefined && !daap?.enabled && (
          <p className="rounded-md bg-paper p-space-3 text-[13px] text-ink-600">
            Sign-in with DAAP isn&apos;t available right now. Please try again in a few minutes.
          </p>
        )}

        <p className="mt-space-5 text-center text-[12.5px] text-ink-400">
          Work at a restaurant?{" "}
          <a href="/portal/login" className="font-semibold text-brand-600 hover:underline">
            Staff login
          </a>
        </p>
      </Card>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthContent />
    </Suspense>
  );
}
