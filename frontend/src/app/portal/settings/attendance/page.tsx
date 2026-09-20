"use client";

import { MapPin } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { PortalShell } from "@/components/portal/PortalShell";
import { usePermission, useStaffSession } from "@/lib/staffAuth";
import { useAttendanceSettings, type AttendanceSettings } from "@/hooks/useHr";

type Form = { shift_start: string; shift_end: string; grace: string; latitude: string; longitude: string; radius: string; ips: string };

const toForm = (s: AttendanceSettings): Form => ({
  shift_start: s.shift_start ?? "", shift_end: s.shift_end ?? "", grace: String(s.late_grace_minutes),
  latitude: s.latitude?.toString() ?? "", longitude: s.longitude?.toString() ?? "", radius: s.radius_meters?.toString() ?? "",
  ips: s.allowed_ips.join("\n"),
});

function SettingsForm({ initial, onSave }: { initial: AttendanceSettings; onSave: (s: AttendanceSettings) => Promise<string | null> }) {
  const [form, setForm] = useState<Form>(toForm(initial));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  function useMyLocation() {
    if (!navigator.geolocation) return setError("This browser can't share its location.");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { set({ latitude: p.coords.latitude.toFixed(6), longitude: p.coords.longitude.toFixed(6), radius: form.radius || "100" }); setLocating(false); },
      () => { setError("Couldn't get your location -- allow location access, or type it in."); setLocating(false); },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const problem = await onSave({
      shift_start: form.shift_start || null, shift_end: form.shift_end || null, late_grace_minutes: Number(form.grace || 0),
      latitude: num(form.latitude), longitude: num(form.longitude), radius_meters: num(form.radius),
      allowed_ips: form.ips.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
    });
    setSaving(false);
    if (problem) setError(problem);
  }

  return (
    <form onSubmit={submit} aria-label="Attendance settings" className="grid grid-cols-1 gap-space-4 lg:grid-cols-2">
      <Card className="p-space-5">
        <h2 className="mb-space-1 text-[15px] font-bold text-ink-900">Shift and lateness</h2>
        <p className="mb-space-4 text-[13px] text-ink-600">The default shift for anyone without their own pattern (set per person on the Staff page).</p>
        <div className="grid grid-cols-2 gap-space-3">
          <Field label="Shift starts" htmlFor="as-start"><Input id="as-start" type="time" value={form.shift_start} onChange={(e) => set({ shift_start: e.target.value })} /></Field>
          <Field label="Shift ends" htmlFor="as-end"><Input id="as-end" type="time" value={form.shift_end} onChange={(e) => set({ shift_end: e.target.value })} /></Field>
        </div>
        <Field label="Late grace (minutes)" htmlFor="as-grace" hint="Arriving within this many minutes of the start is still on time.">
          <Input id="as-grace" inputMode="numeric" value={form.grace} onChange={(e) => set({ grace: e.target.value })} />
        </Field>
      </Card>

      <Card className="p-space-5">
        <h2 className="mb-space-1 text-[15px] font-bold text-ink-900">Where staff can clock in</h2>
        <p className="mb-space-4 text-[13px] text-ink-600">
          Optional. A clock-in passes if the phone is within the radius <em>or</em> on an allowed network. Leave everything blank to allow clocking in from anywhere. This deters, it doesn&apos;t prove -- location can be faked.
        </p>
        <div className="grid grid-cols-3 gap-space-3">
          <Field label="Latitude" htmlFor="as-lat"><Input id="as-lat" inputMode="decimal" value={form.latitude} onChange={(e) => set({ latitude: e.target.value })} /></Field>
          <Field label="Longitude" htmlFor="as-lng"><Input id="as-lng" inputMode="decimal" value={form.longitude} onChange={(e) => set({ longitude: e.target.value })} /></Field>
          <Field label="Radius (m)" htmlFor="as-radius"><Input id="as-radius" inputMode="numeric" value={form.radius} onChange={(e) => set({ radius: e.target.value })} /></Field>
        </div>
        <Button type="button" variant="secondary" size="md" onClick={useMyLocation} disabled={locating} className="mb-space-4"><MapPin size={14} /> {locating ? "Locating…" : "Use my current location"}</Button>
        <Field label="Allowed IP addresses or ranges" htmlFor="as-ips" hint="One per line, e.g. 203.0.113.7 or 198.51.100.0/24 (the restaurant's Wi-Fi).">
          <Textarea id="as-ips" rows={3} value={form.ips} onChange={(e) => set({ ips: e.target.value })} />
        </Field>
      </Card>

      <div className="lg:col-span-2">
        {error && <p role="alert" data-testid="settings-error" className="mb-space-3 text-[13px] font-medium text-error">{error}</p>}
        <PermissionGate page="attendance_settings" action="write">
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save settings"}</Button>
        </PermissionGate>
      </div>
    </form>
  );
}

export default function AttendanceSettingsPage() {
  const session = useStaffSession();
  const canView = usePermission("attendance_settings", "view");
  const { settings, error, save } = useAttendanceSettings(canView);

  if (!canView) {
    return (
      <PortalShell hospital={session?.hospital || null} active="settings">
        <p className="text-[13px] text-ink-400">You don&apos;t have access to attendance settings.</p>
      </PortalShell>
    );
  }

  return (
    <PortalShell hospital={session?.hospital || null} active="settings">
      <PageHeader title="Attendance rules" description="The shift, the lateness grace, and where staff may clock in from." />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}
      {!settings ? <p className="text-[13px] text-ink-400">Loading…</p> : <SettingsForm initial={settings} onSave={save} />}
    </PortalShell>
  );
}
