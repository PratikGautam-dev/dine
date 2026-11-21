"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { ClipboardList, Download, Search } from "lucide-react";
import { useState } from "react";
import { ChangeDetails, ChangeList } from "@/components/portal/ChangeList";
import { SettingsPageFrame } from "@/components/portal/settings/SettingsPageFrame";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { Button } from "@/components/erp-ui/Button";
import { Card } from "@/components/erp-ui/Card";
import { CursorPager } from "@/components/erp-ui/CursorPager";
import { DataTable } from "@/components/erp-ui/DataTable";
import { Input } from "@/components/erp-ui/Input";
import { Modal } from "@/components/erp-ui/Modal";
import {
  auditCsv,
  formatTimestamp,
  shortRef,
  type AuditEntry,
} from "@/lib/audit";
import { fetchActivityForExport, useActivityLog } from "@/hooks/useActivity";
import { humanize } from "@/lib/erp/erp";
import { toast } from "@/lib/toast";
import { useDebounced } from "@/lib/erp/useDebounced";

const filterClass = "h-10 text-[13px]";

const buildColumns = (
  view: (e: AuditEntry) => void,
): ColumnDef<AuditEntry, unknown>[] => [
  {
    header: "Date",
    cell: ({ row }) => (
      <span className="text-[12.5px] whitespace-nowrap text-ink-400">
        {formatTimestamp(row.original.created_at)}
      </span>
    ),
  },
  {
    header: "Action",
    cell: ({ row }) => (
      <span className="font-semibold whitespace-nowrap text-ink-900">
        {row.original.action}
      </span>
    ),
  },
  {
    header: "Actor",
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-ink-900">
        {row.original.actor_label ?? humanize(row.original.actor_type)}
      </span>
    ),
  },
  {
    header: "Entity",
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {row.original.entity_type}
        {row.original.entity_label ? (
          <span className="text-ink-600"> {row.original.entity_label}</span>
        ) : (
          row.original.entity_id && (
            <span className="text-ink-600">
              {" "}
              #{shortRef(row.original.entity_id)}
            </span>
          )
        )}
      </span>
    ),
  },
  {
    header: "Changes",
    cell: ({ row }) => (
      <ChangeList
        summary={row.original.summary}
        changes={row.original.changes}
        onMore={() => view(row.original)}
      />
    ),
  },
];

export default function ActivityPage() {
  const { restaurant, ready } = usePortalGuard();
  const [viewing, setViewing] = useState<AuditEntry | null>(null);
  const [columns] = useState(() => buildColumns(setViewing));
  const [f, setF] = useState({
    q: "",
    action: "",
    entity_type: "",
    date_from: "",
    date_to: "",
  });
  const d = useDebounced(f);
  const filters = d;
  const log = useActivityLog(filters); // paged on the server by the id of the last entry seen
  const rows = log.rows;
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }));
  if (!ready) return null;

  async function exportCsv() {
    let all;
    try {
      all = await fetchActivityForExport(filters); // up to 500 entries matching the filters, not just this page
    } catch (e) {
      return toast.error("Couldn't export", (e as Error).message);
    }
    const url = URL.createObjectURL(
      new Blob([auditCsv(all)], { type: "text/csv" }),
    );
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `activity-${new Date().toISOString().slice(0, 10)}.csv`,
    });
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <SettingsPageFrame
      restaurant={restaurant}
      icon={<ClipboardList size={20} />}
      title="Activity log"
      description="A permanent record of important actions: who did what, on which record, and what changed. It can't be edited."
      actions={
        <Button variant="secondary" onClick={exportCsv} disabled={!rows.length}>
          <Download size={15} /> Export
        </Button>
      }
    >
      <Card className="mb-space-4 flex flex-wrap gap-space-2 p-space-3">
        <div className="relative min-w-60 flex-1">
          <Search
            size={15}
            className="absolute top-1/2 left-space-3 -translate-y-1/2 text-ink-400"
          />
          <Input
            className={`${filterClass} pl-9`}
            placeholder="Search actor, action, or entity id…"
            value={f.q}
            onChange={set("q")}
            aria-label="Search activity"
          />
        </div>
        <Input
          className={`${filterClass} w-44`}
          placeholder="Action (e.g. order.cancelled)"
          value={f.action}
          onChange={set("action")}
          aria-label="Filter by action"
        />
        <Input
          className={`${filterClass} w-36`}
          placeholder="Entity type"
          value={f.entity_type}
          onChange={set("entity_type")}
          aria-label="Filter by entity type"
        />
        <Input
          type="date"
          className={`${filterClass} w-38`}
          value={f.date_from}
          onChange={set("date_from")}
          aria-label="From date"
        />
        <Input
          type="date"
          className={`${filterClass} w-38`}
          value={f.date_to}
          onChange={set("date_to")}
          aria-label="To date"
        />
      </Card>
      {log.error && (
        <p className="mb-space-3 text-[13px] font-medium text-error">
          {log.error.message}
        </p>
      )}
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(e) => String(e.id)}
        paginate={false}
        emptyMessage={log.data ? "Nothing recorded yet." : "Loading…"}
      />
      <CursorPager {...log.pager} />
      <EntryModal entry={viewing} onClose={() => setViewing(null)} />
    </SettingsPageFrame>
  );
}

/** One entry in full: who, what, where and when as labelled details, then every change it made. */
function EntryModal({
  entry,
  onClose,
}: {
  entry: AuditEntry | null;
  onClose: () => void;
}) {
  if (!entry) return null;
  const details: [string, React.ReactNode][] = [
    ["Date", formatTimestamp(entry.created_at)],
    [
      "Action",
      <span key="action" className="font-mono">
        {entry.action}
      </span>,
    ],
    ["Actor", entry.actor_label ?? humanize(entry.actor_type)],
    ["Entity", entry.entity_type],
    ["Record", entry.entity_label ?? "—"],
    [
      "Entity id",
      entry.entity_id ? (
        <span className="font-mono break-all">{entry.entity_id}</span>
      ) : (
        "—"
      ),
    ],
  ];
  return (
    <Modal
      open
      title="Activity details"
      description={entry.summary}
      onClose={onClose}
      width="lg"
    >
      <dl className="grid grid-cols-1 gap-x-space-4 gap-y-space-3 sm:grid-cols-2">
        {details.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-[11px] font-semibold tracking-wide text-ink-400 uppercase">
              {k}
            </dt>
            <dd className="mt-0.5 text-[13px] text-ink-900">{v}</dd>
          </div>
        ))}
      </dl>
      <h3 className="mt-space-4 mb-space-2 border-t border-line pt-space-4 text-[13px] font-bold text-ink-900">
        Changes
      </h3>
      <ChangeDetails changes={entry.changes} />
    </Modal>
  );
}
