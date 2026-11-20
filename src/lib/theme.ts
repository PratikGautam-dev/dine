/** Portal theming: turns one brand colour into the --brand-50..900 scale the whole UI already reads, and
 * applies it (plus an optional sidebar colour) as CSS variables on <html>. */

export type Branding = {
  primary_color?: string | null;
  sidebar_color?: string | null;
  logo_url?: string | null;
};

/** The colour the app ships with (matches --brand-600 in globals.css). */
export const DEFAULT_BRAND = "#e21220";

export const BRAND_PRESETS = [
  "#e21220",
  "#2f6fe4",
  "#16a05a",
  "#167a76",
  "#c2491b",
  "#7f0a2e",
  "#7c3aed",
  "#374766",
];

const CACHE_KEY = "portal_branding";
const SCALE = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

export function normalizeHex(input: string): string | null {
  const v = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(v)) return `#${v.split("").map((c) => c + c).join("").toLowerCase()}`;
  if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v.toLowerCase()}`;
  return null;
}

function toRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("")}`;
}

function mix(hex: string, target: [number, number, number], amount: number): string {
  const c = toRgb(hex);
  return toHex(c.map((x, i) => x + (target[i] - x) * amount) as [number, number, number]);
}

/** WCAG contrast ratio of white text on this colour. */
export function contrastWithWhite(hex: string): number {
  const lin = toRgb(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return 1.05 / (lum + 0.05);
}

export function brandScale(hex: string): Record<(typeof SCALE)[number], string> {
  const white: [number, number, number] = [255, 255, 255];
  const black: [number, number, number] = [0, 0, 0];
  return {
    50: mix(hex, white, 0.95),
    100: mix(hex, white, 0.88),
    200: mix(hex, white, 0.76),
    300: mix(hex, white, 0.58),
    400: mix(hex, white, 0.3),
    500: mix(hex, white, 0.12),
    600: hex,
    700: mix(hex, black, 0.21),
    800: mix(hex, black, 0.4),
    900: mix(hex, black, 0.58),
  };
}

/** Sets (or, for empty values, clears) the theme variables. Safe to call repeatedly. */
export function applyBranding(b: Branding | null | undefined) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const primary = b?.primary_color ? normalizeHex(b.primary_color) : null;
  const sidebar = b?.sidebar_color ? normalizeHex(b.sidebar_color) : null;
  for (const step of SCALE) {
    if (primary) root.style.setProperty(`--brand-${step}`, brandScale(primary)[step]);
    else root.style.removeProperty(`--brand-${step}`);
  }
  if (sidebar) root.style.setProperty("--sidebar", sidebar);
  else root.style.removeProperty("--sidebar");
}

export function readCachedBranding(): Branding | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Branding) : null;
  } catch {
    return null;
  }
}

export function cacheBranding(b: Branding) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(b));
  } catch {
    /* storage unavailable */
  }
}
