"use client";

import { MultiSelect } from "@/components/erp-ui/MultiSelect";

/** Building blocks of the portal's long "numbered section" forms (New Discount, New Campaign), so those modals look and behave alike. */

export const generateCode = () =>
  Array.from({ length: 8 }, () =>
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789".charAt(Math.floor(Math.random() * 32)),
  ).join("");

export function Section({
  n,
  title,
  aside,
  children,
}: {
  n: number;
  title: string;
  /** Put the heading beside the content instead of above it (the short schedule and summary rows). */
  aside?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-lg border border-line bg-card p-space-3 ${aside ? "md:flex md:items-center md:gap-space-4" : ""}`}
    >
      <h3
        className={`text-[15px] font-bold text-ink-900 ${aside ? "mb-space-2 md:mb-0 md:w-40 md:shrink-0" : "mb-space-2"}`}
      >
        {n}. {title}
      </h3>
      {children}
    </section>
  );
}

export function ChipList({
  items,
  onRemove,
}: {
  items: { id: string; label: string }[];
  onRemove: (id: string) => void;
}) {
  if (!items.length) return null;
  return (
    <ul className="space-y-space-1">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-center justify-between gap-space-2 rounded-md bg-ink-50 px-space-3 py-space-1 text-[13px]"
        >
          <span className="min-w-0 truncate">{item.label}</span>
          <button
            type="button"
            aria-label={`Remove ${item.label}`}
            onClick={() => onRemove(item.id)}
            className="shrink-0 text-ink-400 hover:text-ink-900"
          >
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}

/** A selectable card with a radio dot (or a tile when `tile`), used for the discount type and the eligibility choices. */
export function OptionCard({
  selected,
  onSelect,
  title,
  hint,
  tile,
  icon,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  hint: string;
  tile?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const body = (
    <>
      {tile ? (
        <>
          <span className={selected ? "text-brand-700" : "text-ink-900"}>
            {icon}
          </span>
          <span className="text-[13px] font-semibold text-ink-900">
            {title}
          </span>
          <span className="text-[12px] text-ink-400">{hint}</span>
        </>
      ) : (
        <div className="flex items-start gap-space-2">
          <span
            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${selected ? "border-brand-700" : "border-ink-400"}`}
          >
            {selected && <span className="h-2 w-2 rounded-full bg-brand-700" />}
          </span>
          <span>
            <span className="block text-[13.5px] font-semibold text-ink-900">
              {title}
            </span>
            <span className="block text-[12.5px] text-ink-600">{hint}</span>
          </span>
        </div>
      )}
    </>
  );
  return (
    <div
      className={`flex flex-col rounded-md border p-space-3 transition-colors ${
        selected ? "border-brand-700 bg-brand-50" : "border-line bg-card"
      } ${tile ? "text-center" : ""}`}
    >
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className={`block w-full text-left ${tile ? "flex flex-col items-center gap-space-1" : ""}`}
      >
        {body}
      </button>
      {children && <div className="mt-auto pt-space-2">{children}</div>}
    </div>
  );
}

export function CheckList({
  items,
  selected,
  onChange,
  loading,
  empty,
  placeholder,
}: {
  items: { id: string; label: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
  empty: string;
  placeholder: string;
}) {
  if (!items.length)
    return (
      <p className="text-[13px] text-ink-600">{loading ? "Loading…" : empty}</p>
    );
  return (
    <MultiSelect
      options={items.map((item) => ({ value: item.id, label: item.label }))}
      value={selected}
      onValueChange={onChange}
      placeholder={placeholder}
    />
  );
}
