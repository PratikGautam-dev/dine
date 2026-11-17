"use client";

import { Paintbrush } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { use } from "react";
import { DineThemeEditor } from "@/components/portal/channels/DineThemeEditor";
import { DINE_THEME } from "@/components/portal/channels/OnlineStoreThemes";
import { PortalShell } from "@/components/portal/PortalShell";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { PageHeader } from "@/components/ui/PageHeader";

/** Customize the website's one theme: change the look and text, preview it, then publish. */
export default function ThemeEditorPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  const { restaurant, ready } = usePortalGuard();
  if (key !== DINE_THEME.key) notFound();
  if (!ready) return null;
  return (
    <PortalShell restaurant={restaurant} active="channel-online">
      <PageHeader
        icon={<Paintbrush size={20} />}
        title="Customize theme"
        description="Change the look and text of your website, preview it, then publish."
        actions={
          <Link href="/portal/channels/online" className="text-[13px] font-semibold text-brand-700 hover:underline">
            ← Back to Website
          </Link>
        }
      />
      <DineThemeEditor />
    </PortalShell>
  );
}
