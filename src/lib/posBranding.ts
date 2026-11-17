/** How the business's tills look (Channels > POS). Tills read it on their next sync; the colour maths mirrors the till's
 * (shopconnect-pos lib/theme/brand_colors.dart) so the preview shows what the till will. */
export type PosBranding = {
  app_name: string;
  /** "#RRGGBB": buttons, links, highlights. Must contrast 3:1 with white (the server checks). */
  primary_color: string;
  /** "#RRGGBB" or null: a dark shade of the brand colour. Must contrast 4.5:1 with white. */
  sidebar_color: string | null;
  logo_url: string | null;
  /** Read-only: DAAP's super admin shows or hides the mark per business. */
  show_powered_by: boolean;
  version: number;
};

export type PosBrandingInput = Partial<
  Pick<PosBranding, "app_name" | "primary_color" | "sidebar_color" | "logo_url">
>;

export const MAX_APP_NAME = 24;

export const BRAND_PRESETS = [
  { key: "#2F6FED", name: "DAAP blue" },
  { key: "#0F9D58", name: "Green" },
  { key: "#0F766E", name: "Teal" },
  { key: "#C2410C", name: "Orange" },
  { key: "#B91C1C", name: "Red" },
  { key: "#800020", name: "Maroon" },
  { key: "#7C3AED", name: "Violet" },
  { key: "#334155", name: "Slate" },
];

const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (v: string) => HEX.test(v);

type Rgb = [number, number, number];
const toRgb = (hex: string): Rgb =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const toHex = ([r, g, b]: Rgb) =>
  "#" +
  [r, g, b]
    .map((c) => Math.round(c).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

function luminance(hex: string) {
  const [r, g, b] = toRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string) {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function toHsl([r, g, b]: Rgb): Rgb {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h =
    max === rr
      ? 60 * (((gg - bb) / d) % 6)
      : max === gg
        ? 60 * ((bb - rr) / d + 2)
        : 60 * ((rr - gg) / d + 4);
  return [(h + 360) % 360, s, l];
}

function fromHsl([h, s, l]: Rgb): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

/** The sidebar the till draws when none is chosen: the brand colour's hue, very dark. */
export function deriveSidebar(primary: string) {
  const [h, s] = toHsl(toRgb(primary));
  return toHex(fromHsl([h, Math.min(s * 0.7, 0.7), 0.13]));
}

/** The brand colour as the till shows it on the sidebar ("POS" of the name): lightened until it reads. */
export function readableOn(color: string, bg: string) {
  const [h, s, l0] = toHsl(toRgb(color));
  let l = l0;
  let out = color;
  while (contrast(out, bg) < 4.5 && l < 0.95) {
    l = Math.min(l + 0.05, 1);
    out = toHex(fromHsl([h, s, l]));
  }
  return out;
}

/** What the till will show for these values (the preview). DAAP's own blue keeps its navy, as on the till. */
export function tillColors(primary: string, sidebar: string | null) {
  const p = isHex(primary) ? primary : "#2F6FED";
  const daap = p.toUpperCase() === "#2F6FED" && !sidebar;
  const bg = daap
    ? "#0B1739"
    : sidebar && isHex(sidebar)
      ? sidebar
      : deriveSidebar(p);
  return { primary: p, sidebar: bg, accent: daap ? p : readableOn(p, bg) };
}
