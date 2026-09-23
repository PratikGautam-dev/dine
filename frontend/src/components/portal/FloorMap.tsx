"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { DoorOpen, Minus, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { RestaurantTable } from "@/hooks/useRestaurantTables";

const STATUS_FILL: Record<RestaurantTable["status"], string> = {
  free: "linear-gradient(160deg, var(--success-tint), #ffffff)",
  occupied: "linear-gradient(160deg, var(--brand-50), #ffffff)",
  needs_cleaning: "linear-gradient(160deg, var(--accent-violet-tint), #ffffff)",
  blocked: "linear-gradient(160deg, var(--accent-violet-tint), #ffffff)",
};
const STATUS_BORDER: Record<RestaurantTable["status"], string> = {
  free: "var(--success)", occupied: "var(--brand-500)",
  needs_cleaning: "var(--accent-violet)", blocked: "var(--accent-violet)",
};
const STATUS_TEXT: Record<RestaurantTable["status"], string> = {
  free: "text-success", occupied: "text-brand-700",
  needs_cleaning: "text-accent-violet", blocked: "text-accent-violet",
};
const RESERVED_BORDER = "var(--warning)";
const RESERVED_FILL = "linear-gradient(160deg, var(--warning-tint), #ffffff)";

function statusLabel(t: RestaurantTable): string {
  if (t.status === "free" && t.is_reserved_soon) return "Reserved";
  if (t.status === "free") return "Available";
  if (t.status === "occupied") return "Occupied";
  if (t.status === "needs_cleaning") return "Cleaning";
  return "Blocked";
}

/** Small dots around the table perimeter, one per seat -- real capacity, not decoration for its own
 * sake (a 6-top visibly reads as bigger/busier than a 2-top). Capped so a very large table's chairs
 * don't overlap into noise. */
function ChairDots({ capacity, round }: { capacity: number; round: boolean }) {
  const count = Math.min(capacity, 8);
  const rx = round ? 44 : 48;
  const ry = round ? 44 : 36;
  const dots = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    return { x: 50 + rx * Math.cos(angle), y: 50 + ry * Math.sin(angle) };
  });
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox="0 0 100 100">
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={3.4} className="fill-ink-400/50" />
      ))}
    </svg>
  );
}

/** Real, persisted floor-map positions (tables.pos_x/pos_y, percent of this canvas) -- a table that
 * has never been dragged falls back to an auto-computed grid slot (client-side only, never written
 * back until staff actually move it), so a fresh install never looks broken. Drag updates locally
 * and persists on release via the caller's onMove -- framer-motion owns the drag physics (spring
 * settle, elastic bounds) so it feels like a real object, not a repositioned <div>. */
export function FloorMap({
  tables, selectedId, onSelect, onMove,
}: {
  tables: RestaurantTable[];
  selectedId: string | null;
  onSelect: (table: RestaurantTable) => void;
  onMove: (tableId: string, posX: number, posY: number) => void;
}) {
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Auto-grid fallback for any table with no saved position yet -- 5 columns, evenly spaced.
  const fallbackPositions = useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>();
    const unset = tables.filter((t) => t.pos_x == null || t.pos_y == null);
    const cols = 5;
    unset.forEach((t, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions.set(t.id, { x: 10 + col * 18, y: 14 + row * 24 });
    });
    return positions;
  }, [tables]);

  function positionOf(t: RestaurantTable): { x: number; y: number } {
    if (t.pos_x != null && t.pos_y != null) return { x: t.pos_x, y: t.pos_y };
    return fallbackPositions.get(t.id) || { x: 10, y: 10 };
  }

  function handleDragEnd(table: RestaurantTable, info: { point: { x: number; y: number } }) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.min(96, Math.max(0, ((info.point.x - rect.left) / rect.width) * 100));
    const y = Math.min(94, Math.max(0, ((info.point.y - rect.top) / rect.height) * 100));
    onMove(table.id, x, y);
  }

  return (
    <Card className="overflow-hidden p-space-4">
      <div className="mb-space-3 flex items-center justify-between">
        <div>
          <h3 className="text-[15px] font-bold text-ink-900">Dining Area — Floor Map</h3>
          <p className="text-hint">Drag a table to rearrange your floor · click to see its details</p>
        </div>
        <div className="flex items-center gap-space-2">
          <button type="button" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(2)))} aria-label="Zoom out" className="rounded-md border border-line bg-card p-1.5 text-ink-600 shadow-[var(--shadow-sm)] hover:bg-paper">
            <Minus size={14} />
          </button>
          <span className="w-10 text-center text-[12px] font-semibold text-ink-600">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))} aria-label="Zoom in" className="rounded-md border border-line bg-card p-1.5 text-ink-600 shadow-[var(--shadow-sm)] hover:bg-paper">
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div
        className="relative overflow-hidden rounded-xl border border-line"
        style={{
          backgroundColor: "var(--paper)",
          backgroundImage: "radial-gradient(var(--line) 1.4px, transparent 1.4px)",
          backgroundSize: "22px 22px",
        }}
      >
        {/* Entrance marker -- pure visual chrome (a fixed corner label), not a data claim. */}
        <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-md bg-card/90 px-space-2 py-1 text-[10.5px] font-bold uppercase tracking-wide text-ink-400 shadow-[var(--shadow-sm)] backdrop-blur">
          <DoorOpen size={12} /> Entrance
        </div>

        <motion.div
          ref={canvasRef}
          className="relative h-[440px] w-full origin-top-left"
          animate={{ scale: zoom }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          style={{ transformOrigin: "top left", width: `${100 / zoom}%`, height: `${440 / zoom}px` }}
        >
          {tables.length === 0 && (
            <p className="absolute inset-0 flex items-center justify-center text-[13px] text-ink-400">No tables yet.</p>
          )}
          {tables.map((t, i) => {
            const pos = positionOf(t);
            const selected = t.id === selectedId;
            const reservedSoon = t.status === "free" && t.is_reserved_soon;
            const round = t.shape === "round";
            return (
              <motion.div
                // Remounts (only) when the persisted position actually changes -- resets framer-motion's
                // own internal drag offset to zero at the new left/top, so a second drag never double-
                // applies the previous drop's delta on top of the freshly saved percentage position.
                key={`${t.id}-${pos.x.toFixed(1)}-${pos.y.toFixed(1)}`}
                drag
                dragMomentum={false}
                dragElastic={0.08}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.96 }}
                whileDrag={{ scale: 1.12, zIndex: 20, boxShadow: "0 12px 24px -6px rgba(42,33,28,0.28)" }}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.02, type: "spring", stiffness: 260, damping: 20 }}
                onDragEnd={(_, info) => handleDragEnd(t, info)}
                onTap={() => onSelect(t)}
                className={cn(
                  "group absolute flex h-[70px] w-[70px] -translate-x-1/2 -translate-y-1/2 cursor-grab flex-col items-center justify-center border-2 active:cursor-grabbing",
                  round ? "rounded-full" : "rounded-xl",
                )}
                style={{
                  left: `${pos.x}%`, top: `${pos.y}%`,
                  background: reservedSoon ? RESERVED_FILL : STATUS_FILL[t.status],
                  borderColor: reservedSoon ? RESERVED_BORDER : STATUS_BORDER[t.status],
                  boxShadow: selected
                    ? `0 0 0 3px var(--brand-600), 0 6px 14px -4px rgba(42,33,28,0.25)`
                    : "0 2px 6px -1px rgba(42,33,28,0.12), 0 1px 2px rgba(42,33,28,0.08)",
                }}
                title={`${t.name} — ${statusLabel(t)}`}
              >
                <ChairDots capacity={t.capacity} round={round} />
                <span className={cn("text-[12px] font-bold leading-none", reservedSoon ? "text-warning" : STATUS_TEXT[t.status])}>{t.name}</span>
                <span className={cn("mt-0.5 text-[9.5px] font-semibold leading-none opacity-70", reservedSoon ? "text-warning" : STATUS_TEXT[t.status])}>
                  {t.capacity}p
                </span>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      <div className="mt-space-3 flex flex-wrap gap-space-4 text-[12px] text-ink-600">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-success" /> Available</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-warning" /> Reserved</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-brand-600" /> Occupied</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-accent-violet" /> Cleaning / Blocked</span>
      </div>
    </Card>
  );
}
