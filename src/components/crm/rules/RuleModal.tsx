"use client";

import { Settings02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { ConditionBuilder } from "@/components/crm/rules/ConditionBuilder";
import { Button } from "@/components/erp-ui/Button";
import { Field } from "@/components/erp-ui/Field";
import { Input } from "@/components/erp-ui/Input";
import { Modal } from "@/components/erp-ui/Modal";
import { Select } from "@/components/erp-ui/Select";
import { erp } from "@/lib/erp/erp";
import {
  FREQUENCY_LABEL,
  ONCE_LABEL,
  conditionReady,
  defaultCondition,
  describeConditions,
  type Condition,
  type CrmRule,
  type Match,
  type RuleFrequency,
  type RuleRun,
  type RuleScope,
  type RuleStatus,
} from "@/lib/erp/rules";
import type { CustomerTag } from "@/lib/erp/tags";
import { toast } from "@/lib/toast";

type Once = "ever" | "year" | "month";

/** Create or edit a rule: a tag rule (IF conditions THEN this tag) or a membership automation (IF conditions THEN points / a follow-up). */
export function RuleModal({
  scope,
  rule,
  start,
  tags,
  onClose,
  onSaved,
}: {
  scope: RuleScope;
  /** null = a new rule. */
  rule: CrmRule | null;
  /** A new rule's starting conditions and tag (from the quick builder or the tag form). */
  start?: { conditions?: Condition[]; match?: Match; tag_id?: string };
  tags: CustomerTag[];
  onClose: () => void;
  onSaved: (rule: CrmRule & { run: RuleRun | null }) => void;
}) {
  const [name, setName] = useState(rule?.name ?? "");
  const [description, setDescription] = useState(rule?.description ?? "");
  const [conditions, setConditions] = useState<Condition[]>(
    rule?.conditions.length
      ? rule.conditions
      : (start?.conditions ?? [
          defaultCondition(
            scope === "tag" ? "total_spend" : "birthday_this_month",
          ),
        ]),
  );
  const [match, setMatch] = useState<Match>(
    rule?.match ?? start?.match ?? "all",
  );
  const [tagId, setTagId] = useState(rule?.tag_id ?? start?.tag_id ?? "");
  const action = rule?.action;
  const [kind, setKind] = useState<"award_points" | "follow_up">(
    action?.type === "follow_up" ? "follow_up" : "award_points",
  );
  const [points, setPoints] = useState(
    action?.type === "award_points" ? String(action.points) : "100",
  );
  const [reason, setReason] = useState(
    action?.type === "award_points" ? (action.reason ?? "") : "",
  );
  const [note, setNote] = useState(
    action?.type === "follow_up" ? action.note : "",
  );
  const [once, setOnce] = useState<Once>(
    action && action.type !== "tag" ? action.once : "year",
  );
  const [frequency, setFrequency] = useState<RuleFrequency>(
    rule?.frequency ?? (scope === "tag" ? "real_time" : "daily"),
  );
  const [status, setStatus] = useState<RuleStatus>(rule?.status ?? "active");
  const [busy, setBusy] = useState(false);
  const tagNames = Object.fromEntries(tags.map((t) => [t.id, t.name]));
  const usable = tags.filter((t) => t.kind !== "system");
  const ready =
    conditions.every(conditionReady) &&
    (scope === "tag"
      ? !!tagId
      : kind === "follow_up"
        ? !!note.trim()
        : Number(points) > 0);

  async function save() {
    if (busy || !ready) return;
    setBusy(true);
    const body = {
      name:
        name.trim() ||
        describeConditions(conditions, match, tagNames).slice(0, 80),
      description: description.trim() || null,
      conditions,
      match,
      frequency,
      status,
      ...(scope === "tag"
        ? { tag_id: tagId }
        : {
            action:
              kind === "award_points"
                ? {
                    type: "award_points",
                    points: Number(points),
                    reason: reason.trim() || null,
                    once,
                  }
                : { type: "follow_up", note: note.trim(), once },
          }),
    };
    const res = rule
      ? await erp<CrmRule & { run: RuleRun | null }>(
          `/api/v1/crm/rules/${scope}/${rule.id}`,
          "PUT",
          body,
        )
      : await erp<CrmRule & { run: RuleRun | null }>(
          `/api/v1/crm/rules/${scope}`,
          "POST",
          body,
        );
    setBusy(false);
    if (res.error || !res.data)
      return toast.error("Couldn't save the rule", res.error ?? undefined);
    const run = res.data.run;
    toast.success(
      "Rule saved",
      run
        ? scope === "tag"
          ? `${run.matched} matched · ${run.added} tagged · ${run.removed} untagged`
          : `${run.matched} matched · ${run.added} acted on`
        : undefined,
    );
    onSaved(res.data);
  }

  return (
    <Modal
      open
      onClose={onClose}
      width="lg"
      title={
        rule
          ? "Edit rule"
          : scope === "tag"
            ? "Create tag rule"
            : "Add automation"
      }
      description={
        scope === "tag"
          ? "Customers who match carry the tag; anyone who stops matching loses it. Tags given by hand are never touched."
          : "Acts on matching members once per period: give loyalty points, or add a follow-up for the team."
      }
      bannerIcon={<HugeiconsIcon icon={Settings02Icon} size={22} />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !ready} onClick={save}>
            {rule ? "Save rule" : "Create rule"}
          </Button>
        </>
      }
    >
      <Field
        label="Rule name"
        htmlFor="rule_name"
        hint="Leave empty to name it after its conditions."
      >
        <Input
          id="rule_name"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <p className="mb-space-2 text-[13px] font-bold tracking-wide text-ink-600 uppercase">
        If these conditions are met
      </p>
      <ConditionBuilder
        conditions={conditions}
        match={match}
        tags={tags.filter((t) => t.id !== tagId)}
        exclude={scope === "tag" ? [] : ["has_tag"]}
        membersOnly={scope === "membership"}
        onChange={(c, m) => {
          setConditions(c);
          setMatch(m);
        }}
      />
      <p className="mt-space-4 mb-space-2 text-[13px] font-bold tracking-wide text-ink-600 uppercase">
        Then
      </p>
      {scope === "tag" ? (
        <Field label="Assign this tag" htmlFor="rule_tag" required>
          <Select id="rule_tag" value={tagId} onValueChange={setTagId}>
            <option value="">Choose a tag…</option>
            {usable.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.status !== "active" ? ` (${t.status})` : ""}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <div className="space-y-space-3">
          <Select
            value={kind}
            onValueChange={(v) => setKind(v as typeof kind)}
            aria-label="Action"
          >
            <option value="award_points">Give loyalty points</option>
            <option value="follow_up">Add a follow-up for the team</option>
          </Select>
          {kind === "award_points" ? (
            <div className="grid gap-space-3 sm:grid-cols-2">
              <Field label="Points" htmlFor="rule_points" required>
                <Input
                  id="rule_points"
                  inputMode="numeric"
                  value={points}
                  onChange={(e) => setPoints(e.target.value.replace(/\D/g, ""))}
                />
              </Field>
              <Field
                label="Reason (shown in the points history)"
                htmlFor="rule_reason"
              >
                <Input
                  id="rule_reason"
                  maxLength={120}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
            </div>
          ) : (
            <Field label="Follow-up note" htmlFor="rule_note" required>
              <Input
                id="rule_note"
                maxLength={300}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
          )}
          <Field label="How often per customer" htmlFor="rule_once">
            <Select
              id="rule_once"
              value={once}
              onValueChange={(v) => setOnce(v as Once)}
            >
              {(Object.keys(ONCE_LABEL) as Once[]).map((o) => (
                <option key={o} value={o}>
                  {ONCE_LABEL[o]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}
      <div className="mt-space-3 grid gap-space-3 sm:grid-cols-2">
        <Field
          label="Runs"
          htmlFor="rule_freq"
          hint="Real-time rules also re-check a customer right after each order."
        >
          <Select
            id="rule_freq"
            value={frequency}
            onValueChange={(v) => setFrequency(v as RuleFrequency)}
          >
            {(Object.keys(FREQUENCY_LABEL) as RuleFrequency[]).map((f) => (
              <option key={f} value={f}>
                {FREQUENCY_LABEL[f]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="rule_status">
          <Select
            id="rule_status"
            value={status}
            onValueChange={(v) => setStatus(v as RuleStatus)}
          >
            <option value="active">
              Active (runs now and then on schedule)
            </option>
            <option value="draft">Draft</option>
            <option value="paused">Paused</option>
          </Select>
        </Field>
      </div>
      <Field label="Description (optional)" htmlFor="rule_desc">
        <Input
          id="rule_desc"
          maxLength={300}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
    </Modal>
  );
}
