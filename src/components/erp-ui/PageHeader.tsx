"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  /** A lucide icon element shown in a brand-tinted square before the title, e.g. <CalendarCheck size={20} />. */
  icon?: ReactNode;
  /** Page actions fill the mobile width and keep their natural width on desktop. */
  actions?: ReactNode;
  /** Optional sizing for the actions area, without changing other page headers. */
  actionsClassName?: string;
  /** Shows "Viewing: <branch>" when the branch switcher is narrowing this page. Set it only on pages that really filter. */
  className?: string;
};

export function PageHeader({
  title,
  description,
  icon,
  actions,
  actionsClassName,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-space-5 flex flex-wrap items-center justify-between gap-space-3",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-space-3">
        {icon && (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-display">{title}</h1>
          {description && (
            <p className="mt-0.5 text-[13.5px] text-ink-600">{description}</p>
          )}
          
        </div>
      </div>
      {actions && (
        <div
          data-page-actions
          className={cn(
            "mobile-page-actions page-header-actions flex flex-wrap items-center gap-space-2",
            actionsClassName,
          )}
        >
          {actions}
        </div>
      )}
    </div>
  );
}
