import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { z } from "zod";

/* The one phone rule, the same as the server's (shopconnect-backend/core/phone.py, also on libphonenumber). The server stays the
 * authority; this only lets a form say what is wrong before it is sent. Numbers are sent and stored in E.164 ("+919876543210").
 *   "mobile" -- people (customers, staff, riders, delivery recipients): WhatsApp, SMS and calls reach them.
 *   "any"    -- the business, branches, suppliers: a mobile or a landline with its STD code ("0612 2345678").
 * Only ALLOWED_COUNTRIES for now; a number typed without "+" is read as DEFAULT_COUNTRY. */
export const DEFAULT_COUNTRY = "IN" as const;
export const ALLOWED_COUNTRIES: readonly string[] = ["IN"];
export const COUNTRY_PREFIX = "+91";

export type PhoneKind = "mobile" | "any";

export const PHONE_MESSAGES = {
  mobile: "Enter a valid 10-digit mobile number.",
  landline: "Enter a mobile number (this one looks like a landline).",
  any: "Enter a valid phone number (mobile, or landline with its STD code).",
  country: "Only Indian (+91) numbers are supported for now.",
  required: "Phone number is required.",
} as const;

const MOBILE_TYPES = new Set(["MOBILE", "FIXED_LINE_OR_MOBILE"]);
const ANY_TYPES = new Set([
  ...MOBILE_TYPES,
  "FIXED_LINE",
  "VOIP",
  "TOLL_FREE",
  "UAN",
]);

/** `raw` as E.164 when it is a valid number of this kind, else the reason to show. */
export function checkPhone(
  raw: string,
  kind: PhoneKind = "mobile",
): { e164: string; error?: undefined } | { e164?: undefined; error: string } {
  let text = raw.trim();
  if (text.startsWith("00")) text = `+${text.slice(2)}`; // "0091 98765 43210"
  const number = parsePhoneNumberFromString(text, DEFAULT_COUNTRY);
  if (!number || !number.isValid()) return { error: PHONE_MESSAGES[kind] };
  if (!number.country || !ALLOWED_COUNTRIES.includes(number.country))
    return { error: PHONE_MESSAGES.country };
  const type = number.getType() ?? "";
  if (kind === "mobile" && !MOBILE_TYPES.has(type))
    return {
      error:
        type === "FIXED_LINE" ? PHONE_MESSAGES.landline : PHONE_MESSAGES.mobile,
    };
  if (kind === "any" && !ANY_TYPES.has(type))
    return { error: PHONE_MESSAGES.any };
  return { e164: number.number };
}

/** For people to read: "+91 98765 43210", "+91 612 234 5678". A value that does not parse is shown as it is; null/blank as "". */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return "";
  const number = parsePhoneNumberFromString(value, DEFAULT_COUNTRY);
  return number?.isValid() ? number.formatInternational() : value;
}

/** What a phone field shows while editing: the number without the country prefix (the input shows "+91" itself), "98765 43210". */
export function phoneForInput(value: string | null | undefined): string {
  if (!value) return "";
  const number = parsePhoneNumberFromString(value, DEFAULT_COUNTRY);
  return number?.isValid() && number.country === DEFAULT_COUNTRY
    ? number.formatNational().replace(/^0/, "")
    : value;
}

/** A zod field: what was typed in, E.164 out. `required: false` turns blank into null (clears the number). */
export function phoneField(kind: PhoneKind, { required = true } = {}) {
  return z.string().transform((value, ctx) => {
    if (!value.trim()) {
      if (required)
        ctx.addIssue({ code: "custom", message: PHONE_MESSAGES.required });
      return null as unknown as string;
    }
    const result = checkPhone(value, kind);
    if (result.error) {
      ctx.addIssue({ code: "custom", message: result.error });
      return z.NEVER;
    }
    return result.e164!;
  });
}

/** For forms that check by hand: the message to show, or undefined when it is fine. Blank is fine unless `required`. */
export function phoneError(
  value: string,
  kind: PhoneKind = "mobile",
  { required = false } = {},
): string | undefined {
  if (!value.trim()) return required ? PHONE_MESSAGES.required : undefined;
  return checkPhone(value, kind).error;
}

/** E.164 for sending, or null for blank. Call only after phoneError said it is fine. */
export function toE164(
  value: string,
  kind: PhoneKind = "mobile",
): string | null {
  return value.trim() ? (checkPhone(value, kind).e164 ?? value.trim()) : null;
}
