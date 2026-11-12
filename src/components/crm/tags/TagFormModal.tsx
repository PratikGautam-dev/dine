"use client";

import { Tag01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { TagChip } from "@/components/crm/tags/TagChip";
import { Button } from "@/components/erp-ui/Button";
import { Input } from "@/components/erp-ui/Input";
import { Modal } from "@/components/erp-ui/Modal";
import { Switch } from "@/components/erp-ui/Switch";
import { cn } from "@/lib/cn";
import { TEXTAREA_CLASS } from "@/lib/erp/crm";
import { erp } from "@/lib/erp/erp";
import { TIER_LABEL } from "@/lib/erp/membership";
import {
  APPLIES_TO_LABEL,
  EMPTY_TAG,
  TAG_COLOR,
  TAG_COLORS,
  TAG_ICON,
  TAG_ICONS,
  TAG_TEMPLATES,
  type CustomerTag,
  type TagAppliesTo,
  type TagForm,
  type TagTier,
} from "@/lib/erp/tags";
import { toast } from "@/lib/toast";

const TIERS: TagTier[] = ["regular", "silver", "gold", "platinum"];

function Step({
  n,
  title,
  hint,
  children,
}: {
  n: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line p-space-3">
      <h3 className="mb-space-2 flex items-center gap-space-2 text-[14.5px] font-bold text-ink-900">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-700 text-[12px] font-bold text-white">
          {n}
        </span>
        {title}
      </h3>
      {hint && (
        <p className="-mt-1 mb-space-2 text-[12.5px] text-ink-600">{hint}</p>
      )}
      {children}
    </section>
  );
}

function Choice({
  checked,
  onClick,
  children,
}: {
  checked: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      className={cn(
        "flex items-center gap-space-2 rounded-lg border px-space-3 py-2 text-left text-[13px] transition-colors",
        checked
          ? "border-brand-600 bg-brand-50 font-semibold text-ink-900"
          : "border-line text-ink-700 hover:bg-black/[0.03]",
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
          checked ? "border-brand-700" : "border-ink-300",
        )}
      >
        {checked && <span className="h-2 w-2 rounded-full bg-brand-700" />}
      </span>
      {children}
    </button>
  );
}

/** Add or edit a tag: name and description, colour and icon, who it applies to, status and notes, with a live preview. */
export function TagFormModal({
  open,
  tag,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** null = a new tag. */
  tag: CustomerTag | null;
  onClose: () => void;
  /** `withRule`: a new rule-based tag, whose rule is set up next. */
  onSaved: (tag: CustomerTag, withRule: boolean) => void;
}) {
  // Mounted afresh for each tag (the page keys it), so the form starts from the tag.
  const [form, setForm] = useState<TagForm>(() =>
    tag
      ? {
          name: tag.name,
          description: tag.description ?? "",
          color: tag.color,
          icon: tag.icon,
          applies_to: tag.applies_to,
          membership_filter: tag.membership_filter,
          status: tag.status,
          notes: tag.notes ?? "",
        }
      : EMPTY_TAG,
  );
  const [busy, setBusy] = useState(false);
  const [ruleBased, setRuleBased] = useState(false);
  const system = tag?.kind === "system";

  const set = (patch: Partial<TagForm>) => setForm((f) => ({ ...f, ...patch }));
  const toggleTier = (t: TagTier) =>
    set({
      membership_filter: form.membership_filter.includes(t)
        ? form.membership_filter.filter((x) => x !== t)
        : [...form.membership_filter, t],
    });

  async function save(status = form.status) {
    if (busy || !form.name.trim()) return;
    if (form.applies_to === "tiers" && form.membership_filter.length === 0)
      return toast.error(
        "Pick the tiers",
        "Choose at least one membership tier this tag applies to.",
      );
    setBusy(true);
    const body = {
      ...form,
      status,
      name: form.name.trim(),
      description: form.description.trim() || null,
      notes: form.notes.trim() || null,
    };
    const res = tag
      ? await erp<CustomerTag>(`/api/v1/crm/tag-records/${tag.id}`, "PUT", body)
      : await erp<CustomerTag>("/api/v1/crm/tag-records", "POST", body);
    setBusy(false);
    if (res.error || !res.data)
      return toast.error("Couldn't save the tag", res.error ?? undefined);
    toast.success(
      tag ? "Tag saved" : `“${res.data.name}” created`,
      !tag && ruleBased ? "Now set the rule that gives it out." : undefined,
    );
    onSaved(res.data, !tag && ruleBased);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      width="xl"
      title={tag ? "Edit Tag" : "Add New Tag"}
      description="Create a tag to segment customers for campaigns, loyalty and analysis."
      bannerIcon={<HugeiconsIcon icon={Tag01Icon} size={22} />}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {!tag && (
            <Button
              variant="secondary"
              disabled={busy || !form.name.trim()}
              onClick={() => save("draft")}
            >
              Save as Draft
            </Button>
          )}
          <Button disabled={busy || !form.name.trim()} onClick={() => save()}>
            {tag
              ? "Save Tag"
              : ruleBased
                ? "Create Tag & Set Rule"
                : "Create Tag"}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-space-3 lg:grid-cols-[1fr_340px]"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="space-y-space-3">
          <Step n={1} title="Basic Information">
            <label
              className="mb-1 block text-[13px] font-semibold text-ink-900"
              htmlFor="tag_name"
            >
              Tag Name <span className="text-error">*</span>
            </label>
            <Input
              id="tag_name"
              maxLength={40}
              disabled={system}
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
            />
            <p className="mt-0.5 text-right text-[11.5px] text-ink-400">
              {form.name.length}/40
            </p>
            <label
              className="mb-1 block text-[13px] font-semibold text-ink-900"
              htmlFor="tag_desc"
            >
              Short Description
            </label>
            <textarea
              id="tag_desc"
              rows={2}
              maxLength={200}
              className={TEXTAREA_CLASS}
              value={form.description}
              onChange={(e) => set({ description: e.target.value })}
            />
            <p className="text-right text-[11.5px] text-ink-400">
              {form.description.length}/200
            </p>
          </Step>

          {!tag && (
            <Step n={2} title="Tag Type" hint="How customers get this tag.">
              <div
                className="grid gap-space-2 sm:grid-cols-2"
                role="radiogroup"
              >
                <Choice
                  checked={!ruleBased}
                  onClick={() => setRuleBased(false)}
                >
                  <span>
                    <span className="block">Manual tag</span>
                    <span className="block text-[12px] font-normal text-ink-600">
                      Added by hand to chosen customers
                    </span>
                  </span>
                </Choice>
                <Choice checked={ruleBased} onClick={() => setRuleBased(true)}>
                  <span>
                    <span className="block">Rule-based tag</span>
                    <span className="block text-[12px] font-normal text-ink-600">
                      Given and taken back automatically by a rule
                    </span>
                  </span>
                </Choice>
              </div>
            </Step>
          )}

          <Step n={tag ? 2 : 3} title="Color & Icon">
            <div className="flex flex-wrap gap-space-4">
              <div>
                <p className="mb-1 text-[12.5px] text-ink-600">Tag Color</p>
                <div
                  className="flex flex-wrap gap-space-2"
                  role="radiogroup"
                  aria-label="Tag colour"
                >
                  {TAG_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={form.color === c}
                      aria-label={c}
                      onClick={() => set({ color: c })}
                      className={cn(
                        "h-7 w-7 rounded-full ring-offset-2",
                        TAG_COLOR[c].swatch,
                        form.color === c && "ring-2 ring-ink-900",
                      )}
                    />
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-[12.5px] text-ink-600">Tag Icon</p>
                <div
                  className="flex flex-wrap gap-1"
                  role="radiogroup"
                  aria-label="Tag icon"
                >
                  {TAG_ICONS.map((i) => (
                    <button
                      key={i}
                      type="button"
                      role="radio"
                      aria-checked={form.icon === i}
                      aria-label={i}
                      onClick={() => set({ icon: i })}
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-md border",
                        form.icon === i
                          ? cn("border-transparent", TAG_COLOR[form.color].chip)
                          : "border-line text-ink-600 hover:bg-black/[0.03]",
                      )}
                    >
                      <HugeiconsIcon icon={TAG_ICON[i]} size={16} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Step>

          <Step
            n={3}
            title="Applies To"
            hint="Who this tag may be given to. Customers outside it are skipped when tagging."
          >
            <div className="flex flex-wrap gap-space-2" role="radiogroup">
              {(Object.keys(APPLIES_TO_LABEL) as TagAppliesTo[]).map((a) => (
                <Choice
                  key={a}
                  checked={form.applies_to === a}
                  onClick={() => set({ applies_to: a })}
                >
                  {APPLIES_TO_LABEL[a]}
                </Choice>
              ))}
            </div>
          </Step>

          <Step
            n={tag ? 4 : 5}
            title={
              form.applies_to === "tiers"
                ? "Membership Tiers"
                : "Membership Filter (Optional)"
            }
            hint="Only members of these tiers can carry this tag."
          >
            <div className="flex flex-wrap gap-space-4">
              {TIERS.map((t) => (
                <label
                  key={t}
                  className="flex cursor-pointer items-center gap-space-2 text-[13.5px] text-ink-900"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--color-brand-700)]"
                    checked={form.membership_filter.includes(t)}
                    onChange={() => toggleTier(t)}
                  />
                  {TIER_LABEL[t]}
                </label>
              ))}
            </div>
          </Step>
        </div>

        <div className="space-y-space-3">
          <section className="rounded-lg bg-purple-50/60 p-space-3">
            <h3 className="text-[14.5px] font-bold text-ink-900">
              Tag Preview
            </h3>
            <p className="text-[12.5px] text-ink-600">
              How the tag appears in lists and customer details.
            </p>
            <div className="flex justify-center py-space-4">
              <TagChip
                name={form.name.trim() || "Tag name"}
                color={form.color}
                icon={form.icon}
                className="px-space-4 py-1.5 text-[14px]"
              />
            </div>
          </section>

          {!tag && (
            <Step
              n={5}
              title="Suggested Tag Purpose"
              hint="Use a ready-made idea to get started."
            >
              <div className="grid grid-cols-2 gap-space-2">
                {TAG_TEMPLATES.map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() =>
                      set({
                        name: t.name,
                        color: t.color,
                        icon: t.icon,
                        description: t.description,
                      })
                    }
                    className={cn(
                      "flex items-center gap-space-2 rounded-lg px-space-2 py-1.5 text-left text-[12.5px] font-semibold",
                      TAG_COLOR[t.color].chip,
                      form.name === t.name && "ring-2 ring-current",
                    )}
                  >
                    <HugeiconsIcon
                      icon={TAG_ICON[t.icon]}
                      size={14}
                      className="shrink-0"
                    />
                    <span className="truncate">{t.name}</span>
                  </button>
                ))}
              </div>
            </Step>
          )}

          <Step
            n={tag ? 5 : 6}
            title="Status"
            hint="Draft and inactive tags are not given to customers."
          >
            <div className="flex items-center gap-space-3 text-[14px]">
              <Switch
                tone="success"
                checked={form.status === "active"}
                onChange={() =>
                  set({
                    status: form.status === "active" ? "inactive" : "active",
                  })
                }
                aria-label="Active"
              />
              {form.status === "active"
                ? "Active"
                : form.status === "draft"
                  ? "Draft"
                  : "Inactive"}
            </div>
          </Step>

          <Step n={tag ? 6 : 8} title="Notes / Internal Remark">
            <textarea
              rows={3}
              maxLength={500}
              aria-label="Notes"
              className={TEXTAREA_CLASS}
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
            <p className="text-right text-[11.5px] text-ink-400">
              {form.notes.length}/500
            </p>
          </Step>
        </div>
      </form>
    </Modal>
  );
}
