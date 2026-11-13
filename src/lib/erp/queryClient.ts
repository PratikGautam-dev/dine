import { QueryClient, isServer } from "@tanstack/react-query";

/** Freshness is unchanged from before the cache existed: every screen re-reads its data when it opens (staleTime 0). The cache only lets a
 * screen show what it had a moment ago while that happens, lets identical requests share one fetch, and lets a save refresh every screen
 * that shows what it changed (invalidateQueries). Unused entries are dropped after gcTime, so it does not grow with use. */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false,
        staleTime: 0,
        gcTime: 5 * 60 * 1000,
      },
    },
  });
}

let browserClient: QueryClient | undefined;

/** The app's query cache: one per browser tab (a new one per server render, so nothing is shared between requests on the server). */
export function getQueryClient(): QueryClient {
  if (isServer) return makeQueryClient();
  return (browserClient ??= makeQueryClient());
}

/** Forget everything cached. Called when the signed-in person changes or signs out, so one account never sees another's data
 * (the query keys do not carry the user). */
export function clearQueryCache() {
  browserClient?.clear();
}
