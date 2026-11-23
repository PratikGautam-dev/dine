"use client";

import {
  CalendarClock,
  Copy,
  MapPin,
  Pencil,
  Trash2,
  Wifi,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/erp-ui/Badge";
import { Button } from "@/components/erp-ui/Button";
import { Card } from "@/components/erp-ui/Card";
import { Field } from "@/components/erp-ui/Field";
import { Input, Textarea } from "@/components/erp-ui/Input";
import { Modal } from "@/components/erp-ui/Modal";
import { PageHeader } from "@/components/erp-ui/PageHeader";
import { Select } from "@/components/erp-ui/Select";
import { SkeletonLines } from "@/components/erp-ui/Skeleton";
import { Switch } from "@/components/erp-ui/Switch";
import { Tabs } from "@/components/erp-ui/Tabs";
import { PortalShell } from "@/components/portal/PortalShell";
import { cn } from "@/lib/cn";
import { fmtDate, WEEKDAY_NUMBERS } from "@/lib/hr";
import { hasTenantWide } from "@/lib/erp/staffAuth";
import { usePermission, useStaffSession } from "@/lib/staffAuth";
import {
  useAttendanceSettings,
  useHolidays,
  type AttendanceDefaults,
  type BranchRule,
  type Holiday,
  type VerifyMode,
} from "@/hooks/useHr";

const MODES: { value: VerifyMode; label: string; hint: string }[] = [
  {
    value: "off",
    label: "No check",
    hint: "Staff can clock in from anywhere.",
  },
  {
    value: "location",
    label: "Location",
    hint: "The phone must be within the radius of the shop.",
  },
  {
    value: "network",
    label: "Shop Wi-Fi",
    hint: "The phone must be on the shop's internet connection.",
  },
  {
    value: "either",
    label: "Location or Wi-Fi",
    hint: "Either one is enough. Location-only clock-ins are flagged for a look.",
  },
  {
    value: "both",
    label: "Location and Wi-Fi",
    hint: "Strictest: both must match.",
  },
];

const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

/** Pick weekly days off: 0 = Sunday ... 6 = Saturday. */
function WeekdayPicker({
  value,
  onChange,
  disabled,
}: {
  value: number[];
  onChange: (next: number[]) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="flex flex-wrap gap-space-1"
      role="group"
      aria-label="Weekly off"
    >
      {WEEKDAY_NUMBERS.map((d) => {
        const on = value.includes(d.n);
        return (
          <button
            key={d.n}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            onClick={() =>
              onChange(on ? value.filter((x) => x !== d.n) : [...value, d.n])
            }
            className={cn(
              "touch-target rounded-md border px-space-3 py-space-1 text-[13px] font-semibold transition-colors",
              on
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-line bg-card text-ink-700 hover:border-brand-400",
              disabled && "opacity-60",
            )}
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================================ business rules
function BusinessRules({
  initial,
  canEdit,
  onSave,
}: {
  initial: AttendanceDefaults;
  canEdit: boolean;
  onSave: (patch: Partial<AttendanceDefaults>) => Promise<string | null>;
}) {
  const [shiftStart, setShiftStart] = useState(initial.shift_start ?? "");
  const [shiftEnd, setShiftEnd] = useState(initial.shift_end ?? "");
  const [weeklyOff, setWeeklyOff] = useState<number[]>(initial.weekly_off);
  const [grace, setGrace] = useState(String(initial.late_grace_minutes));
  const [early, setEarly] = useState(
    initial.early_clock_in_minutes?.toString() ?? "",
  );
  const [autoClose, setAutoClose] = useState(
    initial.auto_close_after_minutes?.toString() ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(
      await onSave({
        shift_start: shiftStart || null,
        shift_end: shiftEnd || null,
        weekly_off: weeklyOff,
        late_grace_minutes: Number(grace || 0),
        early_clock_in_minutes: numOrNull(early),
        auto_close_after_minutes: numOrNull(autoClose),
      }),
    );
    setSaving(false);
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Business attendance rules"
      className="max-w-2xl"
    >
      <Card className="mb-space-4 p-space-5">
        <h2 className="mb-space-1 text-[15px] font-bold text-ink-900">
          Working hours
        </h2>
        <p className="mb-space-4 text-[13px] text-ink-600">
          The default for everyone. A branch can have its own hours (Branches
          tab), and a person their own (Settings &gt; Users). A shift that ends
          before it starts runs past midnight.
        </p>
        <div className="grid grid-cols-2 gap-space-3">
          <Field label="Shift starts" htmlFor="ar-start">
            <Input
              id="ar-start"
              type="time"
              disabled={!canEdit}
              value={shiftStart}
              onChange={(e) => setShiftStart(e.target.value)}
            />
          </Field>
          <Field label="Shift ends" htmlFor="ar-end">
            <Input
              id="ar-end"
              type="time"
              disabled={!canEdit}
              value={shiftEnd}
              onChange={(e) => setShiftEnd(e.target.value)}
            />
          </Field>
        </div>
        <Field
          label="Weekly off"
          hint="These days are never counted as absent."
        >
          <WeekdayPicker
            value={weeklyOff}
            onChange={setWeeklyOff}
            disabled={!canEdit}
          />
        </Field>
      </Card>

      <Card className="mb-space-4 p-space-5">
        <h2 className="mb-space-1 text-[15px] font-bold text-ink-900">
          Lateness and clock-out
        </h2>
        <div className="grid grid-cols-1 gap-space-3 md:grid-cols-3">
          <Field
            label="Late after (minutes)"
            htmlFor="ar-grace"
            hint="0 = late from the first minute."
          >
            <Input
              id="ar-grace"
              inputMode="numeric"
              disabled={!canEdit}
              value={grace}
              onChange={(e) => setGrace(e.target.value)}
            />
          </Field>
          <Field
            label="Earliest clock-in (minutes before)"
            htmlFor="ar-early"
            hint="Empty = any time."
          >
            <Input
              id="ar-early"
              inputMode="numeric"
              disabled={!canEdit}
              value={early}
              onChange={(e) => setEarly(e.target.value)}
            />
          </Field>
          <Field
            label="Close forgotten clock-outs after (minutes)"
            htmlFor="ar-auto"
            hint="After the shift ends. Empty = 16 hours after clock-in."
          >
            <Input
              id="ar-auto"
              inputMode="numeric"
              disabled={!canEdit}
              value={autoClose}
              onChange={(e) => setAutoClose(e.target.value)}
            />
          </Field>
        </div>
      </Card>
      {error && (
        <p
          role="alert"
          className="mb-space-3 text-[13px] font-medium text-error"
        >
          {error}
        </p>
      )}
      {canEdit ? (
        <Button className="mobile-page-action" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save rules"}
        </Button>
      ) : (
        <p className="text-hint">
          Only someone who manages attendance for every branch can change these.
        </p>
      )}
    </form>
  );
}

// ============================================================================================ branches
function BranchEditor({
  rule,
  detectedIp,
  onSave,
  onClose,
}: {
  rule: BranchRule;
  detectedIp: string | null;
  onSave: (patch: Partial<BranchRule>) => Promise<string | null>;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<VerifyMode>(rule.verify_mode);
  const [radius, setRadius] = useState(rule.radius_meters?.toString() ?? "100");
  const [ips, setIps] = useState(rule.allowed_ips.join("\n"));
  const [lat, setLat] = useState(rule.latitude?.toString() ?? "");
  const [lng, setLng] = useState(rule.longitude?.toString() ?? "");
  const [ownHours, setOwnHours] = useState(rule.shift_start !== null);
  const [start, setStart] = useState(rule.shift_start ?? "");
  const [end, setEnd] = useState(rule.shift_end ?? "");
  const [ownOff, setOwnOff] = useState(rule.weekly_off !== null);
  const [off, setOff] = useState<number[]>(rule.weekly_off ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const usesLocation =
    mode === "location" || mode === "either" || mode === "both";
  const usesNetwork =
    mode === "network" || mode === "either" || mode === "both";
  const ipList = ips
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  async function save() {
    setSaving(true);
    const problem = await onSave({
      latitude: lat.trim() === "" ? null : Number(lat),
      longitude: lng.trim() === "" ? null : Number(lng),
      verify_mode: mode,
      radius_meters: usesLocation ? Number(radius || 100) : rule.radius_meters,
      allowed_ips: ipList,
      shift_start: ownHours ? start || null : null,
      shift_end: ownHours ? end || null : null,
      weekly_off: ownOff ? off : null,
    });
    setSaving(false);
    if (problem) setError(problem);
    else onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={rule.branch_name}
      description="How clock-ins are checked here, and this branch's own hours."
      footer={
        <div className="flex justify-end gap-space-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      }
    >
      <Field label="Clock-in check">
        <div className="space-y-space-2">
          {MODES.map((m) => (
            <label
              key={m.value}
              className={cn(
                "flex cursor-pointer gap-space-2 rounded-md border p-space-2",
                mode === m.value
                  ? "border-brand-600 bg-brand-50"
                  : "border-line",
              )}
            >
              <input
                type="radio"
                name="mode"
                checked={mode === m.value}
                onChange={() => setMode(m.value)}
              />
              <span>
                <span className="block text-[13.5px] font-semibold text-ink-900">
                  {m.label}
                </span>
                <span className="text-hint">{m.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </Field>
      {usesLocation && (
        <Field label="Branch location" htmlFor="br-lat" hint="Where staff must be to clock in. Stand at the branch and use your current location.">
          <div className="flex flex-wrap items-center gap-space-2">
            <Input id="br-lat" inputMode="decimal" placeholder="Latitude" value={lat} onChange={(e) => setLat(e.target.value)} />
            <Input id="br-lng" aria-label="Longitude" inputMode="decimal" placeholder="Longitude" value={lng} onChange={(e) => setLng(e.target.value)} />
            <Button
              variant="secondary"
              type="button"
              onClick={() =>
                navigator.geolocation?.getCurrentPosition(
                  (pos) => {
                    setLat(pos.coords.latitude.toFixed(6));
                    setLng(pos.coords.longitude.toFixed(6));
                  },
                  () => setError("Couldn't read your location. Allow location access, or type the coordinates."),
                )
              }
            >
              <MapPin size={14} /> Use my current location
            </Button>
          </div>
        </Field>
      )}
      {usesLocation && (
        <Field
          label="Radius (metres)"
          htmlFor="br-radius"
          hint="100–200 m suits most shops."
        >
          <Input
            id="br-radius"
            inputMode="numeric"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
          />
        </Field>
      )}
      {usesNetwork && (
        <Field
          label="Shop internet addresses"
          htmlFor="br-ips"
          hint="One per line: an address like 49.36.12.7 or a range like 49.36.0.0/16. Open this page on the shop's Wi-Fi and add it."
        >
          <Textarea
            id="br-ips"
            rows={3}
            value={ips}
            onChange={(e) => setIps(e.target.value)}
          />
          {detectedIp && !ipList.includes(detectedIp) && (
            <Button
              variant="secondary"
              className="mt-space-2"
              onClick={() =>
                setIps((v) =>
                  v.trim() ? `${v.trim()}\n${detectedIp}` : detectedIp,
                )
              }
            >
              <Wifi size={14} /> Add this network ({detectedIp})
            </Button>
          )}
        </Field>
      )}
      <div className="mb-space-3 flex items-center justify-between gap-space-2">
        <span className="text-[13.5px] font-semibold text-ink-900">
          Own working hours
        </span>
        <Switch
          checked={ownHours}
          onChange={() => setOwnHours((v) => !v)}
          aria-label="Own working hours"
        />
      </div>
      {ownHours && (
        <div className="grid grid-cols-2 gap-space-3">
          <Field label="Starts" htmlFor="br-start">
            <Input
              id="br-start"
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </Field>
          <Field label="Ends" htmlFor="br-end">
            <Input
              id="br-end"
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </Field>
        </div>
      )}
      <div className="mb-space-3 flex items-center justify-between gap-space-2">
        <span className="text-[13.5px] font-semibold text-ink-900">
          Own weekly off
        </span>
        <Switch
          checked={ownOff}
          onChange={() => setOwnOff((v) => !v)}
          aria-label="Own weekly off"
        />
      </div>
      {ownOff && <WeekdayPicker value={off} onChange={setOff} />}
      {error && (
        <p
          role="alert"
          className="mt-space-3 text-[13px] font-medium text-error"
        >
          {error}
        </p>
      )}
    </Modal>
  );
}

function Branches({
  rules,
  detectedIp,
  canEdit,
  onSave,
}: {
  rules: BranchRule[];
  detectedIp: string | null;
  canEdit: boolean;
  onSave: (
    branchId: string,
    patch: Partial<BranchRule>,
  ) => Promise<string | null>;
}) {
  const [editing, setEditing] = useState<BranchRule | null>(null);
  return (
    <>
      <p className="mb-space-3 max-w-2xl text-[13px] text-ink-600">
        Each branch decides how its clock-ins are checked. Staff clock in at
        whichever of their branches they&apos;re at. Location can be faked by a
        determined person; Wi-Fi is harder -- use both where it matters.
      </p>
      <Card className="no-scrollbar min-w-0 max-w-full overflow-x-auto p-space-2">
        <table className="w-full text-left text-[13px] max-md:min-w-[640px]">
          <thead>
            <tr className="text-label border-b border-line text-ink-600">
              <th className="px-space-3 py-space-2 font-medium">Branch</th>
              <th className="px-space-3 py-space-2 font-medium">Check</th>
              <th className="px-space-3 py-space-2 font-medium">Hours</th>
              <th className="px-space-3 py-space-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rules.map((b) => (
              <tr
                key={b.branch_id}
                className="border-b border-line last:border-0"
              >
                <td className="px-space-3 py-space-2">
                  <p className="font-semibold text-ink-900">{b.branch_name}</p>
                  {b.latitude === null && (
                    <p className="flex items-center gap-1 text-hint">
                      <MapPin size={12} /> No location saved
                    </p>
                  )}
                </td>
                <td className="px-space-3 py-space-2">
                  <Badge tone={b.verify_mode === "off" ? "neutral" : "success"}>
                    {MODES.find((m) => m.value === b.verify_mode)?.label}
                  </Badge>
                  {b.verify_mode !== "off" &&
                    b.radius_meters &&
                    b.verify_mode !== "network" && (
                      <span className="ml-1 text-hint">
                        {b.radius_meters} m
                      </span>
                    )}
                </td>
                <td className="px-space-3 py-space-2">
                  {b.shift_start
                    ? `${b.shift_start}–${b.shift_end}`
                    : "Business default"}
                </td>
                <td className="px-space-3 py-space-2 text-right">
                  {canEdit && (
                    <Button variant="ghost" onClick={() => setEditing(b)}>
                      <Pencil size={14} /> Edit
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      {editing && (
        <BranchEditor
          rule={editing}
          detectedIp={detectedIp}
          onSave={(patch) => onSave(editing.branch_id, patch)}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

// ============================================================================================ holidays
function HolidayDialog({
  initial,
  branches,
  canEditBusiness,
  onSave,
  onClose,
}: {
  initial: Holiday | null;
  branches: BranchRule[];
  canEditBusiness: boolean;
  onSave: (h: {
    id?: string;
    date: string;
    name: string;
    branch_id: string | null;
  }) => Promise<string | null>;
  onClose: () => void;
}) {
  const [date, setDate] = useState(initial?.date ?? "");
  const [name, setName] = useState(initial?.name ?? "");
  const [branch, setBranch] = useState(
    initial?.branch_id ??
      (canEditBusiness ? "" : (branches[0]?.branch_id ?? "")),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    const problem = await onSave({
      id: initial?.id,
      date,
      name: name.trim(),
      branch_id: branch || null,
    });
    setSaving(false);
    if (problem) setError(problem);
    else onClose();
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? "Edit holiday" : "Add holiday"}
      width="sm"
      footer={
        <div className="flex justify-end gap-space-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !date || !name.trim()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      }
    >
      <Field label="Date" htmlFor="hd-date" required>
        <Input
          id="hd-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>
      <Field label="Name" htmlFor="hd-name" required>
        <Input
          id="hd-name"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      {!initial && (
        <Field label="Applies to">
          <Select value={branch} onValueChange={setBranch}>
            {canEditBusiness && <option value="">Every branch</option>}
            {branches.map((b) => (
              <option key={b.branch_id} value={b.branch_id}>
                {b.branch_name} only
              </option>
            ))}
          </Select>
        </Field>
      )}
      {error && (
        <p role="alert" className="text-[13px] font-medium text-error">
          {error}
        </p>
      )}
    </Modal>
  );
}

function Holidays({
  branches,
  canEdit,
  canEditBusiness,
}: {
  branches: BranchRule[];
  canEdit: boolean;
  canEditBusiness: boolean;
}) {
  const [year, setYear] = useState(new Date().getFullYear());
  const { holidays, error, save, remove, copyYear } = useHolidays(true, year);
  const [editing, setEditing] = useState<Holiday | "new" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  return (
    <>
      <div className="mb-space-3 flex flex-wrap items-center gap-space-2">
        <Select
          aria-label="Year"
          value={year}
          onValueChange={(v) => setYear(Number(v))}
          className="w-28"
        >
          {[year - 1, year, year + 1].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
        {canEdit && (
          <>
            <Button onClick={() => setEditing("new")}>
              <CalendarClock size={14} /> Add holiday
            </Button>
            <Button
              variant="secondary"
              onClick={async () => setProblem(await copyYear(year - 1, year))}
            >
              <Copy size={14} /> Copy from {year - 1}
            </Button>
          </>
        )}
      </div>
      {(error || problem) && (
        <p className="mb-space-3 text-[13px] text-error">{error ?? problem}</p>
      )}
      <Card className="min-w-0 max-w-2xl p-space-2">
        {!holidays ? (
          <SkeletonLines rows={3} />
        ) : holidays.length === 0 ? (
          <p className="p-space-4 text-[13px] text-ink-400">
            No holidays in {year} yet.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {holidays.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-space-2 px-space-3 py-space-2"
              >
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold text-ink-900">
                    {h.name}
                  </p>
                  <p className="text-hint">
                    {fmtDate(h.date)} · {h.branch_name ?? "Every branch"}
                  </p>
                </div>
                {canEdit && (h.branch_id !== null || canEditBusiness) && (
                  <div className="flex gap-space-1">
                    <Button
                      variant="ghost"
                      onClick={() => setEditing(h)}
                      aria-label={`Edit ${h.name}`}
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={async () => setProblem(await remove(h.id))}
                      aria-label={`Remove ${h.name}`}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {editing && (
        <HolidayDialog
          initial={editing === "new" ? null : editing}
          branches={branches}
          canEditBusiness={canEditBusiness}
          onSave={save}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

// ============================================================================================ page
export default function AttendanceSettingsPage() {
  const session = useStaffSession();
  const canView = usePermission("attendance_settings", "view");
  const canEdit = usePermission("attendance_settings", "write");
  const canEditBusiness = hasTenantWide(session, "attendance_settings:manage");
  const { settings, error, saveDefaults, saveBranch } =
    useAttendanceSettings(canView);
  const [tab, setTab] = useState<"rules" | "branches" | "holidays">("rules");

  if (!canView) {
    return (
      <PortalShell restaurant={session?.restaurant ?? null} active="settings">
        <p className="text-[13px] text-ink-400">
          You don&apos;t have access to attendance settings.
        </p>
      </PortalShell>
    );
  }

  return (
    <PortalShell restaurant={session?.restaurant ?? null} active="settings">
      <PageHeader
        icon={<CalendarClock size={20} />}
        title="Attendance and holidays"
        description="Working hours, lateness, how each branch checks clock-ins, and your holiday calendar."
      />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}
      <Tabs
        tabs={[
          { key: "rules", label: "Business rules" },
          { key: "branches", label: "Branches" },
          { key: "holidays", label: "Holidays" },
        ]}
        value={tab}
        onChange={setTab}
      />
      {!settings ? (
        <SkeletonLines rows={3} />
      ) : tab === "rules" ? (
        <BusinessRules
          key={JSON.stringify(settings.defaults)}
          initial={settings.defaults}
          canEdit={canEditBusiness}
          onSave={saveDefaults}
        />
      ) : tab === "branches" ? (
        <Branches
          rules={settings.branches}
          detectedIp={settings.detected_ip}
          canEdit={canEdit}
          onSave={saveBranch}
        />
      ) : (
        <Holidays
          branches={settings.branches}
          canEdit={canEdit}
          canEditBusiness={canEditBusiness}
        />
      )}
    </PortalShell>
  );
}
