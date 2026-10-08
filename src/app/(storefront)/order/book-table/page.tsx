"use client";

// Ported from dine-client's app/book-table/page.tsx. Fully visual/non-functional on purpose --
// no backend endpoint exists for table reservations in dine-connect yet (explicit product
// decision: port the page anyway, visible from the shared header nav, rather than hide it).
// `selectedOutlet` (AppContext) becomes the static MOCK_OUTLET from bookingData.ts; cart/preorder
// stays the original's empty-cart branch (no real restaurant context on this standalone route);
// the `showToast` calls elsewhere in the booking components were already swapped for this app's
// real `@/lib/toast` when they were ported.
import { useEffect, useMemo, useRef, useState } from "react";
import { BookingHero } from "@/components/storefront/booking/BookingHero";
import { DineInUnavailable } from "@/components/storefront/booking/DineInUnavailable";
import { PartySeatingSection } from "@/components/storefront/booking/PartySeatingSection";
import { DateTimeSection } from "@/components/storefront/booking/DateTimeSection";
import { GuestDetailsSection } from "@/components/storefront/booking/GuestDetailsSection";
import { PreorderSection } from "@/components/storefront/booking/PreorderSection";
import { ReservationSummary } from "@/components/storefront/booking/ReservationSummary";
import { BookingConfirmation } from "@/components/storefront/booking/BookingConfirmation";
import { useNowMinute } from "@/components/storefront/booking/useNowMinute";
import {
  ALL_SLOTS, EMAIL_PATTERN, GRACE_HOLD_MINUTES, MOCK_OUTLET, PARTY_OPTIONS, SEATING_AREAS,
  buildBookingDay, buildQuickDays, getSlotState, isAreaSuitable, isValidPhone, toDayKey,
  type ConfirmedBooking, type SlotState, type TimeSlot,
} from "@/components/storefront/booking/bookingData";

const NO_SLOT_STATE: SlotState = { tablesLeft: 0, bookable: false };

export default function BookTablePage() {
  const nowMinute = useNowMinute();

  const [partyId, setPartyId] = useState("2");
  const [areaId, setAreaId] = useState(SEATING_AREAS[0].id);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [occasion, setOccasion] = useState("");
  const [accommodations, setAccommodations] = useState<string[]>([]);
  const [request, setRequest] = useState("");
  const [includePreorder, setIncludePreorder] = useState(true);
  const [isConfirming, setIsConfirming] = useState(false);
  const [booking, setBooking] = useState<ConfirmedBooking | null>(null);

  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  const clock = useMemo(() => {
    if (nowMinute === null) return null;
    const now = new Date(nowMinute * 60_000);
    return { todayKey: toDayKey(now), nowMinutes: now.getHours() * 60 + now.getMinutes() };
  }, [nowMinute]);

  const days = useMemo(() => (clock ? buildQuickDays(clock.todayKey) : null), [clock]);

  const party = PARTY_OPTIONS.find((p) => p.id === partyId) ?? PARTY_OPTIONS[1];
  const partyIndex = PARTY_OPTIONS.indexOf(party);
  const area = SEATING_AREAS.find((a) => a.id === areaId) ?? SEATING_AREAS[0];

  const activeDayKey = selectedDayKey && clock && selectedDayKey >= clock.todayKey ? selectedDayKey : (clock?.todayKey ?? null);
  const activeDay = clock && activeDayKey ? buildBookingDay(activeDayKey, clock.todayKey) : null;
  const customDay = activeDay && days && !days.some((d) => d.key === activeDay.key) ? activeDay : null;

  const slotState = (slot: TimeSlot): SlotState =>
    clock && activeDayKey
      ? getSlotState({ dayKey: activeDayKey, todayKey: clock.todayKey, nowMinutes: clock.nowMinutes, slot, partyIndex })
      : NO_SLOT_STATE;

  const selectedSlot = ALL_SLOTS.find((s) => s.id === selectedSlotId && slotState(s).bookable) ?? null;

  function handlePartyChange(id: string) {
    setPartyId(id);
    const next = PARTY_OPTIONS.find((p) => p.id === id);
    if (next && !isAreaSuitable(area, next)) {
      const fallback = SEATING_AREAS.find((a) => isAreaSuitable(a, next));
      if (fallback) setAreaId(fallback.id);
    }
  }

  function toggleAccommodation(id: string) {
    setAccommodations((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  }

  // No real restaurant context on this standalone route, so pre-order always has nothing to add
  // (matches PreorderSection's own "always renders the empty-cart branch" scope note).
  const preorderCount = 0;
  const preorderTotal = 0;

  const emailValid = email === "" || EMAIL_PATTERN.test(email);
  const guestValid = name.trim().length > 0 && isValidPhone(phone) && emailValid;

  let blockedHint: string | null = null;
  if (!MOCK_OUTLET.isOpen) blockedHint = `${MOCK_OUTLET.brand} is closed right now.`;
  else if (!selectedSlot) blockedHint = "Choose a date and time slot to continue.";
  else if (!guestValid) blockedHint = emailValid ? "Add your name and a valid mobile number." : "Enter a valid email address or clear it.";
  const canConfirm = blockedHint === null;

  function handleConfirm() {
    if (!canConfirm || isConfirming || !selectedSlot || !activeDay) return;
    setIsConfirming(true);
    const snapshot: Omit<ConfirmedBooking, "ref"> = {
      brand: MOCK_OUTLET.brand,
      branch: MOCK_OUTLET.branch,
      outletId: MOCK_OUTLET.id,
      dateSummary: activeDay.summary,
      slotLabel: selectedSlot.label,
      guestsLabel: party.label,
      areaName: area.name,
      name: name.trim(),
      phone,
      occasion,
      preorderCount,
      preorderTotal,
    };
    confirmTimer.current = setTimeout(() => {
      setBooking({ ...snapshot, ref: `TB${Date.now().toString().slice(-6)}` });
      setIsConfirming(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 1500);
  }

  const tablesLeft = selectedSlot ? slotState(selectedSlot).tablesLeft : null;
  const meal = selectedSlot ? (selectedSlot.meal === "dinner" ? "Dinner" : "Lunch") : null;
  const dateSummary =
    activeDay && selectedSlot?.meal === "dinner" && activeDay.tag === "TODAY"
      ? activeDay.summary.replace("Today", "Tonight")
      : (activeDay?.summary ?? null);

  return (
    <div className="min-h-screen bg-sf-bg-page">
      {booking ? (
        <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-8">
          <BookingConfirmation booking={booking} />
        </div>
      ) : !MOCK_OUTLET.services.includes("Dine-in") ? (
        <>
          <BookingHero outlet={MOCK_OUTLET} />
          <DineInUnavailable outlet={MOCK_OUTLET} />
        </>
      ) : (
        <>
          <BookingHero outlet={MOCK_OUTLET} />

          <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8">
            <div className="mb-6 flex flex-col items-start justify-between gap-3 rounded-xl bg-sf-primary-light p-4 shadow-sm sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sf-primary text-sf-on-primary shadow-sm">
                  <span className="material-symbols-outlined text-[20px]">whatshot</span>
                </span>
                <div>
                  <h2 className="font-sf-body text-base font-bold text-sf-primary">
                    High demand tonight in {MOCK_OUTLET.branch}
                  </h2>
                  <p className="font-sf-body text-xs text-sf-on-surface-variant">
                    {selectedSlot && tablesLeft !== null
                      ? `${tablesLeft} ${tablesLeft === 1 ? "table" : "tables"} remaining for the ${selectedSlot.label} slot. `
                      : "Dinner slots fill up fast. "}
                    Free cancellation up to {GRACE_HOLD_MINUTES} mins prior.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 rounded-lg bg-sf-surface px-3 py-1.5 font-sf-body text-xs font-semibold text-sf-text-body shadow-sm">
                <span className="h-2 w-2 animate-pulse rounded-full bg-sf-veg-green" />
                Instant confirmation enabled
              </div>
            </div>

            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
              <div className="flex flex-col gap-6 lg:col-span-7 xl:col-span-8">
                <PartySeatingSection partyId={partyId} onPartyChange={handlePartyChange} areaId={areaId} onAreaChange={setAreaId} />
                <DateTimeSection
                  days={days}
                  customDay={customDay}
                  todayKey={clock?.todayKey ?? null}
                  activeDayKey={activeDayKey}
                  onSelectDay={setSelectedDayKey}
                  slotState={slotState}
                  selectedSlotId={selectedSlot?.id ?? null}
                  onSelectSlot={setSelectedSlotId}
                />
                <GuestDetailsSection
                  name={name}
                  setName={setName}
                  phone={phone}
                  setPhone={setPhone}
                  email={email}
                  setEmail={setEmail}
                  occasion={occasion}
                  setOccasion={(value) => setOccasion(value === occasion ? "" : value)}
                  accommodations={accommodations}
                  toggleAccommodation={toggleAccommodation}
                  request={request}
                  setRequest={setRequest}
                />
                <PreorderSection includePreorder={includePreorder} setIncludePreorder={setIncludePreorder} outlet={MOCK_OUTLET} />
              </div>

              <aside className="no-scrollbar lg:sticky lg:top-24 lg:col-span-5 lg:max-h-[calc(100vh-120px)] lg:overflow-y-auto xl:col-span-4">
                <ReservationSummary
                  outlet={MOCK_OUTLET}
                  dateSummary={dateSummary}
                  meal={meal}
                  slotLabel={selectedSlot?.label ?? null}
                  guestsLabel={party.label}
                  areaName={area.name}
                  occasion={occasion}
                  preorderCount={preorderCount}
                  preorderTotal={preorderTotal}
                  canConfirm={canConfirm}
                  isConfirming={isConfirming}
                  blockedHint={blockedHint}
                  onConfirm={handleConfirm}
                />
              </aside>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
