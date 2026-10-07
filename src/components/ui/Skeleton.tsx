import { cn } from "@/lib/cn";

/** Base shimmering placeholder block -- same animate-pulse + bg-line
 * convention the storefront order tracker already used ad hoc
 * (app/(storefront)/order/orders/[id]/page.tsx), now shared so every
 * loading state in the app looks like one system instead of plain
 * "Loading…" text in some places and a bespoke pulse div in others. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-line/60", className)} {...props} />;
}

/** A DataTable-shaped loading state: a header bar plus `rows` rows of
 * `columns` bars, so the page doesn't jump when the real table swaps in. */
export function TableSkeleton({ rows = 6, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="py-space-1" aria-hidden="true">
      <div className="flex gap-space-4 border-b border-line pb-space-2">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" style={{ maxWidth: i === 0 ? "40%" : undefined }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-space-4 border-b border-line py-space-3 last:border-0">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className="h-3.5 flex-1" style={{ maxWidth: c === 0 ? "40%" : undefined }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** A list of avatar + two-line rows -- chat threads, guest lists, anything
 * row-shaped that isn't a <DataTable>. */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-space-4 py-space-1" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-space-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-space-2">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A handful of label+field bars -- settings/detail forms still being fetched. */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div className="space-y-space-4 py-space-1" aria-hidden="true">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-space-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-full max-w-sm" />
        </div>
      ))}
    </div>
  );
}

/** One short shimmering line -- a drop-in replacement for a lone
 * "Loading…" <p>, wherever a full table/list/form skeleton would be
 * overkill (a single stat, a sidebar label, an inline status). */
export function TextSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-3 w-24", className)} aria-hidden="true" />;
}

/** One StatTile-shaped card: icon block, label line, value line -- matches
 * components/ui/StatTile's own icon+label+value layout closely enough that
 * a dashboard's grid doesn't jump when the real tiles swap in. */
export function StatTileSkeleton() {
  return (
    <div className="rounded-lg border border-line bg-card p-space-4" aria-hidden="true">
      <Skeleton className="mb-space-3 h-9 w-9 rounded-md" />
      <Skeleton className="mb-space-2 h-3 w-20" />
      <Skeleton className="h-6 w-16" />
    </div>
  );
}

/** A dashboard-shaped loading state: a row of stat tiles plus one big block
 * underneath standing in for a chart/table section -- dashboard, reports,
 * live-operations all share this same "tiles on top" layout. */
export function DashboardSkeleton({ tiles = 5 }: { tiles?: number }) {
  return (
    <div aria-hidden="true">
      <div className="mb-space-4 grid grid-cols-1 gap-space-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: tiles }).map((_, i) => <StatTileSkeleton key={i} />)}
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}

/** A multi-column board of cards -- kitchen-orders' 4-lane status board. */
export function BoardSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="mb-space-4 grid grid-cols-1 gap-space-4 lg:grid-cols-4" aria-hidden="true">
      {Array.from({ length: columns }).map((_, i) => (
        <div key={i} className="space-y-space-3">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}
