"use client";

import { ExternalLink, Paintbrush } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { storefrontUrl, SitePreview } from "@/components/portal/channels/DineThemeEditor";
import { Badge } from "@/components/erp-ui/Badge";
import { Button } from "@/components/erp-ui/Button";
import { Card } from "@/components/erp-ui/Card";
import { useStorefrontDraft } from "@/hooks/useStorefrontDraft";
import { useStorefrontSettings } from "@/hooks/useStorefrontSettings";
import { hasPermission, useStaffSession } from "@/lib/erp/staffAuth";

/** The one theme DINE's website has today (the ERP lists every installed and available theme; here there is a single built-in one, so no install or
 * remove). Same card as the ERP's current theme: live preview, status, Customize, Publish, View store. */
export const DINE_THEME = {
  key: "dine-default",
  name: "Dine default",
  blurb: "Your restaurant's page: hero, menu, photo gallery and reviews.",
};

export function OnlineStoreThemes() {
  const session = useStaffSession();
  const canView = hasPermission(session, "settings", "view");
  const canEdit = hasPermission(session, "settings", "write");
  const { storefront } = useStorefrontSettings(canView);
  const { draft, previewToken, fetchPreviewToken, publish, publishing, hasUnpublishedChanges } =
    useStorefrontDraft(canView);

  useEffect(() => {
    if (draft && !previewToken) fetchPreviewToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  if (!canView)
    return (
      <Card className="p-space-4 text-[13.5px] text-ink-600">
        Ask an administrator to manage the website.
      </Card>
    );

  const storeUrl = storefront?.public_url_path
    ? `${storefrontUrl()}${storefront.public_url_path}`
    : null;
  const previewSrc =
    storefront?.slug && previewToken
      ? `${storefrontUrl()}/${storefront.slug}?preview_token=${previewToken}&v=${encodeURIComponent(draft?.draft_updated_at ?? "")}`
      : null;
  const live = !!storefront?.web_ordering_enabled;

  return (
    <>
      <h2 className="mb-space-3 text-[17px] font-semibold text-ink-900">Current theme</h2>
      <Card className="mb-space-5 grid min-w-0 gap-space-4 p-space-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="min-w-0">
          <div className="mb-space-1 flex flex-wrap items-center gap-space-2">
            <h3 className="break-words text-[16px] font-semibold text-ink-900">
              {DINE_THEME.name}
            </h3>
            <Badge tone={live ? "success" : "neutral"}>{live ? "Live" : "Ordering off"}</Badge>
            {hasUnpublishedChanges && <Badge tone="warning">Unpublished changes</Badge>}
          </div>
          <p className="mb-space-4 text-[13.5px] text-ink-600">{DINE_THEME.blurb}</p>
          <div className="flex flex-wrap gap-space-2">
            <Link href={`/portal/channels/online/themes/${DINE_THEME.key}`}>
              <Button>
                <Paintbrush size={14} /> Customize
              </Button>
            </Link>
            {canEdit && hasUnpublishedChanges && (
              <Button variant="secondary" disabled={publishing} onClick={() => void publish()}>
                {publishing ? "Publishing…" : "Publish"}
              </Button>
            )}
            {storeUrl && (
              <a href={storeUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary">
                  View my store <ExternalLink size={14} />
                </Button>
              </a>
            )}
          </div>
          {!storefront?.slug && (
            <p className="mt-space-3 text-[13px] text-ink-600">
              Choose your store link in the{" "}
              <a href="#online-storefront" className="font-semibold text-brand-600 hover:underline">
                Online storefront
              </a>{" "}
              section below to see a preview.
            </p>
          )}
        </div>
        <SitePreview
          key={draft?.draft_updated_at ?? "initial"}
          src={previewSrc}
          title="Website preview"
        />
      </Card>
    </>
  );
}
