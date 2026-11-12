"use client";

import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { Badge } from "@/components/erp-ui/Badge";
import { Button } from "@/components/erp-ui/Button";
import { Field } from "@/components/erp-ui/Field";
import { Input } from "@/components/erp-ui/Input";
import { Modal } from "@/components/erp-ui/Modal";
import { PhoneInput } from "@/components/erp-ui/PhoneInput";
import { Select } from "@/components/erp-ui/Select";
import { erp, useErpQuery, type Customer } from "@/lib/erp/erp";
import type { CrmSettings } from "@/lib/erp/crm";
import {
  BENEFIT_TIERS,
  SOURCE_LABEL,
  TIER_LABEL,
  type BenefitTier,
  type Source,
} from "@/lib/erp/membership";
import { phoneError, toE164 } from "@/lib/erp/phone";
import { toast } from "@/lib/toast";

const MAX_TAGS = 20; // the server's limits (services/crm.py)
const MAX_TAG_LENGTH = 40;

/** "" = not a member. Inactive is not offered: a member only becomes inactive by not buying. */
type Start = "" | BenefitTier;

/** How the server stores a tag: spaces collapsed, the capitalisation kept (tags are told apart without regard to case). */
const tidyTag = (raw: string) => raw.split(/\s+/).filter(Boolean).join(" ");
const sameTag = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/**
 * The Customers page's Add customer form. Name and one of phone / email are all it needs. Membership and tags are optional extras, offered
 * only to someone who may change customers (they are separate calls after the customer exists: if one of them fails the customer is still
 * added and the message says what was not saved). Mount it only while open, so every opening starts blank.
 */
export function AddCustomerModal({
  canEnrich,
  onClose,
  onAdded,
}: {
  /** May also enrol a member and tag (customers:update). */
  canEnrich: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [tier, setTier] = useState<Start>("");
  const [source, setSource] = useState<Source>("in_store");
  const [birthday, setBirthday] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const known = useErpQuery<{ tag: string; customers: number }[]>(
    canEnrich ? "/api/v1/crm/tags" : null,
  );

  // A member's tier follows their loyalty points, so a tier above Regular is set by adding the points that tier starts at.
  const plans = useErpQuery<{ settings: CrmSettings }>(
    canEnrich ? "/api/v1/crm/segments" : null,
  );
  const startPoints = (t: Start): number | null => {
    if (t === "") return 0;
    if (t === "regular") return 0;
    const settings = plans.data?.settings;
    return settings ? settings[`${t}_min_points`] : null; // null: not known (yet)
  };
  const points = startPoints(tier);
  const member = canEnrich && tier !== ""; // a member needs name, phone, email and date of birth
  const hasContact = member
    ? !!form.phone.trim() && !!form.email.trim()
    : !!form.phone.trim() || !!form.email.trim();
  const ready =
    !!form.name.trim() &&
    hasContact &&
    (!member || (!!birthday && points !== null));

  /** Adds what is typed in the tag box; returns the tags afterwards (the state is not updated yet when a submit needs them). */
  function commitDraft(current: string[]): string[] {
    const tag = tidyTag(draft);
    if (!tag) return current;
    if (tag.length > MAX_TAG_LENGTH) {
      setTagError(`A tag can be at most ${MAX_TAG_LENGTH} characters.`);
      return current;
    }
    if (current.some((t) => sameTag(t, tag))) {
      setDraft("");
      return current;
    }
    if (current.length >= MAX_TAGS) {
      setTagError(`A customer can have at most ${MAX_TAGS} tags.`);
      return current;
    }
    setTagError(null);
    setDraft("");
    const next = [...current, tag];
    setTags(next);
    return next;
  }

  async function create() {
    if (busy || !ready) return;
    const bad = phoneError(form.phone);
    if (bad) return toast.error("Check the phone number", bad);
    const pending = canEnrich ? tidyTag(draft) : "";
    const finalTags = canEnrich ? commitDraft(tags) : [];
    if (pending && !finalTags.some((t) => sameTag(t, pending))) return; // the tag box holds one that was refused; its message is showing
    setBusy(true);
    const res = await erp<Customer>("/api/v1/customers", "POST", {
      name: form.name.trim(),
      phone: toE164(form.phone),
      email: form.email.trim() || null,
    });
    if (res.error || !res.data) {
      setBusy(false);
      return toast.error("Couldn't add the customer", res.error ?? undefined);
    }
    const id = String(res.data.id);
    // The customer exists from here on: later steps report what they could not do, and never undo it.
    const missed: string[] = [];
    let dobSaved = true;
    if (canEnrich && birthday) {
      const dob = await erp(`/api/v1/crm/customers/${id}/profile`, "PATCH", {
        birthday,
      });
      if (dob.error) {
        dobSaved = false;
        missed.push(`date of birth (${dob.error})`);
      }
    }
    if (member && dobSaved) {
      {
        const m = await erp("/api/v1/crm/membership/members", "POST", {
          customer_id: id,
          source,
        });
        if (m.error) missed.push(`membership (${m.error})`);
        else if (points) {
          const bonus = await erp(
            `/api/v1/crm/customers/${id}/loyalty`,
            "POST",
            {
              delta: points,
              reason: `Starting tier set when the customer was added (${TIER_LABEL[tier as BenefitTier]})`,
            },
          );
          if (bonus.error)
            missed.push(
              `${TIER_LABEL[tier as BenefitTier]} tier (${bonus.error})`,
            );
        }
      }
    }
    if (finalTags.length) {
      const t = await erp("/api/v1/crm/tags", "POST", {
        customer_ids: [id],
        add: finalTags,
      });
      if (t.error) missed.push(`tags (${t.error})`);
    }
    setBusy(false);
    if (missed.length)
      toast.error(
        "Customer added, but some details were not saved",
        `${missed.join("; ")}. Finish them from the customer's profile.`,
      );
    else toast.success("Customer added");
    onClose();
    onAdded();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add customer"
      description="Name is required, along with at least one of phone or email."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || !ready}
            type="submit"
            form="add-customer-form"
          >
            Add customer
          </Button>
        </>
      }
    >
      <form
        id="add-customer-form"
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <Field className="!mb-space-3" label="Name" htmlFor="c_name" required>
          <Input
            id="c_name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        {canEnrich && (
          <Field
            className="!mb-space-3"
            label="Date of birth"
            htmlFor="c_bday"
            required={member}
            hint={member ? "Needed for a membership." : "Optional."}
          >
            <Input
              id="c_bday"
              type="date"
              required={member}
              max={new Date().toISOString().slice(0, 10)}
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
            />
          </Field>
        )}
        <div className="grid gap-x-space-4 sm:grid-cols-2">
          <Field
            className="!mb-space-3"
            label="Phone"
            htmlFor="c_phone"
            required
            hint={member ? "Required for a member." : undefined}
          >
            <PhoneInput
              id="c_phone"
              required={member || !form.email.trim()}
              value={form.phone}
              onChange={(phone) => setForm({ ...form, phone })}
            />
          </Field>
          <Field
            className="!mb-space-3"
            label="Email"
            htmlFor="c_email"
            required
            hint={member ? "Required for a member." : undefined}
          >
            <Input
              id="c_email"
              type="email"
              required={member || !form.phone.trim()}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
        </div>
        {!member && (
          <p className="-mt-space-1 mb-space-3 text-[12.5px] text-ink-600">
            Phone or email is required; either one is enough.
          </p>
        )}

        {canEnrich && (
          <>
            <Field
              className="!mb-space-3"
              label="Membership"
              htmlFor="c_member"
              hint={
                tier === ""
                  ? "Leave as Not a member to add just the customer."
                  : tier === "regular"
                    ? "They start on the Regular plan and move up as they earn loyalty points."
                    : points === null
                      ? plans.error
                        ? "Couldn't load the points this tier needs. Try again, or choose Regular."
                        : "Loading the points this tier needs…"
                      : `Enrols them and adds ${points} loyalty points, the least ${TIER_LABEL[tier]} needs. The adjustment is recorded with a reason.`
              }
            >
              <Select
                id="c_member"
                value={tier}
                onValueChange={(v) => setTier(v as Start)}
              >
                <option value="">Not a member</option>
                {BENEFIT_TIERS.map((t) => (
                  <option key={t} value={t}>
                    {TIER_LABEL[t]}
                  </option>
                ))}
              </Select>
            </Field>
            {member && (
              <Field className="!mb-space-3" label="Source" htmlFor="c_source">
                <Select
                  id="c_source"
                  value={source}
                  onValueChange={(v) => setSource(v as Source)}
                >
                  {(Object.keys(SOURCE_LABEL) as Source[]).map((s) => (
                    <option key={s} value={s}>
                      {SOURCE_LABEL[s]}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <Field
              className="!mb-space-3"
              label="Tags"
              htmlFor="c_tag"
              error={tagError ?? undefined}
              hint={
                tagError ? undefined : "Press Enter or comma after each tag."
              }
            >
              {tags.length > 0 && (
                <ul
                  className="mb-space-2 flex flex-wrap gap-space-1"
                  aria-label="Tags to add"
                >
                  {tags.map((t) => (
                    <li key={t}>
                      <Badge tone="clay" className="normal-case">
                        {t}
                        <button
                          type="button"
                          aria-label={`Remove tag ${t}`}
                          onClick={() =>
                            setTags((cur) => cur.filter((x) => x !== t))
                          }
                          className="ml-1 inline-flex text-ink-600 hover:text-error"
                        >
                          <HugeiconsIcon icon={Cancel01Icon} size={12} />
                        </button>
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              <Input
                id="c_tag"
                list="c_tag_suggestions"
                placeholder={
                  tags.length ? "Add another tag" : "e.g. vip, wedding"
                }
                value={draft}
                maxLength={MAX_TAG_LENGTH + 10}
                onChange={(e) => {
                  setDraft(e.target.value.replace(/,/g, ""));
                  setTagError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault(); // Enter adds the tag; it does not submit the form
                    commitDraft(tags);
                  } else if (e.key === "Backspace" && !draft && tags.length)
                    setTags((cur) => cur.slice(0, -1));
                }}
              />
              <datalist id="c_tag_suggestions">
                {(known.data ?? [])
                  .filter((k) => !tags.some((t) => sameTag(t, k.tag)))
                  .map((k) => (
                    <option key={k.tag} value={k.tag} />
                  ))}
              </datalist>
            </Field>
          </>
        )}
      </form>
    </Modal>
  );
}
