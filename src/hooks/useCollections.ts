import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MenuItem } from "@/hooks/useMenuItems";
import { portalFetch } from "@/lib/portalAuth";
import { toast } from "@/lib/toast";

/** A curated group of menu items ("Chef's specials", "Under ₹200"), stored in the database per
 * restaurant (/api/portal/collections). They reference real menu item ids. Collections that older
 * versions kept in this browser's localStorage are uploaded once, then removed from the browser. */
export type Collection = {
  id: string;
  name: string;
  description: string;
  item_ids: string[];
  show_in_header: boolean;
  created_at: string;
  updated_at: string;
  /** "category" collections mirror a menu category: they are derived from the menu, not stored, so
   * their name and items are managed in the Menu page. Anything else is a custom collection. */
  source?: "category" | "manual";
};

export type CollectionDraft = Pick<
  Collection,
  "name" | "description" | "item_ids" | "show_in_header"
>;

export const CATEGORY_PREFIX = "cat:";

const legacyKey = (restaurantId: number) => `dine_collections_${restaurantId}`;
const legacyHeaderKey = (restaurantId: number) => `dine_collection_category_header_${restaurantId}`;

type ApiList = { collections: Collection[]; category_header_flags: Record<string, boolean> };
export type SaveResult = { ok: true } | { ok: false; error: string };

const JSON_HEADERS = { "Content-Type": "application/json" };

function readLegacy<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Custom collections (from the database) plus one read-only collection per menu category (derived
 * from `items`). The link is one-way on purpose: a category always shows up here, but a collection
 * created here never writes to a menu item's category, so it never appears in the Menu's category
 * list. */
export function useCollections(restaurantId: number | null, items: MenuItem[] | null) {
  const [custom, setCustom] = useState<Collection[] | null>(null);
  const [headerFlags, setHeaderFlags] = useState<Record<string, boolean>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const imported = useRef(false);

  const load = useCallback(async () => {
    const result = await portalFetch("/api/portal/collections");
    if (!result.ok) {
      if (!result.unauthorized) setLoadError(result.error);
      return null;
    }
    const data = result.data as ApiList;
    setCustom(data.collections);
    setHeaderFlags(data.category_header_flags ?? {});
    setLoadError(null);
    return data;
  }, []);

  useEffect(() => {
    if (restaurantId == null) return;
    let cancelled = false;
    (async () => {
      const data = await load();
      if (cancelled || !data || imported.current) return;
      imported.current = true;
      // One-time upload of collections an older version kept in this browser.
      const old = readLegacy<Collection[]>(legacyKey(restaurantId), []);
      const oldFlags = readLegacy<Record<string, boolean>>(legacyHeaderKey(restaurantId), {});
      if (!Array.isArray(old) || (old.length === 0 && Object.keys(oldFlags).length === 0)) return;
      let allOk = true;
      for (const c of [...old].reverse()) {
        if (
          data.collections.some((x) => x.name.trim().toLowerCase() === c.name.trim().toLowerCase())
        )
          continue;
        const r = await portalFetch("/api/portal/collections", {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify({
            name: c.name,
            description: c.description ?? "",
            item_ids: c.item_ids ?? [],
            show_in_header: !!c.show_in_header,
          }),
        });
        if (!r.ok) allOk = false;
      }
      for (const [category, flag] of Object.entries(oldFlags)) {
        if (!flag || data.category_header_flags?.[category]) continue;
        const r = await portalFetch("/api/portal/collections/category-header", {
          method: "PUT",
          headers: JSON_HEADERS,
          body: JSON.stringify({ category, show_in_header: true }),
        });
        if (!r.ok) allOk = false;
      }
      if (allOk) {
        try {
          localStorage.removeItem(legacyKey(restaurantId));
          localStorage.removeItem(legacyHeaderKey(restaurantId));
        } catch {
          /* nothing to clean up */
        }
      }
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [restaurantId, load]);

  const collections = useMemo<Collection[] | null>(() => {
    if (custom === null || items === null) return null;
    const byCategory = new Map<string, string[]>();
    for (const i of items) {
      const cat = (i.category || "").trim();
      if (!cat) continue;
      byCategory.set(cat, [...(byCategory.get(cat) ?? []), i.id]);
    }
    const fromCategories: Collection[] = [...byCategory.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, item_ids]) => ({
        id: CATEGORY_PREFIX + name,
        name,
        description: "",
        item_ids,
        show_in_header: headerFlags[name] ?? false,
        created_at: "",
        updated_at: "",
        source: "category" as const,
      }));
    return [...custom.map((c) => ({ ...c, source: "manual" as const })), ...fromCategories];
  }, [custom, items, headerFlags]);

  const save = useCallback(async (draft: CollectionDraft, id?: string): Promise<SaveResult> => {
    const result = await portalFetch(
      id ? `/api/portal/collections/${id}` : "/api/portal/collections",
      {
        method: id ? "PUT" : "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(draft),
      },
    );
    if (!result.ok) {
      return { ok: false, error: result.unauthorized ? "Please sign in again." : result.error };
    }
    const saved = (result.data as { collection: Collection }).collection;
    setCustom((prev) =>
      id ? (prev ?? []).map((c) => (c.id === id ? saved : c)) : [saved, ...(prev ?? [])],
    );
    toast.success(id ? "Collection updated" : "Collection created");
    return { ok: true };
  }, []);

  const remove = useCallback(async (id: string) => {
    const result = await portalFetch(`/api/portal/collections/${id}`, { method: "DELETE" });
    if (!result.ok) {
      toast.error(
        "Couldn't delete collection",
        result.unauthorized ? "Please sign in again." : result.error,
      );
      return;
    }
    setCustom((prev) => (prev ?? []).filter((c) => c.id !== id));
    toast.success("Collection deleted");
  }, []);

  const toggleHeader = useCallback(
    async (id: string) => {
      const isCategory = id.startsWith(CATEGORY_PREFIX);
      const name = id.slice(CATEGORY_PREFIX.length);
      const current = isCategory
        ? (headerFlags[name] ?? false)
        : (custom?.find((c) => c.id === id)?.show_in_header ?? false);
      const next = !current;
      const apply = (value: boolean) => {
        if (isCategory) setHeaderFlags((p) => ({ ...p, [name]: value }));
        else
          setCustom((p) =>
            (p ?? []).map((c) => (c.id === id ? { ...c, show_in_header: value } : c)),
          );
      };
      apply(next); // optimistic; rolled back if the server says no
      const result = isCategory
        ? await portalFetch("/api/portal/collections/category-header", {
            method: "PUT",
            headers: JSON_HEADERS,
            body: JSON.stringify({ category: name, show_in_header: next }),
          })
        : await portalFetch(`/api/portal/collections/${id}/header`, {
            method: "PUT",
            headers: JSON_HEADERS,
            body: JSON.stringify({ show_in_header: next }),
          });
      if (!result.ok) {
        apply(current);
        toast.error(
          "Couldn't update collection",
          result.unauthorized ? "Please sign in again." : result.error,
        );
      }
    },
    [custom, headerFlags],
  );

  return { collections, loadError, save, remove, toggleHeader };
}
