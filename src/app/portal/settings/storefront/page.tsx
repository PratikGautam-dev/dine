import { redirect } from "next/navigation";

/** The online storefront settings moved to the Website sales channel page (Sales Channels -> Website, "Online storefront" section). */
export default function StorefrontSettingsMovedPage() {
  redirect("/portal/channels/online#online-storefront");
}
