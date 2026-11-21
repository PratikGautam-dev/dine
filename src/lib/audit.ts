import { humanize } from "@/lib/erp/erp";

/** Stops a spreadsheet running a cell that starts with = + - @ as a formula. */
const neutralise = (v: string) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A uuid is unreadable in a table: show its first block. Anything else (a settings key) is shown whole. */
export const shortRef = (ref: string | null) =>
  ref && UUID.test(ref) ? ref.slice(0, 8) : ref;

/** "order.status_changed" -> "Order Status Changed" (used where a sentence reads better than the code). */
export const actionLabel = (action: string) =>
  action.split(".").map(humanize).join(" ");

/** One change of an entry, as the API words it (names instead of ids, ₹ amounts, readable field labels). */
export type AuditChange =
  | {
      field: string;
      label: string;
      kind: "value";
      /** false = the old value was not recorded: only `to` is known. */
      known: boolean;
      from: string | null;
      to: string;
    }
  | {
      field: string;
      label: string;
      kind: "list";
      /** false = only the whole new list is known (in `added`). */
      known: boolean;
      added: AuditItem[];
      removed: AuditItem[];
    }
  | { field: string; label: string; kind: "touched" };

/** A list item: its name, and the record's id when it names one (kept for support). */
export type AuditItem = { text: string; id: string | null };

/** "Price: ₹1,200 -> ₹1,450", "Products: +Linen Kurta, -Cotton Dupatta" (plain text, for the CSV). */
export function changeText(c: AuditChange): string {
  if (c.kind === "touched") return `${c.label}: changed`;
  if (c.kind === "value")
    return c.known ? `${c.label}: ${c.from} -> ${c.to}` : `${c.label}: ${c.to}`;
  const items = [
    ...c.added.map((x) => `${c.known ? "+" : ""}${x.text}`),
    ...c.removed.map((x) => `-${x.text}`),
  ];
  return `${c.label}: ${items.join(", ")}`;
}

const stamp = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});
export const formatTimestamp = (iso: string) => stamp.format(new Date(iso));

export type AuditEntry = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  actor_type: string;
  actor_id: string | null;
  actor_label: string | null;
  created_at: string;
  /** One line saying what happened, e.g. "Wedding Edit: added 3 products, removed 1". */
  summary: string;
  /** The record's name when the entry was written (kept even if it is renamed or deleted later). */
  entity_label: string | null;
  changes: AuditChange[];
};

const cell = (v: string) => `"${neutralise(v).replace(/"/g, '""')}"`;
/** CSV of the rows as shown (one line per entry, changes joined with "; "), ready to download. */
export function auditCsv(rows: AuditEntry[]): string {
  const head = [
    "Date",
    "Action",
    "Actor",
    "Entity",
    "Summary",
    "Changes",
  ];
  const lines = rows.map((r) =>
    [
      new Date(r.created_at).toISOString(),
      r.action,
      r.actor_label ?? humanize(r.actor_type),
      [r.entity_type, r.entity_label, r.entity_id && `#${r.entity_id}`]
        .filter(Boolean)
        .join(" "),
      r.summary,
      r.changes.map(changeText).join("; "),
    ]
      .map(cell)
      .join(","),
  );
  return [head.map(cell).join(","), ...lines].join("\n");
}
