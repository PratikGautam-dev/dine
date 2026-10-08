"use client";

// Ported from dine-client's components/menu/MenuSearchFilter.tsx. dine-client's version mixes a
// free-text search box with diet/rating/sort pills that have no equivalent real data here, so
// this keeps only what maps onto real fields: the search input (shown while `searching`, exactly
// like the file this replaces) and the category chip row (hidden once there's a live query,
// exactly like the file this replaces).
import { cn } from "@/lib/cn";

export type Chip = { key: string; label: string; icon: string };

type Props = {
  restaurantName: string;
  searching: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  showChips: boolean;
  chips: Chip[];
  activeCat: string;
  onPickCategory: (key: string) => void;
};

export function MenuSearchFilter({
  restaurantName,
  searching,
  query,
  onQueryChange,
  showChips,
  chips,
  activeCat,
  onPickCategory,
}: Props) {
  if (!searching && !showChips) return null;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-8">
      <div className="flex flex-col gap-3 rounded-2xl border border-sf-border-divider/70 bg-sf-surface p-4 shadow-sm md:p-5">
        {searching && (
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[22px] text-sf-text-muted">
              search
            </span>
            <input
              autoFocus
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder={`Search ${restaurantName}'s menu`}
              className="h-12 w-full rounded-xl border border-sf-border-divider bg-sf-surface-container-low pl-12 pr-4 font-sf-body text-sm text-sf-on-surface placeholder:text-sf-text-muted focus:border-sf-primary focus:bg-sf-surface focus:outline-none transition-all"
            />
          </div>
        )}

        {showChips && chips.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
            {chips.map(({ key, label, icon }) => {
              const active = activeCat === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onPickCategory(key)}
                  className={cn(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 font-sf-body text-xs font-semibold shadow-xs transition-all cursor-pointer",
                    active
                      ? "bg-sf-primary-light border-sf-primary/30 text-sf-primary"
                      : "bg-sf-surface-container-low hover:bg-sf-surface-container-high text-sf-on-surface border-sf-border-divider",
                  )}
                >
                  <span className="material-symbols-outlined text-[16px]">{icon}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
