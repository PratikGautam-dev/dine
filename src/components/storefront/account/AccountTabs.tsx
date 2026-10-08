"use client";

import { cn } from "@/lib/cn";
import { TAB_LIST, type AccountTab } from "@/lib/account";

interface AccountTabsProps {
  active: AccountTab;
  onChange: (tab: AccountTab) => void;
}

export function AccountTabs({ active, onChange }: AccountTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Account sections"
      className="flex items-center gap-1 overflow-x-auto pb-1 mb-6 no-scrollbar"
    >
      {TAB_LIST.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            id={`account-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls="account-panel"
            onClick={() => onChange(tab.id)}
            className={cn(
              "px-4 py-2.5 rounded-full font-sf-body text-sm shrink-0 flex items-center gap-1.5 transition-colors cursor-pointer",
              selected
                ? "bg-sf-primary text-sf-on-primary font-semibold shadow-sm"
                : "bg-sf-surface hover:bg-sf-surface-container text-sf-on-surface",
            )}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
