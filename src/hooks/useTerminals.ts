"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { erpGet, erpSend } from "@/lib/erp/erp";
import { queryKeys } from "@/lib/erp/queryKeys";
import type { PosRelease } from "@/lib/posReleases";

export type TerminalEvent = {
  id: string;
  event: string;
  actor_type: string;
  ip: string | null;
  detail: Record<string, unknown>;
  created_at: string;
};
export type Terminal = {
  id: string;
  code: string;
  name: string;
  status: "active" | "revoked";
  platform: string;
  install_id_hint: string;
  os_version: string | null;
  manufacturer: string | null;
  model: string | null;
  hardware_id: string | null;
  serial_number: string | null;
  app_version: string | null;
  app_build: string | null;
  locale: string | null;
  timezone: string | null;
  device_info: Record<string, unknown>;
  paired_at: string;
  paired_ip: string | null;
  last_seen_at: string | null;
  last_ip: string | null;
  last_sync_at: string | null;
  /** What the till itself says it still holds (its last heartbeat); null before the first report. */
  queue_unsent: number | null;
  queue_refused: number | null;
  queue_oldest_at: string | null;
  queue_reported_at: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  /** Records this (revoked) terminal handed over that wait for a decision. */
  handover_held?: number;
  events?: TerminalEvent[];
};

/** A bill, shift or day close a revoked terminal handed over (erp-dine-backend pos/handover.py): held until a manager decides. */
export type HandoverRecord = {
  id: string;
  terminal_id: string;
  terminal_code: string;
  terminal_name: string;
  kind: "bill" | "shift" | "day_close";
  reference: string | null;
  occurred_at: string | null;
  received_at: string;
  total_paise: number | null;
  cashier_name: string | null;
  status: "held" | "approved" | "rejected" | "refused";
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  error_message: string | null;
};
export type PairingCode = {
  id: string;
  terminal_name: string | null;
  created_at: string;
  expires_at: string;
};
export type Issued = {
  id: string;
  code: string;
  terminal_name: string | null;
  expires_at: string;
};
export type Listing = { terminals: Terminal[]; pairing_codes: PairingCode[] };
export type Cashier = {
  id: string;
  name: string;
  email: string;
  status: "active" | "disabled";
  roles: string[];
  has_pin: boolean;
  pin_updated_at: string | null;
};

/** One paired terminal with its device details and event history. */
export function useTerminal(id: string) {
  return useQuery({
    queryKey: queryKeys.terminal(id),
    queryFn: () => erpGet<Terminal>(`/api/v1/terminals/${id}`),
    enabled: Boolean(id),
  });
}

/** A branch's paired terminals and live pairing codes. */
export function useBranchTerminals(branchId: string) {
  return useQuery({
    queryKey: queryKeys.branchTerminals(branchId),
    queryFn: () => erpGet<Listing>(`/api/v1/branches/${branchId}/terminals`),
    enabled: Boolean(branchId),
  });
}

function useRefreshTerminals() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.terminals });
}

/** A one-time pairing code for a new terminal (optionally named). */
export function useIssuePairingCode(branchId: string) {
  const refresh = useRefreshTerminals();
  return useMutation({
    mutationFn: (terminalName: string | null) =>
      erpSend<Issued>(
        `/api/v1/branches/${branchId}/terminals/pairing-codes`,
        "POST",
        terminalName ? { terminal_name: terminalName } : {},
      ),
    onSuccess: refresh,
  });
}

export function useCancelPairingCode() {
  const refresh = useRefreshTerminals();
  return useMutation({
    mutationFn: (id: string) => erpSend(`/api/v1/terminals/pairing-codes/${id}`, "DELETE"),
    onSuccess: refresh,
  });
}

/** Lock a terminal for good: it locks at its next contact, hands over any bills it never uploaded (held for a manager), then wipes itself. */
export function useRevokeTerminal() {
  const refresh = useRefreshTerminals();
  return useMutation({
    mutationFn: (input: { id: string; reason: string | null }) =>
      erpSend(`/api/v1/terminals/${input.id}/revoke`, "POST", {
        reason: input.reason,
      }),
    onSuccess: refresh,
  });
}

/** A revoked terminal leaves the portal for good; the server checks the typed name again. Its bills and day closes are kept. */
export function useDeleteTerminal() {
  const refresh = useRefreshTerminals();
  return useMutation({
    mutationFn: (input: { id: string; confirmName: string }) =>
      erpSend(`/api/v1/terminals/${input.id}/delete`, "POST", {
        confirm_name: input.confirmName,
      }),
    onSuccess: refresh,
  });
}

export function useRenameTerminal() {
  const refresh = useRefreshTerminals();
  return useMutation({
    mutationFn: (input: { id: string; name: string }) =>
      erpSend(`/api/v1/terminals/${input.id}`, "PATCH", { name: input.name }),
    onSuccess: refresh,
  });
}

/** The newest published till release (null before the first one), to flag terminals running an older version. Read through
 * /api/pos/latest: the browser can't read R2 directly. */
export function usePosLatestRelease() {
  return useQuery({
    queryKey: queryKeys.posLatestRelease,
    queryFn: async (): Promise<PosRelease | null> => {
      const res = await fetch("/api/pos/latest");
      return res.ok ? ((await res.json()) as PosRelease | null) : null;
    },
    staleTime: 10 * 60_000,
  });
}

/** What revoked terminals of a branch handed over and still wait for a decision. */
export function useHandoverRecords(branchId: string) {
  return useQuery({
    queryKey: [...queryKeys.terminals, "handover", branchId],
    queryFn: () =>
      erpGet<{ total: number; records: HandoverRecord[] }>(
        `/api/v1/terminals/handover-records?status=held&branch_id=${encodeURIComponent(branchId)}`,
      ),
    enabled: Boolean(branchId),
  });
}

/** Approve (booked like any upload, flagged as handed over) or reject (a note is required) one handed-over record. */
export function useDecideHandover() {
  const refresh = useRefreshTerminals();
  return useMutation({
    mutationFn: (input: { id: string; decision: "approve" | "reject"; note: string | null }) =>
      erpSend<{ id: string; status: string; error?: string }>(
        `/api/v1/terminals/handover-records/${input.id}/${input.decision}`,
        "POST",
        { note: input.note },
      ),
    onSuccess: refresh,
  });
}

/** The people who can bill at a branch and whether each has a terminal PIN. */
export function useBranchCashiers(branchId: string) {
  return useQuery({
    queryKey: queryKeys.branchCashiers(branchId),
    queryFn: () => erpGet<Cashier[]>(`/api/v1/branches/${branchId}/cashiers`),
    enabled: Boolean(branchId),
  });
}

function useRefreshCashiers() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.cashiers });
}

export function useSetCashierPin() {
  const refresh = useRefreshCashiers();
  return useMutation({
    mutationFn: (input: { userId: string; pin: string }) =>
      erpSend(`/api/v1/users/${input.userId}/pin`, "PUT", { pin: input.pin }),
    onSuccess: refresh,
  });
}

export function useClearCashierPin() {
  const refresh = useRefreshCashiers();
  return useMutation({
    mutationFn: (userId: string) => erpSend(`/api/v1/users/${userId}/pin`, "DELETE"),
    onSuccess: refresh,
  });
}

/** What the Sales channels pages need of a branch: its name and whether it takes POS sales (GET /api/v1/channels/branches). */
export type ChannelBranch = {
  id: string;
  branch_code: string;
  branch_name: string;
  status: string;
  accepts_pos: boolean;
  accepts_online: boolean;
  accepts_whatsapp: boolean;
};

export function useChannelBranches() {
  return useQuery({
    queryKey: queryKeys.channelBranches,
    queryFn: () => erpGet<ChannelBranch[]>("/api/v1/channels/branches"),
  });
}

export type ChannelSwitch = "accepts_pos" | "accepts_online" | "accepts_whatsapp";

/** Switch a branch on or off for the website or WhatsApp. */
export function useToggleChannelBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { branchId: string; field: ChannelSwitch; value: boolean }) =>
      erpSend(`/api/v1/channels/branches/${input.branchId}`, "PATCH", {
        [input.field]: input.value,
      }),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.channelBranches }),
        qc.invalidateQueries({ queryKey: queryKeys.channels }),
      ]),
  });
}

/** Switch "Takes POS sales" on or off for a branch. The POS checklist depends on it, so it refreshes too. */
export function useTogglePosBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { branchId: string; value: boolean }) =>
      erpSend(`/api/v1/channels/branches/${input.branchId}`, "PATCH", { accepts_pos: input.value }),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.channels }),
        qc.invalidateQueries({ queryKey: queryKeys.terminals }),
      ]),
  });
}

export type TerminalSummary = {
  branch_id: string;
  paired: number;
  online: number;
  last_seen_at: string | null;
  waiting_bills: number;
  tills_holding: number;
};

/** Paired and online terminals for every branch, in one request. */
export function useTerminalSummary() {
  return useQuery({
    queryKey: queryKeys.terminalSummary,
    queryFn: () => erpGet<TerminalSummary[]>("/api/v1/terminals/summary"),
  });
}
