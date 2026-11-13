"use client";

import { ImagePlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input, Textarea } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { useRaiseTicket, useSupportCategories } from "@/hooks/useSupport";
import {
  fileProblem,
  MAX_FILES,
  PRIORITIES,
  PRIORITY_LABEL,
  QUESTION_MAX_CHARS,
  SUBJECT_MAX_CHARS,
  type SupportPriority,
} from "@/lib/support";
import { toast } from "@/lib/toast";
import { Counter } from "./Counter";

const selectStyle =
  "h-11 w-full rounded-md border border-line bg-card px-space-3 text-[14px] text-ink-900 shadow-[var(--shadow-sm)] " +
  "focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100";

/** The "Raise a ticket" form: what's wrong, how urgent, a reference, and up to three screenshots. */
export function RaiseTicketModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const cats = useSupportCategories();
  const raise = useRaiseTicket();
  const picker = useRef<HTMLInputElement>(null);
  const [subject, setSubject] = useState("");
  const [question, setQuestion] = useState("");
  const [priority, setPriority] = useState<SupportPriority>("normal");
  const [category, setCategory] = useState("");
  const [reference, setReference] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);

  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const f of Array.from(list)) {
      const problem = fileProblem(f);
      if (problem) return setError(problem);
      if (next.length >= MAX_FILES) return setError(`You can attach at most ${MAX_FILES} images.`);
      next.push(f);
    }
    setError("");
    setFiles(next);
    if (picker.current) picker.current.value = "";
  }

  function submit() {
    if (!subject.trim()) return setError("Enter a subject.");
    if (!question.trim()) return setError("Describe the problem.");
    setError("");
    raise.mutate(
      { subject: subject.trim(), question: question.trim(), priority, category_id: category, problem_reference: reference, files },
      {
        onSuccess: (t) => {
          toast.success("Ticket raised", `${t.ticket_number} is with our team`);
          onClose();
          router.push(`/portal/support/${t.id}`);
        },
        onError: (e) => setError(e.message),
      },
    );
  }

  return (
    <Modal onClose={onClose} labelledBy="st-title" maxWidthClass="max-w-[640px]">
      <h2 id="st-title" className="text-[17px] font-bold text-ink-900">
        Raise a ticket
      </h2>
      <p className="mb-space-4 mt-0.5 text-[13px] text-ink-600">
        Tell us what&apos;s wrong and we&apos;ll reply here. You can follow it any time.
      </p>
      <div className="grid gap-x-space-3 sm:grid-cols-2">
        <Field label="Category" htmlFor="st-cat">
          <select id="st-cat" value={category} onChange={(e) => setCategory(e.target.value)} className={selectStyle}>
            <option value="">Select a category</option>
            {(cats.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priority" htmlFor="st-prio">
          <select
            id="st-prio"
            value={priority}
            onChange={(e) => setPriority(e.target.value as SupportPriority)}
            className={selectStyle}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Subject" htmlFor="st-subject" required>
        <Input
          id="st-subject"
          maxLength={SUBJECT_MAX_CHARS}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="A short summary"
        />
        <Counter used={subject.length} max={SUBJECT_MAX_CHARS} unit="characters" />
      </Field>
      <Field label="What happened?" htmlFor="st-question" required>
        <Textarea
          id="st-question"
          rows={5}
          maxLength={QUESTION_MAX_CHARS}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What you did, what you expected and what you saw instead."
        />
        <Counter used={question.length} max={QUESTION_MAX_CHARS} unit="characters" />
      </Field>
      <Field
        label="Related order or booking (optional)"
        htmlFor="st-ref"
        hint="For example an order number, so we can find it quickly."
      >
        <Input id="st-ref" maxLength={120} value={reference} onChange={(e) => setReference(e.target.value)} />
      </Field>
      <Field label={`Screenshots (${files.length} of ${MAX_FILES})`} hint="JPEG, PNG or WebP, up to 2 MB each.">
        <div className="flex flex-wrap items-center gap-space-2">
          {previews.map((src, i) => (
            <div key={src} className="relative h-20 w-20 overflow-hidden rounded-md border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of the chosen file */}
              <img src={src} alt={files[i].name} className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label={`Remove ${files[i].name}`}
                onClick={() => setFiles(files.filter((_, j) => j !== i))}
                className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 text-white"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {files.length < MAX_FILES && (
            <button
              type="button"
              onClick={() => picker.current?.click()}
              className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-line text-[12px] text-ink-600 hover:bg-brand-50"
            >
              <ImagePlus size={18} /> Add
            </button>
          )}
          <input
            ref={picker}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>
      </Field>
      {error && (
        <p role="alert" className="text-[13px] font-medium text-error">
          {error}
        </p>
      )}
      <div className="mt-space-4 flex justify-end gap-space-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={raise.isPending} onClick={submit}>
          {raise.isPending ? "Sending…" : "Raise ticket"}
        </Button>
      </div>
    </Modal>
  );
}
