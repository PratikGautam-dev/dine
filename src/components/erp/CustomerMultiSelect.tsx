"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { SearchCombobox } from "@/components/erp-ui/SearchCombobox";
import { useCustomerSearch } from "@/hooks/erp/useCustomers";
import { formatPhone } from "@/lib/erp/phone";
import { useDebounced } from "@/lib/erp/useDebounced";

/** How many customers the list shows; typing narrows it on the server, so every customer can be reached. */
const LIST_SIZE = 50;

/** A customer as far as a picker needs to show them. */
export type PickedCustomer = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
};

/** A form field holding SEVERAL existing customers: the chosen ones show as removable chips, and a search by name, phone or email (run on the
 * server, so it works with any number of customers) adds more. Anyone already chosen is left out of the results. */
export function CustomerMultiSelect({
  value,
  onChange,
  id,
  max = 500,
  placeholder = "Choose customers, or search by name, phone or email…",
}: {
  value: PickedCustomer[];
  onChange: (customers: PickedCustomer[]) => void;
  id?: string;
  /** Most customers that can be chosen. */
  max?: number;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const query = useDebounced(q.trim());
  const results = useCustomerSearch(query, LIST_SIZE, true); // with nothing typed, the newest customers
  const chosen = new Set(value.map((c) => c.id));
  const full = value.length >= max;
  return (
    <div className="space-y-space-2">
      {value.length > 0 && (
        <ul
          aria-label="Chosen customers"
          className="flex max-h-40 flex-wrap gap-space-1 overflow-y-auto"
        >
          {value.map((c) => (
            <li
              key={c.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-ink-50 py-0.5 pl-space-3 pr-1 text-[13px] text-ink-900"
            >
              <span className="truncate">
                {c.name}
                {c.phone && (
                  <span className="text-[12px] text-ink-400">
                    {" "}
                    · {formatPhone(c.phone)}
                  </span>
                )}
              </span>
              <button
                type="button"
                aria-label={`Remove ${c.name}`}
                onClick={() => onChange(value.filter((x) => x.id !== c.id))}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-ink-600 hover:bg-black/[0.08] hover:text-ink-900"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {full ? (
        <p className="text-[12.5px] text-ink-600">
          That is the most customers one campaign can go to ({max}).
        </p>
      ) : (
        <SearchCombobox
          id={id}
          label="Search customers"
          placeholder={value.length ? "Add another customer…" : placeholder}
          query={q}
          onQueryChange={setQ}
          items={(results.data ?? []).filter((c) => !chosen.has(c.id))}
          itemLabel={(customer) => customer.name}
          onPick={(customer) => onChange([...value, customer])}
          loading={results.isFetching || q.trim() !== query}
          emptyLabel={
            query ? "No customers match." : "No more customers to add."
          }
          renderItem={(customer) => (
            <>
              <span className="block text-[14px] font-medium text-ink-900">
                {customer.name}
              </span>
              <span className="block text-[12px] text-ink-400">
                {[customer.phone, customer.email].filter(Boolean).join(" · ")}
              </span>
            </>
          )}
        />
      )}
    </div>
  );
}
