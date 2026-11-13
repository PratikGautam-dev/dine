"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { PortalShell } from "@/components/portal/PortalShell";
import type { PortalRestaurant } from "@/lib/portalAuth";

/** The common frame of a settings page: the portal shell (which swaps in the settings menu), the page header,
 * and the content column. Every page under /portal/settings follows it. */
export function SettingsPageFrame({
  restaurant,
  title,
  description,
  icon,
  actions,
  children,
}: {
  restaurant: PortalRestaurant | null;
  title: string;
  description: string;
  icon: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <PortalShell restaurant={restaurant} active="settings">
      <PageHeader title={title} description={description} icon={icon} actions={actions} />
      {children}
    </PortalShell>
  );
}

/** The error / "Saved." line and Save button that close every settings form card. */
export function SaveFooter({
  error,
  saved,
  saving,
  label = "Save changes",
}: {
  error: string | null;
  saved?: boolean;
  saving: boolean;
  label?: string;
}) {
  return (
    <>
      {error && <p className="mt-space-2 text-[12.5px] font-medium text-error">{error}</p>}
      {saved && <p className="mt-space-2 text-[12.5px] font-medium text-success">Saved.</p>}
      <SaveButton saving={saving} label={label} />
    </>
  );
}

function SaveButton({ saving, label }: { saving: boolean; label: string }) {
  return (
    <Button type="submit" disabled={saving} className="mt-space-4">
      {saving ? "Saving…" : label}
    </Button>
  );
}
