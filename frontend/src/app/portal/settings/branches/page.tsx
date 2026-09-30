"use client";

import { useState } from "react";
import { MapPin, Pencil, Plus, Store } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Switch } from "@/components/ui/Switch";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { PortalShell } from "@/components/portal/PortalShell";
import { usePermission, useStaffSession } from "@/lib/staffAuth";
import {
  emptyBranchForm, toBranchForm, useBranchManagement, type BranchForm,
} from "@/hooks/useBranchManagement";
import type { Branch } from "@/lib/branchContext";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function BranchFormCard({
  title, form, onChange, onSubmit, onCancel, saving, error, canWrite,
}: {
  title: string;
  form: BranchForm;
  onChange: (patch: Partial<BranchForm>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
  canWrite: boolean;
}) {
  function toggleDay(day: string) {
    onChange({
      operating_days: form.operating_days.includes(day)
        ? form.operating_days.filter((d) => d !== day)
        : [...form.operating_days, day],
    });
  }

  return (
    <Card className="mb-space-4 p-space-5">
      <h2 className="mb-space-4 text-[15px] font-bold text-ink-900">{title}</h2>
      <div className="grid grid-cols-1 gap-x-space-4 sm:grid-cols-2">
        <Field label="Branch name" htmlFor="br-name" required>
          <Input id="br-name" value={form.name} onChange={(e) => onChange({ name: e.target.value })} disabled={!canWrite} />
        </Field>
        <Field label="City" htmlFor="br-city">
          <Input id="br-city" value={form.city} onChange={(e) => onChange({ city: e.target.value })} disabled={!canWrite} />
        </Field>
        <Field label="Address" htmlFor="br-address" className="sm:col-span-2">
          <Input id="br-address" value={form.address_line} onChange={(e) => onChange({ address_line: e.target.value })} disabled={!canWrite} />
        </Field>
        <Field label="Phone" htmlFor="br-phone">
          <Input id="br-phone" value={form.phone} onChange={(e) => onChange({ phone: e.target.value })} disabled={!canWrite} />
        </Field>
        <Field label="Operating hours" htmlFor="br-hours" hint="e.g. 11:00-23:00 -- leave blank to use the restaurant's own hours">
          <Input id="br-hours" value={form.operating_hours} onChange={(e) => onChange({ operating_hours: e.target.value })} placeholder="11:00-23:00" disabled={!canWrite} />
        </Field>
        <Field label="Turnover (min)" htmlFor="br-turnover" hint="Leave blank to use the restaurant's own setting">
          <Input id="br-turnover" type="number" min="0" value={form.turnover_minutes} onChange={(e) => onChange({ turnover_minutes: e.target.value })} disabled={!canWrite} />
        </Field>
        <Field label="Booking interval (min)" htmlFor="br-interval" hint="Leave blank to use the restaurant's own setting">
          <Input id="br-interval" type="number" min="0" value={form.booking_interval_minutes} onChange={(e) => onChange({ booking_interval_minutes: e.target.value })} disabled={!canWrite} />
        </Field>
        <div className="sm:col-span-2">
          <p className="mb-space-2 text-[12.5px] font-semibold text-ink-700">Operating days</p>
          <div className="flex flex-wrap gap-space-2">
            {WEEKDAYS.map((day) => (
              <button
                key={day}
                type="button"
                disabled={!canWrite}
                onClick={() => toggleDay(day)}
                className={`rounded-md border px-space-3 py-1 text-[12.5px] font-semibold transition-colors ${
                  form.operating_days.includes(day) ? "border-brand-400 bg-brand-50 text-brand-700" : "border-line text-ink-600"
                }`}
              >
                {day}
              </button>
            ))}
          </div>
        </div>
      </div>
      {error && <p className="mt-space-2 text-[13px] font-medium text-error">{error}</p>}
      <div className="mt-space-4 flex gap-space-2">
        <Button type="button" onClick={onSubmit} disabled={saving || !form.name.trim()}>{saving ? "Saving…" : "Save"}</Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>Cancel</Button>
      </div>
    </Card>
  );
}

function BranchRow({ branch, canWrite, onEdit, onToggleActive, togglingId }: {
  branch: Branch;
  canWrite: boolean;
  onEdit: () => void;
  onToggleActive: () => void;
  togglingId: string | null;
}) {
  return (
    <Card className="mb-space-3 flex items-center justify-between gap-space-3 p-space-4">
      <div className="flex min-w-0 items-center gap-space-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
          <Store size={18} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-space-2">
            <p className="truncate text-[13.5px] font-bold text-ink-900">{branch.name}</p>
            {branch.is_default && <Badge tone="brand">Default</Badge>}
            {!branch.is_active && <Badge tone="neutral">Inactive</Badge>}
          </div>
          {(branch.address_line || branch.city) && (
            <p className="flex items-center gap-1 text-[12px] text-ink-600">
              <MapPin size={12} /> {[branch.address_line, branch.city].filter(Boolean).join(", ")}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-space-2">
        {canWrite && (
          <>
            <Button variant="secondary" onClick={onEdit}>
              <Pencil size={13} /> Edit
            </Button>
            {!branch.is_default && (
              <Switch
                checked={branch.is_active}
                onChange={onToggleActive}
                disabled={togglingId === branch.id}
                aria-label={branch.is_active ? "Deactivate branch" : "Activate branch"}
              />
            )}
          </>
        )}
      </div>
    </Card>
  );
}

export default function BranchesSettingsPage() {
  const session = useStaffSession();
  const canView = usePermission("settings", "view");
  const canWrite = usePermission("settings", "write");
  const {
    multiBranchEnabled, branches, error, saving, togglingId,
    toggleMultiBranch, createBranch, updateBranch, setBranchActive,
  } = useBranchManagement(canView);

  const [adding, setAdding] = useState(false);
  const [addForm, setAddForm] = useState<BranchForm>(emptyBranchForm());
  const [addError, setAddError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<BranchForm>(emptyBranchForm());
  const [editError, setEditError] = useState<string | null>(null);

  if (!canView) {
    return (
      <PortalShell hospital={session?.hospital || null} active="branches">
        <p className="text-[13px] text-ink-400">You don&apos;t have access to Settings.</p>
      </PortalShell>
    );
  }

  function openAdd() {
    setAddForm(emptyBranchForm());
    setAddError(null);
    setAdding(true);
  }

  function openEdit(branch: Branch) {
    setEditForm(toBranchForm(branch));
    setEditError(null);
    setEditingId(branch.id);
  }

  async function handleAdd() {
    setAddError(null);
    const problem = await createBranch(addForm);
    if (problem) setAddError(problem);
    else setAdding(false);
  }

  async function handleEdit() {
    if (!editingId) return;
    setEditError(null);
    const problem = await updateBranch(editingId, editForm);
    if (problem) setEditError(problem);
    else setEditingId(null);
  }

  return (
    <PortalShell hospital={session?.hospital || null} active="branches">
      <PageHeader
        title="Branches"
        icon={<Store size={22} />}
        description="Add locations for this restaurant -- the WhatsApp bot and portal stay one unified account, filterable by branch."
      />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

      <Card className="mb-space-4 flex items-center justify-between p-space-5">
        <div>
          <h2 className="text-[15px] font-bold text-ink-900">Enable multiple branches</h2>
          <p className="text-hint">
            Off means today&apos;s behavior -- one location, no branch question on WhatsApp, no switcher in the portal.
          </p>
        </div>
        <Switch
          checked={multiBranchEnabled}
          onChange={() => toggleMultiBranch(!multiBranchEnabled)}
          disabled={!canWrite || saving}
          aria-label="Enable multiple branches"
        />
      </Card>

      {!branches ? (
        <p className="text-[13px] text-ink-400">Loading…</p>
      ) : (
        <>
          {branches.map((b) =>
            editingId === b.id ? (
              <BranchFormCard
                key={b.id}
                title={`Edit ${b.name}`}
                form={editForm}
                onChange={(patch) => setEditForm({ ...editForm, ...patch })}
                onSubmit={handleEdit}
                onCancel={() => setEditingId(null)}
                saving={saving}
                error={editError}
                canWrite={canWrite}
              />
            ) : (
              <BranchRow
                key={b.id}
                branch={b}
                canWrite={canWrite}
                onEdit={() => openEdit(b)}
                onToggleActive={() => setBranchActive(b.id, !b.is_active)}
                togglingId={togglingId}
              />
            ),
          )}

          {adding ? (
            <BranchFormCard
              title="Add a branch"
              form={addForm}
              onChange={(patch) => setAddForm({ ...addForm, ...patch })}
              onSubmit={handleAdd}
              onCancel={() => setAdding(false)}
              saving={saving}
              error={addError}
              canWrite={canWrite}
            />
          ) : (
            <PermissionGate page="settings" action="write">
              <Button variant="secondary" onClick={openAdd}>
                <Plus size={14} /> Add a branch
              </Button>
            </PermissionGate>
          )}
        </>
      )}
    </PortalShell>
  );
}
