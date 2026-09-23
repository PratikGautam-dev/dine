"use client";

import { useMemo, useState } from "react";
import {
  Award, Calendar, Crown, Mail, MapPin, Medal, Plus, Repeat, Search, Star, Trash2, UserPlus, UserRound, Users, X,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { DepartmentDonut } from "@/components/portal/DepartmentDonut";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/portal/StatTile";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { formatDate } from "@/lib/formatDate";
import { rupees } from "@/lib/foodOrders";
import { usePatients, type Patient } from "@/hooks/usePatients";
import { createPatientColumns } from "./_components/patients-columns";

const DAY_MS = 24 * 60 * 60 * 1000;
// The list API returns at most this many guests (most recently seen first).
const DIRECTORY_LIMIT = 200;

const LOYALTY_ICON: Record<string, typeof Crown> = { VIP: Crown, Gold: Medal, Silver: Star, Bronze: Award };

export default function PortalPatientsPage() {
  const { hospital, ready } = usePortalGuard();
  const {
    patients,
    directory,
    error,
    search,
    setSearch,
    selected,
    toggleSelected,
    toggleSelectAll,
    selectedPatients,
    allSelected,
    pendingDelete,
    setPendingDelete,
    deleting,
    runDelete,
    activeId,
    profile,
    profileLoading,
    savingProfile,
    openProfile,
    closeProfile,
    saveProfileFields,
    creating,
    createCustomer,
  } = usePatients(ready);

  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const columns = useMemo(
    () =>
      createPatientColumns({
        selected, toggleSelected, toggleSelectAll, allSelected,
        onDelete: (p: Patient) => setPendingDelete([p]),
      }),
    [selected, toggleSelected, toggleSelectAll, allSelected, setPendingDelete],
  );

  // Everything below describes the whole directory (not the current search).
  const summary = useMemo(() => {
    const all = directory || [];
    const now = new Date().getTime();
    const cutoff30 = now - 30 * DAY_MS;
    const cutoff7 = now - 7 * DAY_MS;
    const byBookings = [
      { department_name: "1 booking", count: all.filter((p) => p.visit_count === 1).length },
      { department_name: "2–3 bookings", count: all.filter((p) => p.visit_count >= 2 && p.visit_count <= 3).length },
      { department_name: "4 or more", count: all.filter((p) => p.visit_count >= 4).length },
    ].filter((s) => s.count > 0);
    return {
      total: all.length,
      returning: all.filter((p) => p.visit_count >= 2).length,
      vip: all.filter((p) => p.loyalty_tier === "VIP").length,
      active30: all.filter((p) => p.last_visit && new Date(p.last_visit).getTime() >= cutoff30).length,
      newThisWeek: all.filter((p) => p.created_at && new Date(p.created_at).getTime() >= cutoff7).length,
      byBookings,
      top: [...all]
        .filter((p) => p.total_spend_paise > 0)
        .sort((a, b) => b.total_spend_paise - a.total_spend_paise)
        .slice(0, 5),
    };
  }, [directory]);

  async function handleAddCustomer() {
    const ok = await createCustomer({ name: newName.trim(), phone: newPhone.trim() });
    if (ok) {
      setAddOpen(false);
      setNewName("");
      setNewPhone("");
    }
  }

  async function handleAddNote() {
    if (!noteDraft.trim()) return;
    setAddingNote(true);
    await saveProfileFields({ notes: noteDraft.trim() });
    setAddingNote(false);
    setNoteDraft("");
  }

  return (
    <PortalShell hospital={hospital} active="patients">
        <div className="mb-space-2 flex flex-wrap items-start justify-between gap-space-3">
          <PageHeader
            title="Customers"
            icon={<Users size={22} />}
            description="Build stronger relationships with your guests."
          />
          <PermissionGate page="patients" action="write">
            <Button size="md" onClick={() => setAddOpen(true)}>
              <UserPlus size={15} /> Add Customer
            </Button>
          </PermissionGate>
        </div>
        {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

        {directory && (
          <>
            <div className="mb-space-4 grid grid-cols-1 gap-space-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <StatTile icon={<Users size={22} />} label="Total customers" value={summary.total} deltaPct={null} hint="In your directory" tone="brand" filled />
              <StatTile icon={<Calendar size={22} />} label="Active, last 30 days" value={summary.active30} deltaPct={null} hint="Booked or visited recently" tone="info" filled />
              <StatTile icon={<Repeat size={22} />} label="Repeat guests" value={summary.returning} deltaPct={null} hint="Booked 2 or more times" tone="warning" filled />
              <StatTile icon={<Crown size={22} />} label="VIP customers" value={summary.vip} deltaPct={null} hint="Top loyalty tier" tone="clay" filled />
              <StatTile icon={<UserPlus size={22} />} label="New this week" value={summary.newThisWeek} deltaPct={null} hint="Joined in the last 7 days" tone="violet" filled />
            </div>
            {directory.length >= DIRECTORY_LIMIT && (
              <p className="mb-space-3 text-[12px] text-ink-400">
                Showing your {DIRECTORY_LIMIT} most recently seen guests; the counts below cover those.
              </p>
            )}
          </>
        )}

        <div className="grid grid-cols-1 gap-space-4 xl:grid-cols-[1fr_340px]">
          <div className="min-w-0">
            <div className="mb-space-3 flex flex-col gap-space-3 sm:flex-row sm:items-center sm:justify-between sm:gap-space-4">
              <div className="relative w-full flex-1 sm:max-w-[360px]">
                <Search size={15} className="absolute top-1/2 left-space-3 -translate-y-1/2 text-ink-400" />
                <Input
                  placeholder="Search by name or phone"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {selectedPatients.length > 0 && (
                <PermissionGate page="patients" action="delete">
                  <Button variant="destructive" size="md" onClick={() => setPendingDelete(selectedPatients)}>
                    <Trash2 size={15} />
                    Delete selected ({selectedPatients.length})
                  </Button>
                </PermissionGate>
              )}
            </div>

            <Card className="p-space-4">
              {!patients ? (
                <p className="text-[13px] text-ink-400">Loading…</p>
              ) : patients.length === 0 ? (
                <div className="py-space-6 text-center">
                  <UserRound size={28} className="mx-auto mb-space-2 text-ink-300" />
                  <p className="text-[13px] text-ink-400">
                    {search ? "No customers match that search." : "No customers yet — they appear here after a first booking."}
                  </p>
                </div>
              ) : (
                <DataTable
                  columns={columns}
                  data={patients}
                  getRowId={(p) => String(p.id)}
                  onRowClick={(p) => openProfile(p.id)}
                />
              )}
            </Card>
          </div>

          <div className="min-w-0">
            {activeId === null ? (
              <Card className="flex h-full min-h-[240px] flex-col items-center justify-center p-space-4 text-center">
                <UserRound size={26} className="mb-space-2 text-ink-300" />
                <p className="text-[13px] text-ink-400">Select a customer to see their profile.</p>
              </Card>
            ) : (
              <Card className="p-space-4">
                <div className="mb-space-4 flex items-center justify-between">
                  <h3 className="text-[15px] font-bold text-ink-900">Customer Details</h3>
                  <button
                    type="button"
                    onClick={closeProfile}
                    className="rounded-md p-1 text-ink-400 hover:bg-black/4 hover:text-ink-900"
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>

                {profileLoading || !profile ? (
                  <p className="text-[12.5px] text-ink-400">Loading…</p>
                ) : (
                  <>
                    <div className="mb-space-4 flex items-center gap-space-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[16px] font-bold text-brand-700">
                        {(profile.name || profile.phone).trim().charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-space-1">
                          <p className="truncate text-[15px] font-bold text-ink-900">{profile.name || "Not registered yet"}</p>
                          {profile.loyalty_tier && (() => {
                            const Icon = LOYALTY_ICON[profile.loyalty_tier] ?? Star;
                            return (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-warning-tint px-space-2 py-0.5 text-[10.5px] font-bold text-warning">
                                <Icon size={11} /> {profile.loyalty_tier}
                              </span>
                            );
                          })()}
                        </div>
                        <p className="text-[12px] text-ink-600">
                          {profile.total_orders} orders · {profile.patient_display_id || `#${profile.id}`}
                        </p>
                      </div>
                    </div>

                    <div className="mb-space-4 space-y-space-2 text-[13px]">
                      <p className="flex items-center gap-space-2 text-ink-700">
                        <WhatsAppIcon size={14} /> {profile.phone}
                      </p>
                      {profile.email && (
                        <p className="flex items-center gap-space-2 text-ink-700">
                          <Mail size={14} className="text-ink-400" /> {profile.email}
                        </p>
                      )}
                      {profile.address && (
                        <p className="flex items-center gap-space-2 text-ink-700">
                          <MapPin size={14} className="text-ink-400" /> {profile.address}
                        </p>
                      )}
                    </div>

                    {profile.loyalty_tier && (
                      <div className="mb-space-4 flex items-center justify-between rounded-lg bg-paper px-space-3 py-space-3">
                        <div>
                          <p className="text-[11px] font-semibold text-ink-600">LOYALTY POINTS</p>
                          <p className="text-[20px] font-bold tabular-nums text-ink-900">{profile.loyalty_points}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[11px] font-semibold text-ink-600">MEMBER SINCE</p>
                          <p className="text-[12.5px] font-semibold text-ink-900">{formatDate(profile.created_at)}</p>
                        </div>
                      </div>
                    )}

                    <dl className="mb-space-4 space-y-space-2 text-[12.5px]">
                      {profile.dietary_preference && (
                        <div className="flex justify-between gap-space-3">
                          <dt className="text-ink-600">Dietary preference</dt>
                          <dd className="font-semibold text-ink-900">{profile.dietary_preference}</dd>
                        </div>
                      )}
                      {profile.allergies && (
                        <div className="flex justify-between gap-space-3">
                          <dt className="text-ink-600">Allergies</dt>
                          <dd className="font-semibold text-error">{profile.allergies}</dd>
                        </div>
                      )}
                      {profile.favorite_item && (
                        <div className="flex justify-between gap-space-3">
                          <dt className="text-ink-600">Favorite item</dt>
                          <dd className="font-semibold text-ink-900">{profile.favorite_item}</dd>
                        </div>
                      )}
                      <div className="flex justify-between gap-space-3">
                        <dt className="text-ink-600">Preferred channel</dt>
                        <dd className="flex items-center gap-1 font-semibold text-ink-900"><WhatsAppIcon size={12} /> WhatsApp</dd>
                      </div>
                      <div className="flex justify-between gap-space-3">
                        <dt className="text-ink-600">Total spend</dt>
                        <dd className="font-semibold text-ink-900">{rupees(profile.total_spend_paise)}</dd>
                      </div>
                      <div className="flex justify-between gap-space-3">
                        <dt className="text-ink-600">Last visit</dt>
                        <dd className="font-semibold text-ink-900">{formatDate(profile.last_visit)}</dd>
                      </div>
                    </dl>

                    {profile.notes && (
                      <div className="mb-space-4 rounded-lg bg-paper p-space-3">
                        <p className="mb-space-1 text-[11px] font-semibold text-ink-600">NOTES</p>
                        <p className="text-[12.5px] text-ink-700">{profile.notes}</p>
                      </div>
                    )}

                    <div className="mb-space-4 grid grid-cols-2 gap-space-2">
                      <a
                        href={`https://wa.me/${profile.phone.replace(/[^\d]/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-space-1 rounded-md bg-success px-space-3 py-space-2 text-[12.5px] font-semibold text-white hover:opacity-90"
                      >
                        <WhatsAppIcon size={14} className="brightness-0 invert" /> Message
                      </a>
                      <Link
                        href={`/portal/patients/${profile.id}`}
                        className="inline-flex items-center justify-center gap-space-1 rounded-md border border-line bg-card px-space-3 py-space-2 text-[12.5px] font-semibold text-ink-900 hover:bg-paper"
                      >
                        View History
                      </Link>
                    </div>

                    <PermissionGate page="patients" action="write">
                      <div className="border-t border-line pt-space-3">
                        <label className="mb-space-1 block text-[11px] font-semibold text-ink-600">ADD NOTE</label>
                        <div className="flex gap-space-2">
                          <Input
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            placeholder="Write a note about this guest…"
                            className="text-[12.5px]"
                          />
                          <Button size="md" variant="secondary" onClick={handleAddNote} disabled={addingNote || savingProfile || !noteDraft.trim()}>
                            {addingNote ? "…" : "Save"}
                          </Button>
                        </div>
                      </div>
                    </PermissionGate>
                  </>
                )}
              </Card>
            )}
          </div>
        </div>

        {directory && (
          <div className="mt-space-4 grid grid-cols-1 gap-space-4 lg:grid-cols-2">
            <DepartmentDonut
              data={summary.byBookings}
              title="Customer segments"
              subtitle="How often your guests come back"
              unit="guests"
              emptyText="No guests yet."
            />
            <Card className="p-space-4">
              <div className="mb-space-3">
                <h3 className="text-[15px] font-bold text-ink-900">Top customers by spend</h3>
                <p className="text-hint">Highest lifetime spend first</p>
              </div>
              {summary.top.length === 0 ? (
                <div className="flex h-[200px] items-center justify-center text-[13px] text-ink-400">
                  No spend recorded yet.
                </div>
              ) : (
                <ol className="divide-y divide-line">
                  {summary.top.map((p, i) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => openProfile(p.id)}
                        className="flex w-full items-center gap-space-3 py-space-2 text-left hover:opacity-80"
                      >
                        <span className="w-5 text-[12px] font-semibold text-ink-400">{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold text-ink-900">{p.name || p.phone}</span>
                          {p.name && <span className="block text-[12px] text-ink-600">{p.phone}</span>}
                        </span>
                        <span className="text-right text-[13px] font-semibold tabular-nums text-ink-900">
                          {rupees(p.total_spend_paise)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>
        )}

        <ConfirmDialog
          open={pendingDelete !== null}
          title={pendingDelete && pendingDelete.length > 1 ? `Delete ${pendingDelete.length} customers?` : "Delete customer?"}
          message={
            pendingDelete
              ? `This will permanently delete ${
                  pendingDelete.length > 1 ? `${pendingDelete.length} customer records` : pendingDelete[0].name || pendingDelete[0].phone
                }. This action is irreversible.`
              : ""
          }
          confirmLabel="Delete"
          destructive
          busy={deleting}
          onConfirm={() => pendingDelete && runDelete(pendingDelete)}
          onCancel={() => setPendingDelete(null)}
        />

        {addOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-space-4" onClick={() => setAddOpen(false)}>
            <div
              className="w-full max-w-[420px] rounded-lg bg-card p-space-5 shadow-[var(--shadow-lg)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-space-4 flex items-center justify-between">
                <h2 className="text-[16px] font-semibold text-ink-900">Add Customer</h2>
                <button type="button" onClick={() => setAddOpen(false)} className="text-ink-400 hover:text-ink-900">
                  <X size={18} />
                </button>
              </div>
              <Field label="Name" htmlFor="new-customer-name" required>
                <Input id="new-customer-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Guest's full name" />
              </Field>
              <Field label="Phone (WhatsApp)" htmlFor="new-customer-phone" required hint="Used to reach them on WhatsApp.">
                <Input id="new-customer-phone" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+91…" />
              </Field>
              <div className="mt-space-2 flex justify-end gap-space-2">
                <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={creating}>
                  Cancel
                </Button>
                <Button onClick={handleAddCustomer} disabled={creating || !newName.trim() || !newPhone.trim()}>
                  {creating ? "Adding…" : <><Plus size={15} /> Add Customer</>}
                </Button>
              </div>
            </div>
          </div>
        )}
    </PortalShell>
  );
}
