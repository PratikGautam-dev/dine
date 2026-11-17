"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { Badge } from "@/components/erp-ui/Badge";
import { Button } from "@/components/erp-ui/Button";
import { Field } from "@/components/erp-ui/Field";
import { Input, Textarea } from "@/components/erp-ui/Input";
import { Modal } from "@/components/erp-ui/Modal";
import {
  useBranchCashiers,
  type Cashier,
  useBranchTerminals,
  useCancelPairingCode,
  useClearCashierPin,
  useDeleteTerminal,
  useIssuePairingCode,
  useRenameTerminal,
  useRevokeTerminal,
  useSetCashierPin,
  useTerminal,
  type Issued,
  type Terminal,
} from "@/hooks/useTerminals";
import { formatDateTime, humanize } from "@/lib/erp/erp";
import { hasPermission, useStaffSession } from "@/lib/erp/staffAuth";
import { toast } from "@/lib/toast";
import Link from "next/link";
import { SkeletonLines } from "@/components/erp-ui/Skeleton";

const rowActionClass =
  "min-w-0 max-md:h-11 max-md:border max-md:border-line max-md:bg-card max-md:px-space-2 max-md:text-[12.5px]";

/** Waiting more than a day is something to chase. */
function isOld(iso: string | null): boolean {
  return !!iso && Date.now() - new Date(iso).getTime() > 24 * 3600 * 1000;
}

function ago(iso: string | null): string {
  if (!iso) return "never";
  const s = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 1000),
  );
  if (s < 90) return "just now";
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 129600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

const deviceLine = (t: Terminal) =>
  [[t.manufacturer, t.model].filter(Boolean).join(" "), t.os_version]
    .filter(Boolean)
    .join(" · ") || humanize(t.platform);

/** Shows a freshly generated pairing code once: large, with a QR for the terminal to scan and a countdown to expiry. */
function CodeModal({
  issued,
  onClose,
}: {
  issued: Issued;
  onClose: () => void;
}) {
  const [left, setLeft] = useState(() =>
    Math.max(
      0,
      Math.round((new Date(issued.expires_at).getTime() - Date.now()) / 1000),
    ),
  );
  useEffect(() => {
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <Modal
      open
      onClose={onClose}
      width="sm"
      title="Pairing code"
      description="Enter this code on the POS terminal. It works once."
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => {
              navigator.clipboard?.writeText(issued.code).then(
                () => toast.success("Code copied"),
                () => undefined,
              );
            }}
          >
            Copy code
          </Button>
          <Button onClick={onClose}>Done</Button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-space-3 py-space-2">
        <p
          className="font-mono text-[34px] font-bold tracking-[0.12em] text-ink-900"
          aria-label={`Pairing code ${issued.code}`}
        >
          {issued.code}
        </p>
        <p
          className={`text-[13px] font-medium ${left > 0 ? "text-ink-600" : "text-error"}`}
        >
          {left > 0
            ? `Expires in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`
            : "Expired. Generate a new code."}
        </p>
        <p className="text-hint text-center">
          For security this code is shown only now.{" "}
          {issued.terminal_name
            ? `The terminal will be named “${issued.terminal_name}”.`
            : ""}
        </p>
      </div>
    </Modal>
  );
}

function Detail({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useTerminal(id);
  const t = q.data;
  const rows: [string, string | null][] = t
    ? [
        ["Code", t.code],
        ["Platform", humanize(t.platform)],
        ["Manufacturer", t.manufacturer],
        ["Model", t.model],
        ["OS version", t.os_version],
        [
          "App version",
          [t.app_version, t.app_build && `(build ${t.app_build})`]
            .filter(Boolean)
            .join(" ") || null,
        ],
        ["Hardware ID", t.hardware_id],
        ["Serial number", t.serial_number],
        ["Install", t.install_id_hint],
        ["Locale", t.locale],
        ["Timezone", t.timezone],
        [
          "Paired",
          `${formatDateTime(t.paired_at)}${t.paired_ip ? ` from ${t.paired_ip}` : ""}`,
        ],
        [
          "Last seen",
          t.last_seen_at
            ? `${ago(t.last_seen_at)}${t.last_ip ? ` from ${t.last_ip}` : ""}`
            : "never",
        ],
        ["Last synced", ago(t.last_sync_at)],
        ...(t.status === "revoked"
          ? [
              [
                "Revoked",
                `${t.revoked_at ? formatDateTime(t.revoked_at) : ""}${t.revoke_reason ? ` · ${t.revoke_reason}` : ""}`,
              ] as [string, string],
            ]
          : []),
      ]
    : [];
  return (
    <Modal
      open
      onClose={onClose}
      width="lg"
      title={t?.name ?? "Terminal"}
      description="Everything the terminal reported about itself, and what has happened to it."
      footer={
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      }
    >
      {q.error && <p className="text-[13px] text-error">{q.error.message}</p>}
      {t && (
        <>
          <dl className="grid gap-x-space-4 gap-y-space-2 sm:grid-cols-2">
            {rows
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="text-label">{k}</dt>
                  <dd className="break-all text-[14px] text-ink-900">{v}</dd>
                </div>
              ))}
          </dl>
          {Object.keys(t.device_info ?? {}).length > 0 && (
            <>
              <h4 className="mt-space-4 text-[13px] font-semibold text-ink-900">
                Other device details
              </h4>
              <dl className="mt-space-2 grid gap-x-space-4 gap-y-space-1 sm:grid-cols-2">
                {Object.entries(t.device_info).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-label">{humanize(k)}</dt>
                    <dd className="text-[13.5px] text-ink-900">
                      {typeof v === "object" ? JSON.stringify(v) : String(v)}
                    </dd>
                  </div>
                ))}
              </dl>
            </>
          )}
          <h4 className="mt-space-4 text-[13px] font-semibold text-ink-900">
            Recent activity
          </h4>
          <ul className="mt-space-2 divide-y divide-line">
            {(t.events ?? []).map((e) => (
              <li
                key={e.id}
                className="flex justify-between gap-space-3 py-space-2 text-[13.5px]"
              >
                <span className="text-ink-900">
                  {humanize(e.event)}
                  {e.ip ? (
                    <span className="text-ink-400"> · {e.ip}</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-ink-400">
                  {formatDateTime(e.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}

const nameSchema = z
  .string()
  .trim()
  .min(1, "Give the terminal a name.")
  .max(80, "Use 80 characters or fewer.");

/** Terminals tab of a branch: generate pairing codes, see every paired terminal and its device details, rename and revoke. */
export function TerminalsPanel({ branchId }: { branchId: string }) {
  const session = useStaffSession();
  const canManage = hasPermission(session, "settings", "write");
  const list = useBranchTerminals(branchId);
  const [nextName, setNextName] = useState("");
  const [issued, setIssued] = useState<Issued | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<Terminal | null>(null);
  const [reason, setReason] = useState("");
  const [deleting, setDeleting] = useState<Terminal | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [renaming, setRenaming] = useState<{
    t: Terminal;
    name: string;
    error?: string;
  } | null>(null);
  const issueCode = useIssuePairingCode(branchId);
  const cancelPairing = useCancelPairingCode();
  const revokeTerminal = useRevokeTerminal();
  const renameTerminal = useRenameTerminal();
  const deleteTerminal = useDeleteTerminal();
  const busy =
    issueCode.isPending ||
    revokeTerminal.isPending ||
    renameTerminal.isPending ||
    deleteTerminal.isPending;

  function generate() {
    const checked = nextName.trim() ? nameSchema.safeParse(nextName) : null;
    if (checked && !checked.success)
      return toast.error(checked.error.issues[0].message);
    issueCode.mutate(nextName.trim() || null, {
      onSuccess: (code) => {
        setIssued(code);
        setNextName("");
      },
      onError: (e) => toast.error("Couldn't create a pairing code", e.message),
    });
  }
  function cancelCode(id: string) {
    cancelPairing.mutate(id, {
      onError: (e) => toast.error("Couldn't cancel the code", e.message),
    });
  }
  function revoke() {
    if (!revoking) return;
    revokeTerminal.mutate(
      { id: revoking.id, reason: reason.trim() || null },
      {
        onSuccess: () => {
          toast.success(
            `${revoking.name} revoked. It locks at its next contact, hands over any unsent bills for your review, then wipes itself.`,
          );
          setRevoking(null);
          setReason("");
        },
        onError: (e) => toast.error("Couldn't revoke the terminal", e.message),
      },
    );
  }
  function remove() {
    if (!deleting || confirmName.trim() !== deleting.name) return;
    deleteTerminal.mutate(
      { id: deleting.id, confirmName: confirmName.trim() },
      {
        onSuccess: () => {
          toast.success(`${deleting.name} deleted.`);
          setDeleting(null);
          setConfirmName("");
        },
        onError: (e) => toast.error("Couldn't delete the terminal", e.message),
      },
    );
  }
  function rename() {
    if (!renaming) return;
    const checked = nameSchema.safeParse(renaming.name);
    if (!checked.success)
      return setRenaming({
        ...renaming,
        error: checked.error.issues[0].message,
      });
    renameTerminal.mutate(
      { id: renaming.t.id, name: checked.data },
      {
        onSuccess: () => setRenaming(null),
        onError: (e) => toast.error("Couldn't rename the terminal", e.message),
      },
    );
  }

  const terminals = list.data?.terminals ?? [];
  return (
    <div>
      {canManage && (
        <div className="mb-space-4 flex flex-wrap items-end gap-space-2 rounded-lg border border-line bg-paper p-space-3">
          <Field
            label="Name for the new terminal"
            htmlFor="t_name"
            className="mb-0 min-w-0 basis-full md:min-w-56 md:flex-1 md:basis-auto"
            hint="Optional, e.g. “Counter 1”. You can rename it later."
          >
            <Input
              id="t_name"
              value={nextName}
              maxLength={80}
              onChange={(e) => setNextName(e.target.value)}
            />
          </Field>
          <Button
            className="mobile-page-action"
            disabled={busy}
            onClick={generate}
          >
            Generate pairing code
          </Button>
        </div>
      )}
      {(list.data?.pairing_codes ?? []).length > 0 && (
        <ul className="mb-space-4 divide-y divide-line rounded-lg border border-line">
          {list.data?.pairing_codes.map((c) => (
            <li
              key={c.id}
              className="mobile-page-action-row flex items-center justify-between gap-space-3 px-space-3 py-space-2 text-[13.5px]"
            >
              <span>
                Unused code{c.terminal_name ? ` for “${c.terminal_name}”` : ""}{" "}
                <span className="text-ink-400">
                  · expires {formatDateTime(c.expires_at)}
                </span>
              </span>
              {canManage && (
                <button
                  type="button"
                  className="mobile-page-action text-[13px] font-semibold text-error"
                  onClick={() => cancelCode(c.id)}
                >
                  Cancel
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {list.error && (
        <p className="mb-space-3 text-[13px] text-error">
          {list.error.message}
        </p>
      )}
      {terminals.length === 0 &&
        (list.isFetching ? (
          <SkeletonLines rows={2} />
        ) : (
          <p className="text-[13.5px] text-ink-400">
            {
              "No terminals paired to this branch yet. Generate a pairing code and enter it in the POS app."
            }
          </p>
        ))}
      <ul className="divide-y divide-line">
        {terminals.map((t) => (
          <li
            key={t.id}
            className="flex flex-col items-stretch gap-space-2 py-space-3 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-space-3"
          >
            <div className="min-w-0 flex-1 break-words">
              <div className="mb-1 flex items-start justify-between gap-space-2">
                <p className="min-w-0 text-[14px] font-semibold text-ink-900">
                  {t.name}{" "}
                  <span className="block text-[12px] font-normal text-ink-400 md:inline">
                    {t.code}
                  </span>
                </p>
                <Badge
                  className="shrink-0"
                  tone={t.status === "active" ? "success" : "neutral"}
                >
                  {t.status}
                </Badge>
              </div>
              <p className="text-[12.5px] text-ink-600">
                {deviceLine(t)}
                {t.app_version ? ` · app ${t.app_version}` : ""}
              </p>
              <p className="text-[12.5px] text-ink-400">
                {t.status === "active"
                  ? `Last seen ${ago(t.last_seen_at)}`
                  : `Revoked${t.revoke_reason ? `: ${t.revoke_reason}` : ""}`}
              </p>
              {t.status === "active" && (t.queue_unsent ?? 0) > 0 && (
                <p className="mt-space-1">
                  <Badge tone={isOld(t.queue_oldest_at) ? "error" : "warning"}>
                    {t.queue_unsent} bill{t.queue_unsent === 1 ? "" : "s"}{" "}
                    waiting on the till · oldest {ago(t.queue_oldest_at)}
                  </Badge>
                </p>
              )}
            </div>
            <div className="grid w-full grid-cols-2 gap-space-2 md:flex md:w-auto md:flex-wrap md:justify-end md:gap-space-1">
              <Button
                className={rowActionClass}
                variant="ghost"
                onClick={() => setDetail(t.id)}
              >
                Details
              </Button>
              {canManage && t.status === "active" && (
                <Button
                  variant="ghost"
                  className={rowActionClass}
                  onClick={() => setRenaming({ t, name: t.name })}
                >
                  Rename
                </Button>
              )}
              {canManage && t.status === "active" && (
                <Button
                  variant="ghost"
                  className={`${rowActionClass} text-error max-md:border-error/30`}
                  onClick={() => {
                    setRevoking(t);
                    setReason("");
                  }}
                >
                  Revoke
                </Button>
              )}
              {canManage && t.status === "revoked" && (
                <Button
                  variant="ghost"
                  className={`${rowActionClass} text-error max-md:col-span-2 max-md:border-error/30`}
                  onClick={() => {
                    setDeleting(t);
                    setConfirmName("");
                  }}
                >
                  Delete
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {issued && <CodeModal issued={issued} onClose={() => setIssued(null)} />}
      {detail && <Detail id={detail} onClose={() => setDetail(null)} />}
      <Modal
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        width="sm"
        title={`Revoke ${revoking?.name ?? "terminal"}?`}
        description="The terminal locks at its next contact (within about a minute if it is connected). Any bills it has not uploaded are handed over to you to approve or reject, then it wipes its data. To use that device again it must be paired with a new code."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRevoking(null)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={revoke}>
              Revoke terminal
            </Button>
          </>
        }
      >
        {(revoking?.queue_unsent ?? 0) > 0 && (
          <p className="mb-space-3 rounded-md bg-warning-tint p-space-3 text-[13px] text-ink-900">
            This terminal reported {revoking?.queue_unsent} bill
            {revoking?.queue_unsent === 1 ? "" : "s"} it had not uploaded
            {revoking?.queue_reported_at
              ? ` (${ago(revoking.queue_reported_at)})`
              : ""}
            . They are kept: when it reconnects it hands them over, and you
            approve or reject each one. If the device is lost and never
            reconnects, those bills cannot be recovered.
          </p>
        )}
        <Field
          label="Reason"
          htmlFor="t_reason"
          hint="Optional, kept in the activity log, e.g. “lost tablet”."
        >
          <Textarea
            id="t_reason"
            rows={2}
            maxLength={200}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      </Modal>
      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        width="sm"
        title={`Delete ${deleting?.name ?? "terminal"}?`}
        description="This can't be undone. The terminal is removed from this branch for good and nothing about it can be recovered here. The bills it took and its day closes stay in your sales and reports."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy || confirmName.trim() !== deleting?.name}
              onClick={remove}
            >
              Delete terminal
            </Button>
          </>
        }
      >
        {deleting && (
          <Field
            label={`Type “${deleting.name}” to confirm`}
            htmlFor="t_delete"
            required
          >
            <Input
              id="t_delete"
              autoComplete="off"
              value={confirmName}
              maxLength={80}
              onChange={(e) => setConfirmName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") remove();
              }}
            />
          </Field>
        )}
      </Modal>
      <Modal
        open={renaming !== null}
        onClose={() => setRenaming(null)}
        width="sm"
        title="Rename terminal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={rename}>
              Save
            </Button>
          </>
        }
      >
        {renaming && (
          <Field
            label="Name"
            htmlFor="t_rename"
            required
            error={renaming.error}
          >
            <Input
              id="t_rename"
              invalid={!!renaming.error}
              value={renaming.name}
              maxLength={80}
              onChange={(e) =>
                setRenaming({
                  ...renaming,
                  name: e.target.value,
                  error: undefined,
                })
              }
            />
          </Field>
        )}
      </Modal>
    </div>
  );
}

const pinSchema = z
  .object({
    pin: z.string().regex(/^\d{6}$/, "The PIN must be exactly 6 digits."),
    again: z.string(),
  })
  .refine((v) => v.pin === v.again, {
    path: ["again"],
    message: "The two PINs don't match.",
  });

/** Cashiers tab: the people who can bill at this branch, and whether each has a PIN for the terminal. */
export function CashiersPanel({ branchId }: { branchId: string }) {
  const session = useStaffSession();
  const canSetPin = hasPermission(session, "settings", "write");
  const list = useBranchCashiers(branchId);
  const [target, setTarget] = useState<Cashier | null>(null);
  const [form, setForm] = useState({ pin: "", again: "" });
  const [errors, setErrors] = useState<{ pin?: string; again?: string }>({});
  const setPin = useSetCashierPin();
  const clearPin = useClearCashierPin();
  const busy = setPin.isPending;
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);

  function save() {
    if (!target) return;
    const parsed = pinSchema.safeParse(form);
    if (!parsed.success) {
      const e: typeof errors = {};
      for (const i of parsed.error.issues)
        e[i.path[0] as "pin" | "again"] ??= i.message;
      return setErrors(e);
    }
    setPin.mutate(
      { userId: target.id, pin: parsed.data.pin },
      {
        onSuccess: () => {
          toast.success(
            `PIN set for ${target.name}. The terminal gets it on its next sync.`,
          );
          setTarget(null);
        },
        onError: (e) => setErrors({ pin: e.message }),
      },
    );
  }
  function clear(c: Cashier) {
    clearPin.mutate(c.id, {
      onSuccess: () =>
        toast.success(`${c.name} can no longer sign in at the POS terminal.`),
      onError: (e) => toast.error("Couldn't remove the PIN", e.message),
    });
  }

  const cashiers = list.data ?? [];
  return (
    <div>
      <p className="mb-space-3 text-[13px] text-ink-600">
        Cashiers are team members whose role lets them bill at this branch. Give
        each a 6-digit PIN to sign in at the POS terminal. Add people and roles
        under{" "}
        <Link className="underline" href="/portal/settings/staff">
          Team &amp; Access
        </Link>
        .
      </p>
      {list.error && (
        <p className="mb-space-3 text-[13px] text-error">
          {list.error.message}
        </p>
      )}
      {cashiers.length === 0 &&
        (list.isFetching ? (
          <SkeletonLines rows={2} />
        ) : (
          <p className="text-[13.5px] text-ink-400">
            {"Nobody can bill at this branch yet."}
          </p>
        ))}
      <ul className="divide-y divide-line">
        {cashiers.map((c) => (
          <li
            key={c.id}
            className="flex flex-col items-stretch gap-space-2 py-space-3 text-[14px] md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-space-3"
          >
            <div className="flex min-w-0 flex-1 items-start justify-between gap-space-2">
              <span className="min-w-0 break-words">
                <strong className="text-ink-900">{c.name}</strong>{" "}
                <span className="block text-[12.5px] text-ink-400">
                  {c.email}
                </span>
                <span className="text-[12.5px] text-ink-600">
                  {c.roles.map(humanize).join(", ")}
                </span>
              </span>
              <Badge
                className="shrink-0"
                tone={
                  c.status === "disabled"
                    ? "neutral"
                    : c.has_pin
                      ? "success"
                      : "warning"
                }
              >
                {c.status === "disabled"
                  ? "disabled"
                  : c.has_pin
                    ? "PIN set"
                    : "No PIN"}
              </Badge>
            </div>
            <div className="grid w-full grid-cols-2 gap-space-2 md:flex md:w-auto md:items-center">
              {canSetPin && c.status === "active" && (
                <Button
                  variant="ghost"
                  className={rowActionClass}
                  onClick={() => {
                    setTarget(c);
                    setForm({ pin: "", again: "" });
                    setErrors({});
                  }}
                >
                  {c.has_pin ? "Reset PIN" : "Set PIN"}
                </Button>
              )}
              {canSetPin && c.has_pin && (
                <Button
                  variant="ghost"
                  className={`${rowActionClass} text-error max-md:border-error/30`}
                  onClick={() => clear(c)}
                >
                  Remove
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {!canSetPin && cashiers.length > 0 && (
        <p className="mt-space-3 text-[12.5px] text-ink-400">
          Only a business administrator can set PINs.
        </p>
      )}
      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        width="sm"
        title={`PIN for ${target?.name ?? ""}`}
        description="6 digits. Avoid repeated or sequential numbers."
        footer={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={save}>
              Save PIN
            </Button>
          </>
        }
      >
        <Field label="New PIN" htmlFor="c_pin" required error={errors.pin}>
          <Input
            id="c_pin"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            invalid={!!errors.pin}
            value={form.pin}
            onChange={(e) => {
              setForm({ ...form, pin: digits(e.target.value) });
              setErrors({});
            }}
          />
        </Field>
        <Field
          label="Repeat PIN"
          htmlFor="c_pin2"
          required
          error={errors.again}
        >
          <Input
            id="c_pin2"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            invalid={!!errors.again}
            value={form.again}
            onChange={(e) => {
              setForm({ ...form, again: digits(e.target.value) });
              setErrors({});
            }}
          />
        </Field>
      </Modal>
    </div>
  );
}
