"use client";

// "My Orders" is now a tab on the account page (src/app/(storefront)/order/account/page.tsx's
// Order History tab, same real GET /api/public/orders data). This route stays as a thin redirect
// so any existing bookmarks/links to /order/orders keep working instead of 404ing.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OrdersRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/order/account?tab=orders");
  }, [router]);
  return null;
}
