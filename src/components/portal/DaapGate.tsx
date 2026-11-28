"use client";

import { useState } from "react";
import { AlertTriangle, Clock, ExternalLink, Info, MapPin } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CheckboxRow } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import {
  useDaapStatus,
  useFirstOpen,
  useSaveFirstOpen,
  type DaapStatus,
  type FirstOpen,
} from "@/hooks/useDaapStatus";
import { usePermission } from "@/lib/staffAuth";
import { STATES } from "@/lib/states";

type Linked = Extract<DaapStatus, { linked: true }>;

/** DAAP's part of every portal page (PortalShell): the waiting screen while DAAP keeps a new business locked until it has checked it,
 * the first-open screen (name and place the first outlet), and banners for a verification or payment that needs the owner. The server
 * refuses everything locked on its own; this only shows why. A restaurant DAAP doesn't know sees nothing of it. */
export function DaapGate({ children }: { children: React.ReactNode }) {
  const { data: status } = useDaapStatus();
  const canSetUp = usePermission("settings", "write");

  if (!status || !status.linked) return <>{children}</>;
  if (status.awaiting_verification) return <WaitingScreen status={status} />;
  if (status.first_open && canSetUp) return <FirstOpenScreen />;
  return (
    <>
      <Banners status={status} />
      {children}
    </>
  );
}

const VERIFICATION_TEXT: Record<string, { title: string; body: string }> = {
  not_submitted: {
    title: "Finish your business details in DAAP Account",
    body: "DAAP checks your business before the portal opens. Add your details and documents in DAAP Account to start.",
  },
  verification_pending: {
    title: "DAAP is verifying your business",
    body: "This usually takes a working day. The portal opens as soon as it's verified; you'll get an email too.",
  },
  changes_requested: {
    title: "DAAP needs a few changes",
    body: "Update the details DAAP asked about in DAAP Account. Verification continues once you send them.",
  },
  rejected: {
    title: "DAAP couldn't verify your business",
    body: "See the reason in DAAP Account, or contact DAAP support.",
  },
};

function WaitingScreen({ status }: { status: Linked }) {
  const { refetch, isFetching } = useDaapStatus();
  const text =
    VERIFICATION_TEXT[status.verification ?? "verification_pending"] ??
    VERIFICATION_TEXT.verification_pending;
  return (
    <div className="flex min-h-full items-center justify-center py-space-8">
      <Card className="w-full max-w-lg p-space-6 text-center">
        <span className="mx-auto mb-space-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Clock size={22} />
        </span>
        <h1 className="mb-space-2 text-[20px] font-bold text-ink-900">{text.title}</h1>
        <p className="mb-space-4 text-[14px] text-ink-600">{text.body}</p>
        {status.note && status.verification === "changes_requested" && (
          <p className="mb-space-4 rounded-md bg-paper p-space-3 text-left text-[13px] text-ink-900">
            <span className="font-semibold">DAAP&apos;s note: </span>
            {status.note}
          </p>
        )}
        <div className="flex flex-col justify-center gap-space-2 sm:flex-row">
          {status.business_url && (
            <Button href={status.business_url} target="_blank" rel="noopener noreferrer">
              Open DAAP Account <ExternalLink size={15} />
            </Button>
          )}
          <Button variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? "Checking…" : "Check again"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Banners({ status }: { status: Linked }) {
  const items: { tone: "info" | "warn"; text: string; href: string | null; action: string }[] = [];
  if (status.verification && status.verification !== "verified") {
    const text = VERIFICATION_TEXT[status.verification];
    if (text)
      items.push({
        tone: status.verification === "changes_requested" ? "warn" : "info",
        text: text.title,
        href: status.business_url,
        action: "Open DAAP Account",
      });
  }
  if (status.services.some((s) => s.status === "past_due")) {
    items.push({
      tone: "warn",
      text: "Your DAAP payment is overdue. Pay it to keep every service on.",
      href: status.billing_url,
      action: "Plan & billing",
    });
  }
  if (items.length === 0) return null;
  return (
    <div className="mb-space-4 flex flex-col gap-space-2">
      {items.map((b) => (
        <div
          key={b.text}
          className={
            b.tone === "warn"
              ? "flex items-center gap-space-3 rounded-md border border-warning/30 bg-warning-tint p-space-3 text-[13px] text-ink-900"
              : "flex items-center gap-space-3 rounded-md border border-brand-200 bg-brand-50 p-space-3 text-[13px] text-ink-900"
          }
        >
          {b.tone === "warn" ? (
            <AlertTriangle size={16} className="shrink-0 text-warning" />
          ) : (
            <Info size={16} className="shrink-0 text-brand-600" />
          )}
          <span className="flex-1">{b.text}</span>
          {b.href && (
            <a
              href={b.href}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 font-semibold text-brand-600 hover:underline"
            >
              {b.action}
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function FirstOpenScreen() {
  const { data, error, isLoading } = useFirstOpen(true);
  if (isLoading) return null;
  if (error || !data)
    return (
      <p className="text-[14px] text-error">{error?.message || "Couldn't load your outlet."}</p>
    );
  return <FirstOpenForm data={data} />;
}

function FirstOpenForm({ data }: { data: FirstOpen }) {
  const save = useSaveFirstOpen();
  const reg = data.registered_address;
  const [name, setName] = useState(data.outlet.name || "");
  const [same, setSame] = useState(true);
  const [address, setAddress] = useState({ address_line: "", city: "", state: "", pincode: "" });
  const registered = [reg.address_line, reg.city, reg.state, reg.pincode]
    .filter(Boolean)
    .join(", ");
  const addressOk =
    same ||
    (address.address_line.trim() &&
      address.city.trim() &&
      address.state &&
      /^[1-9]\d{5}$/.test(address.pincode));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    save.mutate({ name: name.trim(), same_as_registered: same, ...(same ? {} : { address }) });
  }

  return (
    <div className="flex min-h-full items-center justify-center py-space-8">
      <Card className="w-full max-w-lg p-space-6">
        <span className="mb-space-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <MapPin size={22} />
        </span>
        <h1 className="mb-space-1 text-[20px] font-bold text-ink-900">
          Welcome! Set up your first outlet
        </h1>
        <p className="mb-space-5 text-[14px] text-ink-600">
          Name the outlet and confirm where it is. You can add more outlets later in Settings.
        </p>
        <form onSubmit={submit} className="flex flex-col gap-space-4">
          <Field label="Outlet name" htmlFor="outlet-name" required>
            <Input
              id="outlet-name"
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Boring Road"
            />
          </Field>
          <CheckboxRow checked={same} onChange={setSame}>
            <span>
              The outlet is at the registered address
              {registered && <span className="block text-[12.5px] text-ink-600">{registered}</span>}
            </span>
          </CheckboxRow>
          {!same && (
            <>
              <Field label="Address" htmlFor="outlet-address" required>
                <Input
                  id="outlet-address"
                  value={address.address_line}
                  maxLength={300}
                  onChange={(e) => setAddress({ ...address, address_line: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-1 gap-space-3 sm:grid-cols-3">
                <Field label="City" htmlFor="outlet-city" required>
                  <Input
                    id="outlet-city"
                    value={address.city}
                    maxLength={100}
                    onChange={(e) => setAddress({ ...address, city: e.target.value })}
                  />
                </Field>
                <Field label="State" htmlFor="outlet-state" required>
                  <select
                    id="outlet-state"
                    value={address.state}
                    onChange={(e) => setAddress({ ...address, state: e.target.value })}
                    className="h-11 w-full rounded-md border border-line bg-card px-space-3 text-[14px] text-ink-900"
                  >
                    <option value="">Choose</option>
                    {STATES.map((s) => (
                      <option key={s.code} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="PIN code" htmlFor="outlet-pincode" required>
                  <Input
                    id="outlet-pincode"
                    inputMode="numeric"
                    maxLength={6}
                    value={address.pincode}
                    onChange={(e) =>
                      setAddress({ ...address, pincode: e.target.value.replace(/\D/g, "") })
                    }
                  />
                </Field>
              </div>
            </>
          )}
          {save.error && <p className="text-[13px] font-medium text-error">{save.error.message}</p>}
          <Button type="submit" disabled={!name.trim() || !addressOk || save.isPending}>
            {save.isPending ? "Saving…" : "Open my portal"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
