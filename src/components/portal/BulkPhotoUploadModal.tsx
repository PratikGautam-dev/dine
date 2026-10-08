"use client";

import { useMemo, useRef, useState } from "react";
import { ImageUp, Loader2, TriangleAlert, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { MenuItem } from "@/hooks/useMenuItems";
import { portalFetch } from "@/lib/portalAuth";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";

/** filename (no extension, no separators, lowercase) -> for best-guess matching against item
 * names normalised the same way. Deliberately simple (no fuzzy/Levenshtein library) -- staff
 * always sees and confirms the guess before anything saves, so a slightly-wrong guess costs one
 * dropdown click, never a silently misapplied photo. */
function normalise(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function bestGuess(filename: string, items: MenuItem[]): string | null {
  const name = normalise(filename);
  if (!name) return null;
  const exact = items.find((i) => normalise(i.name) === name);
  if (exact) return exact.id;
  // Otherwise the item whose own normalised name is the longest substring match either direction
  // (covers "masala-dosa-2.jpg" -> "Masala Dosa", or "dosa.jpg" -> the one item containing "dosa").
  let bestId: string | null = null;
  let bestScore = 0;
  for (const item of items) {
    const itemName = normalise(item.name);
    if (!itemName) continue;
    const score = name.includes(itemName)
      ? itemName.length
      : itemName.includes(name)
        ? name.length
        : 0;
    if (score > bestScore) {
      bestScore = score;
      bestId = item.id;
    }
  }
  // Require at least a 3-character overlap -- "idli.jpg" shouldn't weakly match everything.
  return bestScore >= 3 ? bestId : null;
}

type RowStatus = "pending" | "uploading" | "done" | "error";

type Row = {
  key: string;
  file: File;
  previewUrl: string;
  itemId: string | null;
  status: RowStatus;
  error: string | null;
};

type Props = {
  items: MenuItem[];
  onClose: () => void;
  /** Called once after at least one photo has been successfully assigned, so the caller can
   * reload the menu list. */
  onUploaded: () => void;
};

/** The portal's bulk photo-upload panel: pick several files at once, each gets a best-guess menu
 * item from its filename (never auto-saved), staff reviews/corrects every row via a dropdown,
 * then "Upload & assign" runs each confirmed row through the same two-step upload-then-assign
 * flow the single-item panel already uses (POST .../upload-image, then POST .../{id}/image). */
export function BulkPhotoUploadModal({ items, onClose, onUploaded }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const nonComboItems = useMemo(() => items, [items]);

  function addFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const next: Row[] = [...fileList].map((file, i) => ({
      key: `${file.name}-${file.size}-${Date.now()}-${i}`,
      file,
      previewUrl: URL.createObjectURL(file),
      itemId: bestGuess(file.name, nonComboItems),
      status: "pending",
      error: null,
    }));
    setRows((prev) => [...prev, ...next]);
  }

  function removeRow(key: string) {
    setRows((prev) => {
      const row = prev.find((r) => r.key === key);
      if (row) URL.revokeObjectURL(row.previewUrl);
      return prev.filter((r) => r.key !== key);
    });
  }

  function setRowItem(key: string, itemId: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, itemId: itemId || null } : r)));
  }

  const matchedCount = rows.filter((r) => r.itemId).length;
  const canRun = matchedCount > 0 && !running;

  async function handleUploadAll() {
    setRunning(true);
    let successCount = 0;
    // Sequential, not parallel -- keeps per-row progress legible and avoids hammering R2/the
    // backend with a burst of simultaneous multipart uploads from a single click.
    for (const row of rows) {
      if (!row.itemId || row.status === "done") continue;
      setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, status: "uploading", error: null } : r)));
      const body = new FormData();
      body.append("file", row.file);
      const uploadResult = await portalFetch("/api/portal/menu-items/upload-image", {
        method: "POST",
        body,
      });
      if (!uploadResult.ok) {
        setRows((prev) =>
          prev.map((r) =>
            r.key === row.key
              ? { ...r, status: "error", error: uploadResult.unauthorized ? "Session expired" : uploadResult.error }
              : r,
          ),
        );
        continue;
      }
      const { image_url } = uploadResult.data as { image_url: string };
      const assignResult = await portalFetch(`/api/portal/menu-items/${row.itemId}/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url }),
      });
      if (!assignResult.ok) {
        setRows((prev) =>
          prev.map((r) =>
            r.key === row.key
              ? { ...r, status: "error", error: assignResult.unauthorized ? "Session expired" : assignResult.error }
              : r,
          ),
        );
        continue;
      }
      successCount += 1;
      setRows((prev) => prev.map((r) => (r.key === row.key ? { ...r, status: "done" } : r)));
    }
    setRunning(false);
    if (successCount > 0) {
      toast.success(`${successCount} photo${successCount === 1 ? "" : "s"} assigned`);
      onUploaded();
    }
  }

  return (
    <Modal onClose={running ? () => {} : onClose} labelledBy="bulk-photo-upload-title" maxWidthClass="max-w-[720px]">
      <div className="mb-space-4 flex items-start justify-between gap-space-3">
        <div>
          <h2 id="bulk-photo-upload-title" className="text-[16px] font-bold text-ink-900">
            Bulk upload photos
          </h2>
          <p className="text-hint mt-1">
            Pick several dish photos at once. We&apos;ll guess which item each one belongs to from its
            filename — review and fix the guess before anything is saved.
          </p>
        </div>
        {!running && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-ink-400 hover:bg-black/[0.04] hover:text-ink-900"
          >
            <X size={18} />
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {rows.length === 0 ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-space-2 rounded-lg border-2 border-dashed border-line bg-paper py-space-8 text-ink-600 hover:border-brand-300 hover:bg-brand-50"
        >
          <ImageUp size={28} className="text-ink-400" />
          <span className="text-[13.5px] font-semibold">Click to choose photos</span>
          <span className="text-hint">JPEG, PNG or WebP — up to 5 MB each</span>
        </button>
      ) : (
        <>
          <div className="mb-space-3 flex items-center justify-between">
            <span className="text-[12.5px] text-ink-600">
              {rows.length} photo{rows.length === 1 ? "" : "s"} · {matchedCount} matched to an item
            </span>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={running}
              className="text-[12.5px] font-semibold text-brand-700 hover:underline disabled:opacity-50"
            >
              + Add more
            </button>
          </div>

          <div className="mb-space-4 max-h-[360px] space-y-space-2 overflow-y-auto">
            {rows.map((row) => (
              <div
                key={row.key}
                className="flex items-center gap-space-3 rounded-md border border-line bg-card p-space-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={row.previewUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-md object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12.5px] font-semibold text-ink-900">
                    {row.file.name}
                  </div>
                  <select
                    aria-label={`Menu item for ${row.file.name}`}
                    value={row.itemId ?? ""}
                    disabled={running || row.status === "done"}
                    onChange={(e) => setRowItem(row.key, e.target.value)}
                    className={cn(
                      "mt-1 h-8 w-full max-w-[280px] rounded-md border bg-card px-space-2 text-[12.5px] text-ink-900 outline-none focus:border-brand-400",
                      row.itemId ? "border-line" : "border-warning",
                    )}
                  >
                    <option value="">Select item…</option>
                    {nonComboItems.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                  {row.status === "error" && (
                    <div className="mt-1 flex items-center gap-space-1 text-[11.5px] text-destructive">
                      <TriangleAlert size={12} /> {row.error}
                    </div>
                  )}
                </div>
                <div className="shrink-0">
                  {row.status === "uploading" && (
                    <Loader2 size={18} className="animate-spin text-brand-600" />
                  )}
                  {row.status === "done" && <Badge tone="success">Saved</Badge>}
                  {row.status === "pending" && !row.itemId && <Badge tone="warning">No match</Badge>}
                  {row.status !== "uploading" && row.status !== "done" && (
                    <button
                      type="button"
                      onClick={() => removeRow(row.key)}
                      disabled={running}
                      aria-label={`Remove ${row.file.name}`}
                      className="ml-space-2 rounded-md p-1 text-ink-400 hover:bg-black/[0.04] hover:text-ink-900 disabled:opacity-50"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="flex items-center justify-end gap-space-3">
        <Button variant="secondary" onClick={onClose} disabled={running}>
          {rows.some((r) => r.status === "done") ? "Done" : "Cancel"}
        </Button>
        {rows.length > 0 && (
          <Button onClick={handleUploadAll} disabled={!canRun}>
            {running ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Uploading…
              </>
            ) : (
              <>
                <Upload size={14} /> Upload &amp; assign {matchedCount || ""}
              </>
            )}
          </Button>
        )}
      </div>
    </Modal>
  );
}
