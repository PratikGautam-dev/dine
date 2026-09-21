import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  /** A lucide icon element shown in a brand-tinted square before the title, e.g. <CalendarCheck size={20} />. */
  icon?: ReactNode;
  /** Buttons/controls for this page, e.g. "Add doctor" -- rendered right-aligned. */
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, description, icon, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("mb-space-5 flex flex-wrap items-center justify-between gap-space-3", className)}>
      <div className="flex min-w-0 items-center gap-space-3">
        {icon && (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-display">{title}</h1>
          {description && <p className="mt-0.5 text-[13.5px] text-ink-600">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-space-2">{actions}</div>}
    </div>
  );
}
