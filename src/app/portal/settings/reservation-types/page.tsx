"use client";

import { ListChecks } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { AppointmentTypeToggles } from "@/components/portal/AppointmentTypeToggles";
import { SettingsPageFrame } from "@/components/portal/settings/SettingsPageFrame";
import { BranchField } from "@/components/portal/settings/BranchField";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { useSettingsBranch } from "@/hooks/useSettingsBranch";

export default function ReservationTypesSettingsPage() {
  const { restaurant } = usePortalGuard();
  const { branches, branchId, branch, setBranchId } = useSettingsBranch();
  // Backend route guards already 403 the actual mutations for a tenant lacking manage_appointment_types.
  // Fails open (renders the section) while restaurant hasn't loaded yet.
  const canManageAppointmentTypes =
    !restaurant || restaurant.admin_capabilities?.includes("manage_appointment_types");

  return (
    <SettingsPageFrame
      restaurant={restaurant}
      title="Reservation types"
      maxWidthClass="max-w-[880px]"
      icon={<ListChecks size={20} />}
      description="Which reservation types each branch offers in the WhatsApp booking menu."
    >
      {canManageAppointmentTypes && (
        <Card className="p-space-5">
          <h2 className="mb-space-1 text-[15px] font-bold text-ink-900">Reservation types</h2>
          <p className="mb-space-3 text-[12.5px] text-ink-400">
            Turn on/off which of your allowed reservation types this branch shows in the WhatsApp
            booking menu. A type greyed out below hasn&apos;t been enabled for your account by the
            platform — contact support to request it.
          </p>
          <BranchField
            branches={branches}
            branchId={branchId}
            branch={branch}
            onChange={setBranchId}
          />
          <AppointmentTypeToggles canManage={canManageAppointmentTypes} branchId={branchId} />
        </Card>
      )}
    </SettingsPageFrame>
  );
}
