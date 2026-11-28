import { redirect } from "next/navigation";

/** "Food Orders" became "Orders" (every channel, /portal/orders). Old links and bookmarks keep working, with their query. */
export default async function FoodOrdersMoved({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) {
    for (const value of Array.isArray(v) ? v : v === undefined ? [] : [v]) params.append(k, value);
  }
  const query = params.toString();
  redirect(`/portal/orders${query ? `?${query}` : ""}`);
}
