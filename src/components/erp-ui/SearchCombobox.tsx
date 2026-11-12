"use client";

import { Combobox } from "@base-ui/react/combobox";
import type { ReactNode } from "react";
import { Input } from "@/components/erp-ui/Input";

/** Server-filtered results share positioning, dismissal and keyboard selection. */
export function SearchCombobox<Item extends { id: string }>({
  id,
  label,
  placeholder,
  query,
  onQueryChange,
  items,
  itemLabel,
  renderItem,
  onPick,
  onFocus,
  loading,
  emptyLabel,
}: {
  id?: string;
  label: string;
  placeholder: string;
  query: string;
  onQueryChange: (query: string) => void;
  items: readonly Item[];
  itemLabel: (item: Item) => string;
  renderItem: (item: Item) => ReactNode;
  onPick: (item: Item) => void;
  onFocus?: () => void;
  loading: boolean;
  emptyLabel: string;
}) {
  return (
    <Combobox.Root
      items={items}
      filter={null}
      value={null}
      inputValue={query}
      onInputValueChange={(next, details) => {
        // Dismissing results preserves the query; only typing edits it.
        if (
          details.reason === "input-change" ||
          details.reason === "clear-press"
        )
          onQueryChange(next);
      }}
      onValueChange={(item) => {
        if (item) {
          onPick(item);
          onQueryChange("");
        }
      }}
      itemToStringLabel={itemLabel}
      isItemEqualToValue={(a, b) => a.id === b.id}
    >
      <Combobox.Input
        id={id}
        aria-label={label}
        placeholder={placeholder}
        onFocus={onFocus}
        render={<Input />}
      />
      <Combobox.Portal>
        <Combobox.Positioner
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={8}
          className="z-50 outline-none"
          onClick={(event) => event.stopPropagation()}
        >
          <Combobox.Popup className="max-h-[min(15rem,var(--available-height))] w-[var(--anchor-width)] max-w-[calc(100vw-16px)] overflow-y-auto rounded-md border border-line bg-card p-1 shadow-[var(--shadow-md)] outline-none">
            <Combobox.List>
              {items.map((item) => (
                <Combobox.Item
                  key={item.id}
                  value={item}
                  className="min-h-11 cursor-pointer rounded px-space-3 py-space-2 text-left break-words outline-none data-highlighted:bg-brand-50"
                >
                  {renderItem(item)}
                </Combobox.Item>
              ))}
            </Combobox.List>
            {items.length === 0 && (
              <p
                role="status"
                className="px-space-3 py-space-2 text-[13px] text-ink-400"
              >
                {loading ? "Searching…" : emptyLabel}
              </p>
            )}
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
