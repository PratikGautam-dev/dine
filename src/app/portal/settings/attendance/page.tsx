"use client";

import {
  CalendarClock,
  Copy,
  LocateFixed,
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
import { mapLink, parseMapPoint } from "@/lib/geo";
import {
  bestPosition,
  LOCATION_HINT,
  useAttendanceSettings,
  useLeaveAllowance,
  useHolidays,
  type AttendanceDefaults,
  type BranchRule,
  type Holiday,
  type ShopLocation,
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
  const [deviceLock, setDeviceLock] = useState(initial.device_lock);
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
        device_lock: deviceLock,
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

      <Card className="mb-space-4 p-space-5">
        <h2 className="mb-space-3 text-[15px] font-bold text-ink-900">
          Devices
        </h2>
        <div className={canEdit ? undefined : "pointer-events-none opacity-60"}>
          <SwitchRow
            label="Lock attendance to one device per person"
            hint={
              "Off by default. When on, the device someone first clocks in from becomes theirs, and clock-in and clock-out work only " +
              "from it. Lost or new phone: on Team Attendance, open the month, click their name and reset the device. Clearing the browser's data or " +
              "a private window also counts as a new device. Someone on another device can still ask a manager to approve their clock-in."
            }
            checked={deviceLock}
            onChange={() => setDeviceLock((v) => !v)}
          />
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

/** The yearly leave allowance: a business-wide number, changed only by someone who approves leave for every branch. */
function LeaveAllowance() {
  const session = useStaffSession();
  const canEdit = hasTenantWide(session, "leave:approve");
  const { allowance, save } = useLeaveAllowance(true);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(draft);
    if (!Number.isInteger(value) || value < 0)
      return setError("Enter a whole number of days.");
    setSaving(true);
    const problem = await save(value);
    setSaving(false);
    setError(problem);
    if (!problem) setDraft("");
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Yearly leave allowance"
      className="max-w-2xl"
    >
      <Card className="mb-space-4 p-space-5">
        <h2 className="mb-space-1 text-[15px] font-bold text-ink-900">
          Yearly leave allowance
        </h2>
        <p className="mb-space-3 text-[13px] text-ink-600">
          Everyone gets{" "}
          <strong data-testid="allowance-current">{allowance ?? "—"}</strong>{" "}
          days a year (unpaid leave doesn&apos;t count against it).
        </p>
        {canEdit ? (
          <div className="flex flex-wrap items-end gap-space-3">
            <Field
              label="New allowance (days)"
              htmlFor="allowance"
              error={error ?? undefined}
            >
              <Input
                id="allowance"
                inputMode="numeric"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={String(allowance ?? 20)}
              />
            </Field>
            <Button
              type="submit"
              variant="secondary"
              disabled={saving || draft === ""}
              className="mb-space-3"
            >
              {saving ? "Saving…" : "Save allowance"}
            </Button>
          </div>
        ) : (
          <p className="text-hint">
            Only someone who approves leave for every branch can change it.
          </p>
        )}
      </Card>
    </form>
  );
}

// ============================================================================================ branches
const CAPTURE_ACCURACY_M = 50; // the server's limit for a reading taken at the shop
const MAX_RADIUS_M = 500;
const usesGeo = (m: VerifyMode) =>
  m === "location" || m === "either" || m === "both";
const exactLocation = (r: BranchRule) =>
  r.latitude !== null &&
  (r.location_source === "device" || r.location_source === "manual");

/** Where a branch's position came from, in a few words. */
function locationLabel(r: BranchRule): string {
  if (r.latitude === null) return "No location";
  if (r.location_source === "device") return "Exact spot, taken at the shop";
  if (r.location_source === "manual") return "Exact spot, entered by hand";
  return "Rough location from the pincode";
}

/** The shop's exact spot: take it with this device while at the shop (the Wi-Fi address comes with it), or paste coordinates or a
 * Google Maps link. Nothing is saved until the editor's Save. */
function ShopLocationSection({
  rule,
  pending,
  onPending,
  onNetwork,
}: {
  rule: BranchRule;
  pending: ShopLocation | null;
  onPending: (l: ShopLocation | null) => void;
  onNetwork: () => void;
}) {
  const [locating, setLocating] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const shown = pending ?? (rule.latitude !== null ? rule : null);

  async function takeHere() {
    setProblem(null);
    setLocating(true);
    const r = await bestPosition();
    setLocating(false);
    if (!r.ok) return setProblem(LOCATION_HINT[r.reason]);
    const { latitude, longitude, accuracy } = r.position;
    if (accuracy > CAPTURE_ACCURACY_M)
      return setProblem(
        `That reading could be off by about ${Math.round(accuracy)} m; it needs to be within ${CAPTURE_ACCURACY_M} m. Step near a window or outside and try again -- a phone works far better than a laptop.`,
      );
    onPending({
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
      source: "device",
      accuracy_m: Math.round(accuracy),
    });
    onNetwork(); // standing in the shop: its Wi-Fi address is the one this page sees, if it's on the shop's Wi-Fi
  }

  function applyTyped() {
    const point = parseMapPoint(typed);
    if (!point)
      return setProblem(
        typed.includes("goo.gl")
          ? "Short links don't carry the location. Open the link, then copy the full address from the browser, or long-press the pin in Google Maps and copy the numbers."
          : "Paste numbers like 25.5941, 85.1376, or a Google Maps link to the shop.",
      );
    setProblem(null);
    setTyping(false);
    setTyped("");
    onPending({ ...point, source: "manual" });
  }

  return (
    <div className="mb-space-4 rounded-md border border-line p-space-3">
      <div className="flex flex-wrap items-start justify-between gap-space-2">
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-ink-900">
            Shop location
          </p>
          <p
            className={cn(
              "text-[13px]",
              pending || exactLocation(rule) ? "text-ink-600" : "text-warning",
            )}
          >
            {pending
              ? pending.source === "device"
                ? `Taken here, within ${pending.accuracy_m} m. Save to use it.`
                : "Entered by hand. Save to use it."
              : locationLabel(rule)}
            {shown && shown.latitude !== null && shown.longitude !== null && (
              <>
                {" · "}
                <a
                  href={mapLink(shown.latitude, shown.longitude)}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-brand-700 underline"
                >
                  {shown.latitude.toFixed(5)}, {shown.longitude.toFixed(5)}
                </a>
              </>
            )}
          </p>
        </div>
        {pending && (
          <Button variant="ghost" onClick={() => onPending(null)}>
            Undo
          </Button>
        )}
      </div>
      {!pending && !exactLocation(rule) && (
        <p className="mt-space-1 text-hint">
          A pincode&apos;s centre can be kilometres from the shop, so location
          checks need the exact spot.
        </p>
      )}
      <div className="mt-space-3 flex flex-wrap gap-space-2">
        <Button variant="secondary" onClick={takeHere} disabled={locating}>
          <LocateFixed size={14} />
          {locating ? "Finding you…" : "I'm at the shop now"}
        </Button>
        {!typing && (
          <Button variant="ghost" onClick={() => setTyping(true)}>
            Enter it myself
          </Button>
        )}
      </div>
      {typing && (
        <div className="mt-space-3 flex flex-wrap items-end gap-space-2">
          <Field
            label="Coordinates or Google Maps link"
            htmlFor="br-point"
            className="mb-0 min-w-0 flex-1"
          >
            <Input
              id="br-point"
              value={typed}
              placeholder="25.5941, 85.1376"
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyTyped()}
            />
          </Field>
          <Button variant="secondary" onClick={applyTyped}>
            Use this
          </Button>
        </div>
      )}
      {problem && (
        <p role="alert" className="mt-space-2 text-[13px] text-error">
          {problem}
        </p>
      )}
    </div>
  );
}

/** The business's own hours and days off, in words, for "a branch without its own uses …". */
const businessHours = (d: AttendanceDefaults) =>
  d.shift_start && d.shift_end
    ? `${d.shift_start}–${d.shift_end}`
    : "no set hours (nobody is marked late)";
const businessOff = (d: AttendanceDefaults) =>
  d.weekly_off.length
    ? WEEKDAY_NUMBERS.filter((w) => d.weekly_off.includes(w.n))
        .map((w) => w.label)
        .join(", ")
    : "no weekly off";

/** A switch with what it means underneath. */
function SwitchRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="mb-space-3 flex items-start justify-between gap-space-3">
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold text-ink-900">
          {label}
        </span>
        <span className="text-hint block">{hint}</span>
      </span>
      <Switch checked={checked} onChange={onChange} aria-label={label} />
    </div>
  );
}

function BranchEditor({
  rule,
  defaults,
  detectedIp,
  onSave,
  onSaveLocation,
  onClose,
}: {
  rule: BranchRule;
  defaults: AttendanceDefaults;
  detectedIp: string | null;
  onSave: (patch: Partial<BranchRule>) => Promise<string | null>;
  onSaveLocation: (location: ShopLocation) => Promise<string | null>;
  onClose: () => void;
}) {
  const [location, setLocation] = useState<ShopLocation | null>(null);
  const [mode, setMode] = useState<VerifyMode>(rule.verify_mode);
  const [radius, setRadius] = useState(rule.radius_meters?.toString() ?? "100");
  const [ips, setIps] = useState(rule.allowed_ips.join("\n"));
  const [ownHours, setOwnHours] = useState(rule.shift_start !== null);
  const [start, setStart] = useState(rule.shift_start ?? "");
  const [end, setEnd] = useState(rule.shift_end ?? "");
  const [ownOff, setOwnOff] = useState(rule.weekly_off !== null);
  const [off, setOff] = useState<number[]>(rule.weekly_off ?? []);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const usesLocation = usesGeo(mode);
  // location checks need the exact spot; one already switched on stays selectable so saving other changes still works
  const geoAllowed =
    location !== null || exactLocation(rule) || usesGeo(rule.verify_mode);
  const usesNetwork =
    mode === "network" || mode === "either" || mode === "both";
  const ipList = ips
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

  async function save() {
    const r = Number(radius || 100);
    if (usesLocation && !(r >= 50 && r <= MAX_RADIUS_M))
      return setError(`The radius must be 50 to ${MAX_RADIUS_M} metres.`);
    setSaving(true);
    if (location) {
      // first, so a location check switched on in the same save finds the exact spot
      const failed = await onSaveLocation(location);
      if (failed) {
        setSaving(false);
        return setError(failed);
      }
      setLocation(null);
    }
    const problem = await onSave({
      verify_mode: mode,
      radius_meters: usesLocation ? r : rule.radius_meters,
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
      <ShopLocationSection
        rule={rule}
        pending={location}
        onPending={setLocation}
        onNetwork={() =>
          detectedIp &&
          setIps((v) =>
            v.split(/[\n,]/).some((x) => x.trim() === detectedIp)
              ? v
              : v.trim()
                ? `${v.trim()}\n${detectedIp}`
                : detectedIp,
          )
        }
      />
      <Field
        label="Clock-in check"
        hint={
          geoAllowed
            ? undefined
            : "Set the shop location above to use a location check."
        }
      >
        <div className="space-y-space-2">
          {MODES.map((m) => {
            const blocked = usesGeo(m.value) && !geoAllowed;
            return (
              <label
                key={m.value}
                className={cn(
                  "flex gap-space-2 rounded-md border p-space-2",
                  blocked ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                  mode === m.value
                    ? "border-brand-600 bg-brand-50"
                    : "border-line",
                )}
              >
                <input
                  type="radio"
                  name="mode"
                  disabled={blocked}
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
            );
          })}
        </div>
      </Field>
      {usesLocation && (
        <Field
          label="Radius (metres)"
          htmlFor="br-radius"
          hint={`50 to ${MAX_RADIUS_M} m around the shop location. 100 m suits most shops; go wider only for a large site, since a wide circle can take in nearby homes.`}
        >
          <Input
            id="br-radius"
            type="number"
            min={50}
            max={MAX_RADIUS_M}
            step={10}
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
          hint="One per line: an address like 49.36.12.7 or a range like 49.36.0.0/16. Browsers can't read the Wi-Fi's name, only the internet address it uses, so add it while on the shop's Wi-Fi (not mobile data). Home broadband addresses can change when the router restarts; if staff suddenly can't clock in, add the new one."
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
      <SwitchRow
        label="Own working hours"
        hint={
          ownHours
            ? "This branch's start and end times decide who is late and what counts as overtime here."
            : `Off: this branch follows the business hours (${businessHours(defaults)}), set under Business rules. Turn on if this branch keeps different hours.`
        }
        checked={ownHours}
        onChange={() => setOwnHours((v) => !v)}
      />
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
      <SwitchRow
        label="Own weekly off"
        hint={
          ownOff
            ? "The days picked below are this branch's days off: nobody here is marked absent on them."
            : `Off: this branch follows the business's weekly off (${businessOff(defaults)}). Turn on if this branch closes on other days.`
        }
        checked={ownOff}
        onChange={() => setOwnOff((v) => !v)}
      />
      <p className="text-hint mb-space-3">
        Hours set for a person (Team &amp; Access) come before the
        branch&apos;s, and the branch&apos;s before the business&apos;s.
      </p>
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
  defaults,
  detectedIp,
  canEdit,
  onSave,
  onSaveLocation,
}: {
  rules: BranchRule[];
  defaults: AttendanceDefaults;
  detectedIp: string | null;
  canEdit: boolean;
  onSave: (
    branchId: string,
    patch: Partial<BranchRule>,
  ) => Promise<string | null>;
  onSaveLocation: (
    branchId: string,
    location: ShopLocation,
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
                  <p
                    className={cn(
                      "flex items-center gap-1 text-[12px]",
                      exactLocation(b) ? "text-ink-400" : "text-warning",
                    )}
                  >
                    <MapPin size={12} /> {locationLabel(b)}
                  </p>
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
          defaults={defaults}
          detectedIp={detectedIp}
          onSave={(patch) => onSave(editing.branch_id, patch)}
          onSaveLocation={(l) => onSaveLocation(editing.branch_id, l)}
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
  const { settings, error, saveDefaults, saveBranch, saveLocation } =
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
        description="Working hours, lateness, leave allowance, how each branch checks clock-ins, and your holiday calendar."
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
        <>
          <BusinessRules
            key={JSON.stringify(settings.defaults)}
            initial={settings.defaults}
            canEdit={canEditBusiness}
            onSave={saveDefaults}
          />
          <div className="mt-space-6">
            <LeaveAllowance />
          </div>
        </>
      ) : tab === "branches" ? (
        <Branches
          rules={settings.branches}
          defaults={settings.defaults}
          detectedIp={settings.detected_ip}
          canEdit={canEdit}
          onSave={saveBranch}
          onSaveLocation={saveLocation}
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
