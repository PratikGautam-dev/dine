"use client";

import { useState } from "react";
import { SegmentCustomerList } from "@/components/crm/rules/SegmentsView";
import { Card } from "@/components/erp-ui/Card";
import { Select } from "@/components/erp-ui/Select";
import { useErpQuery } from "@/lib/erp/erp";
import type { SavedSegment } from "@/lib/erp/rules";

const nf = (n: number) => n.toLocaleString("en-IN");

/** Customers > Segments > Customers in Segment: pick a saved segment and see who is in it. */
export function CustomersInSegment({ currency }: { currency: string }) {
  const segments = useErpQuery<SavedSegment[]>("/api/v1/crm/customer-segments");
  const [picked, setPicked] = useState("");
  const all = segments.data ?? [];
  const segment = all.find((s) => s.id === picked) ?? all[0] ?? null;
  if (segments.loading)
    return <p className="text-[13px] text-ink-600">Loading…</p>;
  if (!segment)
    return (
      <Card className="p-space-4 text-[13px] text-ink-600">
        No segments yet. Create one in the Segment Builder tab.
      </Card>
    );
  return (
    <Card className="p-space-4">
      <div className="mb-space-3 flex flex-wrap items-center gap-space-2">
        <span className="text-[13px] font-semibold text-ink-900">Segment</span>
        <Select
          value={segment.id}
          onValueChange={setPicked}
          className="!w-auto min-w-[220px]"
          aria-label="Segment"
        >
          {all.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({nf(s.member_count)})
            </option>
          ))}
        </Select>
      </div>
      <SegmentCustomerList
        key={segment.id}
        segment={segment}
        currency={currency}
      />
    </Card>
  );
}

/** Customers > Segments > Analytics: how big each segment is and which kinds of condition they use (counted live, nothing estimated). */
export function SegmentAnalytics() {
  const segments = useErpQuery<SavedSegment[]>("/api/v1/crm/customer-segments");
  const all = [...(segments.data ?? [])]
    .filter((s) => s.status === "active" && s.show_in_filters)
    .sort((a, b) => b.member_count - a.member_count);
  const biggest = all[0]?.member_count || 1;
  const kinds = new Map<string, number>();
  for (const s of all)
    kinds.set(s.rule_type, (kinds.get(s.rule_type) ?? 0) + 1);
  if (segments.loading)
    return <p className="text-[13px] text-ink-600">Loading…</p>;
  if (!all.length)
    return (
      <Card className="p-space-4 text-[13px] text-ink-600">
        No segments yet. Create one in the Segment Builder tab.
      </Card>
    );
  return (
    <div className="grid gap-space-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Card className="p-space-4">
        <h2 className="mb-space-3 text-[15px] font-bold text-ink-900">
          Customers by segment
        </h2>
        <ul className="space-y-space-3">
          {all.map((s) => (
            <li key={s.id}>
              <div className="mb-1 flex justify-between text-[13px]">
                <span className="font-medium text-ink-900">{s.name}</span>
                <span className="text-ink-600">{nf(s.member_count)}</span>
              </div>
              <div className="h-2 rounded-full bg-ink-50">
                <div
                  className="h-2 rounded-full bg-brand-600"
                  style={{ width: `${(100 * s.member_count) / biggest}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="h-fit p-space-4">
        <h2 className="mb-space-3 text-[15px] font-bold text-ink-900">
          Segments by condition type
        </h2>
        <ul className="space-y-space-2 text-[13px]">
          {[...kinds].map(([kind, n]) => (
            <li key={kind} className="flex justify-between">
              <span className="text-ink-700">{kind}</span>
              <span className="font-semibold text-ink-900">{n}</span>
            </li>
          ))}
        </ul>
        <p className="mt-space-3 text-[12px] text-ink-600">
          Active segments shown in reports. Counts are worked out afresh each
          time this page loads.
        </p>
      </Card>
    </div>
  );
}
