"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { SearchCombobox } from "@/components/erp-ui/SearchCombobox";
import { useCustomerSearch } from "@/hooks/erp/useCustomers";
import type { Customer } from "@/lib/erp/erp";
import { useDebounced } from "@/lib/erp/useDebounced";
import { formatPhone } from "@/lib/erp/phone";

/** How many customers the list shows; typing narrows it on the server, so every customer can be reached. */
const LIST_SIZE = 50;

/** A form field holding ONE existing customer: shows the chosen one (with a button to clear it), otherwise a search by name, phone or
 * email run on the server (8 results), so it works with any number of customers. Cleared = no existing customer (`emptyLabel`). */
export function CustomerSelect({
  value,
  onChange,
  id,
  emptyLabel = "Search customers by name, phone or email…",
}: {
  value: Customer | null;
  onChange: (customer: Customer | null) => void;
  id?: string;
  emptyLabel?: string;
}) {
  const [q, setQ] = useState("");
  const query = useDebounced(q.trim());
  const results = useCustomerSearch(query, LIST_SIZE, true, !value); // with nothing typed, the newest customers
  if (value)
    return (
      <div className="flex h-10 items-center justify-between gap-space-2 rounded-md border border-line bg-card px-space-3 text-[14px]">
        <span className="min-w-0 truncate text-ink-900">
          {value.name}
          {value.phone && (
            <span className="text-[12px] text-ink-400">
              {" "}
              · {formatPhone(value.phone)}
            </span>
          )}
        </span>
        <button
          type="button"
          aria-label="Clear customer"
          onClick={() => onChange(null)}
          className="shrink-0 text-ink-400 hover:text-ink-900"
        >
          <X size={15} />
        </button>
      </div>
    );
  return (
    <SearchCombobox
      id={id}
      label="Search customers"
      placeholder={emptyLabel}
      query={q}
      onQueryChange={setQ}
      items={results.data ?? []}
      itemLabel={(customer) => customer.name}
      onPick={onChange}
      loading={results.isFetching || q.trim() !== query}
      emptyLabel="No customers match."
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
  );
}
