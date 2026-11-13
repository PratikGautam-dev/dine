"use client";

import {
  Add01Icon,
  Delete02Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useState } from "react";
import { Input } from "@/components/erp-ui/Input";
import { MultiSelect } from "@/components/erp-ui/MultiSelect";
import { Select } from "@/components/erp-ui/Select";
import { cn } from "@/lib/cn";
import { SEGMENT_META, SEGMENT_ORDER } from "@/lib/erp/crm";
import { erp, fromMinor, toMinor } from "@/lib/erp/erp";
import {
  CHANNEL_LABEL,
  FIELD_META,
  OP_LABEL,
  WINDOW_PRESETS,
  conditionReady,
  defaultCondition,
  type Condition,
  type ConditionWindow,
  type ConditionField,
  type Match,
  type Preview,
} from "@/lib/erp/rules";
import { useDebounced } from "@/lib/erp/useDebounced";

export function Multi({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <span className="flex flex-wrap gap-1">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() =>
              onChange(
                on ? value.filter((v) => v !== o.value) : [...value, o.value],
              )
            }
            className={cn(
              "rounded-md border px-2.5 py-1 text-[12.5px] font-medium",
              on
                ? "border-brand-600 bg-brand-50 text-brand-800"
                : "border-line text-ink-600 hover:bg-black/[0.03]",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </span>
  );
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** "Any time" (all-time figures), the last 7 / 30 / 90 / 365 days, or between two dates: what an order figure is counted over. */
function PeriodSelect({
  value,
  onChange,
}: {
  value: ConditionWindow | undefined;
  onChange: (w: ConditionWindow | undefined) => void;
}) {
  const days = value?.kind === "days" ? value.days : null;
  // a period saved with another number of days (through the API) still shows as what it is
  const presets =
    days !== null && !WINDOW_PRESETS.includes(days)
      ? [...WINDOW_PRESETS, days].sort((a, b) => a - b)
      : WINDOW_PRESETS;
  return (
    <Select
      value={
        value
          ? value.kind === "between"
            ? "between"
            : String(value.days)
          : "all"
      }
      onValueChange={(v) => {
        if (v === "all") onChange(undefined);
        else if (v === "between")
          onChange({ kind: "between", start: "", end: today() });
        else onChange({ kind: "days", days: Number(v) });
      }}
      className="!w-auto min-w-[140px] max-w-[220px] flex-[1_1_170px] !rounded-md"
      aria-label="Time period"
    >
      <option value="all">All time</option>
      {presets.map((d) => (
        <option key={d} value={String(d)}>
          In the last {d} days
        </option>
      ))}
      <option value="between">Between dates</option>
    </Select>
  );
}

function DateRange({
  value,
  onChange,
}: {
  value: Extract<ConditionWindow, { kind: "between" }>;
  onChange: (w: ConditionWindow) => void;
}) {
  return (
    <div className="flex min-w-0 max-w-full @[34rem]:max-w-[calc(100%-2.5rem)] flex-[1_1_100%] flex-wrap items-center gap-space-2 text-[13px] text-ink-600">
      From
      <Input
        type="date"
        aria-label="From date"
        className="!w-40 !rounded-md max-md:min-w-0 max-md:flex-1 max-md:!w-auto"
        max={value.end || today()}
        value={value.start}
        onChange={(e) => onChange({ ...value, start: e.target.value })}
      />
      to
      <Input
        type="date"
        aria-label="To date"
        className="!w-40 !rounded-md max-md:min-w-0 max-md:flex-1 max-md:!w-auto"
        min={value.start || undefined}
        max={today()}
        value={value.end}
        onChange={(e) => onChange({ ...value, end: e.target.value })}
      />
    </div>
  );
}

/** One condition: field, comparison, value. Money is typed in rupees and kept in paise. */
export function Row({
  c,
  fields,
  tags,
  onChange,
  onRemove,
}: {
  c: Condition;
  fields: ConditionField[];
  tags: { id: string; name: string }[];
  onChange: (c: Condition) => void;
  onRemove?: () => void;
}) {
  const meta = FIELD_META[c.field];
  const [money, setMoney] = useState(
    meta.input === "money" && typeof c.value === "number"
      ? fromMinor(c.value)
      : "",
  );
  return (
    // Wraps by the width this row actually gets (it sits in a column beside a side panel, so screen breakpoints don't tell): controls drop to a
    // second line instead of overflowing, and the remove button sits at the right end of the last line.
    <div className="@container">
      <div className="relative flex flex-wrap items-start gap-space-2 pr-10 @[34rem]:pr-0">
        <Select
          value={c.field}
          onValueChange={(f) => {
            const next = defaultCondition(f as ConditionField);
            if (FIELD_META[next.field].input === "money")
              setMoney(fromMinor(next.value as number));
            onChange(next);
          }}
          className="!w-auto min-w-[140px] max-w-[220px] flex-[1_1_170px] !rounded-md"
          aria-label="Condition"
        >
          {fields.map((f) => (
            <option key={f} value={f}>
              {FIELD_META[f].label}
            </option>
          ))}
        </Select>
        {OP_LABEL[c.op] !== "" && (
          <Select
            value={c.op}
            onValueChange={(op) =>
              onChange({ ...c, op: op as Condition["op"] })
            }
            className="!w-auto min-w-[130px] max-w-[190px] flex-[1_1_150px] !rounded-md"
            aria-label="Comparison"
          >
            {meta.ops.map((op) => (
              <option key={op} value={op}>
                {OP_LABEL[op]}
              </option>
            ))}
          </Select>
        )}
        {meta.input === "money" && (
          <span className="relative min-w-[120px] max-w-[200px] flex-[1_1_140px]">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-ink-400">
              ₹
            </span>
            <Input
              inputMode="decimal"
              aria-label="Amount"
              className="!w-full !rounded-md pl-7"
              value={money}
              onChange={(e) => {
                setMoney(e.target.value);
                const minor = toMinor(e.target.value);
                onChange({ ...c, value: minor ?? undefined });
              }}
            />
          </span>
        )}
        {meta.input === "number" && (
          <span className="flex min-w-[110px] max-w-[160px] flex-[1_1_120px] items-center gap-1">
            <Input
              inputMode="numeric"
              aria-label="Number"
              className="!w-full !rounded-md"
              value={typeof c.value === "number" ? String(c.value) : ""}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "");
                onChange({
                  ...c,
                  value: digits === "" ? undefined : Number(digits),
                });
              }}
            />
            {meta.unit && (
              <span className="text-[13px] text-ink-600">{meta.unit}</span>
            )}
          </span>
        )}
        {meta.input === "tiers" && (
          <MultiSelect
            className="min-w-[200px] max-w-full @[34rem]:max-w-[calc(100%-2.5rem)] flex-[1_1_240px]"
            placeholder="Choose memberships"
            options={SEGMENT_ORDER.map((s) => ({
              value: s,
              label: SEGMENT_META[s].label,
            }))}
            value={(c.value as string[]) ?? []}
            onValueChange={(v) => onChange({ ...c, value: v })}
          />
        )}
        {meta.input === "channels" && (
          <MultiSelect
            className="min-w-[200px] max-w-full @[34rem]:max-w-[calc(100%-2.5rem)] flex-[1_1_240px]"
            placeholder="Choose channels"
            options={Object.entries(CHANNEL_LABEL).map(([value, label]) => ({
              value,
              label,
            }))}
            value={(c.value as string[]) ?? []}
            onValueChange={(v) => onChange({ ...c, value: v })}
          />
        )}
        {meta.input === "tags" && (
          <MultiSelect
            className="min-w-[200px] max-w-full @[34rem]:max-w-[calc(100%-2.5rem)] flex-[1_1_240px]"
            placeholder="Choose tags"
            options={tags.map((t) => ({ value: t.id, label: t.name }))}
            value={(c.value as string[]) ?? []}
            onValueChange={(v) => onChange({ ...c, value: v })}
          />
        )}
        {meta.windowed && (
          <PeriodSelect
            value={c.window}
            onChange={(window) => onChange({ ...c, window })}
          />
        )}
        {meta.input === "customer_type" && (
          <Select
            value={String(c.value)}
            onValueChange={(v) => onChange({ ...c, value: v })}
            className="!w-auto"
            aria-label="Customer type"
          >
            <option value="individual">Individual</option>
            <option value="business">Business (B2B)</option>
          </Select>
        )}
        {meta.input === "gender" && (
          <Select
            value={String(c.value)}
            onValueChange={(v) => onChange({ ...c, value: v })}
            className="!w-auto"
            aria-label="Gender"
          >
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </Select>
        )}
        {meta.input === "text" && (
          <Input
            aria-label="Value"
            className="!w-auto min-w-[140px] max-w-[280px] flex-[1_1_180px] !rounded-md"
            maxLength={80}
            value={String(c.value ?? "")}
            onChange={(e) => onChange({ ...c, value: e.target.value })}
          />
        )}
        {c.window?.kind === "between" && (
          <DateRange
            value={c.window}
            onChange={(window) => onChange({ ...c, window })}
          />
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove condition"
            className="absolute right-0 top-1.5 flex h-8 w-8 shrink-0 @[34rem]:static @[34rem]:ml-auto @[34rem]:mt-1.5 items-center justify-center rounded-md text-ink-400 hover:bg-black/[0.05] hover:text-ink-700"
          >
            <HugeiconsIcon icon={Delete02Icon} size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

/** IF these conditions (all / any) — with how many customers match right now. */
export function ConditionBuilder({
  conditions,
  match,
  onChange,
  tags = [],
  exclude = [],
  membersOnly = false,
  showPreview = true,
}: {
  conditions: Condition[];
  match: Match;
  onChange: (conditions: Condition[], match: Match) => void;
  tags?: { id: string; name: string }[];
  /** Fields this rule may not use. */
  exclude?: ConditionField[];
  /** Count members only (membership automations act on members). */
  membersOnly?: boolean;
  showPreview?: boolean;
}) {
  const fields = (Object.keys(FIELD_META) as ConditionField[]).filter(
    (f) => !exclude.includes(f),
  );
  const [keys, setKeys] = useState(() => conditions.map((_, i) => i));
  const [next, setNext] = useState(conditions.length);
  const ready = conditions.length > 0 && conditions.every(conditionReady);
  const body = useDebounced(
    ready
      ? JSON.stringify({ conditions, match, members_only: membersOnly })
      : "",
    400,
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!showPreview || !body) return;
    let live = true;
    void erp<Preview>(
      "/api/v1/crm/rules/preview",
      "POST",
      JSON.parse(body),
    ).then((res) => {
      if (!live) return;
      setPreview(res.data ?? null);
      setPreviewError(res.error ?? null);
    });
    return () => {
      live = false;
    };
  }, [body, showPreview]);

  const add = () => {
    onChange([...conditions, defaultCondition(fields[0])], match);
    setKeys([...keys, next]);
    setNext(next + 1);
  };

  return (
    <div className="space-y-space-2">
      {conditions.length > 1 && (
        <p className="flex items-center gap-space-2 text-[13px] text-ink-700">
          Match
          <Select
            value={match}
            onValueChange={(m) => onChange(conditions, m as Match)}
            className="!w-auto"
            aria-label="Match"
          >
            <option value="all">all of these</option>
            <option value="any">any of these</option>
          </Select>
        </p>
      )}
      {conditions.map((c, i) => (
        <Row
          key={keys[i] ?? i}
          c={c}
          fields={fields}
          tags={tags}
          onChange={(nc) =>
            onChange(
              conditions.map((x, j) => (j === i ? nc : x)),
              match,
            )
          }
          onRemove={
            conditions.length > 1
              ? () => {
                  onChange(
                    conditions.filter((_, j) => j !== i),
                    match,
                  );
                  setKeys(keys.filter((_, j) => j !== i));
                }
              : undefined
          }
        />
      ))}
      {conditions.length < 10 && (
        <button
          type="button"
          onClick={add}
          className="flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline max-md:w-full max-md:justify-center max-md:rounded-md max-md:border max-md:border-dashed max-md:border-brand-300 max-md:py-space-2"
        >
          <HugeiconsIcon icon={Add01Icon} size={14} /> Add condition
        </button>
      )}
      {showPreview && (
        <div className="flex items-center gap-space-3 rounded-lg bg-brand-50 p-space-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-brand-700">
            <HugeiconsIcon icon={UserGroupIcon} size={18} />
          </span>
          <div className="min-w-0">
            {!ready ? (
              <p className="text-[13px] text-ink-600">
                Fill in the conditions to see who matches.
              </p>
            ) : previewError ? (
              <p className="text-[13px] font-medium text-error">
                {previewError}
              </p>
            ) : (
              <>
                <p className="text-[13px] text-ink-600">
                  {membersOnly
                    ? "Members matching now"
                    : "Customers matching now"}
                </p>
                <p className="text-[20px] font-bold leading-tight text-ink-900">
                  {preview ? preview.matched.toLocaleString("en-IN") : "…"}
                </p>
                {preview && preview.sample.length > 0 && (
                  <p className="truncate text-[12px] text-ink-600">
                    {preview.sample.map((s) => s.name || "Unnamed").join(", ")}
                    {preview.matched > preview.sample.length ? "…" : ""}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
