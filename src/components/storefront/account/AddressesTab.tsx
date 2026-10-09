"use client";

import { useState } from "react";
import { Card } from "./Card";
import type { SavedAddress } from "@/lib/useAccountProfile";

interface AddressesTabProps {
  addresses: SavedAddress[];
  adding: boolean;
  onAdd: (address: string) => Promise<boolean>;
  deletingId: number | null;
  onDelete: (id: number) => void;
}

export function AddressesTab({ addresses, adding, onAdd, deletingId, onDelete }: AddressesTabProps) {
  const [draft, setDraft] = useState("");

  async function handleAdd() {
    const address = draft.trim();
    if (!address) return;
    const ok = await onAdd(address);
    if (ok) setDraft("");
  }

  return (
    <div className="space-y-4">
      {addresses.length === 0 ? (
        <Card className="p-6 flex flex-col items-center gap-2 text-center">
          <span className="material-symbols-outlined text-sf-text-muted text-[28px]">location_on</span>
          <p className="font-sf-body text-sm text-sf-on-surface font-semibold">No saved addresses yet</p>
          <p className="font-sf-body text-xs text-sf-text-muted">Add one below for faster checkout.</p>
        </Card>
      ) : (
        addresses.map((address) => (
          <Card key={address.id} className="p-5 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-sf-surface-container text-sf-text-body">
                <span className="material-symbols-outlined text-[20px]">location_on</span>
              </div>
              <p className="font-sf-body text-sm text-sf-on-surface mt-1.5">{address.address}</p>
            </div>
            <button
              type="button"
              onClick={() => onDelete(address.id)}
              disabled={deletingId === address.id}
              aria-label="Remove address"
              className="h-9 px-3.5 rounded-lg bg-sf-surface-container hover:bg-sf-error/10 hover:text-sf-error text-sf-on-surface font-sf-body text-xs font-semibold shrink-0 transition-colors cursor-pointer disabled:opacity-50"
            >
              {deletingId === address.id ? "Removing…" : "Remove"}
            </button>
          </Card>
        ))
      )}

      <Card className="p-5">
        <label htmlFor="new-address" className="block font-sf-body text-xs font-semibold text-sf-on-surface mb-2">
          Add a new address
        </label>
        <div className="flex gap-2">
          <input
            id="new-address"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Flat/house no., street, area, city"
            className="w-full h-11 px-4 rounded-lg bg-sf-surface-container-low text-sf-on-surface font-sf-body text-sm placeholder:text-sf-text-muted focus:bg-sf-surface focus:outline-none focus:ring-2 focus:ring-sf-primary"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={adding || !draft.trim()}
            className="px-5 h-11 rounded-lg bg-sf-primary hover:bg-sf-secondary text-sf-on-primary font-sf-body text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer shrink-0"
          >
            {adding ? "Saving…" : "Add"}
          </button>
        </div>
        <p className="font-sf-body text-xs text-sf-text-muted mt-2">Up to 5 saved addresses.</p>
      </Card>
    </div>
  );
}
