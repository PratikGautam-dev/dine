"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { erpGet, erpSend } from "@/lib/erp/erp";
import { queryKeys } from "@/lib/erp/queryKeys";

/** The POS side of the menu (backend pos/menu.py): kitchen stations, categories, add-on groups and an item's POS details. Money is paise. */
export type Station = {
  id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  item_count: number;
  category_count: number;
};
export type Category = {
  id: string;
  name: string;
  sort_order: number;
  station_id: string | null;
  tax_code: string | null;
  item_count: number;
};
export type ModifierOption = {
  id?: string;
  name: string;
  price_paise: number;
  is_veg: boolean | null;
  is_active: boolean;
};
export type ModifierGroup = {
  id: string;
  name: string;
  min_select: number;
  max_select: number | null;
  sort_order: number;
  is_active: boolean;
  item_count: number;
  options: ModifierOption[];
};
export type Variant = {
  id?: string;
  name: string;
  price_paise: number;
  dine_in_price_paise: number | null;
  takeaway_price_paise: number | null;
  delivery_price_paise: number | null;
  is_active: boolean;
};
export type ItemPos = {
  id: string;
  name: string;
  price_paise: number;
  station_id: string | null;
  tax_code: string | null;
  short_name: string | null;
  dine_in_price_paise: number | null;
  takeaway_price_paise: number | null;
  delivery_price_paise: number | null;
  variants: Variant[];
  modifier_group_ids: string[];
};
export type ItemPosInput = Omit<ItemPos, "id" | "name" | "price_paise">;

function useRefreshMenu() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.posMenu });
}

export const useStations = () =>
  useQuery({
    queryKey: queryKeys.posStations,
    queryFn: () => erpGet<Station[]>("/api/v1/pos/stations"),
  });
export const useCategories = () =>
  useQuery({
    queryKey: queryKeys.posCategories,
    queryFn: () => erpGet<Category[]>("/api/v1/pos/categories"),
  });
export const useModifierGroups = () =>
  useQuery({
    queryKey: queryKeys.posModifierGroups,
    queryFn: () => erpGet<ModifierGroup[]>("/api/v1/pos/modifier-groups"),
  });
export const useItemPos = (id: string) =>
  useQuery({
    queryKey: queryKeys.posMenuItem(id),
    queryFn: () => erpGet<ItemPos>(`/api/v1/pos/menu-items/${id}`),
    enabled: Boolean(id),
  });

/** Create (no id) or update one row of a POS menu list: stations, categories or modifier-groups. */
export function useSaveRow<T>(kind: "stations" | "categories" | "modifier-groups") {
  const refresh = useRefreshMenu();
  return useMutation({
    mutationFn: (input: { id?: string; body: unknown }) =>
      erpSend<T>(
        input.id ? `/api/v1/pos/${kind}/${input.id}` : `/api/v1/pos/${kind}`,
        input.id ? "PUT" : "POST",
        input.body,
      ),
    onSuccess: refresh,
  });
}

export function useDeleteRow(kind: "stations" | "categories" | "modifier-groups") {
  const refresh = useRefreshMenu();
  return useMutation({
    mutationFn: (id: string) => erpSend(`/api/v1/pos/${kind}/${id}`, "DELETE"),
    onSuccess: refresh,
  });
}

export function useSaveItemPos(id: string) {
  const refresh = useRefreshMenu();
  return useMutation({
    mutationFn: (body: ItemPosInput) =>
      erpSend<ItemPos>(`/api/v1/pos/menu-items/${id}`, "PUT", body),
    onSuccess: refresh,
  });
}

/** POS settings: restaurant-wide values and each branch's overrides (null = the restaurant's). */
export type PosSettings = {
  restaurant: {
    /** Read-only here: edited in Settings > Taxes. */
    prices_include_tax: boolean;
    default_tax_bps: number;
    fssai_number: string | null;
    takeaway_pay_first: boolean;
    packaging_fee_paise: number;
    /** No delivery fee on a till bill once the food reaches this (null = the fee always applies). */
    free_delivery_above_paise: number | null;
    /** When the business day ends, 0-6 o'clock (0 = midnight): KOT numbers, the bill's day and the Z follow it. */
    day_ends_hour: number;
  };
  branches: {
    id: string;
    name: string;
    code: string | null;
    fssai_number: string | null;
    takeaway_pay_first: boolean | null;
    packaging_fee_paise: number | null;
    /** null = the restaurant's setting; 0 = the fee always applies at this branch. */
    free_delivery_above_paise: number | null;
    day_ends_hour: number | null;
    service_charge_pct: number | null;
  }[];
};

export const usePosSettings = () =>
  useQuery({
    queryKey: queryKeys.posSettings,
    queryFn: () => erpGet<PosSettings>("/api/v1/pos/settings"),
  });

export function useSavePosSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { branchId?: string; body: Record<string, unknown> }) =>
      erpSend<PosSettings>(
        input.branchId ? `/api/v1/pos/settings/branches/${input.branchId}` : "/api/v1/pos/settings",
        "PUT",
        input.body,
      ),
    onSuccess: (data) => qc.setQueryData(queryKeys.posSettings, data),
  });
}
