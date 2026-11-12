"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { cn } from "@/lib/cn";
import { TAG_COLOR, TAG_ICON, type TagColor, type TagIcon } from "@/lib/erp/tags";

/** A tag as customers' lists show it: tinted pill with its icon. */
export function TagChip({
  name,
  color,
  icon,
  className,
}: {
  name: string;
  color: TagColor;
  icon: TagIcon;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-[180px] items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold whitespace-nowrap",
        TAG_COLOR[color].chip,
        className,
      )}
    >
      <HugeiconsIcon icon={TAG_ICON[icon]} size={12} className="shrink-0" />
      <span className="truncate">{name}</span>
    </span>
  );
}

/** The solid rounded square in front of a tag's name in the tag list. */
export function TagTile({
  color,
  icon,
  size = 28,
}: {
  color: TagColor;
  icon: TagIcon;
  size?: number;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg",
        TAG_COLOR[color].tile,
      )}
      style={{ width: size, height: size }}
    >
      <HugeiconsIcon icon={TAG_ICON[icon]} size={Math.round(size * 0.55)} />
    </span>
  );
}
