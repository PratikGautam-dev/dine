"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft, Building2, Power } from "lucide-react";
import { Badge } from "@/components/erp-ui/Badge";
import { Modal } from "@/components/erp-ui/Modal";
import { Select } from "@/components/erp-ui/Select";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Textarea } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { FormSkeleton } from "@/components/ui/Skeleton";
import { BranchFormDialog } from "@/components/portal/BranchFormDialog";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { PortalShell } from "@/components/portal/PortalShell";
import { ContactDetailsModal } from "@/components/portal/settings/ContactDetailsModal";
import { OpeningHoursEditor } from "@/components/portal/settings/OpeningHoursEditor";
import { useAppointmentTypes } from "@/hooks/useAppointmentTypes";
import { useGstRegistrations, useLinkBranchGst } from "@/hooks/useTaxes";
import { useBranchBookingHours } from "@/hooks/useBranchBookingHours";
import {
  emptyBranchForm,
  toBranchForm,
  useBranchManagement,
  type BranchForm,
} from "@/hooks/useBranchManagement";
import type { Branch } from "@/lib/branchContext";
import { formatPhone } from "@/lib/erp/phone";
import { rupees } from "@/lib/foodOrders";
import { usePermission, useStaffSession } from "@/lib/staffAuth";

/** One labelled card of a branch page: a title, an optional Edit action and a list of label / value rows. */
function Section({
  title,
  note,
  action,
  children,
}: {
  title: string;
  note?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="mb-space-4 p-space-4">
      <div className="mb-space-3 flex items-start justify-between gap-space-3">
        <div>
          <h2 className="text-[15px] font-bold text-ink-900">{title}</h2>
          {note && <p className="mt-0.5 text-[13px] text-ink-600">{note}</p>}
        </div>
        {action}
      </div>
      <div className="divide-y divide-line rounded-md border border-line">{children}</div>
    </Card>
  );
}

function Row({ label, children }: { label: string; children?: React.ReactNode }) {
  const empty = children === null || children === undefined || children === "" || children === false;
  return (
    <div className="grid grid-cols-[160px_1fr] items-start gap-space-3 px-space-3 py-space-3 text-[13px] sm:grid-cols-[200px_1fr]">
      <span className="text-ink-600">{label}</span>
      <span className={empty ? "text-ink-400" : "font-medium text-ink-900"}>{empty ? "Not set" : children}</span>
    </div>
  );
}

function OnOff({ on }: { on: boolean }) {
  return <Badge tone={on ? "success" : "neutral"}>{on ? "on" : "off"}</Badge>;
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <PermissionGate page="settings" action="write">
      <Button variant="secondary" onClick={onClick}>
        Edit
      </Button>
    </PermissionGate>
  );
}

function LinkButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <PermissionGate page="settings" action="write">
      <Link href={href}>
        <Button variant="secondary" tabIndex={-1}>
          {children}
        </Button>
      </Link>
    </PermissionGate>
  );
}

/** Settings > Branches > one branch: its contact, address, what it does, order settings, table-booking hours and reservation types. */
export default function BranchPage() {
  const { id } = useParams<{ id: string }>();
  const session = useStaffSession();
  const canView = usePermission("settings", "view");
  const canWrite = usePermission("settings", "write");
  const { branches, error, saving, togglingId, updateBranch, patchBranch, setBranchActive, reload } =
    useBranchManagement(canView);
  const branch = useMemo(() => (branches ?? []).find((b) => b.id === id) ?? null, [branches, id]);

  const registrations = useGstRegistrations(canView);
  const linkGst = useLinkBranchGst();
  const linking = linkGst.isPending;
  const activeRegistrations = (registrations.data?.registrations ?? []).filter((r) => r.is_active);
  const registration = (registrations.data?.registrations ?? []).find((r) => r.id === branch?.gst_registration_id) ?? null;
  const [dialog, setDialog] = useState<"contact" | "does" | "orders" | "tax" | "receipt" | null>(null);
  const [registrationId, setRegistrationId] = useState("");
  const [receipt, setReceipt] = useState({ receipt_header: "", receipt_footer: "" });
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<BranchForm>(emptyBranchForm());
  const [does, setDoes] = useState({ accepts_online: true, accepts_whatsapp: true, tables_enabled: false });

  const hours = useBranchBookingHours(canView, branch?.id ?? null);
  const types = useAppointmentTypes(branch?.id ?? null);

  function open(kind: "contact" | "does" | "orders" | "tax" | "receipt", b: Branch) {
    setFormError(null);
    if (kind === "tax") setRegistrationId(b.gst_registration_id ?? "");
    if (kind === "receipt") setReceipt({ receipt_header: b.receipt_header ?? "", receipt_footer: b.receipt_footer ?? "" });
    if (kind === "orders") setForm(toBranchForm(b));
    if (kind === "does")
      setDoes({
        accepts_online: b.accepts_online !== false,
        accepts_whatsapp: b.accepts_whatsapp !== false,
        tables_enabled: !!b.tables_enabled,
      });
    setDialog(kind);
  }

  if (!canView) {
    return (
      <PortalShell restaurant={session?.restaurant || null} active="branches">
        <p className="text-[13px] text-ink-400">You don&apos;t have access to Settings.</p>
      </PortalShell>
    );
  }

  const back = (
    <Link href="/portal/settings/branches" className="mb-space-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink-600 hover:text-ink-900">
      <ArrowLeft size={14} /> All branches
    </Link>
  );

  if (!branches || !branch) {
    return (
      <PortalShell restaurant={session?.restaurant || null} active="branches">
        <div className="mx-auto max-w-[880px]">
          {back}
          {error && <p className="mb-space-3 text-[13px] font-medium text-error">{error}</p>}
          {!branches ? <FormSkeleton fields={4} /> : <p className="text-[13px] text-ink-600">That branch doesn&apos;t exist.</p>}
        </div>
      </PortalShell>
    );
  }

  const phone = formatPhone(branch.phone);
  const activeTypes = (types.types ?? []).filter((t) => t.is_allowed && t.is_active && t.id !== "followup" && t.id !== "procedure");

  return (
    <PortalShell restaurant={session?.restaurant || null} active="branches">
      <div className="mx-auto max-w-[880px]">
        {back}
        <PageHeader
          icon={<Building2 size={20} />}
          title={branch.name}
          description={
            <span className="flex items-center gap-space-2">
              {branch.is_default && <Badge tone="brand">Default</Badge>}
              <Badge tone={branch.is_active ? "success" : "neutral"}>{branch.is_active ? "active" : "inactive"}</Badge>
            </span>
          }
          actions={
            !branch.is_default && (
              <PermissionGate page="settings" action="write">
                <Button
                  variant={branch.is_active ? "destructive" : "secondary"}
                  disabled={togglingId === branch.id}
                  onClick={() => setBranchActive(branch.id, !branch.is_active)}
                >
                  <Power size={14} /> {branch.is_active ? "Deactivate" : "Activate"}
                </Button>
              </PermissionGate>
            )
          }
        />
        {error && <p className="mb-space-3 text-[13px] font-medium text-error">{error}</p>}

        <Section title="Contact" action={<EditButton onClick={() => open("contact", branch)} />}>
          <Row label="Phone">{phone}</Row>
          <Row label="Email">{branch.email}</Row>
        </Section>

        <Section title="Address" action={<EditButton onClick={() => open("contact", branch)} />}>
          <Row label="Address">{branch.address_line}</Row>
          <Row label="City">{branch.city}</Row>
          <Row label="State">{branch.state}</Row>
          <Row label="Pincode">{branch.pincode}</Row>
          <Row label="Store location">
            <span className="font-normal text-ink-600">
              Managed in{" "}
              <Link className="underline" href="/portal/settings/attendance">
                Settings → Attendance
              </Link>
            </span>
          </Row>
        </Section>

        <Section title="Tax" action={<EditButton onClick={() => open("tax", branch)} />}>
          <Row label="GST registration">
            {registration ? [registration.gstin, registration.state_name].filter(Boolean).join(" · ") : null}
          </Row>
        </Section>

        <Section title="What this branch does" action={<EditButton onClick={() => open("does", branch)} />}>
          <Row label="Website orders">
            <OnOff on={branch.accepts_online !== false} />
          </Row>
          <Row label="WhatsApp orders">
            <OnOff on={branch.accepts_whatsapp !== false} />
          </Row>
          <Row label="Dine-in tables">
            <OnOff on={!!branch.tables_enabled} />
          </Row>
          {branch.is_open_override !== null && (
            <Row label="Open or closed">
              <Badge tone={branch.is_open_override ? "success" : "clay"}>
                forced {branch.is_open_override ? "open" : "closed"}
              </Badge>
            </Row>
          )}
        </Section>

        <Section title="Orders and fees" action={<EditButton onClick={() => open("orders", branch)} />}>
          <Row label="Minimum order">{branch.min_order_paise != null ? rupees(branch.min_order_paise) : null}</Row>
          <Row label="Service charge">{branch.service_charge_pct != null ? `${branch.service_charge_pct}%` : null}</Row>
          <Row label="Delivery radius">{branch.delivery_radius_km != null ? `${branch.delivery_radius_km} km` : null}</Row>
          <Row label="Delivery fee">{branch.delivery_fee_paise != null ? rupees(branch.delivery_fee_paise) : null}</Row>
          <Row label="Average prep time">{branch.avg_prep_time_min != null ? `${branch.avg_prep_time_min} min` : null}</Row>
        </Section>

        <Section title="Receipt" action={<EditButton onClick={() => open("receipt", branch)} />}>
          <Row label="Header">{branch.receipt_header}</Row>
          <Row label="Footer">{branch.receipt_footer}</Row>
        </Section>

        <Card className="mb-space-4 p-space-4">
          <h2 className="mb-space-3 text-[15px] font-bold text-ink-900">Opening hours</h2>
          {hours.inherited && hours.loaded && (
            <p className="mb-space-3 text-[13px] text-ink-600">
              This branch uses the restaurant-wide hours until it saves its own.
            </p>
          )}
          <OpeningHoursEditor
            schedule={hours.form.schedule}
            onAdd={hours.addEntry}
            onRemove={hours.removeEntry}
            onSave={() => hours.handleSave()}
            saving={hours.saving}
            dirty={hours.dirty}
            error={hours.error}
            disabled={!canWrite}
          />
        </Card>

        <Section
          title="Reservation types"
          note="Which reservation types this branch offers in the WhatsApp booking menu."
          action={<LinkButton href={`/portal/settings/reservation-types?branch=${branch.id}`}>Edit</LinkButton>}
        >
          <Row label="Offered">{types.types === null ? null : activeTypes.map((t) => t.label).join(", ") || null}</Row>
        </Section>

        <p className="mb-space-6 text-[12.5px] text-ink-400">
          Who works here is under{" "}
          <Link className="underline" href="/portal/settings/staff">
            Users
          </Link>
          .
        </p>
      </div>

      {dialog === "contact" && (
        <ContactDetailsModal
          initial={{
            email: branch.email ?? "",
            phone: branch.phone ?? "",
            address_line: branch.address_line ?? "",
            pincode: branch.pincode ?? "",
            city: branch.city ?? "",
            state: branch.state ?? "",
          }}
          saving={saving}
          error={formError}
          onSave={async (draft) => {
            const problem = await patchBranch(branch, { ...draft });
            if (problem) setFormError(problem);
            else setDialog(null);
          }}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog === "tax" && (
        <Modal
          open
          onClose={() => setDialog(null)}
          width="md"
          title="GST registration"
          footer={
            <>
              <Button variant="ghost" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button
                disabled={linking}
                onClick={() =>
                  linkGst.mutate(
                    { branchId: branch.id, gstRegistrationId: registrationId || null },
                    {
                      onSuccess: () => {
                        reload();
                        setDialog(null);
                      },
                      onError: (e) => setFormError(e.message),
                    },
                  )
                }
              >
                {linking ? "Saving…" : "Save"}
              </Button>
            </>
          }
        >
          <label htmlFor="br-gst" className="text-label mb-space-1 block">
            Registration
          </label>
          <Select id="br-gst" value={registrationId} onValueChange={(v) => setRegistrationId(v)}>
            <option value="">None</option>
            {activeRegistrations.map((r) => (
              <option key={r.id} value={r.id}>
                {r.gstin} — {r.state_name ?? r.state_code}
              </option>
            ))}
          </Select>
          <p className="mt-space-1 text-[12.5px] text-ink-400">
            {(() => {
              const picked = activeRegistrations.find((r) => r.id === registrationId);
              if (!activeRegistrations.length)
                return "No GST registration yet. Add one under Settings → Taxes and duties.";
              if (!picked) return "Invoices from this branch won't show a seller GSTIN.";
              return branch.state && picked.state_name && branch.state !== picked.state_name
                ? `Registered in ${picked.state_name}, but this branch's address is in ${branch.state}. Check both.`
                : `Registered in ${picked.state_name ?? picked.state_code}.`;
            })()}
          </p>
          {formError && <p className="mt-space-2 text-[13px] font-medium text-error">{formError}</p>}
        </Modal>
      )}

      {dialog === "receipt" && (
        <Modal
          open
          onClose={() => setDialog(null)}
          width="md"
          title="Receipt"
          footer={
            <>
              <Button variant="ghost" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button
                disabled={saving}
                onClick={async () => {
                  const problem = await patchBranch(branch, { ...receipt });
                  if (problem) setFormError(problem);
                  else setDialog(null);
                }}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </>
          }
        >
          <label htmlFor="br-rcpt-header" className="text-label mb-space-1 block">
            Header
          </label>
          <Textarea
            id="br-rcpt-header"
            rows={2}
            maxLength={500}
            value={receipt.receipt_header}
            onChange={(e) => setReceipt({ ...receipt, receipt_header: e.target.value })}
          />
          <p className="mb-space-3 mt-space-1 text-[12.5px] text-ink-400">Printed at the top of this branch&apos;s receipts.</p>
          <label htmlFor="br-rcpt-footer" className="text-label mb-space-1 block">
            Footer
          </label>
          <Textarea
            id="br-rcpt-footer"
            rows={2}
            maxLength={500}
            value={receipt.receipt_footer}
            onChange={(e) => setReceipt({ ...receipt, receipt_footer: e.target.value })}
          />
          <p className="mt-space-1 text-[12.5px] text-ink-400">Printed at the bottom, e.g. a thank-you or return policy.</p>
          {formError && <p className="mt-space-2 text-[13px] font-medium text-error">{formError}</p>}
        </Modal>
      )}

      {dialog === "does" && (
        <Modal
          open
          onClose={() => setDialog(null)}
          width="md"
          title="What this branch does"
          footer={
            <>
              <Button variant="ghost" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button
                disabled={saving}
                onClick={async () => {
                  const problem = await patchBranch(branch, { ...does });
                  if (problem) setFormError(problem);
                  else setDialog(null);
                }}
              >
                {saving ? "Saving…" : "Save"}
              </Button>
            </>
          }
        >
          <div className="divide-y divide-line">
            {(
              [
                ["accepts_online", "Takes website orders"],
                ["accepts_whatsapp", "Takes WhatsApp orders"],
                ["tables_enabled", "Dine-in tables"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between py-space-3">
                <span className="text-[14px] text-ink-900">{label}</span>
                <Switch checked={does[key]} onChange={() => setDoes({ ...does, [key]: !does[key] })} aria-label={label} />
              </div>
            ))}
          </div>
          {formError && <p className="mt-space-2 text-[13px] font-medium text-error">{formError}</p>}
        </Modal>
      )}

      {dialog === "orders" && (
        <BranchFormDialog
          title={`Edit ${branch.name}`}
          form={form}
          onChange={(patch) => setForm({ ...form, ...patch })}
          onSubmit={async () => {
            const problem = await updateBranch(branch.id, form);
            if (problem) setFormError(problem);
            else setDialog(null);
          }}
          onClose={() => setDialog(null)}
          saving={saving}
          error={formError}
        />
      )}
    </PortalShell>
  );
}
