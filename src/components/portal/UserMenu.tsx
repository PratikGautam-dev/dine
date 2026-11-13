"use client";

import { useState } from "react";
import { Check, ChevronDown, Copy, LogOut, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { clearPortalSession } from "@/lib/portalAuth";
import { useStaffSession } from "@/lib/staffAuth";
import { roleLabel } from "@/lib/staffRoles";

/** The signed-in person, top right: their initial, name and role, with the business name and ID, Profile and Log out in the menu. All from the real
 * staff session -- renders nothing until it has loaded. */
export function UserMenu() {
  const router = useRouter();
  const session = useStaffSession();
  if (!session) return null;

  const businessName = session.restaurant?.name;
  const businessId = session.restaurant?.display_id;
  const initial = (session.name.trim()[0] || "?").toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${session.name}`}
        className="flex items-center gap-space-2 rounded-md py-1 pr-space-1 pl-1 hover:bg-paper focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[14px] font-bold text-white">
          {initial}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-[160px] truncate text-[13px] font-semibold text-ink-900">
            {session.name}
          </span>
          <span className="block text-[11.5px] text-ink-600">{roleLabel(session.role)}</span>
        </span>
        <ChevronDown size={15} className="hidden text-ink-400 sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[265px]">
        {(businessName || businessId) && (
          <div className="mb-space-1 border-b border-line px-space-3 pt-space-2 pb-space-3">
            {businessName && (
              <p className="truncate text-[15px] font-semibold text-ink-900">{businessName}</p>
            )}
            {businessId && <BusinessId id={businessId} />}
          </div>
        )}
        <DropdownMenuItem onClick={() => router.push("/portal/profile")}>
          <UserRound size={15} /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            clearPortalSession();
            router.push("/");
          }}
        >
          <LogOut size={15} /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** "Business ID  TNT00004 [copy]" -- the copy button flips to a tick for a moment. */
function BusinessId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  async function copy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked -- nothing to do */
    }
  }
  return (
    <div className="mt-1 flex items-center gap-space-2 whitespace-nowrap">
      <span className="text-[12px] text-ink-600">Business ID</span>
      <span className="font-mono text-[12px] font-bold text-ink-900">{id}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy business ID"}
        className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line text-ink-600 hover:bg-paper focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none"
      >
        {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
      </button>
    </div>
  );
}
