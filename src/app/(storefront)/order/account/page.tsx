"use client";

// Ported from dine-client's app/account/page.tsx. Gated behind real login (redirects to
// /order/login?next=/order/account when logged out, same pattern orders/[id]/page.tsx already
// used). Order History, Profile/Addresses, Membership tiers, Credits ledger, and Favourites are
// all REAL now (useAccountProfile.ts, useAccountLoyalty.ts) -- only each tab's surrounding
// decorative copy was ever mock; the underlying data (loyalty_tier/points, loyalty_transactions,
// real order history) already existed in the backend.
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
import type { AccountTab } from "@/lib/account";
import { getCustomerToken } from "@/lib/customerAuth";
import { useCart } from "@/lib/cart";
import { useAccountProfile } from "@/lib/useAccountProfile";
import { useAccountFavorites, useAccountLoyalty, useAccountLoyaltyLedger } from "@/lib/useAccountLoyalty";

export default function AccountPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<AccountTab>("orders");
  const { cart } = useCart();
  const { profile, loading, saving, saveProfile, addingAddress, addAddress, deletingAddressId, deleteAddress } =
    useAccountProfile(ready, cart.slug);
  const { loyalty } = useAccountLoyalty(ready, cart.slug);
  const { transactions } = useAccountLoyaltyLedger(ready, cart.slug);
  const { dishes } = useAccountFavorites(ready);

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

  function goToTab(next: AccountTab) {
    setTab(next);
    document.getElementById("account-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!ready || loading || !profile) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        <div className="h-40 animate-pulse rounded-2xl bg-sf-surface-container-low" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 pb-20 sm:px-8">
      <div className="mb-8 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
        <ProfileCard profile={profile} onEdit={() => goToTab("settings")} onManageAddresses={() => goToTab("addresses")} />
        <MembershipCard loyalty={loyalty} />
        <CreditsCard loyalty={loyalty} onOpenLedger={() => goToTab("ledger")} />
      </div>

      <div id="account-tabs" className="scroll-mt-24">
        <AccountTabs active={tab} onChange={setTab} />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div id="account-panel" role="tabpanel" aria-labelledby={`account-tab-${tab}`} className="lg:col-span-8">
          {tab === "orders" && <OrderHistory />}
          {tab === "membership" && <MembershipTab loyalty={loyalty} />}
          {tab === "ledger" && (
            <Card className="p-6">
              <CreditsActivity transactions={transactions} />
            </Card>
          )}
          {tab === "addresses" && (
            <AddressesTab
              addresses={profile.addresses}
              adding={addingAddress}
              onAdd={addAddress}
              deletingId={deletingAddressId}
              onDelete={deleteAddress}
            />
          )}
          {tab === "favorites" && <FavoritesTab dishes={dishes} />}
          {tab === "settings" && <SettingsTab profile={profile} saving={saving} onSave={saveProfile} />}
        </div>

        <aside className="lg:col-span-4">
          <AccountSidebar loyalty={loyalty} transactions={transactions} onViewLedger={() => goToTab("ledger")} />
        </aside>
      </div>
    </div>
  );
}
