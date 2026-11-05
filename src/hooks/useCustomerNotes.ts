import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { portalFetch } from "@/lib/portalAuth";
import { toast } from "@/lib/toast";

export type CustomerNote = {
  id: number;
  patient_id: number;
  body: string;
  follow_up_at: string | null;
  done_at: string | null;
  created_by: string | null;
  created_at: string;
};

export type OpenFollowUp = CustomerNote & {
  patient_name: string | null;
  patient_phone: string;
  patient_public_id: string;
};

/** Customers page's Notes tab (one customer's own notes) and Follow-ups tab (every open
 * follow-up across every customer, in one list). Kept separate from useCustomers.ts, which was
 * already sizable, rather than growing it further. */
export function useCustomerNotes(activeId: number | null) {
  const router = useRouter();
  const [notes, setNotes] = useState<CustomerNote[] | null>(null);
  const [notesLoading, setNotesLoading] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [followUps, setFollowUps] = useState<OpenFollowUp[] | null>(null);
  const [followUpsLoading, setFollowUpsLoading] = useState(false);

  const loadNotes = useCallback(async () => {
    if (activeId === null) return;
    setNotesLoading(true);
    const result = await portalFetch(`/api/portal/customers/${activeId}/notes`);
    setNotesLoading(false);
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else toast.error("Couldn't load notes", result.error);
      return;
    }
    setNotes((result.data as { notes: CustomerNote[] }).notes);
  }, [activeId, router]);

  useEffect(() => {
    if (activeId !== null) loadNotes();
    else setNotes(null);
  }, [activeId, loadNotes]);

  const addNote = async (body: string, followUpAt: string | null): Promise<boolean> => {
    if (activeId === null) return false;
    setSavingNote(true);
    const result = await portalFetch(`/api/portal/customers/${activeId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, follow_up_at: followUpAt }),
    });
    setSavingNote(false);
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else toast.error("Couldn't save note", result.error);
      return false;
    }
    toast.success("Note added");
    loadNotes();
    return true;
  };

  const loadFollowUps = useCallback(async () => {
    setFollowUpsLoading(true);
    const result = await portalFetch("/api/portal/customers/follow-ups");
    setFollowUpsLoading(false);
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else toast.error("Couldn't load follow-ups", result.error);
      return;
    }
    setFollowUps((result.data as { follow_ups: OpenFollowUp[] }).follow_ups);
  }, [router]);

  const setNoteDone = async (noteId: number, done: boolean) => {
    const result = await portalFetch(`/api/portal/customers/notes/${noteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done }),
    });
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else toast.error("Couldn't update note", result.error);
      return;
    }
    loadNotes();
    loadFollowUps();
  };

  const deleteNote = async (noteId: number) => {
    const result = await portalFetch(`/api/portal/customers/notes/${noteId}`, { method: "DELETE" });
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else toast.error("Couldn't delete note", result.error);
      return;
    }
    toast.success("Note deleted");
    loadNotes();
    loadFollowUps();
  };

  return {
    notes,
    notesLoading,
    savingNote,
    addNote,
    setNoteDone,
    deleteNote,
    followUps,
    followUpsLoading,
    loadFollowUps,
  };
}
