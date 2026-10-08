// Ported from dine-client's components/booking/BookingConfirmation.tsx -- fully static/visual,
// just sf- token renaming; the booking this reads is the local fake confirmation object the
// book-table page builds via setTimeout (no backend exists for table reservations yet).
import Link from "next/link";
import { GRACE_HOLD_MINUTES, type ConfirmedBooking } from "./bookingData";

export function BookingConfirmation({ booking }: { booking: ConfirmedBooking }) {
  const rows = [
    { icon: "storefront", label: "Outlet", value: `${booking.brand}, ${booking.branch}` },
    { icon: "event", label: "Date & time", value: `${booking.dateSummary} • ${booking.slotLabel}` },
    { icon: "group", label: "Party & area", value: `${booking.guestsLabel} • ${booking.areaName}` },
    { icon: "person", label: "Booked for", value: `${booking.name} • +91 ${booking.phone}` },
  ];

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-sf-border-divider/60 bg-sf-surface p-6 text-center shadow-[0_2px_8px_rgba(0,0,0,0.06)] sm:p-10">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-sf-veg-green/10 text-sf-veg-green">
        <span className="material-symbols-outlined text-[36px]" style={{ fontVariationSettings: "'FILL' 1" }}>
          check_circle
        </span>
      </div>
      <h1 className="font-sf-headline text-2xl font-bold text-sf-on-surface sm:text-3xl">Your table is booked!</h1>
      <p className="mt-2 font-sf-body text-sm text-sf-text-body">
        We&apos;ll hold it for {GRACE_HOLD_MINUTES} minutes past your reserved time. Show the code below at the host counter.
      </p>

      <div className="mt-5 inline-flex flex-col items-center rounded-xl border-2 border-dashed border-sf-primary/40 bg-sf-primary-light/40 px-8 py-3">
        <span className="font-sf-body text-[11px] font-bold uppercase tracking-wider text-sf-text-muted">Check-in code</span>
        <span className="font-mono text-2xl font-bold tracking-widest text-sf-primary">{booking.ref}</span>
      </div>

      <dl className="mt-7 space-y-3.5 rounded-xl bg-sf-surface-container-low/70 p-4 text-left">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-3">
            <span className="material-symbols-outlined mt-0.5 text-[20px] text-sf-primary">{row.icon}</span>
            <div className="min-w-0">
              <dt className="font-sf-body text-[11px] font-bold uppercase tracking-wider text-sf-text-muted">{row.label}</dt>
              <dd className="font-sf-body text-sm font-semibold text-sf-on-surface">{row.value}</dd>
            </div>
          </div>
        ))}
        {booking.occasion && (
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined mt-0.5 text-[20px] text-sf-primary">celebration</span>
            <div>
              <dt className="font-sf-body text-[11px] font-bold uppercase tracking-wider text-sf-text-muted">Occasion</dt>
              <dd className="font-sf-body text-sm font-semibold text-sf-on-surface">{booking.occasion}</dd>
            </div>
          </div>
        )}
        {booking.preorderCount > 0 && (
          <div className="flex items-center justify-between border-t border-sf-border-divider pt-3">
            <span className="font-sf-body text-sm font-bold text-sf-on-surface">
              Pre-ordered {booking.preorderCount} {booking.preorderCount === 1 ? "item" : "items"}
            </span>
            <span className="font-sf-headline text-lg font-bold text-sf-primary">₹{booking.preorderTotal}</span>
          </div>
        )}
      </dl>
      {booking.preorderCount > 0 && (
        <p className="mt-2 font-sf-body text-xs text-sf-text-muted">Billed at the restaurant checkout. Nothing was charged today.</p>
      )}

      <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href="/order"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-sf-primary px-6 font-sf-body text-sm font-bold text-sf-on-primary shadow-md transition-colors hover:bg-sf-secondary sm:w-auto"
        >
          <span className="material-symbols-outlined text-[18px]">restaurant_menu</span>
          Browse restaurants
        </Link>
        <Link
          href="/order"
          className="flex h-11 w-full items-center justify-center rounded-xl bg-sf-surface-container-low px-6 font-sf-body text-sm font-bold text-sf-on-surface transition-colors hover:bg-sf-surface-container-high sm:w-auto"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
