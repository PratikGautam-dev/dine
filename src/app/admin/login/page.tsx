"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { saveSuperAdminSession } from "@/lib/superAdminAuth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

// Super-admin login, fully separate from /portal/login -- no Google sign-in option (that's the
// staff/tenant-owner path), posts to admin/super_auth.py's POST /api/admin/super/login.
export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/super/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Incorrect email or password.");
        return;
      }
      saveSuperAdminSession(data.access_token, data.super_admin);
      router.push("/admin/platform-offers");
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

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

        <h1 className="text-display mb-space-1 !text-[22px]">Super admin sign in</h1>
        <p className="text-body mb-space-5">Platform-wide controls — not a restaurant login.</p>

        <form onSubmit={handleSubmit}>
          <Field label="Email" htmlFor="super_admin_email">
            <Input
              id="super_admin_email"
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Password" htmlFor="super_admin_password" error={error || undefined}>
            <Input
              id="super_admin_password"
              type="password"
              value={password}
              invalid={!!error}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button type="submit" disabled={submitting || !email || !password} className="mt-space-2 w-full" size="lg">
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
