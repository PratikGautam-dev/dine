import { Card } from "./Card";
import { SAVED_ADDRESSES, formatMonthYear, type Profile } from "@/lib/account";

interface ProfileCardProps {
  profile: Profile;
  primaryAddressId: string;
  onEdit: () => void;
  onManageAddresses: () => void;
}

export function ProfileCard({ profile, primaryAddressId, onEdit, onManageAddresses }: ProfileCardProps) {
  const initials = profile.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
  const primary = SAVED_ADDRESSES.find((a) => a.id === primaryAddressId);

  return (
    <Card className="lg:col-span-4 p-6 flex flex-col justify-between relative overflow-hidden">
      <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-sf-primary-light/60 blur-2xl pointer-events-none" />
      <div className="relative">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative shrink-0">
              <div
                aria-hidden="true"
                className="w-16 h-16 rounded-full bg-sf-primary text-sf-on-primary flex items-center justify-center font-sf-headline text-xl font-bold ring-2 ring-sf-primary-light shadow-sm"
              >
                {initials || <span className="material-symbols-outlined">person</span>}
              </div>
              <span className="absolute bottom-0 right-0 w-4 h-4 bg-sf-veg-green rounded-full border-2 border-sf-surface" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <h1 className="font-sf-headline text-xl font-semibold text-sf-on-surface truncate">{profile.name}</h1>
                <span className="material-symbols-outlined text-sf-primary text-[18px]" title="Verified Diner">
                  verified
                </span>
              </div>
              <p className="font-sf-body text-xs text-sf-text-muted truncate">
                Member since {formatMonthYear(profile.memberSince)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit profile details"
            title="Edit Profile Details"
            className="p-2 rounded-lg bg-sf-surface-container-low hover:bg-sf-surface-container text-sf-on-surface transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">edit</span>
          </button>
        </div>
        <div className="space-y-1 font-sf-body text-xs text-sf-text-body">
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sf-text-muted text-[16px]">call</span>
            <span className="font-medium">{profile.phone ? `+91 ${profile.phone}` : "Not set"}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sf-text-muted text-[16px]">mail</span>
            <span className="truncate">{profile.email}</span>
          </div>
        </div>
      </div>

      <div className="relative mt-4 bg-sf-surface-container-low rounded-lg p-2 flex items-center justify-between gap-2 text-sf-on-surface">
        <div className="flex items-center gap-1 min-w-0">
          <span className="material-symbols-outlined text-sf-primary text-[20px]">pin_drop</span>
          <div className="leading-tight min-w-0">
            <span className="font-sf-body text-[11px] font-semibold block text-sf-text-muted">Primary Address</span>
            <span className="font-sf-body text-xs font-semibold truncate block">
              {primary ? `${primary.label} • ${primary.line}` : "Not set"}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onManageAddresses}
          className="font-sf-body text-[11px] text-sf-primary font-semibold hover:underline shrink-0 cursor-pointer"
        >
          Manage
        </button>
      </div>
    </Card>
  );
}
