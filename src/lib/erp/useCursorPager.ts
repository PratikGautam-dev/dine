"use client";

import { useState } from "react";
import { PAGE_SIZES } from "@/components/erp-ui/CursorPager";

/** Position in a cursor-paged list. `stack` holds the cursor each visited page started from (null = the first page), so Prev just pops it.
 * Changing `resetKey` (the filters) or the page size goes back to the first page. */
export function useCursorPager(resetKey: string) {
  const [size, setSizeState] = useState(PAGE_SIZES[0]!);
  const [stack, setStack] = useState<(string | null)[]>([null]);
  const [key, setKey] = useState(resetKey);
  if (key !== resetKey) {
    setKey(resetKey);
    setStack([null]);
  } // reset while rendering: no stale page flashes before an effect runs
  return {
    size,
    page: stack.length,
    cursor: stack[stack.length - 1] ?? null,
    setSize: (n: number) => {
      setSizeState(n);
      setStack([null]);
    },
    next: (cursor: string) => setStack((s) => [...s, cursor]),
    prev: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
  };
}
