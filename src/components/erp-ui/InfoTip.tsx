"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { InformationCircleIcon } from "@hugeicons/core-free-icons";
import { Popover } from "@base-ui/react/popover";
import { useState } from "react";

/** A small "i" button that opens an explanatory card on hover or keyboard focus. */
export function InfoTip({
  title,
  children,
  above = false,
  align = "left",
}: {
  title: string;
  children: React.ReactNode;
  /** Open upwards: for items near the bottom of a clipping container. */ above?: boolean;
  /** Which edge of the icon the card lines up with; use "right" near the right edge of a container. */ align?:
    "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        openOnHover
        delay={0}
        onFocus={(event) => {
          if (event.currentTarget.matches(":focus-visible")) setOpen(true);
        }}
        aria-label={`About ${title}`}
        className="touch-target ml-space-2 inline-flex rounded-full align-middle text-ink-400 outline-none hover:text-ink-600 focus-visible:text-brand-600"
      >
        <HugeiconsIcon icon={InformationCircleIcon} size={15} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          side={above ? "top" : "bottom"}
          align={align === "right" ? "end" : "start"}
          sideOffset={6}
          collisionPadding={8}
          className="z-100"
        >
          <Popover.Popup
            aria-label={title}
            initialFocus={false}
            className="w-72 max-w-[calc(100vw-16px)] rounded-lg border border-line bg-card p-space-3 text-left text-[12.5px] font-normal tracking-normal normal-case leading-relaxed text-ink-600 shadow-[var(--shadow-md)]"
          >
            <span className="mb-1 block text-[13px] font-semibold text-ink-900">
              {title}
            </span>
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
