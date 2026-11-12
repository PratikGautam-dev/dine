"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { AnchoredSelect } from "@/components/erp-ui/AnchoredSelect";
import { Button } from "@/components/erp-ui/Button";

export const PAGE_SIZES = [25, 50, 100];
const PAGE_SIZE_ITEMS = PAGE_SIZES.map((value) => ({
  value,
  label: `${value} per page`,
}));

/** Footer for cursor-paged lists: Prev / Next (no page count: the server only knows what comes before and after) and a "N per page" size. */
export function CursorPager({
  page,
  shown,
  size,
  onSize,
  hasNext,
  onPrev,
  onNext,
}: {
  page: number;
  shown: number;
  size: number;
  onSize: (n: number) => void;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (page === 1 && !hasNext && size === PAGE_SIZES[0]) return null; // everything fits on one page of the smallest size
  return (
    <div className="mt-space-3 flex min-w-0 flex-col items-stretch justify-between gap-space-2 border-t border-line pt-space-3 md:flex-row md:items-center">
      <p className="text-center text-[12px] text-ink-400 md:text-left">
        Page {page} · {shown} {shown === 1 ? "entry" : "entries"}
      </p>
      <div className="grid w-full grid-cols-2 items-center gap-space-2 md:flex md:w-auto">
        <Button
          size="md"
          variant="secondary"
          className="min-w-0 px-space-2 md:px-space-4"
          onClick={onPrev}
          disabled={page === 1}
        >
          <ArrowLeft size={13} /> Prev
        </Button>
        <Button
          size="md"
          variant="secondary"
          className="min-w-0 px-space-2 md:px-space-4"
          onClick={onNext}
          disabled={!hasNext}
        >
          Next <ArrowRight size={13} />
        </Button>
        <AnchoredSelect
          value={size}
          onValueChange={onSize}
          options={PAGE_SIZE_ITEMS}
          label="Rows per page"
          compact
          className="col-span-2 md:h-8 md:w-auto"
        />
      </div>
    </div>
  );
}
