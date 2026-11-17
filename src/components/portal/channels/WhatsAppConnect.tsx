"use client";

import { useState } from "react";
import { CopyRow } from "@/components/portal/channels/CopyRow";
import { WhatsAppWalkthrough } from "@/components/portal/channels/WhatsAppWalkthrough";
import { Badge } from "@/components/erp-ui/Badge";
import { Button } from "@/components/erp-ui/Button";
import { Card } from "@/components/erp-ui/Card";
import { ConfirmDialog } from "@/components/erp-ui/ConfirmDialog";
import { Field } from "@/components/erp-ui/Field";
import { Input } from "@/components/erp-ui/Input";
import { Modal } from "@/components/erp-ui/Modal";
import {
  useCheckWhatsAppAccount,
  useDisconnectWhatsApp,
  useSaveWhatsAppAccount,
  useWhatsAppAccount,
  type WhatsAppForm as Form,
} from "@/hooks/useWhatsApp";
import { formatDateTime } from "@/lib/erp/erp";
import { hasPermission, useStaffSession } from "@/lib/erp/staffAuth";
import { toast } from "@/lib/toast";

const QUALITY_TONE = {
  GREEN: "success",
  YELLOW: "warning",
  RED: "warning",
} as const;

/** Connect the business's own WhatsApp number (Meta Cloud API), see its health, and finish the webhook in Meta. Templates are on the WhatsApp page. */
export function WhatsAppConnect() {
  const session = useStaffSession();
  const allowed = hasPermission(session, "settings", "view");
  const canManage = hasPermission(session, "settings", "write");
  const account = useWhatsAppAccount(allowed);
  const saveAccount = useSaveWhatsAppAccount();
  const checkAccount = useCheckWhatsAppAccount();
  const disconnectAccount = useDisconnectWhatsApp();
  const [form, setForm] = useState<Form | null>(null);
  const busy = saveAccount.isPending || checkAccount.isPending;
  const [confirmOff, setConfirmOff] = useState(false);
  const [guide, setGuide] = useState(false);
  const a = account.data;

  if (!allowed)
    return (
      <Card className="mt-space-5 p-space-4 text-[13.5px] text-ink-600">
        Ask an administrator to connect WhatsApp.
      </Card>
    );
  if (!a)
    return (
      <Card className="mt-space-5 p-space-4 text-[13.5px] text-ink-400">
        {account.error?.message ?? "Loading…"}
      </Card>
    );

  const set = (patch: Partial<Form>) =>
    setForm((f) => (f ? { ...f, ...patch } : f));
  const blank: Form = {
    waba_id: "",
    phone_number_id: "",
    access_token: "",
    app_secret: "",
  };
  const editing = a.connected;

  function save() {
    if (!form) return;
    saveAccount.mutate(form, {
      onSuccess: () => {
        toast.success(
          editing ? "WhatsApp details updated" : "WhatsApp connected",
          "Now finish the webhook in Meta.",
        );
        setForm(null);
      },
      onError: (e) => toast.error("Couldn't connect", e.message),
    });
  }
  function check() {
    checkAccount.mutate(undefined, {
      onSuccess: (d) => {
        if (d && d.connected && d.last_error)
          toast.error("Meta rejected the saved details", d.last_error);
        else toast.success("Connection is working");
      },
      onError: (e) => toast.error("Couldn't check", e.message),
    });
  }
  function disconnect() {
    setConfirmOff(false);
    disconnectAccount.mutate(undefined, {
      onSuccess: () => toast.success("WhatsApp disconnected"),
      onError: (e) => toast.error("Couldn't disconnect", e.message),
    });
  }

  const formModal = (
    <Modal
      open={form !== null}
      onClose={() => setForm(null)}
      width="lg"
      title={editing ? "Edit WhatsApp details" : "Connect WhatsApp Business"}
      description={
        editing
          ? "Leave a field blank to keep what is saved."
          : "We check these with Meta before saving."
      }
      footer={
        <>
          <Button variant="ghost" onClick={() => setForm(null)}>
            Cancel
          </Button>
          <Button disabled={busy} onClick={save}>
            {busy ? "Checking with Meta…" : editing ? "Save" : "Connect"}
          </Button>
        </>
      }
    >
      {form && (
        <div className="grid gap-x-space-4 sm:grid-cols-2">
          <Field
            label="WhatsApp Business Account ID"
            htmlFor="w_waba"
            required={!editing}
          >
            <Input
              id="w_waba"
              inputMode="numeric"
              placeholder={a.connected ? a.waba_id : ""}
              value={form.waba_id}
              onChange={(e) =>
                set({ waba_id: e.target.value.replace(/\D/g, "") })
              }
            />
          </Field>
          <Field label="Phone number ID" htmlFor="w_pid" required={!editing}>
            <Input
              id="w_pid"
              inputMode="numeric"
              placeholder={a.connected ? a.phone_number_id : ""}
              value={form.phone_number_id}
              onChange={(e) =>
                set({ phone_number_id: e.target.value.replace(/\D/g, "") })
              }
            />
          </Field>
          <Field
            label="Access token"
            htmlFor="w_tok"
            required={!editing}
            hint={
              a.connected
                ? `Saved: ${a.access_token_hint}. Leave blank to keep it.`
                : "The permanent token from your system user."
            }
            className="sm:col-span-2"
          >
            <Input
              id="w_tok"
              type="password"
              autoComplete="off"
              value={form.access_token}
              onChange={(e) => set({ access_token: e.target.value })}
            />
          </Field>
          <Field
            label="App secret"
            htmlFor="w_sec"
            required={!editing}
            hint={
              a.connected
                ? "Saved. Leave blank to keep it."
                : "From your app's Settings → Basic."
            }
            className="sm:col-span-2"
          >
            <Input
              id="w_sec"
              type="password"
              autoComplete="off"
              value={form.app_secret}
              onChange={(e) => set({ app_secret: e.target.value })}
            />
          </Field>
        </div>
      )}
    </Modal>
  );

  if (!a.connected) {
    return (
      <>
        <WhatsAppWalkthrough
          canConnect={canManage}
          onConnect={() => setForm({ ...blank })}
          webhook={null}
        />
        {formModal}
      </>
    );
  }

  return (
    <>
      <Card className="mt-space-5 p-space-4">
        <div className="mb-space-3 flex flex-wrap items-start justify-between gap-space-3">
          <div>
            <h2 className="text-[15px] font-bold text-ink-900">
              {a.display_phone}
            </h2>
            <p className="text-[13px] text-ink-600">
              {a.verified_name ?? "Name not verified yet"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-space-2">
            <Badge tone={a.last_error ? "warning" : "success"}>
              {a.last_error ? "Needs attention" : "Connected"}
            </Badge>
            {a.quality_rating && (
              <Badge
                tone={
                  QUALITY_TONE[a.quality_rating as keyof typeof QUALITY_TONE] ??
                  "neutral"
                }
              >
                Quality: {a.quality_rating.toLowerCase()}
              </Badge>
            )}
          </div>
        </div>
        {a.last_error && (
          <p className="mb-space-3 rounded-md bg-warning-tint px-space-3 py-space-2 text-[13px] text-ink-900">
            Meta said: {a.last_error}. Update the details or generate a new
            token.
          </p>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-space-4 gap-y-1 text-[13.5px]">
          <dt className="text-ink-600">Business account ID</dt>
          <dd className="font-medium">{a.waba_id}</dd>
          <dt className="text-ink-600">Phone number ID</dt>
          <dd className="font-medium">{a.phone_number_id}</dd>
          <dt className="text-ink-600">Access token</dt>
          <dd className="font-medium">{a.access_token_hint}</dd>
          <dt className="text-ink-600">Last checked</dt>
          <dd className="font-medium">
            {a.last_checked_at ? formatDateTime(a.last_checked_at) : "—"}
          </dd>
        </dl>
        {canManage && (
          <div className="mobile-page-actions mt-space-3 flex flex-wrap gap-space-2">
            <Button variant="secondary" disabled={busy} onClick={check}>
              Check connection
            </Button>
            <Button variant="secondary" onClick={() => setForm({ ...blank })}>
              Edit details
            </Button>
            <Button variant="ghost" onClick={() => setConfirmOff(true)}>
              Disconnect
            </Button>
          </div>
        )}
      </Card>

      <Card className="mt-space-4 p-space-4">
        <div className="mb-space-2 flex flex-wrap items-center justify-between gap-space-2">
          <h2 className="text-[15px] font-bold text-ink-900">
            Finish in Meta: the webhook
          </h2>
          <Badge
            tone={
              a.webhook_verified_at || a.last_message_at ? "success" : "warning"
            }
          >
            {a.webhook_verified_at || a.last_message_at
              ? "Webhook connected"
              : "Waiting for Meta"}
          </Badge>
        </div>
        <p className="mb-space-3 text-[13px] text-ink-600">
          In your Meta app open{" "}
          <strong>WhatsApp → Configuration → Webhook</strong>, paste these two
          values, choose <strong>Verify and save</strong>, then subscribe to the{" "}
          <strong>messages</strong> field. Messages your customers send will
          then appear here.
        </p>
        <CopyRow label="Callback URL" value={a.webhook_url} />
        <CopyRow label="Verify token" value={a.verify_token ?? ""} />
        <Button
          className="mobile-page-action"
          variant="ghost"
          onClick={() => setGuide((g) => !g)}
        >
          {guide
            ? "Hide the Meta walkthrough"
            : "Show me where to click in Meta"}
        </Button>
      </Card>

      {guide && (
        <WhatsAppWalkthrough
          canConnect={false}
          onConnect={() => undefined}
          webhook={{ url: a.webhook_url, token: a.verify_token ?? "" }}
          startAt={6}
        />
      )}

      {formModal}
      <ConfirmDialog
        open={confirmOff}
        title="Disconnect WhatsApp?"
        message="Customers' messages will stop arriving here and your saved token and secret are deleted. Conversations already received are kept. You can connect again later."
        confirmLabel="Disconnect"
        destructive
        onConfirm={disconnect}
        onCancel={() => setConfirmOff(false)}
      />
    </>
  );
}
