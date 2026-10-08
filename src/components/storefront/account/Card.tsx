// Small local stand-in for dine-client's components/ui/card.tsx, re-skinned onto sf- tokens.
// Not reused from @/components/ui/Card: that's the staff portal's own card (ink/brand tokens,
// no sf- prefix) -- using it here would mix two unrelated design systems on one ported page.
import { cn } from "@/lib/cn";

export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-sf-border-divider/70 bg-sf-surface text-sf-on-surface shadow-sm",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
