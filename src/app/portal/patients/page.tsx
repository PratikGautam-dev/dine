"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  Crown,
  FileText,
  Filter,
  Mail,
  MapPin,
  Plus,
  Receipt,
  Repeat,
  Search,
  Star,
  Trash2,
  UserPlus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable } from "@/components/ui/DataTable";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { FormSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { SectionDonut } from "@/components/portal/SectionDonut";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/portal/StatTile";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/formatDate";
import { rupees } from "@/lib/foodOrders";
import { usePatients, type Patient } from "@/hooks/usePatients";
import { useCustomerSegments } from "@/hooks/useCustomerSegments";
import { useCustomerAnalytics } from "@/hooks/useCustomerAnalytics";
import { useLoyaltyProgram } from "@/hooks/useLoyaltyProgram";
import { useCampaigns } from "@/hooks/useCampaigns";
import { createPatientColumns } from "./_components/patients-columns";
import { CustomerPicker } from "./_components/customer-picker";
import { TagsPanel } from "./_components/tags-panel";
import { TagDirectory } from "./_components/tag-directory";
import { CampaignsPanel } from "./_components/campaigns-panel";
import { LoyaltyPanel } from "./_components/loyalty-panel";
import { CommunicationPanel } from "./_components/communication-panel";
import { SegmentsPanel } from "./_components/segments-panel";
import { AnalyticsPanel } from "./_components/analytics-panel";

const TABS = [
  { id: "all", label: "All Customers" },
  { id: "loyalty", label: "Loyalty" },
  { id: "tags", label: "Tags" },
  { id: "communication", label: "Communication" },
  { id: "segments", label: "Segments" },
  { id: "campaigns", label: "Campaigns" },
  { id: "analytics", label: "Analytics" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const DAY_MS = 24 * 60 * 60 * 1000;
// The list API returns at most this many guests (most recently seen first).
const DIRECTORY_LIMIT = 200;

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
    recentOrders,
    profileLoading,
    savingProfile,
    openProfile,
    closeProfile,
    saveProfileFields,
    saveAddress,
    creating,
    createCustomer,
    savingTags,
    saveTags,
    tagActionLoading,
    renameTag,
    deleteTagEverywhere,
    savingTierOverride,
    setTierOverride,
    ledger,
    ledgerLoading,
    loadLedger,
    messages,
    messagesLoading,
    loadMessages,
  } = usePatients(ready);

  const {
    segments,
    creating: creatingSegment,
    createSegment,
    updatingId: updatingSegmentId,
    updateSegment,
    deletingId,
    deleteSegment,
    viewingMembersId,
    members: segmentMembers,
    membersLoading: segmentMembersLoading,
    loadMembers: loadSegmentMembers,
    closeMembers: closeSegmentMembers,
  } = useCustomerSegments(ready);
  const { analytics } = useCustomerAnalytics(ready);
  const { program: loyaltyProgram } = useLoyaltyProgram(ready);
  const {
    campaigns,
    creating: creatingCampaign,
    createCampaign,
    uploadingImage: uploadingCampaignImage,
    uploadImage: uploadCampaignImage,
  } = useCampaigns(ready);

  const [tab, setTab] = useState<TabId>("all");
  const [pickerSearch, setPickerSearch] = useState("");
  const pickerPatients = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return patients;
    return (patients ?? []).filter(
      (p) => (p.name ?? "").toLowerCase().includes(q) || p.phone.includes(q),
    );
  }, [patients, pickerSearch]);

  const [addOpen, setAddOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [platinumOnly, setPlatinumOnly] = useState(false);
  const [tagFilter, setTagFilter] = useState("");
  const [minPoints, setMinPoints] = useState("");
  const [minSpendRupees, setMinSpendRupees] = useState("");
  const [minOrders, setMinOrders] = useState("");
  const allTags = useMemo(
    () => [...new Set((patients ?? []).flatMap((p) => p.tags ?? []))].sort(),
    [patients],
  );
  const visiblePatients = useMemo(
    () =>
      (patients ?? []).filter((p) => {
        if (platinumOnly && p.loyalty_tier !== "Platinum") return false;
        if (tagFilter && !(p.tags ?? []).includes(tagFilter)) return false;
        if (minPoints && p.loyalty_points < Number(minPoints)) return false;
        if (minSpendRupees && p.total_spend_paise < Number(minSpendRupees) * 100) return false;
        if (minOrders && p.total_orders < Number(minOrders)) return false;
        return true;
      }),
    [patients, platinumOnly, tagFilter, minPoints, minSpendRupees, minOrders],
  );
  const activeFilterCount = [platinumOnly, tagFilter, minPoints, minSpendRupees, minOrders].filter(
    Boolean,
  ).length;
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  // "Customer Details" panel's Edit mode -- toggled by the pencil button
  // next to the guest's name, editing email/address/notes together (the
  // fields the reference CRM mockup's Edit action covers).
  const [editingProfile, setEditingProfile] = useState(false);
  const [editEmail, setEditEmail] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editNotes, setEditNotes] = useState("");

  function startEditProfile() {
    if (!profile) return;
    setEditEmail(profile.email || "");
    setEditAddress(profile.address || "");
    setEditNotes(profile.notes || "");
    setEditingProfile(true);
  }

  async function handleSaveProfileEdit() {
    await Promise.all([
      saveProfileFields({ email: editEmail, notes: editNotes }),
      saveAddress(editAddress),
    ]);
    setEditingProfile(false);
  }

  const columns = useMemo(
    () =>
      createPatientColumns({
        selected,
        toggleSelected,
        toggleSelectAll,
        allSelected,
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
      {
        department_name: "2–3 bookings",
        count: all.filter((p) => p.visit_count >= 2 && p.visit_count <= 3).length,
      },
      { department_name: "4 or more", count: all.filter((p) => p.visit_count >= 4).length },
    ].filter((s) => s.count > 0);
    return {
      total: all.length,
      returning: all.filter((p) => p.visit_count >= 2).length,
      vip: all.filter((p) => p.loyalty_tier === "Platinum").length,
      active30: all.filter((p) => p.last_visit && new Date(p.last_visit).getTime() >= cutoff30)
        .length,
      newThisWeek: all.filter((p) => p.created_at && new Date(p.created_at).getTime() >= cutoff7)
        .length,
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

      <div className="mb-space-4 flex flex-wrap gap-space-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full border px-space-3 py-space-1 text-[12.5px] font-semibold transition-colors duration-150",
              tab === t.id
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-line bg-card text-ink-600 hover:border-brand-300 hover:bg-brand-50",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "all" && directory && (
        <>
          <div className="mb-space-4 grid grid-cols-1 gap-space-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatTile
              icon={<Users size={22} />}
              label="Total customers"
              value={summary.total}
              deltaPct={null}
              hint="In your directory"
              tone="brand"
              filled
            />
            <StatTile
              icon={<Calendar size={22} />}
              label="Active, last 30 days"
              value={summary.active30}
              deltaPct={null}
              hint="Booked or visited recently"
              tone="info"
              filled
            />
            <StatTile
              icon={<Repeat size={22} />}
              label="Repeat guests"
              value={summary.returning}
              deltaPct={null}
              hint="Booked 2 or more times"
              tone="warning"
              filled
            />
            <StatTile
              icon={<Crown size={22} />}
              label="Platinum customers"
              value={summary.vip}
              deltaPct={null}
              hint="Top loyalty tier"
              tone="clay"
              filled
            />
            <StatTile
              icon={<UserPlus size={22} />}
              label="New this week"
              value={summary.newThisWeek}
              deltaPct={null}
              hint="Joined in the last 7 days"
              tone="violet"
              filled
            />
          </div>
          {directory.length >= DIRECTORY_LIMIT && (
            <p className="mb-space-3 text-[12px] text-ink-400">
              Showing your {DIRECTORY_LIMIT} most recently seen guests; the counts below cover
              those.
            </p>
          )}
        </>
      )}

      {tab === "all" && (
      <div className="grid grid-cols-1 gap-space-4 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <div className="mb-space-3 flex flex-col gap-space-3 sm:flex-row sm:items-center sm:justify-between sm:gap-space-4">
            <div className="relative w-full flex-1 sm:max-w-[360px]">
              <Search
                size={15}
                className="absolute top-1/2 left-space-3 -translate-y-1/2 text-ink-400"
              />
              <Input
                placeholder="Search by name or phone"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="mb-space-3 flex flex-wrap items-center gap-space-2">
              <Button
                variant={activeFilterCount > 0 ? "primary" : "secondary"}
                size="md"
                onClick={() => setFiltersOpen((v) => !v)}
                aria-pressed={filtersOpen}
              >
                <Filter size={14} />
                Filters
                {activeFilterCount > 0 && (
                  <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/25 text-[11px] font-bold tabular-nums">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </div>
            {selectedPatients.length > 0 && (
              <PermissionGate page="patients" action="delete">
                <Button
                  variant="destructive"
                  size="md"
                  onClick={() => setPendingDelete(selectedPatients)}
                >
                  <Trash2 size={15} />
                  Delete selected ({selectedPatients.length})
                </Button>
              </PermissionGate>
            )}
          </div>

          {filtersOpen && (
            <Card className="mb-space-3 p-space-4">
              <div className="grid grid-cols-1 gap-space-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Loyalty tier">
                  <label className="flex h-11 items-center gap-space-2 rounded-md border border-line bg-card px-space-3">
                    <Switch checked={platinumOnly} onChange={() => setPlatinumOnly((v) => !v)} size="sm" />
                    <Crown size={14} className="text-warning" />
                    <span className="text-[13px] text-ink-700">Platinum members only</span>
                  </label>
                </Field>
                <Field label="Tag" htmlFor="customers-tag-filter">
                  <select
                    id="customers-tag-filter"
                    value={tagFilter}
                    onChange={(e) => setTagFilter(e.target.value)}
                    className="h-11 w-full rounded-md border border-line bg-card px-space-3 text-[13.5px] text-ink-900"
                  >
                    <option value="">All tags</option>
                    {allTags.map((tag) => (
                      <option key={tag} value={tag}>
                        {tag}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Min. loyalty points" htmlFor="customers-min-points">
                  <Input
                    id="customers-min-points"
                    type="number"
                    min={0}
                    placeholder="e.g. 100"
                    value={minPoints}
                    onChange={(e) => setMinPoints(e.target.value)}
                  />
                </Field>
                <Field label="Min. total spend (₹)" htmlFor="customers-min-spend">
                  <Input
                    id="customers-min-spend"
                    type="number"
                    min={0}
                    placeholder="e.g. 5000"
                    value={minSpendRupees}
                    onChange={(e) => setMinSpendRupees(e.target.value)}
                  />
                </Field>
                <Field label="Min. total orders" htmlFor="customers-min-orders">
                  <Input
                    id="customers-min-orders"
                    type="number"
                    min={0}
                    placeholder="e.g. 5"
                    value={minOrders}
                    onChange={(e) => setMinOrders(e.target.value)}
                  />
                </Field>
              </div>
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setPlatinumOnly(false);
                    setTagFilter("");
                    setMinPoints("");
                    setMinSpendRupees("");
                    setMinOrders("");
                  }}
                  className="text-[12.5px] font-semibold text-brand-600 hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </Card>
          )}

          <Card className="p-space-4">
            {!patients ? (
              <TableSkeleton rows={6} columns={6} />
            ) : patients.length === 0 ? (
              <div className="py-space-6 text-center">
                <UserRound size={28} className="mx-auto mb-space-2 text-ink-300" />
                <p className="text-[13px] text-ink-400">
                  {search
                    ? "No customers match that search."
                    : "No customers yet — they appear here after a first booking."}
                </p>
              </div>
            ) : (
              <DataTable
                columns={columns}
                data={visiblePatients}
                getRowId={(p) => String(p.id)}
                onRowClick={(p) => {
                  setEditingProfile(false);
                  openProfile(p.id);
                }}
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
                  onClick={() => {
                    setEditingProfile(false);
                    closeProfile();
                  }}
                  className="rounded-md p-1 text-ink-400 hover:bg-black/4 hover:text-ink-900"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              {profileLoading || !profile ? (
                <FormSkeleton fields={3} />
              ) : (
                <>
                  <div className="mb-space-4 flex items-start justify-between gap-space-2">
                    <div className="flex items-center gap-space-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[16px] font-bold text-brand-700">
                        {(profile.name || profile.phone).trim().charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-space-1">
                          <p className="truncate text-[15px] font-bold text-ink-900">
                            {profile.name || "Not registered yet"}
                          </p>
                          {profile.loyalty_tier === "Platinum" && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-warning-tint px-space-2 py-0.5 text-[10.5px] font-bold text-warning">
                              VIP Customer
                            </span>
                          )}
                        </div>
                        <p className="text-[12px] text-ink-600">
                          {profile.total_orders} orders ·{" "}
                          {profile.patient_display_id || `#${profile.id}`}
                        </p>
                      </div>
                    </div>
                    <PermissionGate page="patients" action="write">
                      {!editingProfile && (
                        <Button size="md" variant="secondary" onClick={startEditProfile}>
                          Edit
                        </Button>
                      )}
                    </PermissionGate>
                  </div>

                  <div className="mb-space-4 grid grid-cols-3 gap-space-2">
                    <div className="rounded-lg bg-warning-tint p-space-3 text-center">
                      <Star size={16} className="mx-auto mb-1 text-warning" />
                      <p className="text-[17px] font-bold tabular-nums text-ink-900">
                        {profile.loyalty_points}
                      </p>
                      <p className="text-[10.5px] font-semibold text-ink-600">Loyalty Points</p>
                    </div>
                    <div className="rounded-lg bg-info-tint p-space-3 text-center">
                      <Receipt size={16} className="mx-auto mb-1 text-info" />
                      <p className="text-[17px] font-bold tabular-nums text-ink-900">
                        {profile.total_orders}
                      </p>
                      <p className="text-[10.5px] font-semibold text-ink-600">Total Orders</p>
                    </div>
                    <div className="rounded-lg bg-accent-violet-tint p-space-3 text-center">
                      <Calendar size={16} className="mx-auto mb-1 text-accent-violet" />
                      <p className="text-[13px] font-bold text-ink-900">
                        {formatDate(recentOrders?.[0]?.created_at ?? profile.last_visit)}
                      </p>
                      <p className="text-[10.5px] font-semibold text-ink-600">Last Purchase</p>
                    </div>
                  </div>

                  <div className="mb-space-4">
                    <h4 className="mb-space-2 text-[12px] font-bold text-ink-900">
                      Customer Information
                    </h4>
                    <div className="space-y-space-2 text-[13px]">
                      <p className="flex items-center gap-space-2 text-ink-700">
                        <UserRound size={14} className="text-ink-400" /> {profile.name || "—"}
                      </p>
                      <p className="flex items-center gap-space-2 text-ink-700">
                        <WhatsAppIcon size={14} /> {profile.phone}
                      </p>

                      {editingProfile ? (
                        <>
                          <div className="flex items-center gap-space-2">
                            <Mail size={14} className="shrink-0 text-ink-400" />
                            <Input
                              value={editEmail}
                              onChange={(e) => setEditEmail(e.target.value)}
                              placeholder="Email"
                              className="text-[12.5px]"
                            />
                          </div>
                          <div className="flex items-start gap-space-2">
                            <MapPin size={14} className="mt-2 shrink-0 text-ink-400" />
                            <Textarea
                              value={editAddress}
                              onChange={(e) => setEditAddress(e.target.value)}
                              rows={2}
                              placeholder="Address"
                              className="text-[12.5px]"
                            />
                          </div>
                          <div>
                            <p className="mb-space-1 flex items-center gap-space-2 text-[11px] font-semibold text-ink-600">
                              <FileText size={12} /> Notes
                            </p>
                            <Textarea
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              rows={3}
                              placeholder="Internal notes about this guest…"
                              className="text-[12.5px]"
                            />
                          </div>
                          <div className="flex gap-space-2 pt-space-1">
                            <Button
                              size="md"
                              onClick={handleSaveProfileEdit}
                              disabled={savingProfile}
                            >
                              {savingProfile ? "Saving…" : "Save"}
                            </Button>
                            <Button
                              size="md"
                              variant="secondary"
                              onClick={() => setEditingProfile(false)}
                              disabled={savingProfile}
                            >
                              Cancel
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          {profile.email && (
                            <p className="flex items-center gap-space-2 text-ink-700">
                              <Mail size={14} className="text-ink-400" /> {profile.email}
                            </p>
                          )}
                          {profile.address && (
                            <div className="flex items-start justify-between gap-space-2">
                              <p className="flex items-start gap-space-2 text-ink-700">
                                <MapPin size={14} className="mt-0.5 shrink-0 text-ink-400" />{" "}
                                {profile.address}
                              </p>
                              <a
                                href={`https://maps.google.com/?q=${encodeURIComponent(profile.address)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="shrink-0 text-[11.5px] font-semibold whitespace-nowrap text-brand-600 hover:underline"
                              >
                                View on Map
                              </a>
                            </div>
                          )}
                          <div>
                            <p className="mb-space-1 flex items-center gap-space-2 text-[11px] font-semibold text-ink-600">
                              <FileText size={12} /> Notes
                            </p>
                            <p
                              className={cn(
                                "rounded-lg bg-paper p-space-3 text-[12.5px]",
                                profile.notes ? "text-ink-700" : "text-ink-400",
                              )}
                            >
                              {profile.notes || "No notes yet."}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  <dl className="mb-space-4 space-y-space-2 border-t border-line pt-space-3 text-[12.5px]">
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
                      <dt className="text-ink-600">Total spend</dt>
                      <dd className="font-semibold text-ink-900">
                        {rupees(profile.total_spend_paise)}
                      </dd>
                    </div>
                  </dl>

                  <div className="mb-space-4">
                    <div className="mb-space-2 flex items-center justify-between">
                      <h4 className="text-[12px] font-bold text-ink-900">Recent Transactions</h4>
                      <Link
                        href={`/portal/patients/${profile.public_id}`}
                        className="text-[11.5px] font-semibold text-brand-600 hover:underline"
                      >
                        View All &gt;
                      </Link>
                    </div>
                    {!recentOrders || recentOrders.length === 0 ? (
                      <p className="py-space-3 text-center text-[12.5px] text-ink-400">
                        No orders yet.
                      </p>
                    ) : (
                      <div className="divide-y divide-line">
                        {recentOrders.slice(0, 5).map((o) => (
                          <div
                            key={o.id}
                            className="flex items-center justify-between py-space-2 text-[12.5px]"
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-ink-900">{formatDate(o.created_at)}</p>
                              <p className="text-hint">
                                {o.item_count} item{o.item_count === 1 ? "" : "s"}
                              </p>
                            </div>
                            <p className="font-semibold text-ink-900">{rupees(o.total_paise)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-space-2">
                    <a
                      href={`https://wa.me/${profile.phone.replace(/[^\d]/g, "")}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-space-1 rounded-md bg-success px-space-3 py-space-2 text-[12.5px] font-semibold text-white hover:opacity-90"
                    >
                      <WhatsAppIcon size={14} className="brightness-0 invert" /> Message
                    </a>
                    <Link
                      href={`/portal/patients/${profile.public_id}`}
                      className="inline-flex items-center justify-center gap-space-1 rounded-md border border-line bg-card px-space-3 py-space-2 text-[12.5px] font-semibold text-ink-900 hover:bg-paper"
                    >
                      View History
                    </Link>
                  </div>
                </>
              )}
            </Card>
          )}
        </div>
      </div>
      )}

      {tab === "all" && directory && (
        <div className="mt-space-4 grid grid-cols-1 gap-space-4 lg:grid-cols-2">
          <SectionDonut
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
                      onClick={() => {
                        setEditingProfile(false);
                        openProfile(p.id);
                      }}
                      className="flex w-full items-center gap-space-3 py-space-2 text-left hover:opacity-80"
                    >
                      <span className="w-5 text-[12px] font-semibold text-ink-400">{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-ink-900">
                          {p.name || p.phone}
                        </span>
                        {p.name && (
                          <span className="block text-[12px] text-ink-600">{p.phone}</span>
                        )}
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

      {tab === "tags" && (
        <TagDirectory
          directory={directory}
          tagActionLoading={tagActionLoading}
          onRenameTag={renameTag}
          onDeleteTag={deleteTagEverywhere}
          onSelectCustomer={openProfile}
        />
      )}

      {(tab === "loyalty" || tab === "tags" || tab === "communication") && (
        <div className="grid grid-cols-1 gap-space-4 lg:grid-cols-[280px_1fr]">
          <CustomerPicker
            patients={pickerPatients}
            search={pickerSearch}
            onSearchChange={setPickerSearch}
            activeId={activeId}
            onSelect={openProfile}
          />
          <div className="min-w-0">
            {activeId === null ? (
              <Card className="flex min-h-[240px] flex-col items-center justify-center p-space-4 text-center">
                <UserRound size={26} className="mb-space-2 text-ink-300" />
                <p className="text-[13px] text-ink-400">Pick a customer to see their {tab}.</p>
              </Card>
            ) : tab === "loyalty" ? (
              <LoyaltyPanel
                profile={profile}
                profileLoading={profileLoading}
                savingTierOverride={savingTierOverride}
                onSetTierOverride={setTierOverride}
                ledger={ledger}
                ledgerLoading={ledgerLoading}
                onLoadLedger={loadLedger}
                program={loyaltyProgram}
              />
            ) : tab === "tags" ? (
              <TagsPanel
                profile={profile}
                profileLoading={profileLoading}
                saving={savingTags}
                onSave={saveTags}
                directory={directory}
              />
            ) : (
              <CommunicationPanel
                profile={profile}
                profileLoading={profileLoading}
                messages={messages}
                messagesLoading={messagesLoading}
                onLoadMessages={loadMessages}
              />
            )}
          </div>
        </div>
      )}

      {tab === "segments" && (
        <SegmentsPanel
          segments={segments}
          creating={creatingSegment}
          onCreate={createSegment}
          updatingId={updatingSegmentId}
          onUpdate={updateSegment}
          deletingId={deletingId}
          onDelete={deleteSegment}
          viewingMembersId={viewingMembersId}
          members={segmentMembers}
          membersLoading={segmentMembersLoading}
          onViewMembers={loadSegmentMembers}
          onCloseMembers={closeSegmentMembers}
        />
      )}

      {tab === "campaigns" && (
        <CampaignsPanel
          directory={directory}
          segments={segments}
          segmentMembers={segmentMembers}
          segmentMembersLoading={segmentMembersLoading}
          onLoadSegmentMembers={loadSegmentMembers}
          campaigns={campaigns}
          creating={creatingCampaign}
          onCreateCampaign={createCampaign}
          uploadingImage={uploadingCampaignImage}
          onUploadImage={uploadCampaignImage}
          restaurantName={hospital?.name ?? ""}
        />
      )}

      {tab === "analytics" && <AnalyticsPanel analytics={analytics} />}

      <ConfirmDialog
        open={pendingDelete !== null}
        title={
          pendingDelete && pendingDelete.length > 1
            ? `Delete ${pendingDelete.length} customers?`
            : "Delete customer?"
        }
        message={
          pendingDelete
            ? `This will permanently delete ${
                pendingDelete.length > 1
                  ? `${pendingDelete.length} customer records`
                  : pendingDelete[0].name || pendingDelete[0].phone
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
        <Modal
          onClose={() => setAddOpen(false)}
          labelledBy="add-customer-title"
          maxWidthClass="max-w-[420px]"
        >
          <div className="mb-space-4 flex items-center justify-between">
            <h2 id="add-customer-title" className="text-[16px] font-semibold text-ink-900">
              Add Customer
            </h2>
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="text-ink-400 hover:text-ink-900"
            >
              <X size={18} />
            </button>
          </div>
          <Field label="Name" htmlFor="new-customer-name" required>
            <Input
              id="new-customer-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Guest's full name"
            />
          </Field>
          <Field
            label="Phone (WhatsApp)"
            htmlFor="new-customer-phone"
            required
            hint="Used to reach them on WhatsApp."
          >
            <Input
              id="new-customer-phone"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              placeholder="+91…"
            />
          </Field>
          <div className="mt-space-2 flex justify-end gap-space-2">
            <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button
              onClick={handleAddCustomer}
              disabled={creating || !newName.trim() || !newPhone.trim()}
            >
              {creating ? (
                "Adding…"
              ) : (
                <>
                  <Plus size={15} /> Add Customer
                </>
              )}
            </Button>
          </div>
        </Modal>
      )}
    </PortalShell>
  );
}
