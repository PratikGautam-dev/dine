import type { StaffRole } from "@/lib/staffAuth";

/** The three roles a restaurant has, in display order. Names match backend/portal/permissions.py. */
export const ROLE_OPTIONS: { value: StaffRole; label: string; blurb: string }[] = [
  { value: "admin", label: "Owner / Manager", blurb: "Everything, including staff, roles and settings." },
  { value: "receptionist", label: "Front of House", blurb: "Reservations, guests, messages and orders. Can't edit the menu or floor plan, or delete." },
  { value: "kitchen", label: "Kitchen Staff", blurb: "Orders and menu availability. Sees reservations read-only." },
];

export const ROLE_LABEL: Record<StaffRole, string> = {
  admin: "Owner / Manager",
  receptionist: "Front of House",
  kitchen: "Kitchen Staff",
  // Retired: no restaurant can hold or assign it any more.
  doctor: "Table manager (retired)",
};

export const ROLE_TONE: Record<StaffRole, "brand" | "clay" | "neutral"> = {
  admin: "brand",
  receptionist: "clay",
  kitchen: "neutral",
  doctor: "neutral",
};
