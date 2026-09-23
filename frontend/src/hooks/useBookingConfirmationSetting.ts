import { useCallback, useEffect, useState } from "react";
import { portalFetch } from "@/lib/portalAuth";
import { toast } from "@/lib/toast";

/** Settings > Booking Rules' own toggle for require_booking_confirmation (Table Bookings follow-up)
 * -- its own save action, same "separate write path, its own sub-form" precedent
 * useRestaurantHours() already sets for the operating-hours group. Off (default) is today's
 * behavior unchanged; on, a new WhatsApp booking lands 'pending' until staff confirm it. */
export function useBookingConfirmationSetting(ready: boolean) {
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const result = await portalFetch("/api/portal/settings");
    if (result.ok) setEnabled(Boolean((result.data as { require_booking_confirmation?: boolean }).require_booking_confirmation));
  }, []);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  async function toggle(next: boolean) {
    setEnabled(next);
    setSaving(true);
    const result = await portalFetch("/api/portal/settings/booking-confirmation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ require_booking_confirmation: next }),
    });
    setSaving(false);
    if (!result.ok) {
      setEnabled(!next);
      if (!result.unauthorized) toast.error("Couldn't save", result.error);
      return;
    }
    toast.success(next ? "Bookings now need staff confirmation" : "Bookings confirm automatically again");
  }

  return { enabled, saving, toggle };
}
