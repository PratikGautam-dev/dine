"use client";

import { useEffect } from "react";
import { cn } from "@/lib/cn";

type Props = {
  onClose: () => void;
  labelledBy: string;
  /** Tailwind max-width class for the card, e.g. "max-w-[520px]" -- forms vary in field count. */
  maxWidthClass?: string;
  children: React.ReactNode;
};

/** The one centered-modal shell every "Add X" / "Edit X" form in the portal mounts its fields
 * into -- blurred dark overlay, Escape-to-close, click-outside-to-close, a scrollable card so a
 * long form never gets clipped by the viewport. Previously each dialog (StaffFormDialog,
 * BranchFormDialog, and a few hand-rolled inline ones) copied this same overlay/card markup by
 * hand; this is the single place that styling now lives. */
export function Modal({ onClose, labelledBy, maxWidthClass = "max-w-[520px]", children }: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-space-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cn("my-auto max-h-[90vh] w-full overflow-y-auto rounded-lg bg-card p-space-5 shadow-[var(--shadow-lg)]", maxWidthClass)}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
