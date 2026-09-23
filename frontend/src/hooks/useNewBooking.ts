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

export type BookingType = "table" | "doctor";

/** Loads department/doctor/slot context + submits the /portal/new-booking
 * staff-created booking form. Two distinct booking types, chosen explicitly
 * up front rather than guessed from hospital type (Table Reservation --
 * party size -> section preference -> date/time -> auto-assigned table,
 * same connector.get_available_table_slots()/create_table_reservation()
 * path the WhatsApp flow uses; Doctor Appointment -- the original
 * department/doctor/slot flow, kept for any hospital still using a custom
 * appointment type that routes through it). */
export function useNewBooking(ready: boolean) {
  const router = useRouter();
  const [ctx, setCtx] = useState<NewBookingContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const [bookingType, setBookingTypeRaw] = useState<BookingType>("table");

  const [patientName, setPatientName] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [specialRequest, setSpecialRequest] = useState("");
  const [departmentId, setDepartmentIdRaw] = useState("");
  const [doctorId, setDoctorIdRaw] = useState("");
  const [date, setDateRaw] = useState("");
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

  function setBookingType(type: BookingType) {
    setBookingTypeRaw(type);
    setDepartmentIdRaw("");
    setDoctorIdRaw("");
    setDateRaw("");
    setSlotId("");
    setPartySizeRaw("");
    setTableSlots(null);
  }

  function setDepartmentId(id: string) {
    setDepartmentIdRaw(id);
    setDoctorIdRaw("");
    setDateRaw("");
    setSlotId("");
    setTableSlots(null);
  }

  function setDoctorId(id: string) {
    setDoctorIdRaw(id);
    setDateRaw("");
    setSlotId("");
  }

  function setDate(d: string) {
    setDateRaw(d);
    setSlotId("");
  }

  function setPartySize(n: number | "") {
    setPartySizeRaw(n);
    setSlotId("");
    setTableSlots(null);
  }

  const doctors = departmentId && ctx ? ctx.doctors_by_department[departmentId] || [] : [];
  const datesForDoctor = doctorId && ctx ? Object.keys(ctx.slots_by_doctor[doctorId] || {}).sort() : [];
  const slotsForDate = doctorId && date && ctx ? ctx.slots_by_doctor[doctorId]?.[date] || [] : [];

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
    const body =
      bookingType === "table"
        ? {
            booking_type: "table",
            patient_name: patientName, patient_phone: patientPhone,
            party_size: partySize, department_id: departmentId || null, slot_id: slotId,
            special_request: specialRequest || null,
          }
        : {
            booking_type: "doctor",
            patient_name: patientName, patient_phone: patientPhone,
            department_id: departmentId, doctor_id: doctorId, slot_id: slotId,
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
    bookingType, setBookingType,
    patientName, setPatientName, patientPhone, setPatientPhone,
    specialRequest, setSpecialRequest,
    departmentId, setDepartmentId, doctorId, setDoctorId, date, setDate, slotId, setSlotId,
    doctors, datesForDoctor, slotsForDate,
    partySize, setPartySize, tableSlots, loadingTableSlots, loadTableSlots,
    handleSubmit,
  };
}
