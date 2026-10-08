// Ported from dine-client's components/tracking/LiveMap.tsx (same static SVG street layout and
// route path). DECORATIVE ONLY: there is no real GPS/delivery-partner tracking backend in
// dine-connect, so this renders a fixed, non-animated illustration -- it is never fed real
// coordinates and never updates. Do not wire this up to real location data; if real live tracking
// is ever built, it should replace this component rather than "fix" it in place.
import { Card } from "@/components/ui/Card";

const MAP_WIDTH = 700;
const MAP_HEIGHT = 340;
const PICKUP = { x: 120, y: 140 };
const DROPOFF = { x: 560, y: 230 };
const ROUTE_PATH = `M ${PICKUP.x} ${PICKUP.y} C 260 120, 380 260, ${DROPOFF.x} ${DROPOFF.y}`;

const pct = (value: number, total: number) => `${(value / total) * 100}%`;

function Pin({ x, y, label, icon }: { x: number; y: number; label: string; icon: string }) {
  return (
    <div
      className="absolute flex -translate-x-1/2 -translate-y-full flex-col items-center"
      style={{ left: pct(x, MAP_WIDTH), top: pct(y, MAP_HEIGHT) }}
    >
      <div className="mb-1 flex items-center gap-1 whitespace-nowrap rounded bg-sf-surface px-2 py-1 font-sf-body text-[11px] font-semibold text-sf-on-surface shadow-md">
        <span className="material-symbols-outlined text-[14px] text-sf-primary">{icon}</span>
        {label}
      </div>
      <div className="h-3 w-3 translate-y-1/2 rounded-full bg-sf-primary ring-4 ring-sf-primary-light" />
    </div>
  );
}

export function LiveMap({ outletLabel }: { outletLabel: string | undefined }) {
  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-space-2 bg-sf-surface-container-low p-space-4">
        <div className="flex items-center gap-1">
          <span className="material-symbols-outlined text-[20px] text-sf-primary">near_me</span>
          <span className="font-sf-body text-[14px] font-semibold text-sf-on-surface">Route preview</span>
        </div>
        <span className="font-sf-body text-[11px] text-sf-text-muted">Illustrative only</span>
      </div>

      <div
        className="relative w-full overflow-hidden bg-sf-map-land"
        style={{ aspectRatio: `${MAP_WIDTH} / ${MAP_HEIGHT}` }}
        role="img"
        aria-label="Decorative illustration of a delivery route; not a live map"
      >
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect x="0" y="0" width={MAP_WIDTH} height={MAP_HEIGHT} className="fill-sf-map-land" />
          <rect x="470" y="30" width="170" height="110" rx="14" className="fill-sf-map-park" />
          <rect x="20" y="210" width="150" height="100" rx="10" className="fill-sf-map-block" />
          <rect x="300" y="260" width="120" height="60" rx="10" className="fill-sf-map-block" />
          <rect x="190" y="30" width="110" height="80" rx="10" className="fill-sf-map-block" />
          <g className="stroke-sf-map-road" strokeWidth="9" strokeLinecap="round" fill="none">
            <path d="M 0 120 L 700 90" />
            <path d="M 160 0 L 200 340" />
            <path d="M 440 0 L 400 340" />
            <path d="M 0 300 L 700 320" />
            <path d="M 560 150 L 600 340" />
          </g>
          <g className="stroke-sf-map-road-edge" strokeWidth="1.5" fill="none">
            <path d="M 0 120 L 700 90" />
            <path d="M 160 0 L 200 340" />
            <path d="M 440 0 L 400 340" />
          </g>
          <path d={ROUTE_PATH} fill="none" className="stroke-sf-map-road" strokeWidth="14" strokeLinecap="round" />
          <path
            d={ROUTE_PATH}
            fill="none"
            className="stroke-sf-surface-container-highest"
            strokeWidth="8"
            strokeLinecap="round"
          />
        </svg>

        <Pin x={PICKUP.x} y={PICKUP.y} label={outletLabel || "Restaurant"} icon="store" />
        <Pin x={DROPOFF.x} y={DROPOFF.y} label="Drop-off" icon="home" />

        <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-lg bg-sf-surface/90 px-3 py-1.5 shadow-sm backdrop-blur-md">
          <span className="material-symbols-outlined text-[18px] text-sf-primary">info</span>
          <span className="font-sf-body text-[12px] font-medium text-sf-on-surface">
            Static preview -- not a real-time location
          </span>
        </div>
      </div>
    </Card>
  );
}
