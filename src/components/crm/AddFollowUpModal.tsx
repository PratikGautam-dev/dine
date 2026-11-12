"use client";

import { useState } from "react";
import {
  FOLLOW_UP_CHANNEL,
  FOLLOW_UP_PRIORITY,
  FOLLOW_UP_STATUS,
  FOLLOW_UP_TYPE,
} from "@/components/crm/followUpMeta";
import { CustomerSelect } from "@/components/erp/CustomerSelect";
import { Button } from "@/components/erp-ui/Button";
import {
  DateTimeField,
  isoToLocalInput,
  localInputToIso,
} from "@/components/erp-ui/DateTimeField";
import { Field } from "@/components/erp-ui/Field";
import { Input } from "@/components/erp-ui/Input";
import { Modal } from "@/components/erp-ui/Modal";
import { Select } from "@/components/erp-ui/Select";
import type {
  FollowUp,
  FollowUpChannel,
  FollowUpPriority,
  FollowUpStatus,
  FollowUpType,
} from "@/lib/erp/crm";
import { erp, type Customer } from "@/lib/erp/erp";
import { toast } from "@/lib/toast";

/** Customers > Follow-ups: add a follow-up, or (with `editing`) change one. Every column of the table is a field here. */
export function AddFollowUpModal({
  users,
  editing,
  onClose,
  onAdded,
}: {
  users: { id: string; name: string }[];
  editing?: FollowUp;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [type, setType] = useState<FollowUpType>(
    editing?.follow_up_type ?? "call",
  );
  const [channel, setChannel] = useState<FollowUpChannel>(
    editing?.channel ?? "call",
  );
  const [priority, setPriority] = useState<FollowUpPriority>(
    editing?.priority ?? "medium",
  );
  const [status, setStatus] = useState<FollowUpStatus>(
    editing?.status ?? "scheduled",
  );
  const [assignedTo, setAssignedTo] = useState(editing?.assigned_to ?? "");
  const [purpose, setPurpose] = useState(editing?.purpose ?? "");
  const [lastContact, setLastContact] = useState(
    isoToLocalInput(editing?.last_contact_at ?? null),
  );
  const [at, setAt] = useState(isoToLocalInput(editing?.follow_up_at ?? null));
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!editing && !customer)
      return toast.error(
        "Choose a customer",
        "Search for the customer to follow up.",
      );
    if (!purpose.trim())
      return toast.error("Add a purpose", "Say what the follow-up is about.");
    const iso = localInputToIso(at);
    if (!iso)
      return toast.error("Choose when", "Pick the date and time to follow up.");
    setSaving(true);
    const fields = {
      body: purpose.trim(),
      follow_up_at: iso,
      follow_up_type: type,
      channel,
      priority,
      status,
      last_contact_at: localInputToIso(lastContact),
    };
    const res = editing
      ? await erp(`/api/v1/crm/notes/${editing.id}`, "PATCH", {
          ...fields,
          assigned_to: assignedTo || null,
        })
      : await erp(`/api/v1/crm/customers/${customer!.id}/notes`, "POST", {
          ...fields,
          ...(assignedTo ? { assigned_to: assignedTo } : {}),
        });
    setSaving(false);
    if (res.error)
      return toast.error(
        editing ? "Couldn't save the follow-up" : "Couldn't add the follow-up",
        res.error,
      );
    toast.success(editing ? "Follow-up saved" : "Follow-up added");
    onAdded();
    onClose();
  }

  return (
    <Modal
      open
      width="lg"
      title={editing ? "Edit follow-up" : "Add follow-up"}
      description={
        editing
          ? "Change any detail of this follow-up."
          : "Schedule a reminder to get back to a customer."
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add follow-up"}
          </Button>
        </>
      }
    >
      <Field label="Customer" htmlFor="fu_customer" required={!editing}>
        {editing ? (
          <p className="flex h-10 items-center rounded-md border border-line bg-black/[0.03] px-space-3 text-[14px] text-ink-900">
            {editing.customer_name}
            {editing.customer_code && (
              <span className="ml-2 text-[12px] text-ink-400">
                {editing.customer_code}
              </span>
            )}
          </p>
        ) : (
          <CustomerSelect
            id="fu_customer"
            value={customer}
            onChange={setCustomer}
          />
        )}
      </Field>
      <div className="grid gap-x-space-3 sm:grid-cols-2">
        <Field label="Follow-up type" htmlFor="fu_type">
          <Select
            id="fu_type"
            value={type}
            onValueChange={(v) => setType(v as FollowUpType)}
          >
            {(Object.keys(FOLLOW_UP_TYPE) as FollowUpType[]).map((t) => (
              <option key={t} value={t}>
                {FOLLOW_UP_TYPE[t].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Channel" htmlFor="fu_channel">
          <Select
            id="fu_channel"
            value={channel}
            onValueChange={(v) => setChannel(v as FollowUpChannel)}
          >
            {(Object.keys(FOLLOW_UP_CHANNEL) as FollowUpChannel[]).map((c) => (
              <option key={c} value={c}>
                {FOLLOW_UP_CHANNEL[c].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priority" htmlFor="fu_priority">
          <Select
            id="fu_priority"
            value={priority}
            onValueChange={(v) => setPriority(v as FollowUpPriority)}
          >
            {(Object.keys(FOLLOW_UP_PRIORITY) as FollowUpPriority[]).map(
              (p) => (
                <option key={p} value={p}>
                  {FOLLOW_UP_PRIORITY[p].label}
                </option>
              ),
            )}
          </Select>
        </Field>
        <Field label="Status" htmlFor="fu_status">
          <Select
            id="fu_status"
            value={status}
            onValueChange={(v) => setStatus(v as FollowUpStatus)}
          >
            {(Object.keys(FOLLOW_UP_STATUS) as FollowUpStatus[]).map((s) => (
              <option key={s} value={s}>
                {FOLLOW_UP_STATUS[s].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Assigned to"
          htmlFor="fu_assigned"
          className="sm:col-span-2"
        >
          <Select
            id="fu_assigned"
            value={assignedTo}
            onValueChange={setAssignedTo}
          >
            <option value="">{editing ? "Unassigned" : "Me"}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Purpose" htmlFor="fu_purpose" required>
        <Input
          id="fu_purpose"
          maxLength={2000}
          placeholder="e.g. Share new festive offer"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
        />
      </Field>
      <div className="grid gap-x-space-3 sm:grid-cols-2">
        <DateTimeField
          id="fu_last"
          label="Last contact"
          value={lastContact}
          onChange={setLastContact}
          defaultTime="10:00"
        />
        <DateTimeField
          id="fu_at"
          label="Next follow-up"
          value={at}
          onChange={setAt}
          defaultTime="10:00"
        />
      </div>
    </Modal>
  );
}
