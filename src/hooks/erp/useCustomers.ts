"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePagedQuery } from "@/hooks/erp/usePagedQuery";
import {
  erpGet,
  erpSend,
  qs,
  type Customer,
  type Interaction,
  type StoreCredit,
} from "@/lib/erp/erp";
import { queryKeys } from "@/lib/erp/queryKeys";

/** The customers list, newest first, paged and searched (name, phone, email) on the server. */
export function useCustomerList(q: string) {
  return usePagedQuery<Customer>(queryKeys.customerList, "/api/v1/customers", {
    q,
  });
}

/** Up to `limit` customers matching `q`, for a picker. Nothing is fetched while `q` is empty, unless `listWhenEmpty`: then the newest customers. */
export function useCustomerSearch(
  q: string,
  limit = 8,
  listWhenEmpty = false,
  enabled = true,
) {
  const params = { q, limit };
  return useQuery({
    queryKey: queryKeys.customerList(params),
    queryFn: () => erpGet<Customer[]>(`/api/v1/customers${qs(params)}`),
    enabled: enabled && (listWhenEmpty || Boolean(q)),
  });
}

/** One customer with their interactions across channels. */
export function useCustomer(id: string) {
  return useQuery({
    queryKey: queryKeys.customer(id),
    queryFn: () =>
      erpGet<Customer & { interactions: Interaction[] }>(
        `/api/v1/customers/${id}`,
      ),
    enabled: Boolean(id),
  });
}

export function useStoreCredit(customerId: string) {
  return useQuery({
    queryKey: queryKeys.storeCredit(customerId),
    queryFn: () =>
      erpGet<StoreCredit>(`/api/v1/customers/${customerId}/store-credit`),
    enabled: Boolean(customerId),
  });
}

export type NewCustomer = {
  name: string;
  phone: string | null;
  email: string | null;
};

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewCustomer) =>
      erpSend<Customer>("/api/v1/customers", "POST", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.customers }),
  });
}
