"use client";

import { useState } from "react";
import { erp } from "@/lib/erp/erp";
import type { ConsentDecision, ConsentSource, ConsentType } from "@/lib/erp/crm";
import { toast } from "@/lib/toast";

const SOURCE_LABEL: Record<ConsentSource, string> = {
  storefront: "the website",
  whatsapp: "WhatsApp",
  pos: "the POS",
  staff: "staff",
};

const ROWS: { type: ConsentType; label: string }[] = [
  { type: "dpdp", label: "DPDP" },
  { type: "privacy_policy", label: "Privacy Policy" },
  { type: "marketing", label: "Marketing" },
];

function when(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** The customer's DPDP / Privacy Policy / Marketing decisions, collected on the website, WhatsApp and the POS. Staff can record one the customer
 * gave in person. Privacy Policy follows DPDP, so it is shown but cannot be changed on its own. */
export function ConsentManagement({
  customerId,
  consents,
  canEdit,
  hasPhone,
  onChanged,
}: {
  customerId: string;
  consents: Record<ConsentType, ConsentDecision>;
  canEdit: boolean;
  hasPhone: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function choose(type: "dpdp" | "marketing", agreed: boolean) {
    setBusy(true);
    const res = await erp(`/api/v1/crm/customers/${customerId}/consents`, "PUT", {
      [type]: agreed,
    });
    setBusy(false);
    if (res.error) return toast.error("Couldn't save consent", res.error);
    toast.success("Consent saved");
    onChanged();
  }

  const editable = canEdit && hasPhone && !busy;

  return (
    <div data-testid="consent-management">
      <h3 className="mb-space-1 text-[14px] font-bold text-ink-900">Consent management</h3>
      <p className="mb-space-3 text-[12.5px] text-ink-600">
        DPDP consent is collected from customers on the website, WhatsApp and the POS. Privacy
        Policy mirrors DPDP (linked). Marketing consent is independent.
        {!hasPhone && " Add a phone number to record consent for this customer."}
      </p>
      <div className="space-y-space-3">
        {ROWS.map(({ type, label }) => {
          const d = consents?.[type] ?? null;
          const linked = type === "privacy_policy";
          const agreed = d?.status === "agreed";
          const disagreed = d?.status === "disagreed";
          const disabled = linked || !editable;
          return (
            <div key={type}>
              <div className="flex items-center justify-between gap-space-3">
                <span className="text-[13.5px] font-semibold text-ink-900">{label}</span>
                <div className="flex items-center gap-space-4 text-[13px]">
                  <label className="flex items-center gap-space-1">
                    <input
                      type="checkbox"
                      checked={agreed}
                      disabled={disabled}
                      onChange={() => !linked && choose(type as "dpdp" | "marketing", true)}
                      aria-label={`${label}: agree`}
                    />
                    Agree
                  </label>
                  <label className="flex items-center gap-space-1">
                    <input
                      type="checkbox"
                      checked={disagreed}
                      disabled={disabled}
                      onChange={() => !linked && choose(type as "dpdp" | "marketing", false)}
                      aria-label={`${label}: disagree`}
                    />
                    Disagree
                  </label>
                </div>
              </div>
              <p className="text-[11.5px] text-ink-400">
                {d
                  ? `Recorded via ${SOURCE_LABEL[d.source]} · ${when(d.decided_at)}`
                  : "Not asked yet"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
