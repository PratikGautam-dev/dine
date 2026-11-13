"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { clearQueryCache, getQueryClient } from "@/lib/erp/queryClient";
import { useStaffSession } from "@/lib/staffAuth";

/** The app's query cache (lib/queryClient). Signing in or out in this tab clears it (lib/staffAuth); this also clears it when the session
 * changes in another tab, since the stored session is shared between tabs. */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const session = useStaffSession();
  const owner = session?.restaurant ? `${session.restaurant.id}:${session.id}` : null;
  const seen = useRef(owner);
  useEffect(() => {
    // null -> someone is the session loading from storage (or a sign-in after a sign-out, which already cleared): nothing to forget
    if (seen.current !== owner && seen.current !== null) clearQueryCache();
    seen.current = owner;
  }, [owner]);
  return (
    <QueryClientProvider client={getQueryClient()}>
      {children}
    </QueryClientProvider>
  );
}
