"use client";

import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/cn";

const box =
  "flex h-8 min-w-8 items-center justify-center rounded-md border border-line bg-card px-space-2 text-[13px] font-semibold text-ink-900 disabled:cursor-not-allowed disabled:text-ink-400";

/** "Showing 1–8 of 1,842" with numbered pages (1 2 3 … last), for a list the server pages. `page` is 0-based. */
export function Pager({
  page,
  pageSize,
  total,
  noun,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  noun: string;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  const shown = [0, 1, 2]
    .map((i) => (page < 2 ? i : page - 1 + i))
    .filter((i) => i < pages);
  const last = pages - 1;
  return (
    <div className="flex flex-wrap items-center justify-between gap-space-2 px-space-3 py-space-3">
      <p className="text-[12.5px] text-ink-600">
        Showing {from.toLocaleString("en-IN")}–{to.toLocaleString("en-IN")} of{" "}
        {total.toLocaleString("en-IN")} {noun}
      </p>
      <div className="flex items-center gap-space-1">
        <button
          type="button"
          aria-label="Previous page"
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
          className={box}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={14} />
        </button>
        {shown.map((i) => (
          <button
            key={i}
            type="button"
            aria-current={i === page ? "page" : undefined}
            onClick={() => onPage(i)}
            className={cn(
              box,
              i === page && "border-brand-800 bg-brand-800 text-white",
            )}
          >
            {i + 1}
          </button>
        ))}
        {last > shown[shown.length - 1] && (
          <>
            {last > shown[shown.length - 1] + 1 && (
              <span className="px-space-1 text-ink-400">…</span>
            )}
            <button type="button" onClick={() => onPage(last)} className={box}>
              {(last + 1).toLocaleString("en-IN")}
            </button>
          </>
        )}
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= last}
          onClick={() => onPage(page + 1)}
          className={box}
        >
          <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
        </button>
      </div>
    </div>
  );
}
