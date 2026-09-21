"use client";

import { ChevronDown, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { clearPortalSession } from "@/lib/portalAuth";
import { useStaffSession } from "@/lib/staffAuth";
import { ROLE_LABEL } from "@/lib/staffRoles";

/** The signed-in person, top right: their initial, name and role, with Log out in the menu. All from the real
 * staff session -- renders nothing until it has loaded. */
export function UserMenu() {
  const router = useRouter();
  const session = useStaffSession();
  if (!session) return null;

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
          <span className="block max-w-[160px] truncate text-[13px] font-semibold text-ink-900">{session.name}</span>
          <span className="block text-[11.5px] text-ink-600">{ROLE_LABEL[session.role]}</span>
        </span>
        <ChevronDown size={15} className="hidden text-ink-400 sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
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
