// Ported verbatim from dine-client's hooks/use-now.ts.
import { useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void) => {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
};

const getSnapshot = () => Math.floor(Date.now() / 60_000);

// null on the server so markup that depends on the current time is only rendered
// after hydration, avoiding server/client mismatches around dates
const getServerSnapshot = () => null;

/** Current time as whole minutes since the epoch, refreshed every minute. Null until hydrated. */
export function useNowMinute(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
