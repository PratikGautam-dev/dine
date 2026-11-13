import { fromMinor, type Channel, type Discount } from "@/lib/erp/erp";

const CHANNEL_NAME: Record<Channel, string> = {
  online: "Website",
  pos: "POS",
  whatsapp: "WhatsApp",
};

const rupees = (minor: number) =>
  `₹${Number(fromMinor(minor)).toLocaleString("en-IN")}`;
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/** What the offer is, e.g. "15% off (max ₹500)". */
export function discountOffer(d: Discount): string {
  switch (d.kind) {
    case "percent":
      return `${d.value}% off${d.max_discount_minor ? ` (max ${rupees(d.max_discount_minor)})` : ""}`;
    case "flat":
      return `${rupees(d.value)} off`;
    case "fixed_price":
      return `${rupees(d.value)} each`;
    case "buy_x_get_y":
      return `Buy ${d.buy_quantity ?? 1} get ${d.get_quantity ?? 1}`;
    case "bogo":
      return "Buy one get one";
    case "free_delivery":
      return "Free delivery";
  }
}

/** One line for a review box: offer, scope, minimum order, validity and channels. */
export function discountSummary(d: Discount): string {
  const channels = d.channels.map((c) => CHANNEL_NAME[c]).join(" and ");
  return [
    `${discountOffer(d)} on ${d.category_ids.length || d.collection_ids.length || d.product_ids.length ? "selected products" : "all products"}`,
    d.min_order_minor ? `Min order ${rupees(d.min_order_minor)}` : null,
    d.starts_at || d.ends_at
      ? `Valid ${d.starts_at ? `from ${day(d.starts_at)}` : "now"} ${d.ends_at ? `to ${day(d.ends_at)}` : "with no end"}`
      : null,
    channels ? `Available on ${channels}` : null,
  ]
    .filter(Boolean)
    .join(" • ");
}
