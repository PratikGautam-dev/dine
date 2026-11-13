"use client";

import { useSyncExternalStore } from "react";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import {
  CHANNEL_LABEL,
  PICKUP_LABEL,
  type GlobalPickup,
  DEFAULT_PERIOD,
  NO_CUSTOM,
  PERIOD_LABEL,
  PERIOD_ORDER,
  formatRange,
  isoDay,
  resolvePeriod,
  resolveRange,
  useGlobalFilter,
  type GlobalChannel,
  type Period,
} from "@/lib/globalFilter";
import { cn } from "@/lib/cn";

export type GlobalFilterOptions = {
  periods: readonly Period[];
  /** Omit when the page has no sales-channel filter. */
  channels?: readonly GlobalChannel[];
  /** Omit when the page has no pickup (dine-in / takeaway / delivery) filter. */
  pickups?: readonly GlobalPickup[];
};

const SECTION_TITLE =
  "mb-space-2 text-[11px] font-semibold tracking-[0.08em] text-ink-400 uppercase";
const todayIso = () => isoDay(new Date());

/** The header's period + channel filter: one chip showing the chosen period and its dates, opening a panel to
 * change either. PortalShell shows it (in place of the plain date chip) on pages that use it; the choice is
 * shared across those pages via GlobalFilterProvider. */
export function GlobalFilter({ periods, channels, pickups }: GlobalFilterOptions) {
  const {
    period: savedPeriod,
    channels: savedChannels,
    pickups: savedPickups,
    custom: savedCustom,
    setPeriod,
    setChannels,
    setPickups,
    setCustomRange,
  } = useGlobalFilter();
  // The saved choice comes from localStorage, which the server can't see: show the defaults until hydrated
  // so the server and first client render match.
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const stored = hydrated ? savedPeriod : DEFAULT_PERIOD;
  const chosenChannels = hydrated && channels ? savedChannels.filter((c) => channels.includes(c)) : [];
  const chosenPickups = hydrated && pickups ? savedPickups.filter((p) => pickups.includes(p)) : [];
  const custom = hydrated ? savedCustom : NO_CUSTOM;
  const period = resolvePeriod(stored, periods);
  const range = resolveRange(period, custom);
  const rangeText = formatRange(range);
  const options = PERIOD_ORDER.filter((p) => periods.includes(p));

  return (
    <div className="hidden md:block">
      <Popover.Root>
        <Popover.Trigger
          aria-label={`Filter: ${PERIOD_LABEL[period]}, ${rangeText}`}
          className={cn(
            "group flex cursor-pointer items-center gap-space-2 rounded-md border border-line bg-card px-space-3 py-1.5 text-[13px] text-ink-700 outline-none",
            "transition-colors duration-150 hover:border-brand-300 hover:bg-brand-50/60",
            "focus-visible:ring-2 focus-visible:ring-brand-400 data-popup-open:border-brand-400 data-popup-open:bg-brand-50/60",
          )}
        >
          <CalendarDays size={15} className="text-ink-400" />
          <span className="font-semibold text-ink-900">{PERIOD_LABEL[period]}</span>
          <span className="text-ink-600">· {rangeText}</span>
          {[...chosenChannels.map((c) => CHANNEL_LABEL[c]), ...chosenPickups.map((p) => PICKUP_LABEL[p])].length > 0 && (
            <span className="rounded-full bg-brand-50 px-space-2 py-0.5 text-[11.5px] font-semibold text-brand-700">
              {[...chosenChannels.map((c) => CHANNEL_LABEL[c]), ...chosenPickups.map((p) => PICKUP_LABEL[p])].join(", ")}
            </span>
          )}
          <ChevronDown
            size={14}
            className="text-ink-400 transition-transform duration-150 group-data-popup-open:rotate-180"
          />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner align="end" sideOffset={6} className="isolate z-50 outline-none">
            <Popover.Popup className="w-[min(420px,calc(100vw-32px))] rounded-xl border border-line bg-card p-space-4 text-ink-900 shadow-[var(--shadow-md)] outline-none">
              <p className={SECTION_TITLE}>Period</p>
              <div className="grid grid-cols-2 gap-x-space-2 gap-y-1">
                {options.map((p) => {
                  const selected = p === period;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPeriod(p)}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-space-3 py-2 text-left text-[14px] transition-colors",
                        selected
                          ? "bg-brand-50 font-semibold text-brand-700"
                          : "text-ink-600 hover:bg-paper hover:text-ink-900",
                      )}
                    >
                      {PERIOD_LABEL[p]}
                      {selected && <Check size={15} className="shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {period === "custom" && (
                <div className="mt-space-3 grid grid-cols-2 gap-space-2">
                  <label className="text-[12px] font-medium text-ink-600">
                    From
                    <input
                      type="date"
                      value={custom.from}
                      max={custom.to || todayIso()}
                      onChange={(e) => setCustomRange(e.target.value, custom.to)}
                      className="mt-1 h-10 w-full rounded-md border border-line bg-card px-space-2 text-[13px] text-ink-900"
                    />
                  </label>
                  <label className="text-[12px] font-medium text-ink-600">
                    To
                    <input
                      type="date"
                      value={custom.to}
                      min={custom.from || undefined}
                      max={todayIso()}
                      onChange={(e) => setCustomRange(custom.from, e.target.value)}
                      className="mt-1 h-10 w-full rounded-md border border-line bg-card px-space-2 text-[13px] text-ink-900"
                    />
                  </label>
                </div>
              )}

              {channels && channels.length > 0 && (
                <ChipGroup
                  title="Sales channel"
                  allLabel="All channels"
                  options={channels}
                  labels={CHANNEL_LABEL}
                  selected={chosenChannels}
                  onChange={setChannels}
                />
              )}

              {pickups && pickups.length > 0 && (
                <ChipGroup
                  title="Pickup"
                  allLabel="All"
                  options={pickups}
                  labels={PICKUP_LABEL}
                  selected={chosenPickups}
                  onChange={setPickups}
                />
              )}

              <p className="mt-space-4 border-t border-line pt-space-3 text-[12.5px] text-ink-400">
                Showing {rangeText}
              </p>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}

const CHIP =
  "rounded-full border px-space-3 py-1.5 text-[13px] font-semibold transition-colors";
const CHIP_ON = "border-brand-600 bg-brand-600 text-white";
const CHIP_OFF = "border-line bg-card text-ink-600 hover:border-brand-300 hover:bg-brand-50";

/** A multi-select group of chips: tick any number; the "all" chip is on when none are ticked and clears the rest. */
function ChipGroup<T extends string>({
  title,
  allLabel,
  options,
  labels,
  selected,
  onChange,
}: {
  title: string;
  allLabel: string;
  options: readonly T[];
  labels: Record<T, string>;
  selected: readonly T[];
  onChange: (next: T[]) => void;
}) {
  const toggle = (o: T) =>
    onChange(selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o]);
  return (
    <>
      <p className={cn(SECTION_TITLE, "mt-space-4")}>{title}</p>
      <div className="flex flex-wrap gap-space-2">
        <button
          type="button"
          aria-pressed={selected.length === 0}
          onClick={() => onChange([])}
          className={cn(CHIP, selected.length === 0 ? CHIP_ON : CHIP_OFF)}
        >
          {allLabel}
        </button>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={selected.includes(o)}
            onClick={() => toggle(o)}
            className={cn(CHIP, selected.includes(o) ? CHIP_ON : CHIP_OFF)}
          >
            {labels[o]}
          </button>
        ))}
      </div>
    </>
  );
}
