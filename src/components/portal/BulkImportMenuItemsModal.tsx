"use client";

import { useMemo, useRef, useState } from "react";
import { FileUp, Loader2, TriangleAlert, Upload, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { portalFetch } from "@/lib/portalAuth";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/cn";

const TEMPLATE_CSV =
  "name,price_rupees,category,description,stock_count,image_filename\n" +
  "Paneer Tikka,249,Starters,Smoky grilled cottage cheese,,paneer-tikka.jpg\n";

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "menu_items_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/** Minimal RFC4180 CSV parser (quoted fields, escaped "" quotes, commas/newlines inside quotes) --
 * no added dependency for a format this contained. Returns rows of raw string cells; the header
 * row is row 0. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

type ImportRow = {
  key: string;
  name: string;
  priceText: string;
  category: string;
  description: string;
  stockText: string; // "" means unlimited
  imageFilename: string;
  status: "pending" | "uploading" | "done" | "error";
  error: string | null;
};

function rowError(row: ImportRow): string | null {
  if (!row.name.trim()) return "Name is required";
  const price = Number(row.priceText);
  if (row.priceText.trim() === "" || Number.isNaN(price) || price < 0) return "Price must be a number ≥ 0";
  return null;
}

type Props = {
  existingNames: string[]; // lowercase, trimmed -- for the non-blocking "already on menu" hint
  onClose: () => void;
  onImported: () => void;
};

/** Bulk-creates menu items from a CSV (name, price_rupees, category, description, stock_count,
 * image_filename) plus an optional batch of photo files matched to each row by exact filename.
 * Nothing is created until staff reviews the parsed table (every field editable, every row
 * removable) and clicks "Create items" -- same confirm-before-save discipline as the
 * bulk-photo-only panel, just one step earlier in the pipeline since this also creates the items
 * themselves, not only their photos. */
export function BulkImportMenuItemsModal({ existingNames, onClose, onImported }: Props) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [imageFiles, setImageFiles] = useState<Map<string, File>>(new Map());
  const [parseError, setParseError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const imagesInputRef = useRef<HTMLInputElement>(null);

  const existingSet = useMemo(() => new Set(existingNames), [existingNames]);

  async function handleCsvPicked(file: File) {
    setParseError(null);
    const text = await file.text();
    const table = parseCsv(text);
    if (table.length === 0) {
      setParseError("That CSV looks empty.");
      return;
    }
    const header = table[0].map((h) => h.trim().toLowerCase());
    const col = (names: string[]) => names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;
    const nameCol = col(["name", "menu_item_name"]);
    const priceCol = col(["price_rupees", "price"]);
    if (nameCol < 0 || priceCol < 0) {
      setParseError('CSV must have at least "name" and "price_rupees" columns.');
      return;
    }
    const categoryCol = col(["category"]);
    const descriptionCol = col(["description"]);
    const stockCol = col(["stock_count", "stock"]);
    const imageCol = col(["image_filename", "image"]);

    const parsed: ImportRow[] = table.slice(1).map((cells, i) => ({
      key: `${i}-${Date.now()}`,
      name: (cells[nameCol] || "").trim(),
      priceText: (cells[priceCol] || "").trim(),
      category: categoryCol >= 0 ? (cells[categoryCol] || "").trim() : "",
      description: descriptionCol >= 0 ? (cells[descriptionCol] || "").trim() : "",
      stockText: stockCol >= 0 ? (cells[stockCol] || "").trim() : "",
      imageFilename: imageCol >= 0 ? (cells[imageCol] || "").trim() : "",
      status: "pending",
      error: null,
    }));
    setRows(parsed);
  }

  function addImageFiles(fileList: FileList | null) {
    if (!fileList) return;
    setImageFiles((prev) => {
      const next = new Map(prev);
      for (const f of fileList) next.set(f.name.toLowerCase(), f);
      return next;
    });
  }

  function updateRow(key: string, patch: Partial<ImportRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  const validRows = rows.filter((r) => !rowError(r));
  const canRun = validRows.length > 0 && !running;

  async function handleCreateAll() {
    setRunning(true);
    const uploadedUrlByFilename = new Map<string, string>();
    let successCount = 0;
    for (const row of rows) {
      if (rowError(row) || row.status === "done") continue;
      updateRow(row.key, { status: "uploading", error: null });

      let imageUrl: string | null = null;
      const filename = row.imageFilename.toLowerCase();
      if (filename) {
        const file = imageFiles.get(filename);
        if (!file) {
          updateRow(row.key, { status: "error", error: `No photo named "${row.imageFilename}" was picked` });
          continue;
        }
        if (uploadedUrlByFilename.has(filename)) {
          imageUrl = uploadedUrlByFilename.get(filename)!;
        } else {
          const body = new FormData();
          body.append("file", file);
          const uploadResult = await portalFetch("/api/portal/menu-items/upload-image", { method: "POST", body });
          if (!uploadResult.ok) {
            updateRow(row.key, {
              status: "error",
              error: uploadResult.unauthorized ? "Session expired" : uploadResult.error,
            });
            continue;
          }
          imageUrl = (uploadResult.data as { image_url: string }).image_url;
          uploadedUrlByFilename.set(filename, imageUrl);
        }
      }

      const createResult = await portalFetch("/api/portal/menu-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: row.name.trim(),
          description: row.description.trim() || null,
          price_rupees: Number(row.priceText) || 0,
          category: row.category.trim() || null,
          is_available: true,
          stock_count: row.stockText.trim() === "" ? null : Number(row.stockText),
          image_url: imageUrl,
          is_combo: false,
          combo_lines: [],
        }),
      });
      if (!createResult.ok) {
        updateRow(row.key, {
          status: "error",
          error: createResult.unauthorized ? "Session expired" : createResult.error,
        });
        continue;
      }
      successCount += 1;
      updateRow(row.key, { status: "done" });
    }
    setRunning(false);
    if (successCount > 0) {
      toast.success(`${successCount} menu item${successCount === 1 ? "" : "s"} created`);
      onImported();
    }
  }

  return (
    <Modal onClose={running ? () => {} : onClose} labelledBy="bulk-import-title" maxWidthClass="max-w-[860px]">
      <div className="mb-space-4 flex items-start justify-between gap-space-3">
        <div>
          <h2 id="bulk-import-title" className="text-[16px] font-bold text-ink-900">
            Bulk import menu items
          </h2>
          <p className="text-hint mt-1">
            Upload a CSV of items (name, price_rupees, category, description, stock_count,
            image_filename) and, optionally, the photo files it refers to. Review every row below
            before anything is created —{" "}
            <button type="button" onClick={downloadTemplate} className="font-semibold text-brand-700 hover:underline">
              download a template
            </button>
            .
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
        ref={csvInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleCsvPicked(file);
          e.target.value = "";
        }}
      />
      <input
        ref={imagesInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          addImageFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {rows.length === 0 ? (
        <button
          type="button"
          onClick={() => csvInputRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-space-2 rounded-lg border-2 border-dashed border-line bg-paper py-space-8 text-ink-600 hover:border-brand-300 hover:bg-brand-50"
        >
          <FileUp size={28} className="text-ink-400" />
          <span className="text-[13.5px] font-semibold">Click to choose a CSV file</span>
          <span className="text-hint">name, price_rupees required — category, description, stock_count, image_filename optional</span>
        </button>
      ) : (
        <>
          {parseError && (
            <p className="mb-space-3 flex items-center gap-space-1 text-[13px] text-destructive">
              <TriangleAlert size={14} /> {parseError}
            </p>
          )}
          <div className="mb-space-3 flex flex-wrap items-center justify-between gap-space-2">
            <span className="text-[12.5px] text-ink-600">
              {rows.length} row{rows.length === 1 ? "" : "s"} · {validRows.length} ready to create ·{" "}
              {imageFiles.size} photo{imageFiles.size === 1 ? "" : "s"} attached
            </span>
            <div className="flex items-center gap-space-3">
              <button
                type="button"
                onClick={() => imagesInputRef.current?.click()}
                disabled={running}
                className="text-[12.5px] font-semibold text-brand-700 hover:underline disabled:opacity-50"
              >
                + Add photos
              </button>
              <button
                type="button"
                onClick={() => csvInputRef.current?.click()}
                disabled={running}
                className="text-[12.5px] font-semibold text-brand-700 hover:underline disabled:opacity-50"
              >
                Replace CSV
              </button>
            </div>
          </div>

          <div className="mb-space-4 max-h-[420px] overflow-auto rounded-md border border-line">
            <table className="w-full text-left text-[12.5px]">
              <thead className="sticky top-0 bg-paper">
                <tr className="border-b border-line text-ink-600">
                  <th className="px-space-2 py-space-2 font-medium">Name</th>
                  <th className="px-space-2 py-space-2 font-medium">Price (₹)</th>
                  <th className="px-space-2 py-space-2 font-medium">Category</th>
                  <th className="px-space-2 py-space-2 font-medium">Stock</th>
                  <th className="px-space-2 py-space-2 font-medium">Photo</th>
                  <th className="px-space-2 py-space-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const error = rowError(row);
                  const hasPhotoFile = row.imageFilename
                    ? imageFiles.has(row.imageFilename.toLowerCase())
                    : true;
                  return (
                    <tr key={row.key} className="border-b border-line last:border-0">
                      <td className="px-space-2 py-space-2">
                        <input
                          value={row.name}
                          disabled={running || row.status === "done"}
                          onChange={(e) => updateRow(row.key, { name: e.target.value })}
                          className="h-8 w-full min-w-[140px] rounded-md border border-line bg-card px-space-2 text-ink-900 outline-none focus:border-brand-400"
                        />
                        {row.name.trim() && existingSet.has(row.name.trim().toLowerCase()) && (
                          <div className="mt-1 text-[11px] text-ink-400">Already on menu</div>
                        )}
                      </td>
                      <td className="px-space-2 py-space-2">
                        <input
                          value={row.priceText}
                          disabled={running || row.status === "done"}
                          onChange={(e) => updateRow(row.key, { priceText: e.target.value })}
                          className="h-8 w-20 rounded-md border border-line bg-card px-space-2 text-ink-900 outline-none focus:border-brand-400"
                        />
                      </td>
                      <td className="px-space-2 py-space-2">
                        <input
                          value={row.category}
                          disabled={running || row.status === "done"}
                          onChange={(e) => updateRow(row.key, { category: e.target.value })}
                          className="h-8 w-28 rounded-md border border-line bg-card px-space-2 text-ink-900 outline-none focus:border-brand-400"
                        />
                      </td>
                      <td className="px-space-2 py-space-2">
                        <input
                          value={row.stockText}
                          placeholder="Unlimited"
                          disabled={running || row.status === "done"}
                          onChange={(e) => updateRow(row.key, { stockText: e.target.value })}
                          className="h-8 w-20 rounded-md border border-line bg-card px-space-2 text-ink-900 outline-none focus:border-brand-400 placeholder:text-ink-400"
                        />
                      </td>
                      <td className="px-space-2 py-space-2">
                        {row.imageFilename ? (
                          <span className={cn("whitespace-nowrap", hasPhotoFile ? "text-ink-600" : "text-warning")}>
                            {row.imageFilename}
                            {!hasPhotoFile && " (not picked)"}
                          </span>
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </td>
                      <td className="px-space-2 py-space-2">
                        <div className="flex items-center justify-end gap-space-2">
                          {row.status === "uploading" && <Loader2 size={14} className="animate-spin text-brand-600" />}
                          {row.status === "done" && <Badge tone="success">Created</Badge>}
                          {row.status === "error" && (
                            <span className="flex items-center gap-space-1 text-[11px] text-destructive">
                              <TriangleAlert size={12} /> {row.error}
                            </span>
                          )}
                          {error && row.status === "pending" && <Badge tone="warning">{error}</Badge>}
                          {row.status !== "uploading" && row.status !== "done" && (
                            <button
                              type="button"
                              onClick={() => removeRow(row.key)}
                              disabled={running}
                              aria-label={`Remove ${row.name || "row"}`}
                              className="rounded-md p-1 text-ink-400 hover:bg-black/[0.04] hover:text-ink-900 disabled:opacity-50"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="flex items-center justify-end gap-space-3">
        <Button variant="secondary" onClick={onClose} disabled={running}>
          {rows.some((r) => r.status === "done") ? "Done" : "Cancel"}
        </Button>
        {rows.length > 0 && (
          <Button onClick={handleCreateAll} disabled={!canRun}>
            {running ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Creating…
              </>
            ) : (
              <>
                <Upload size={14} /> Create {validRows.length} item{validRows.length === 1 ? "" : "s"}
              </>
            )}
          </Button>
        )}
      </div>
    </Modal>
  );
}
