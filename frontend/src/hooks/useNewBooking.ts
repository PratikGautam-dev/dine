import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { portalFetch } from "@/lib/portalAuth";
import { toast } from "@/lib/toast";

export type Department = { id: string; name: string };
export type Doctor = { id: string; name: string };
export type Slot = { id: string; label: string };
export type NewBookingContext = {
  departments: Department[];
  doctors_by_department: Record<string, Doctor[]>;
  slots_by_doctor: Record<string, Record<string, Slot[]>>;
};

/** Loads department/slot context + submits the /portal/new-booking staff-created table-reservation
 * form (party size -> section preference -> date/time -> auto-assigned table, the same
 * connector.get_available_table_slots()/create_table_reservation() path the WhatsApp flow uses).
 * The "Doctor Appointment" booking type was removed from this form -- this restaurant doesn't take
 * doctor appointments -- but booking_type="doctor" is left alone server-side, untouched by this. */
export function useNewBooking(ready: boolean) {
  const router = useRouter();
  const [ctx, setCtx] = useState<NewBookingContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [specialRequest, setSpecialRequest] = useState("");
  const [departmentId, setDepartmentIdRaw] = useState("");
  const [slotId, setSlotId] = useState("");

  const [partySize, setPartySizeRaw] = useState<number | "">("");
  const [tableSlots, setTableSlots] = useState<Slot[] | null>(null);
  const [loadingTableSlots, setLoadingTableSlots] = useState(false);

  const load = useCallback(async () => {
    const result = await portalFetch("/api/portal/new-booking/context");
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else setError(result.error);
      return;
    }
    setCtx(result.data as NewBookingContext);
  }, [router]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  function setDepartmentId(id: string) {
    setDepartmentIdRaw(id);
    setSlotId("");
    setTableSlots(null);
  }

  function setPartySize(n: number | "") {
    setPartySizeRaw(n);
    setSlotId("");
    setTableSlots(null);
  }

  const loadTableSlots = useCallback(async () => {
    if (!partySize || partySize < 1) return;
    setLoadingTableSlots(true);
    setTableSlots(null);
    const params = new URLSearchParams({ party_size: String(partySize) });
    if (departmentId) params.set("department_id", departmentId);
    const result = await portalFetch(`/api/portal/new-booking/table-slots?${params.toString()}`);
    setLoadingTableSlots(false);
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else toast.error("Couldn't load slots", result.error);
      return;
    }
    const data = result.data as { slots: Slot[] };
    setTableSlots(data.slots);
  }, [partySize, departmentId, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrors([]);
    const body = {
      booking_type: "table",
      patient_name: patientName, patient_phone: patientPhone,
      party_size: partySize, department_id: departmentId || null, slot_id: slotId,
      special_request: specialRequest || null,
    };
    const result = await portalFetch("/api/portal/new-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSubmitting(false);
    if (!result.ok) {
      if (result.unauthorized) router.push("/portal/login");
      else {
        setErrors([result.error]);
        toast.error("Couldn't create booking", result.error);
      }
      return;
    }
    const data = result.data as { errors?: string[] };
    if (data.errors?.length) {
      setErrors(data.errors);
      toast.error("Couldn't create booking", data.errors[0]);
      return;
    }
    toast.success("Booking created");
    setSuccess(true);
  }

  return {
    ctx, error, errors, submitting, success,
    patientName, setPatientName, patientPhone, setPatientPhone,
    specialRequest, setSpecialRequest,
    departmentId, setDepartmentId, slotId, setSlotId,
    partySize, setPartySize, tableSlots, loadingTableSlots, loadTableSlots,
    handleSubmit,
  };
}
