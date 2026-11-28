"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/erp-ui/Field";
import { Input, Textarea } from "@/components/erp-ui/Input";
import { Modal } from "@/components/erp-ui/Modal";
import { PhoneInput } from "@/components/erp-ui/PhoneInput";
import { Select } from "@/components/erp-ui/Select";
import { usePincodePlace } from "@/hooks/usePincodePlace";
import { phoneError, toE164 } from "@/lib/erp/phone";
import { STATES } from "@/lib/states";

export type ContactDraft = {
  email: string;
  phone: string;
  address_line: string;
  pincode: string;
  city: string;
  state: string;
};

const digitsOnly = (v: string, max?: number) => v.replace(/\D/g, "").slice(0, max);

/** Settings > General > Store contact details: email, phone and address in one dialog. The pincode comes first and fills the state
 * (locked, or a choice of two for a border pincode) and an empty city (from the district, still editable). A pincode India Post doesn't
 * list is allowed with a warning, and then the state is chosen from the list. */
export function ContactDetailsModal({
  initial,
  saving,
  error,
  onSave,
  onClose,
}: {
  initial: ContactDraft;
  saving: boolean;
  error: string | null;
  onSave: (draft: ContactDraft) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<ContactDraft>(initial);
  const [phoneProblem, setPhoneProblem] = useState<string | null>(null);
  const set = (patch: Partial<ContactDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const { place, unknown, checking } = usePincodePlace(draft.pincode);
  const applied = useRef<{ pincode: string; district: string } | null>(null);
  useEffect(() => {
    if (!place || applied.current?.pincode === place.pincode) return;
    const filledCity = applied.current?.district; // a city filled from the previous pincode follows the new one
    applied.current = { pincode: place.pincode, district: place.district };
    setDraft((d) => {
      const patch: Partial<ContactDraft> = {};
      if (!place.states.some((s) => s.name === d.state)) patch.state = place.state;
      if (!d.city.trim() || d.city === filledCity) patch.city = place.district;
      return Object.keys(patch).length ? { ...d, ...patch } : d;
    });
  }, [place]);

  const border = !!place && place.states.length > 1;
  const stateOptions = border && place ? place.states : STATES;

  function submit() {
    const bad = phoneError(draft.phone, "any");
    if (bad) return setPhoneProblem(bad);
    setPhoneProblem(null);
    onSave({ ...draft, phone: toE164(draft.phone, "any") ?? "" });
  }

  return (
    <Modal
      open
      onClose={onClose}
      width="lg"
      title="Contact details"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={submit}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <div className="grid gap-x-space-4 sm:grid-cols-2">
        <Field label="Email" htmlFor="c_email">
          <Input
            id="c_email"
            type="email"
            value={draft.email}
            onChange={(e) => set({ email: e.target.value })}
          />
        </Field>
        <Field
          label="Phone"
          htmlFor="c_phone"
          hint="Mobile, or a landline with its STD code."
          error={phoneProblem ?? undefined}
        >
          <PhoneInput
            id="c_phone"
            kind="any"
            value={draft.phone}
            onChange={(phone) => set({ phone })}
          />
        </Field>
        <Field label="Address" htmlFor="c_addr" className="sm:col-span-2">
          <Textarea
            id="c_addr"
            rows={2}
            value={draft.address_line}
            onChange={(e) => set({ address_line: e.target.value })}
          />
        </Field>
        <Field
          label="Pincode"
          htmlFor="c_pin"
          error={
            unknown
              ? "India Post doesn't list this pincode. Check it, or choose the state yourself."
              : undefined
          }
          hint={
            checking
              ? "Looking up…"
              : place
                ? `${place.district}, ${border ? place.states.map((s) => s.name).join(" / ") : place.state}`
                : "Fills the city and state"
          }
        >
          <Input
            id="c_pin"
            inputMode="numeric"
            autoComplete="postal-code"
            value={draft.pincode}
            onChange={(e) => set({ pincode: digitsOnly(e.target.value, 6) })}
          />
        </Field>
        <Field label="City" htmlFor="c_city">
          <Input
            id="c_city"
            value={draft.city}
            maxLength={100}
            list={place ? "c_places" : undefined}
            onChange={(e) => set({ city: e.target.value })}
          />
          {place && (
            <datalist id="c_places">
              {[place.district, ...place.localities]
                .filter((n, i, all) => all.indexOf(n) === i)
                .map((n) => (
                  <option key={n} value={n} />
                ))}
            </datalist>
          )}
        </Field>
        <Field
          label="State"
          htmlFor="c_state"
          hint={
            border
              ? "This pincode reaches two states. Choose the right one."
              : place
                ? "From the pincode"
                : undefined
          }
        >
          <Select
            id="c_state"
            value={draft.state}
            disabled={!!place && !border}
            onValueChange={(state) => set({ state })}
          >
            <option value="">Choose a state…</option>
            {stateOptions.map((s) => (
              <option key={s.code} value={s.name}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {error && <p className="mt-space-2 text-[13px] font-medium text-error">{error}</p>}
    </Modal>
  );
}
