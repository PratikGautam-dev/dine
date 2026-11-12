"use client";

import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import {
  CHANNEL_LABEL,
  PERIOD_LABEL,
  PERIOD_ORDER,
  formatRange,
  isoDay,
  resolveChannel,
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
};

const SECTION_TITLE =
  "mb-space-2 text-[11px] font-semibold tracking-[0.08em] text-ink-400 uppercase";
const todayIso = () => isoDay(new Date());

/** The header's period + channel filter: one chip showing the chosen period and its dates, opening a panel to
 * change either. PortalShell shows it (in place of the plain date chip) on pages that use it; the choice is
 * shared across those pages via GlobalFilterProvider. */
export function GlobalFilter({ periods, channels }: GlobalFilterOptions) {
  const {
    period: stored,
    channel: storedChannel,
    custom,
    setPeriod,
    setChannel,
    setCustomRange,
  } = useGlobalFilter();
  const period = resolvePeriod(stored, periods);
  const channel = resolveChannel(storedChannel, channels ?? [""]);
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
          {channels && channel !== "" && (
            <span className="rounded-full bg-brand-50 px-space-2 py-0.5 text-[11.5px] font-semibold text-brand-700">
              {CHANNEL_LABEL[channel]}
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

              {channels && channels.length > 1 && (
                <>
                  <p className={cn(SECTION_TITLE, "mt-space-4")}>Sales channel</p>
                  <div className="flex flex-wrap gap-space-2">
                    {channels.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setChannel(c)}
                        className={cn(
                          "rounded-full border px-space-3 py-1.5 text-[13px] font-semibold transition-colors",
                          channel === c
                            ? "border-brand-600 bg-brand-600 text-white"
                            : "border-line bg-card text-ink-600 hover:border-brand-300 hover:bg-brand-50",
                        )}
                      >
                        {CHANNEL_LABEL[c]}
                      </button>
                    ))}
                  </div>
                </>
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
