"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Actions below the scrollable body; full width on mobile. */
  footer?: React.ReactNode;
  width?: "sm" | "md" | "lg" | "xl";
  /** Reduce vertical padding in the header and footer. */
  compact?: boolean;
  /** false = no close button, and neither a backdrop click nor Escape closes it (a gate the person must act on). */
  dismissible?: boolean;
  /** Icon shown in a white tile on a dark brand header; setting it switches the header to the banner style. */
  bannerIcon?: React.ReactNode;
  /** Class for the scrollable body (e.g. a tinted background). */
  bodyClassName?: string;
  /** Extra classes for the header and footer bars (e.g. to slim them on a phone). */
  headerClassName?: string;
  footerClassName?: string;
};

const WIDTH = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-5xl",
} as const;

/** Generic dialog: backdrop click and Escape close it. */
export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  footer,
  width = "md",
  compact = false,
  dismissible = true,
  bannerIcon,
  bodyClassName = "",
  headerClassName = "",
  footerClassName = "",
}: ModalProps) {
  useEffect(() => {
    if (!open || !dismissible) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, dismissible]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-space-4"
      style={{
        paddingBottom: "max(var(--space-4), env(safe-area-inset-bottom))",
      }}
      onClick={dismissible ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`flex max-h-[90dvh] min-w-0 w-full ${WIDTH[width]} flex-col rounded-lg bg-card shadow-[var(--shadow-lg)] ${bannerIcon ? "overflow-hidden" : "border border-line"}`}
      >
        <div
          className={`flex shrink-0 gap-space-3 border-b ${bannerIcon ? "items-center" : "items-start"} ${bannerIcon ? "border-brand-800 bg-brand-800 text-white" : "border-line"} ${compact ? "px-space-4 py-space-2" : "p-space-4"} ${headerClassName}`}
        >
          {bannerIcon && (
            <div
              className={`flex shrink-0 ${compact ? "h-9 w-9" : "h-11 w-11"} items-center justify-center rounded-lg bg-white text-brand-800`}
            >
              {bannerIcon}
            </div>
          )}
          <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            <h2
              className={`font-bold ${bannerIcon ? `${compact ? "text-[17px]" : "text-[20px]"} text-white` : "text-[17px] text-ink-900"}`}
            >
              {title}
            </h2>
            {description && (
              <p
                className={`mt-0.5 text-[13px] ${bannerIcon ? "text-white/80" : "text-ink-600"}`}
              >
                {description}
              </p>
            )}
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={`touch-target shrink-0 rounded-md p-1 ${bannerIcon ? "text-white/80 hover:bg-white/10 hover:text-white" : "text-ink-400 hover:bg-black/[0.04] hover:text-ink-700"}`}
            >
              <X size={bannerIcon ? 26 : 18} />
            </button>
          )}
        </div>
        <div
          className={`@container min-h-0 min-w-0 max-w-full overflow-y-auto overscroll-contain p-space-4 ${bodyClassName}`}
        >
          {children}
        </div>
        {footer && (
          <div
            className={`mobile-page-actions flex shrink-0 flex-wrap justify-end gap-space-2 border-t border-line ${compact ? "px-space-4 py-space-2" : "p-space-4"} ${footerClassName}`}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
