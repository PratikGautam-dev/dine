import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { portalFetch } from "@/lib/portalAuth";
import { toast } from "@/lib/toast";

export type SegmentMemberPreview = { id: number; name: string | null; phone: string };

export type CustomerSegment = {
  id: number;
  name: string;
  tag: string | null;
  min_points: number | null;
  min_spend_paise: number | null;
  min_orders: number | null;
  platinum_only: boolean;
  created_at: string;
  member_count: number;
  preview: SegmentMemberPreview[];
};

export type NewSegmentFields = {
  name: string;
  tag?: string;
  min_points?: number;
  min_spend_paise?: number;
  min_orders?: number;
  platinum_only?: boolean;
};

export type SegmentMember = {
  id: number;
  name: string | null;
  phone: string;
  email: string | null;
  loyalty_tier: string | null;
  loyalty_points: number;
  total_orders: number;
  total_spend_paise: number;
};

/** Customers page's Segments tab -- named, saved filters, member counts computed live by the
 * backend on every load (never stored), same "derive, don't duplicate" shape list_segments()'s
 * own docstring explains. */
export function useCustomerSegments(ready: boolean) {
  const router = useRouter();
  const [segments, setSegments] = useState<CustomerSegment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [viewingMembersId, setViewingMembersId] = useState<number | null>(null);
  const [members, setMembers] = useState<SegmentMember[] | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);

  const load = useCallback(async () => {
    const result = await portalFetch("/api/portal/patients/segments");
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else setError(result.error);
      return;
    }
    setSegments((result.data as { segments: CustomerSegment[] }).segments);
  }, [router]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  const createSegment = async (fields: NewSegmentFields): Promise<boolean> => {
    setCreating(true);
    const result = await portalFetch("/api/portal/patients/segments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    setCreating(false);
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else toast.error("Couldn't create segment", result.error);
      return false;
    }
    toast.success("Segment created");
    load();
    return true;
  };

  const updateSegment = async (id: number, fields: Partial<NewSegmentFields>): Promise<boolean> => {
    setUpdatingId(id);
    const result = await portalFetch(`/api/portal/patients/segments/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    setUpdatingId(null);
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else toast.error("Couldn't save segment", result.error);
      return false;
    }
    toast.success("Segment updated");
    load();
    return true;
  };

  const loadMembers = async (id: number) => {
    setViewingMembersId(id);
    setMembers(null);
    setMembersLoading(true);
    const result = await portalFetch(`/api/portal/patients/segments/${id}/members`);
    setMembersLoading(false);
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else toast.error("Couldn't load segment members", result.error);
      return;
    }
    setMembers((result.data as { members: SegmentMember[] }).members);
  };

  const closeMembers = () => {
    setViewingMembersId(null);
    setMembers(null);
  };

  const deleteSegment = async (id: number) => {
    setDeletingId(id);
    const result = await portalFetch(`/api/portal/patients/segments/${id}/delete`, { method: "POST" });
    setDeletingId(null);
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else toast.error("Couldn't delete segment", result.error);
      return;
    }
    toast.success("Segment deleted");
    setSegments((prev) => (prev ? prev.filter((s) => s.id !== id) : prev));
  };

  return {
    segments,
    error,
    creating,
    createSegment,
    updatingId,
    updateSegment,
    deletingId,
    deleteSegment,
    viewingMembersId,
    members,
    membersLoading,
    loadMembers,
    closeMembers,
  };
}
