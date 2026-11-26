/** Published Dine POS till releases, as the release workflow writes them to R2 (dine-pos/.github/workflows/release.yml):
 * `latest.json` (the newest) and `index.json` (every release, newest first). Read on the server only: the public R2 address does not
 * allow browser requests from other sites, so the portal asks `/api/pos/latest` instead. Copied from shopconnect-tenant. */
export type ReleaseFile = {
  name: string;
  url: string;
  size: number;
  sha256: string;
};

export type FileKind = "android" | "windows" | "linux_deb" | "linux_tar";

export type PosRelease = {
  version: string;
  date: string;
  notes: string;
  min_version?: string;
  required?: boolean;
  files: Partial<Record<FileKind, ReleaseFile>>;
};

export type Platform = "android" | "windows" | "linux";

/** Where latest.json and index.json live: Dine's public R2 bucket, the same address as dine-pos config/hosted.json RELEASES_URL.
 * POS_RELEASES_URL overrides it (a test folder, or a download domain later). */
const BASE = (
  process.env.POS_RELEASES_URL ?? "https://pub-2992a09c48e1469eb6aa2122dc2fcf89.r2.dev/releases/dine-pos"
).replace(/\/+$/, "");

async function getJson<T>(name: string): Promise<T | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/${name}`, { next: { revalidate: 300 } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export const latestRelease = () => getJson<PosRelease>("latest.json");

export async function releaseHistory(): Promise<PosRelease[]> {
  return (await getJson<{ releases: PosRelease[] }>("index.json"))?.releases ?? [];
}

/** The visitor's platform from their browser, so the page opens on the right download. */
export function platformFromUserAgent(ua: string): Platform {
  if (/android/i.test(ua)) return "android";
  if (/windows/i.test(ua)) return "windows";
  if (/linux|x11/i.test(ua)) return "linux";
  return "windows";
}

export function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

/** -1, 0 or 1 comparing "1.10.0" with "1.9.2" by number, part by part (the till uses the same rule). */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) =>
    v
      .split("+")[0]
      .split(".")
      .map((p) => Number.parseInt(p, 10) || 0);
  const x = parts(a);
  const y = parts(b);
  for (let i = 0; i < 3; i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return Math.sign(d);
  }
  return 0;
}
