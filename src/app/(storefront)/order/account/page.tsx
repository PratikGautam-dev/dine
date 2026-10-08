"use client";

// Ported from dine-client's app/account/page.tsx. Gated behind real login (redirects to
// /order/login?next=/order/account when logged out, same pattern orders/[id]/page.tsx already
// used). Order History tab is REAL (OrderHistory.tsx, GET /api/public/orders). Profile tab shows
// the real phone/name from useCustomerSession() layered onto the rest of dine-client's static
// INITIAL_PROFILE. Membership/Credits/Favourites/Addresses/Settings tabs are fully static
// placeholders (lib/account.ts's mock data) -- no backend exists for them yet, per the explicit
// "port everything, stub what has no backend" decision.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/storefront/account/Card";
import { ProfileCard } from "@/components/storefront/account/ProfileCard";
import { MembershipCard } from "@/components/storefront/account/MembershipCard";
import { CreditsCard } from "@/components/storefront/account/CreditsCard";
import { AccountTabs } from "@/components/storefront/account/AccountTabs";
import { OrderHistory } from "@/components/storefront/account/OrderHistory";
import { MembershipTab } from "@/components/storefront/account/MembershipTab";
import { CreditsActivity } from "@/components/storefront/account/CreditsActivity";
import { AddressesTab } from "@/components/storefront/account/AddressesTab";
import { FavoritesTab } from "@/components/storefront/account/FavoritesTab";
import { SettingsTab } from "@/components/storefront/account/SettingsTab";
import { AccountSidebar } from "@/components/storefront/account/AccountSidebar";
import { INITIAL_PROFILE, SAVED_ADDRESSES, type AccountTab, type Profile } from "@/lib/account";
import { getCustomerToken, useCustomerSession } from "@/lib/customerAuth";

export default function AccountPage() {
  const router = useRouter();
  const session = useCustomerSession();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<AccountTab>("orders");
  const [profile, setProfile] = useState<Profile>(INITIAL_PROFILE);
  const [primaryAddressId, setPrimaryAddressId] = useState(SAVED_ADDRESSES[0].id);

  useEffect(() => {
    if (!getCustomerToken()) {
      router.replace("/order/login?next=/order/account");
      return;
    }
    const initial = new URLSearchParams(window.location.search).get("tab");
    if (initial && ["orders", "membership", "ledger", "addresses", "favorites", "settings"].includes(initial)) {
      setTab(initial as AccountTab);
    }
    setReady(true);
  }, [router]);

  // Layer the real phone/name over dine-client's static profile fields once the session loads.
  useEffect(() => {
    if (session) setProfile((p) => ({ ...p, name: session.name || p.name, phone: session.phone }));
  }, [session]);

  function goToTab(next: AccountTab) {
    setTab(next);
    document.getElementById("account-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!ready) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        <div className="h-40 animate-pulse rounded-2xl bg-sf-surface-container-low" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 pb-20 sm:px-8">
      <div className="mb-8 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
        <ProfileCard
          profile={profile}
          primaryAddressId={primaryAddressId}
          onEdit={() => goToTab("settings")}
          onManageAddresses={() => goToTab("addresses")}
        />
        <MembershipCard />
        <CreditsCard onOpenLedger={() => goToTab("ledger")} />
      </div>

      <div id="account-tabs" className="scroll-mt-24">
        <AccountTabs active={tab} onChange={setTab} />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div id="account-panel" role="tabpanel" aria-labelledby={`account-tab-${tab}`} className="lg:col-span-8">
          {tab === "orders" && <OrderHistory />}
          {tab === "membership" && <MembershipTab />}
          {tab === "ledger" && (
            <Card className="p-6">
              <CreditsActivity />
            </Card>
          )}
          {tab === "addresses" && <AddressesTab primaryId={primaryAddressId} onSetPrimary={setPrimaryAddressId} />}
          {tab === "favorites" && <FavoritesTab />}
          {tab === "settings" && <SettingsTab profile={profile} onSave={setProfile} />}
        </div>

        <aside className="lg:col-span-4">
          <AccountSidebar onViewLedger={() => goToTab("ledger")} />
        </aside>
      </div>
    </div>
  );
}
