// bookingData.ts -- ported verbatim from dine-client's lib/booking.ts (the static slot/seating/
// occasion data plus the pure availability-math helpers the booking page uses). Only the Tailwind
// token strings baked into `tagTone` got the `sf-` prefix inserted; every other value, including
// the deterministic `getSlotState` hash, is unchanged so the UI behaves identically to dine-client.
//
// MOCK_OUTLET is NOT from dine-client's lib/booking.ts -- it stands in for the single "selectedOutlet"
// dine-client's AppContext provided everywhere (brand/branch/address/rating/etc.). dine-connect has
// no such concept (it's a marketplace of many real restaurants, see Header.tsx's own note on this),
// and /order/book-table is a standalone route not nested under any one restaurant's slug, so there is
// no real outlet to read here. Table booking has no backend in this app yet, so this page is pure
// static/local UI -- this placeholder keeps that verbatim visual port self-contained without
// resurrecting AppContext or inventing a fake API call.
export const MOCK_OUTLET = {
  id: 'tossin-kora4',
  brand: 'Tossin Pizza',
  branch: 'Koramangala 4th Block',
  address: 'Koramangala 4th Block (100ft Road)',
  eta: '25-30 mins',
  isOpen: true,
  services: ['Delivery', 'Takeaway', 'Dine-in'] as const,
  rating: 4.8,
  reviewsCount: '3.4k',
  cuisine: 'Artisan Italian',
  image:
    'https://lh3.googleusercontent.com/aida-public/AB6AXuCLQEUxKPcMc0isNFhJQJVJYuN2CUqjIqsA9eumSFxItWAP_fqBgb8VczD-3UnBGeDY6ZvgNW8yP86hBvSsx2Ac4fRjcqRvK3Y23h8w0MUxgFpD99HSG_kVRDnd2dG4cUY6idTpSFbLC9EGo9OzKeSxTtOvhzghCEKgeaxNVutl7jzUQHzi670nRTg1NnWrIwemCfvp6_sCRpyzn1BzE3ehg8oOo_T6vfAV5_G_FEg',
};

// Ported from dine-client's lib/checkout.ts -- only the two bits the booking components need
// (the guest-details form's phone/email validation), not the whole checkout module (unrelated to
// this page and not ported here).
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidPhone(value: string) {
  return /^\d{10}$/.test(value);
}

export interface PartyOption {
  id: string;
  label: string;
  sub: string;
  min: number;
  max: number;
}

export interface SeatingArea {
  id: string;
  name: string;
  description: string;
  tag: string;
  tagTone: string;
  image: string;
  minGuests: number;
  maxGuests: number;
}

export interface TimeSlot {
  id: string;
  label: string;
  /** Minutes after midnight */
  minutes: number;
  meal: 'lunch' | 'dinner';
}

export interface BookingDay {
  key: string;
  tag: string;
  label: string;
  /** Used in summaries, e.g. "Tonight, Oct 24" */
  summary: string;
}

export interface SlotState {
  tablesLeft: number;
  bookable: boolean;
}

export interface ConfirmedBooking {
  ref: string;
  brand: string;
  branch: string;
  outletId: string;
  dateSummary: string;
  slotLabel: string;
  guestsLabel: string;
  areaName: string;
  name: string;
  phone: string;
  occasion: string;
  preorderCount: number;
  preorderTotal: number;
}

export const GRACE_HOLD_MINUTES = 15;
/** Slots starting sooner than this from now can no longer be booked online */
export const BOOKING_CUTOFF_MINUTES = 30;
export const MAX_ADVANCE_DAYS = 60;

export const PARTY_OPTIONS: PartyOption[] = [
  { id: '1', label: '1 Person', sub: 'Solo Hearth', min: 1, max: 1 },
  { id: '2', label: '2 Guests', sub: 'Date / Couple', min: 2, max: 2 },
  { id: '3-4', label: '3-4 Guests', sub: 'Standard Table', min: 3, max: 4 },
  { id: '5-6', label: '5-6 Guests', sub: 'Family Table', min: 5, max: 6 },
  { id: '7-10', label: '7-10 Guests', sub: 'Party Booth', min: 7, max: 10 },
  { id: '10+', label: '10+ Guests', sub: 'Private Room', min: 11, max: 30 },
];

export const SEATING_AREAS: SeatingArea[] = [
  {
    id: 'alfresco',
    name: 'Outdoor Alfresco Patio',
    description: 'Breezy garden seating, pet-friendly',
    tag: 'Live Acoustic Tonight',
    tagTone: 'text-sf-veg-green',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBe0aOE8R5A3qiHzpS9YvruZo2JGskxTnlXInzqofUUGNGN_pAfrQA8UM8V6lBZWPXyDzOaqFo2Imfbbwyc3s1iGynOAXI1bksHIgGfxp6qtBbi43nuEjdLrcSZomhPlSuBrVnhL5Es1w2-AjUanB5LbHJZ7hxkWUkaHdDZds7VE5Qd-M6408tq3NE_RSmlqHGpQrcgcXA3bvWMuj8nIDpeqY0Sih-SvW697NqSSWk',
    minGuests: 1,
    maxGuests: 10,
  },
  {
    id: 'indoor',
    name: 'Indoor AC Dining',
    description: 'Cozy, ambient woodfire aroma & jazz',
    tag: 'Chilled Climate Control',
    tagTone: 'text-sf-text-muted',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBEEiJ_jhpTlwUTBmkkcemPNOfyD-F1nRgZTWIwVJ0DvESUptu1gYy5o_FqqNy287itbhJyexCBvZdVxFN5PkFXYqdJo_yVMKSb5GGv4tAM3EB4Bd-TbBn3aOhYA2TaeSbs1OU8Lr51ahYgnjKHzmfofWHdMvf_YOWIlsdH5ALJLuGrWgCgHReGv9XFB-mzNUi_aivphUpipdTJptyGMsLbxlwHQgNykWKxzy2bIyk',
    minGuests: 1,
    maxGuests: 10,
  },
  {
    id: 'hearth',
    name: "Chef's Hearth Counter",
    description: 'Front-row view of live oven baking',
    tag: "Chef's Table Experience",
    tagTone: 'text-sf-rating-amber',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAGNCf2UbVJucXfKibWCBtVc-pqkvP250nMhI8n67f0VapmEhUm91mlXw6CRBZtAihghMusTSoMnzzYqfmsHigsOsjbgddH5fI8ReKtpTFcUg1Z9EX9Rsd0TKrxqpLCespNuCwTn9Q0-idpv8QOa_zgtMo3Jdw1gSQAsmt115WU-jKto0wteDGpvk5fWxISzbgHEOj1f9fXpxZ9YNAxbKOQfeSa_8JryHwrLaw_swE',
    minGuests: 1,
    maxGuests: 4,
  },
  {
    id: 'mezzanine',
    name: 'Private Mezzanine',
    description: 'Quiet, intimate business or gala setup',
    tag: 'Acoustic Privacy',
    tagTone: 'text-sf-text-muted',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCaqtvX8MhzXAA1o-DoMcPue-39HUnlhjfrr8zDZc9_YHMxx8NgNyeVTYdWahdzgyVpRRJoKha3R4NP_2raJOMeDrfTxxzBRTUouguNLVM9PWgRU29zO9DL_kbMK03j8TY11k6O41nwTkm07mA_ea5jHhdIBA6I9hnhRSqDcJ0VAqhEnOdxe-36G6jXtBf5yf_aeywzNoq1acIbZOKJnuyxU1iPIj0zps5-R563wmU',
    minGuests: 4,
    maxGuests: 30,
  },
];

export const AMBIENCE_IMAGES = [
  {
    label: 'Live Hearth Oven',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDNF4p5uCZN25rJms7S5hg6KeexNxI764fINngnSZqBnQjK9cyu5MaGirHGuQyoE-Xw4ZVzhMrMZ2Gy9tlrXxC0yPh1HEXGcP-ZbQEdsDbrl6Hqpox-9qK4XytD7ZGM1oRy6NdNEN26qb6iiSS3H1IkBvUxDE_Ioe4VewrowSCT7wwAp7Kx7IyztrbilDkGTQNgPdDvadKHTEwO5mMI-a8KG4-F4LhagpNkqskD4c8',
  },
  {
    label: 'Live Acoustic Set',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBPkWiygnaEGf1Z6eMicBHE42ouO-lI4vqvuErchjSFzhR5j33zSomdA0UY9mnMeX9cxRMew1dzazhUVqBskykEXvlGszGHSY4Vm7751ZLi5gq1zQeEifa5x5uVoZyfyCbwis9FTRgoFtLMYmiZhpzzbrFy1VT-01BX6-1K5-PulYRi53-shHG8n5pPSpfkb945Y34E4IW-Qq5-hdUyEUfmzU91zYQ_zaYt52rmlXA',
  },
];

export const DINNER_SLOTS: TimeSlot[] = [
  { id: '19:00', label: '7:00 PM', minutes: 19 * 60, meal: 'dinner' },
  { id: '19:30', label: '7:30 PM', minutes: 19 * 60 + 30, meal: 'dinner' },
  { id: '20:00', label: '8:00 PM', minutes: 20 * 60, meal: 'dinner' },
  { id: '20:30', label: '8:30 PM', minutes: 20 * 60 + 30, meal: 'dinner' },
  { id: '21:00', label: '9:00 PM', minutes: 21 * 60, meal: 'dinner' },
  { id: '21:30', label: '9:30 PM', minutes: 21 * 60 + 30, meal: 'dinner' },
];

export const LUNCH_SLOTS: TimeSlot[] = [
  { id: '12:30', label: '12:30 PM', minutes: 12 * 60 + 30, meal: 'lunch' },
  { id: '13:00', label: '1:00 PM', minutes: 13 * 60, meal: 'lunch' },
  { id: '13:30', label: '1:30 PM', minutes: 13 * 60 + 30, meal: 'lunch' },
  { id: '14:00', label: '2:00 PM', minutes: 14 * 60, meal: 'lunch' },
  { id: '14:30', label: '2:30 PM', minutes: 14 * 60 + 30, meal: 'lunch' },
];

export const ALL_SLOTS = [...LUNCH_SLOTS, ...DINNER_SLOTS];

export const OCCASIONS = [
  'Casual Dining',
  'Date Night 🕯️',
  'Birthday Celebration 🎂',
  'Anniversary 🥂',
  'Business Dinner',
];

export const ACCOMMODATIONS = [
  { id: 'view', label: 'Window / Garden view' },
  { id: 'high-chair', label: 'Child high chair' },
  { id: 'candle', label: "Chef's dessert candle spark" },
];

const MONTH_DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const WEEKDAY_MONTH_DAY = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

export function toDayKey(date: Date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export function fromDayKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function buildBookingDay(key: string, todayKey: string): BookingDay {
  const date = fromDayKey(key);
  const today = fromDayKey(todayKey);
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  const weekday = date.getDay();
  const isWeekend = weekday === 0 || weekday === 6;

  let tag: string;
  let prefix: string;
  if (diffDays === 0) {
    tag = 'TODAY';
    prefix = 'Today';
  } else if (diffDays === 1) {
    tag = 'TOMORROW';
    prefix = 'Tomorrow';
  } else {
    tag = isWeekend ? 'WEEKEND' : date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
    prefix = date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  return {
    key,
    tag,
    label: WEEKDAY_MONTH_DAY.format(date),
    summary: `${prefix}, ${MONTH_DAY.format(date)}`,
  };
}

/** The next few days shown as quick-pick chips, starting today */
export function buildQuickDays(todayKey: string, count = 4): BookingDay[] {
  const today = fromDayKey(todayKey);
  return Array.from({ length: count }, (_, i) => {
    const next = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    return buildBookingDay(toDayKey(next), todayKey);
  });
}

function hash(value: string) {
  let h = 0;
  for (const char of value) h = (h * 31 + char.charCodeAt(0)) >>> 0;
  return h;
}

interface SlotStateInput {
  dayKey: string;
  todayKey: string;
  /** Minutes after midnight, local time */
  nowMinutes: number;
  slot: TimeSlot;
  partyIndex: number;
}

/**
 * Prototype availability: deterministic per day/slot/party size so the UI is stable
 * between renders. Larger parties find fewer free tables.
 */
export function getSlotState({ dayKey, todayKey, nowMinutes, slot, partyIndex }: SlotStateInput): SlotState {
  const base = hash(`${dayKey}-${slot.id}`) % 7;
  const tablesLeft = Math.max(0, base - Math.floor(partyIndex / 2));
  const isPast = dayKey === todayKey && slot.minutes <= nowMinutes + BOOKING_CUTOFF_MINUTES;
  return { tablesLeft, bookable: tablesLeft > 0 && !isPast };
}

export function isAreaSuitable(area: SeatingArea, party: PartyOption) {
  return area.minGuests <= party.max && area.maxGuests >= party.min;
}
