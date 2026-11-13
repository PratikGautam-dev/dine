"use client";

import { Settings02Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useState } from "react";
import { SegmentConditions } from "@/components/crm/rules/SegmentConditions";
import { Button } from "@/components/erp-ui/Button";
import { CheckboxRow } from "@/components/erp-ui/Checkbox";
import { Card } from "@/components/erp-ui/Card";
import { Field } from "@/components/erp-ui/Field";
import { Input } from "@/components/erp-ui/Input";
import { type CrmSummary } from "@/lib/erp/crm";
import { erp, useErpQuery } from "@/lib/erp/erp";
import {
  defaultCondition,
  describeConditions,
  segmentConditionReady,
  type Match,
  type Preview,
  type SavedSegment,
  type SegmentCondition,
} from "@/lib/erp/rules";
import type { CustomerTag } from "@/lib/erp/tags";
import { toast } from "@/lib/toast";
import { useDebounced } from "@/lib/erp/useDebounced";

/** Customers > Segments > Segment Builder: name the segment, set conditions (membership, tags, spend, …) and watch who matches. */
export function SegmentBuilder({
  segment,
  onSaved,
  onCancel,
}: {
  segment: SavedSegment | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const tags = useErpQuery<CustomerTag[]>("/api/v1/crm/tags");
  const summary = useErpQuery<CrmSummary>("/api/v1/crm/summary");
  const [name, setName] = useState(segment?.name ?? "");
  const [description, setDescription] = useState(segment?.description ?? "");
  const [conditions, setConditions] = useState<SegmentCondition[]>(
    segment?.conditions ?? [defaultCondition("tier")],
  );
  const [match, setMatch] = useState<Match>(segment?.match ?? "all");
  const [kind, setKind] = useState<"dynamic" | "static">(
    segment?.kind ?? "dynamic",
  );
  const [marketing, setMarketing] = useState(segment?.marketing ?? true);
  const [showInFilters, setShowInFilters] = useState(
    segment?.show_in_filters ?? true,
  );
  const [busy, setBusy] = useState(false);
  const tagList = tags.data ?? [];
  const tagNames = Object.fromEntries(tagList.map((t) => [t.id, t.name]));
  const ready =
    conditions.length > 0 && conditions.every(segmentConditionReady);

  const body = useDebounced(
    ready ? JSON.stringify({ conditions, match, members_only: false }) : "",
    400,
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  useEffect(() => {
    if (!body) return;
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
  }, [body]);

  const total = summary.data?.total_customers ?? 0;
  const pct =
    preview && total ? Math.round((1000 * preview.matched) / total) / 10 : null;

  async function save(status: "active" | "draft") {
    if (!ready || !name.trim() || busy) return;
    setBusy(true);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      conditions,
      match,
      kind,
      status,
      marketing,
      show_in_filters: showInFilters,
    };
    const res = segment
      ? await erp<SavedSegment>(
          `/api/v1/crm/customer-segments/${segment.id}`,
          "PUT",
          payload,
        )
      : await erp<SavedSegment>(
          "/api/v1/crm/customer-segments",
          "POST",
          payload,
        );
    setBusy(false);
    if (res.error || !res.data)
      return toast.error("Couldn't save the segment", res.error ?? undefined);
    toast.success(
      `“${res.data.name}” saved`,
      `${res.data.member_count.toLocaleString("en-IN")} customers right now`,
    );
    onSaved();
  }

  return (
    <div className="grid gap-space-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Card className="p-space-4">
        <h2 className="text-[17px] font-bold text-ink-900">
          {segment ? "Edit segment" : "Create segment"}
        </h2>
        <p className="mb-space-4 text-[13px] text-ink-600">
          Define a name, set conditions and create a dynamic customer segment.
        </p>
        <div className="grid gap-x-space-4 md:grid-cols-[minmax(0,1fr)_auto]">
          <Field label="Segment name" htmlFor="seg_name" required>
            <Input
              id="seg_name"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Segment type">
            <div
              className="flex gap-space-2"
              role="radiogroup"
              aria-label="Segment type"
            >
              {(["dynamic", "static"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => setKind(k)}
                  className={
                    "flex items-center gap-space-2 rounded-lg border px-space-3 py-space-2 text-[14px] font-medium " +
                    (kind === k
                      ? "border-brand-600 bg-brand-50 text-ink-900"
                      : "border-line text-ink-700 hover:bg-black/[0.03]")
                  }
                >
                  <span
                    className={
                      "flex h-4 w-4 items-center justify-center rounded-full border " +
                      (kind === k ? "border-brand-700" : "border-ink-400")
                    }
                  >
                    {kind === k && (
                      <span className="h-2 w-2 rounded-full bg-brand-700" />
                    )}
                  </span>
                  {k === "dynamic" ? "Dynamic" : "Static"}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <p className="-mt-space-2 mb-space-3 text-[12.5px] text-ink-600">
          {kind === "dynamic"
            ? "Dynamic: customers join and leave as they start or stop matching."
            : "Static: keeps the customers who match when you save. Saving again takes a new snapshot."}
        </p>
        <Field label="Description (optional)" htmlFor="seg_desc">
          <Input
            id="seg_desc"
            maxLength={300}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <SegmentConditions
          conditions={conditions}
          match={match}
          tags={tagList}
          onChange={(c, m) => {
            setConditions(c);
            setMatch(m);
          }}
        />
        <div className="mt-space-4 border-t border-line pt-space-4">
          <h3 className="mb-space-2 flex items-center gap-space-2 text-[15px] font-bold text-ink-900">
            <HugeiconsIcon
              icon={Settings02Icon}
              size={18}
              className="text-brand-700"
            />
            Settings
          </h3>
          <div className="space-y-space-3">
            <CheckboxRow
              checked={kind === "dynamic"}
              onChange={(on) => setKind(on ? "dynamic" : "static")}
            >
              <span className="block font-semibold">
                Auto-update segment (recommended)
              </span>
              <span className="block text-[12.5px] text-ink-600">
                Customers automatically enter or leave this segment based on the
                conditions. Off makes it a static segment.
              </span>
            </CheckboxRow>
            <CheckboxRow checked={marketing} onChange={setMarketing}>
              <span className="block font-semibold">
                Make this segment available for marketing campaigns
              </span>
              <span className="block text-[12.5px] text-ink-600">
                Use in WhatsApp, SMS, Email and offer campaigns.
              </span>
            </CheckboxRow>
            <CheckboxRow checked={showInFilters} onChange={setShowInFilters}>
              <span className="block font-semibold">
                Show in customer filters and reports
              </span>
              <span className="block text-[12.5px] text-ink-600">
                Offered in the All Customers filters and in the segment
                analytics.
              </span>
            </CheckboxRow>
          </div>
        </div>
        <div className="mt-space-4 flex flex-wrap gap-space-2 border-t border-line pt-space-4">
          <Button
            className="max-md:w-full"
            disabled={busy || !ready || !name.trim()}
            onClick={() => save("active")}
          >
            {segment && segment.status === "active"
              ? "Save segment"
              : "Create segment"}
          </Button>
          <Button
            variant="secondary"
            className="max-md:flex-[2] max-md:whitespace-nowrap"
            disabled={busy || !ready || !name.trim()}
            onClick={() => save("draft")}
          >
            Save as Draft
          </Button>
          <Button variant="ghost" className="max-md:flex-1" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </Card>

      <Card className="h-fit p-space-4">
        <h2 className="text-[17px] font-bold text-ink-900">Segment preview</h2>
        <p className="mb-space-3 text-[13px] text-ink-600">
          Live results based on current customer data.
        </p>
        <div className="flex items-center gap-space-3 rounded-lg bg-brand-50 p-space-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand-700">
            <HugeiconsIcon icon={UserGroupIcon} size={20} />
          </span>
          <div>
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
                <p className="text-[13px] text-ink-600">Matching customers</p>
                <p className="text-[22px] font-bold leading-tight text-ink-900">
                  {preview ? preview.matched.toLocaleString("en-IN") : "…"}
                </p>
                {pct !== null && (
                  <p className="text-[12px] text-ink-600">
                    {pct}% of {total.toLocaleString("en-IN")} customers
                  </p>
                )}
              </>
            )}
          </div>
        </div>
        {ready && (
          <div className="mt-space-4">
            <p className="mb-1 text-[13px] font-bold text-ink-900">
              Condition summary
            </p>
            <p className="text-[13px] text-ink-700">
              {describeConditions(conditions, match, tagNames)}
            </p>
          </div>
        )}
        {ready && preview && preview.sample.length > 0 && (
          <div className="mt-space-4">
            <p className="mb-1 text-[13px] font-bold text-ink-900">
              Sample customers
            </p>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {preview.sample.slice(0, 5).map((s) => (
                <li
                  key={s.id}
                  className="px-space-3 py-space-2 text-[13px] text-ink-900"
                >
                  {s.name || "Unnamed"}
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-space-4 rounded-lg bg-ink-50 p-space-3 text-[12.5px] text-ink-700">
          Tip: segments like Inactive Members, High-value Customers or New
          Customers work well for targeted campaigns. Pick a segment as the
          audience when you create a campaign.
        </p>
      </Card>
    </div>
  );
}
