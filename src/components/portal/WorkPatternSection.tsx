"use client";

import { useState } from "react";
import { Button } from "@/components/erp-ui/Button";
import { Field } from "@/components/erp-ui/Field";
import { Input } from "@/components/erp-ui/Input";
import { Select } from "@/components/erp-ui/Select";
import { Switch } from "@/components/erp-ui/Switch";
import { cn } from "@/lib/cn";
import { WEEKDAY_NUMBERS } from "@/lib/hr";
import { usePermission } from "@/lib/staffAuth";
import { useWorkPattern, type WorkPattern } from "@/hooks/useHr";

type Branch = { id: string; branch_name: string };

/** A person's own hours on the Users page: their home branch (whose rules their day is judged by), their own shift and weekly off
 * (empty = the branch's / business's), and whether their attendance is tracked at all (an owner or accountant may not be). */
export function WorkPatternSection({ userId, branches }: { userId: string; branches: Branch[] }) {
  const canView = usePermission("attendance", "view");
  const canEdit = usePermission("attendance", "write");
  const { pattern, error, save } = useWorkPattern(canView, userId);
  if (!canView) return null;
  return (
    <div className="border-t border-line pt-space-3">
      <h3 className="mb-space-2 text-[14px] font-bold text-ink-900">Work pattern</h3>
      {error && <p className="text-[13px] text-error">{error}</p>}
      {pattern && (
        <PatternForm
          key={JSON.stringify(pattern)}
          initial={pattern}
          branches={branches}
          canEdit={canEdit}
          onSave={save}
        />
      )}
    </div>
  );
}

function PatternForm({
  initial,
  branches,
  canEdit,
  onSave,
}: {
  initial: WorkPattern;
  branches: Branch[];
  canEdit: boolean;
  onSave: (next: Omit<WorkPattern, "user_id">) => Promise<string | null>;
}) {
  const [home, setHome] = useState(initial.home_branch_id ?? "");
  const [start, setStart] = useState(initial.shift_start ?? "");
  const [end, setEnd] = useState(initial.shift_end ?? "");
  const [ownOff, setOwnOff] = useState(initial.weekly_off !== null);
  const [off, setOff] = useState<number[]>(initial.weekly_off ?? []);
  const [tracked, setTracked] = useState(initial.tracks_attendance);
  const [problem, setProblem] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setProblem(
      await onSave({
        home_branch_id: home || null,
        shift_start: start || null,
        shift_end: end || null,
        weekly_off: ownOff ? off : null,
        tracks_attendance: tracked,
      }),
    );
    setSaving(false);
  }

  return (
    <div className="space-y-space-2">
      <div className="flex items-center justify-between gap-space-2">
        <span className="text-[13.5px] text-ink-900">Track attendance</span>
        <Switch
          checked={tracked}
          disabled={!canEdit}
          onChange={() => setTracked((v) => !v)}
          aria-label="Track attendance"
        />
      </div>
      <div className="grid grid-cols-1 gap-space-3 md:grid-cols-3">
        <Field label="Home branch" className="!mb-0">
          <Select value={home} onValueChange={setHome} disabled={!canEdit}>
            <option value="">First assigned branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.branch_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Own shift starts" htmlFor="wp-start" className="!mb-0">
          <Input
            id="wp-start"
            type="time"
            disabled={!canEdit}
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </Field>
        <Field
          label="Own shift ends"
          htmlFor="wp-end"
          hint="Empty = the branch's hours."
          className="!mb-0"
        >
          <Input
            id="wp-end"
            type="time"
            disabled={!canEdit}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </Field>
      </div>
      <div className="flex items-center justify-between gap-space-2">
        <span className="text-[13.5px] text-ink-900">Own weekly off</span>
        <Switch
          checked={ownOff}
          disabled={!canEdit}
          onChange={() => setOwnOff((v) => !v)}
          aria-label="Own weekly off"
        />
      </div>
      {ownOff && (
        <div className="flex flex-wrap gap-space-1">
          {WEEKDAY_NUMBERS.map((d) => {
            const on = off.includes(d.n);
            return (
              <button
                key={d.n}
                type="button"
                disabled={!canEdit}
                aria-pressed={on}
                onClick={() => setOff(on ? off.filter((x) => x !== d.n) : [...off, d.n])}
                className={cn(
                  "touch-target rounded-md border px-space-3 py-space-1 text-[13px] font-semibold",
                  on
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-line bg-card text-ink-700",
                )}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      )}
      {problem && (
        <p role="alert" className="text-[13px] font-medium text-error">
          {problem}
        </p>
      )}
      {canEdit && (
        <Button variant="secondary" onClick={submit} disabled={saving}>
          {saving ? "Saving…" : "Save work pattern"}
        </Button>
      )}
    </div>
  );
}
