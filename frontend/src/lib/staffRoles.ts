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

// Staff & Access "Add Role": a hospital-created custom role is just another role_permissions.role
// value the backend already treats as a first-class role (portal.permissions.get_permission_matrix()
// groups by whatever it finds, no fixed list) -- these two helpers give it a readable label/badge
// color without needing every one of ROLE_LABEL/ROLE_TONE's call sites to know about custom roles.
const CUSTOM_ROLE_TONES = ["violet", "warning", "success"] as const;

export function roleLabel(role: string): string {
  if (role in ROLE_LABEL) return ROLE_LABEL[role as StaffRole];
  return role.split("_").filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

export function roleTone(role: string): "brand" | "clay" | "neutral" | "violet" | "warning" | "success" {
  if (role in ROLE_TONE) return ROLE_TONE[role as StaffRole];
  let hash = 0;
  for (let i = 0; i < role.length; i++) hash = (hash * 31 + role.charCodeAt(i)) >>> 0;
  return CUSTOM_ROLE_TONES[hash % CUSTOM_ROLE_TONES.length];
}

/** A role's real blurb (ROLE_OPTIONS, the 3 built-ins) or a generic line for a hospital-created
 * custom role -- there's no stored description field for those, so this is the honest fallback. */
export function roleDescription(role: string): string {
  return ROLE_OPTIONS.find((r) => r.value === role)?.blurb ?? "Custom role -- access set from its permission grid.";
}

export const BUILT_IN_ROLES = ROLE_OPTIONS.map((r) => r.value);

/** Built-in roles first (in their fixed display order), then any hospital-created custom roles
 * alphabetically -- the order the role filter dropdown, the permission matrix cards, and the Roles
 * & Permissions page all render roles in. */
export function orderedRoles(matrix: Record<string, unknown> | null): string[] {
  if (!matrix) return [];
  const known = BUILT_IN_ROLES.filter((r) => r in matrix);
  const custom = Object.keys(matrix).filter((r) => !(BUILT_IN_ROLES as readonly string[]).includes(r)).sort();
  return [...known, ...custom];
}
