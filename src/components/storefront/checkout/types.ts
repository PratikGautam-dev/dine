// Shared types for the checkout (cart) page's section components -- mirrors exactly what
// src/app/(storefront)/order/cart/page.tsx already sent/received before the re-skin; nothing
// here is new shape, just pulled out so the section components can share it without importing
// from the page itself.

export type FulfillmentType = "pickup" | "delivery";
export type PaymentMethod = "online" | "pay_at_restaurant";

export type CouponPreview = {
  offer_id: number;
  name: string;
  coupon_code: string;
  discount_paise: number;
};
