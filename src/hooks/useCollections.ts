import { useCallback, useEffect, useState } from "react";

/** A curated group of menu items ("Chef's specials", "Under ₹200"). The backend has no collections
 * API yet, so these live in this browser's localStorage, scoped per restaurant. They reference real
 * menu item ids; ids that no longer exist are ignored on display. Swap the load/persist pair below
 * for API calls when a backend endpoint exists -- nothing else in the UI needs to change. */
export type Collection = {
  id: string;
  name: string;
  description: string;
  item_ids: string[];
  show_in_header: boolean;
  created_at: string;
  updated_at: string;
};

export type CollectionDraft = Pick<
  Collection,
  "name" | "description" | "item_ids" | "show_in_header"
>;

const key = (restaurantId: number) => `dine_collections_${restaurantId}`;

function load(restaurantId: number): Collection[] {
  try {
    const raw = localStorage.getItem(key(restaurantId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Collection[]) : [];
  } catch {
    return [];
  }
}

function persist(restaurantId: number, list: Collection[]) {
  try {
    localStorage.setItem(key(restaurantId), JSON.stringify(list));
  } catch {
    /* storage full or blocked -- the in-memory list still works for this session */
  }
}

export function useCollections(restaurantId: number | null) {
  const [collections, setCollections] = useState<Collection[] | null>(null);

  useEffect(() => {
    if (restaurantId == null) return;
    // localStorage only exists in the browser, so it is read after mount
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCollections(load(restaurantId));
  }, [restaurantId]);

  const update = useCallback(
    (fn: (prev: Collection[]) => Collection[]) => {
      setCollections((prev) => {
        const next = fn(prev ?? []);
        if (restaurantId != null) persist(restaurantId, next);
        return next;
      });
    },
    [restaurantId],
  );

  const save = useCallback(
    (draft: CollectionDraft, id?: string) => {
      const now = new Date().toISOString();
      update((prev) =>
        id
          ? prev.map((c) => (c.id === id ? { ...c, ...draft, updated_at: now } : c))
          : [{ id: crypto.randomUUID(), ...draft, created_at: now, updated_at: now }, ...prev],
      );
    },
    [update],
  );

  const remove = useCallback(
    (id: string) => update((prev) => prev.filter((c) => c.id !== id)),
    [update],
  );

  const toggleHeader = useCallback(
    (id: string) =>
      update((prev) =>
        prev.map((c) => (c.id === id ? { ...c, show_in_header: !c.show_in_header } : c)),
      ),
    [update],
  );

  return { collections, save, remove, toggleHeader };
}
