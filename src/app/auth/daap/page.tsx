"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { saveStaffSession } from "@/lib/staffAuth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

/** "Sign in with DAAP" lands here (erp-dine-backend daap/sign_in.py): the one-time code rides in the URL fragment, which browsers never
 * send to a server or log. It is swapped once, within a minute, for the usual staff session, then the fragment is wiped from history. */
export default function DaapSignInPage() {
  const router = useRouter();
  const ran = useRef(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const code = new URLSearchParams(window.location.hash.slice(1)).get("code");
    window.history.replaceState(null, "", window.location.pathname);
    if (!code) {
      router.replace("/auth?daap_error=expired");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/daap/exchange`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code }),
        });
        if (!res.ok) {
          router.replace("/auth?daap_error=expired");
          return;
        }
        const data = await res.json();
        saveStaffSession(data.access_token, data.refresh_token, {
          id: data.staff.id,
          name: data.staff.name,
          role: data.staff.role,
          restaurant: data.staff.restaurant,
          permissions: data.permissions,
        });
        router.replace("/portal/dashboard");
      } catch {
        setFailed("Couldn't reach the server. Please try again.");
      }
    })();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-space-4">
      <Card className="w-full max-w-sm p-space-6 text-center">
        {failed ? (
          <>
            <p className="text-body mb-space-4">{failed}</p>
            <a href="/auth" className="font-semibold text-brand-600 hover:underline">
              Back to sign in
            </a>
          </>
        ) : (
          <p className="text-body">Signing you in…</p>
        )}
      </Card>
    </div>
  );
}
