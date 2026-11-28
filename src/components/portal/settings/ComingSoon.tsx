import type { ReactNode } from "react";
import { Card } from "@/components/erp-ui/Card";

/** Placeholder body for a settings page that is not built yet. */
export function ComingSoon({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center px-space-5 py-space-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
        {icon}
      </span>
      <h2 className="mt-space-3 text-[16px] font-bold text-ink-900">{title}</h2>
      <span className="mt-1 rounded-full bg-black/[0.05] px-2.5 py-0.5 text-[11.5px] font-semibold tracking-wide text-ink-600 uppercase">
        Coming soon
      </span>
      <p className="mt-space-3 max-w-md text-[13.5px] text-ink-600">{children}</p>
    </Card>
  );
}
