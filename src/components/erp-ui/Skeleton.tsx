import { cn } from "@/lib/cn";

/** Pulsing placeholder block shown in place of content that is still loading from the backend. */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-ink-400/15", className)}
      {...props}
    />
  );
}

/** A stack of text-line skeletons for lists/paragraphs that have no table shape. */
export function SkeletonLines({
  rows = 3,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("flex flex-col gap-space-2", className)}
    >
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton
          key={i}
          className={cn("h-4", i === rows - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}

/** A whole card of placeholder content: a heading line plus text lines. Use where a section is not rendered at all until its data arrives. */
export function CardSkeleton({
  rows = 3,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn(
        "rounded-lg border border-line bg-card p-space-4 shadow-[var(--shadow-sm)]",
        className,
      )}
    >
      <Skeleton className="mb-space-3 h-5 w-48" />
      <SkeletonLines rows={rows} />
    </div>
  );
}
