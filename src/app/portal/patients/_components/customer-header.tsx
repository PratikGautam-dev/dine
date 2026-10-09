"use client";

import { Crown, Medal, Star } from "lucide-react";
import type { PatientDetail } from "@/hooks/usePatients";

const LOYALTY_ICON: Record<string, typeof Crown> = { Platinum: Crown, Gold: Medal, Silver: Star };

/** The same avatar + name + loyalty-badge treatment the All Customers tab's own detail panel
 * uses, reused at the top of the Loyalty/Tags/Communication tabs so a customer's identity reads
 * consistently no matter which tab you're on -- those tabs previously only showed a plain
 * name/phone line, which looked thinner and less finished than this one. */
export function CustomerHeader({ profile }: { profile: PatientDetail }) {
  return (
    <div className="mb-space-4 flex items-center gap-space-3 border-b border-line pb-space-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[15px] font-bold text-brand-700">
        {(profile.name || profile.phone).trim().charAt(0).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-space-2">
          <p className="truncate text-[15px] font-bold text-ink-900">
            {profile.name || "Not registered yet"}
          </p>
          {profile.loyalty_tier &&
            (() => {
              const Icon = LOYALTY_ICON[profile.loyalty_tier] ?? Star;
              return (
                <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-warning-tint px-space-2 py-0.5 text-[10.5px] font-bold text-warning">
                  <Icon size={11} /> {profile.loyalty_tier}
                </span>
              );
            })()}
        </div>
        <p className="text-[12px] text-ink-600">{profile.phone}</p>
      </div>
    </div>
  );
}
