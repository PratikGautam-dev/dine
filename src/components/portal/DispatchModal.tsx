"use client";

import { useState } from "react";
import { Bike } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import type { DispatchDetails, FoodOrder } from "@/hooks/useFoodOrders";

/** Who is taking this delivery order: the form behind the Kitchen page's "Hand to delivery partner" (an order being
 * prepared) and "Edit details" (an order already out for delivery, to correct or fill in the partner). The same rules
 * the server enforces are checked here first, so a typo is caught before the round trip. */
export function DispatchModal({
  order,
  busy,
  onClose,
  onSubmit,
}: {
  order: FoodOrder;
  busy: boolean;
  onClose: () => void;
  onSubmit: (details: DispatchDetails) => Promise<boolean>;
}) {
  const editing = order.status === "out_for_delivery";
  const [name, setName] = useState(order.delivery_partner_name ?? "");
  const [phone, setPhone] = useState(order.delivery_partner_phone ?? "");
  const [tracking, setTracking] = useState(order.delivery_tracking_id ?? "");
  const [errors, setErrors] = useState<{ name?: string; phone?: string; tracking?: string }>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const found: typeof errors = {};
    const cleanName = name.trim().replace(/\s+/g, " ");
    if (cleanName.length < 2 || cleanName.length > 80)
      found.name = "Enter the delivery partner's name.";
    if (!/^\+?\d{7,15}$/.test(phone.replace(/[\s().-]/g, "")))
      found.phone = "Enter a valid phone number (7 to 15 digits).";
    if (tracking.trim().length > 64) found.tracking = "At most 64 characters.";
    setErrors(found);
    if (Object.keys(found).length) return;
    const ok = await onSubmit({
      partner_name: cleanName,
      partner_phone: phone.trim(),
      tracking_id: tracking.trim(),
    });
    if (ok) onClose();
  }

  return (
    <Modal onClose={onClose} labelledBy="dispatch-title" maxWidthClass="max-w-[460px]">
      <form onSubmit={submit} noValidate>
        <div className="mb-space-4 flex items-center gap-space-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
            <Bike size={22} />
          </span>
          <div className="min-w-0">
            <h2 id="dispatch-title" className="text-[17px] font-bold text-ink-900">
              {editing ? "Delivery details" : "Hand to delivery partner"}
            </h2>
            <p className="truncate text-[13px] text-ink-600">
              {order.reference_id ?? `#${order.id}`} · {order.patient_name || order.phone}
            </p>
          </div>
        </div>
        <Field label="Delivery partner name" htmlFor="dp-name" required error={errors.name}>
          <Input
            id="dp-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            invalid={!!errors.name}
            autoFocus
            placeholder="e.g. Ravi Kumar"
          />
        </Field>
        <Field label="Partner phone number" htmlFor="dp-phone" required error={errors.phone}>
          <Input
            id="dp-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            invalid={!!errors.phone}
            placeholder="e.g. 98765 43210"
          />
        </Field>
        <Field
          label="Tracking ID"
          htmlFor="dp-tracking"
          error={errors.tracking}
          hint={editing ? undefined : "Leave blank and one is generated for you."}
        >
          <Input
            id="dp-tracking"
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            invalid={!!errors.tracking}
            placeholder="From the delivery partner's app"
          />
        </Field>
        <div className="flex justify-end gap-space-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : editing ? "Save details" : "Hand over"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
