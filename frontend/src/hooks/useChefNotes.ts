import { useCallback, useEffect, useState } from "react";
import { portalFetch } from "@/lib/portalAuth";
import { toast } from "@/lib/toast";

export type ChefNote = {
  id: number;
  text: string;
  created_by_name: string;
  created_at: string;
};

const POLL_MS = 20_000;

/** The Kitchen Orders page's real, attributed notes board -- polls lightly since another staff
 * member's shift may post something this tab should pick up without a manual refresh. */
export function useChefNotes(ready: boolean) {
  const [notes, setNotes] = useState<ChefNote[] | null>(null);
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    const result = await portalFetch("/api/portal/chef-notes");
    if (result.ok) setNotes((result.data as { notes: ChefNote[] }).notes);
  }, []);

  useEffect(() => {
    if (!ready) return;
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [ready, load]);

  async function addNote(text: string) {
    setPosting(true);
    const result = await portalFetch("/api/portal/chef-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    setPosting(false);
    if (!result.ok) {
      if (!result.unauthorized) toast.error("Couldn't post note", result.error);
      return false;
    }
    load();
    return true;
  }

  async function deleteNote(id: number) {
    const result = await portalFetch(`/api/portal/chef-notes/${id}/delete`, { method: "POST" });
    if (!result.ok && !result.unauthorized) toast.error("Couldn't remove note", result.error);
    load();
  }

  return { notes, posting, addNote, deleteNote };
}
