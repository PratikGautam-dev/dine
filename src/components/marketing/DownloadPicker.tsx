"use client";

import { Check, Copy, Download } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import {
  formatSize,
  type Platform,
  type PosRelease,
  type ReleaseFile,
} from "@/lib/posReleases";

const TABS: { key: Platform; label: string }[] = [
  { key: "android", label: "Android" },
  { key: "windows", label: "Windows" },
  { key: "linux", label: "Linux" },
];

const STEPS: Record<Platform, string[]> = {
  android: [
    "Open this page on the tablet or phone and tap Download.",
    "Open the downloaded file. If Android asks, allow your browser to install unknown apps.",
    "Tap Install. A newer version installs over the old one and keeps the till's data.",
  ],
  windows: [
    "Download the installer and open it.",
    'If Windows shows "Windows protected your PC", choose More info, then Run anyway.',
    "Follow the steps. The till appears in the Start menu as Dine POS.",
  ],
  linux: [
    "Download the .deb file (Ubuntu, Debian and similar).",
    "Install it: sudo apt install ./dine-pos_*_amd64.deb",
    "Open Dine POS from the applications menu. Other distributions can use the .tar.gz and run dine_pos from it.",
  ],
};

function FileButton({
  file,
  primary,
}: {
  file: ReleaseFile;
  primary: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-space-1">
      <Button
        href={file.url}
        variant={primary ? "primary" : "secondary"}
        size={primary ? "lg" : "md"}
        className="w-full sm:w-auto"
      >
        <Download size={18} /> {file.name}
        <span className="font-normal opacity-80">
          · {formatSize(file.size)}
        </span>
      </Button>
      <button
        type="button"
        onClick={() =>
          navigator.clipboard
            ?.writeText(file.sha256)
            .then(() => setCopied(true))
            .catch(() => undefined)
        }
        className="flex max-w-full items-center gap-1 text-[12px] text-ink-400 hover:text-ink-900"
        title="Copy the SHA-256 checksum"
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
        <span className="truncate font-mono">SHA-256 {file.sha256}</span>
      </button>
    </div>
  );
}

/** The newest release for one platform at a time, starting on the visitor's own. */
export function DownloadPicker({
  release,
  initial,
}: {
  release: PosRelease;
  initial: Platform;
}) {
  const [tab, setTab] = useState<Platform>(initial);
  const files: (ReleaseFile | undefined)[] =
    tab === "android"
      ? [release.files.android]
      : tab === "windows"
        ? [release.files.windows]
        : [release.files.linux_deb, release.files.linux_tar];
  const available = files.filter((f): f is ReleaseFile => !!f);

  return (
    <div>
      <div
        role="tablist"
        aria-label="Platform"
        className="mb-space-5 inline-flex gap-1 rounded-full bg-black/[0.05] p-1"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-full px-space-4 py-1.5 text-[14px] font-semibold transition-colors",
              tab === t.key
                ? "bg-card text-ink-900 shadow-[var(--shadow-sm)]"
                : "text-ink-600 hover:text-ink-900",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {available.length === 0 ? (
        <p className="text-[14px] text-ink-600">
          No {TABS.find((t) => t.key === tab)!.label} build in this release.
        </p>
      ) : (
        <div className="space-y-space-4">
          {available.map((f, i) => (
            <FileButton key={f.name} file={f} primary={i === 0} />
          ))}
        </div>
      )}

      <ol className="mt-space-6 list-decimal space-y-space-2 pl-space-5 text-[14px] text-ink-600">
        {STEPS[tab].map((s) => (
          <li key={s}>{s}</li>
        ))}
        <li>
          Open the app and pair it with the code from the portal: Settings →
          Sales channels → POS → your branch → Terminals.
        </li>
      </ol>
    </div>
  );
}
