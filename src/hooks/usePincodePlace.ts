"use client";

import { useEffect, useState } from "react";
import { staffFetch } from "@/lib/staffAuth";

/** What the pincode directory (India Post data) says about a pincode: its district, its state and, for the few border pincodes, the other
 * states it reaches, plus its post-office names. GET /api/portal/pincodes/{pincode}. */
export type PincodePlace = {
  pincode: string;
  district: string;
  state_code: string;
  state: string;
  states: { code: string; name: string }[];
  localities: string[];
  latitude: number | null;
  longitude: number | null;
};

export const PINCODE_RE = /^[1-9]\d{5}$/;

/** The message GET /api/portal/pincodes/{pincode} answers (404) for a pincode the directory does not list. */
const UNKNOWN_PINCODE = "Unknown pincode.";

// The directory only changes on import, so a pincode is fetched once per page load (null = India Post has no such pincode).
const cache = new Map<string, PincodePlace | null>();

/** The place of a complete pincode. `unknown` is true when the directory has no such pincode (a typo, or a very new one); a network
 * failure is neither found nor unknown. */
export function usePincodePlace(pincode: string) {
  const pin = pincode.replace(/\s/g, "");
  const complete = PINCODE_RE.test(pin);
  const [result, setResult] = useState<{ pin: string; place: PincodePlace | null } | null>(null);

  useEffect(() => {
    if (!complete || cache.has(pin)) return;
    let cancelled = false;
    staffFetch(`/api/portal/pincodes/${pin}`).then((r) => {
      if (cancelled) return;
      if (r.ok) cache.set(pin, r.data as PincodePlace);
      else if (!r.unauthorized && r.error === UNKNOWN_PINCODE) cache.set(pin, null);
      else return;
      setResult({ pin, place: cache.get(pin) ?? null });
    });
    return () => {
      cancelled = true;
    };
  }, [pin, complete]);

  const known = complete ? (cache.has(pin) ? cache.get(pin)! : result?.pin === pin ? result.place : undefined) : undefined;
  return {
    place: known ?? undefined,
    unknown: complete && known === null,
    checking: complete && known === undefined,
  };
}
