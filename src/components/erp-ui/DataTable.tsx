"use client";
"use no memo";

import { Fragment, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { DashboardCircleEditIcon } from "@hugeicons/core-free-icons";
import {
  ColumnDef,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Button } from "@/components/erp-ui/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/erp-ui/table";
import { Skeleton } from "@/components/erp-ui/Skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/erp-ui/dropdown-menu";
import { cn } from "@/lib/cn";

type DataTableProps<TData> = {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  /** Stable row id (defaults to row index) -- pass this whenever `data` has
   * its own id, so client-side pagination/selection survive a row's position
   * shifting between renders (e.g. after a filter changes). */
  getRowId?: (row: TData, index: number) => string;
  /** Rows per page for the built-in client-side pagination (TanStack's
   * getPaginationRowModel) -- this table always paginates client-side today,
   * since every /api/portal/* list route this feeds still returns its whole
   * tenant-scoped result set in one shot. */
  pageSize?: number;
  /** Set false to show every row in `data` with no footer: for a list whose own pager (CursorPager, usePagedQuery) already limits what is
   * fetched, so the table must not page it a second time. Defaults to true; `pageSize` is ignored when false. */
  paginate?: boolean;
  /** Renders an extra full-width row directly under a data row when it
   * returns true for that row -- this table's one hook for the inline
   * reschedule/cancel/follow-up panels several portal pages already show
   * per-row, so that bespoke business logic stays page-owned rather than
   * something this generic component has to understand. */
  isRowExpanded?: (row: TData) => boolean;
  renderRowDetail?: (row: TData) => React.ReactNode;
  rowClassName?: (row: TData) => string;
  /** Makes the whole row clickable (e.g. navigate to a detail page) --
   * individual cells (a checkbox, a delete button) still need their own
   * onClick(e) => e.stopPropagation() to opt out, same as this app's
   * hand-rolled tables already did. */
  onRowClick?: (row: TData) => void;
  emptyMessage?: string;
  /** Extra classes on the scroll container around <Table> -- e.g. a fixed
   * max-height for a small preview list (a CSV import's row
   * preview), which needs its own vertical scroll independent of the page. */
  containerClassName?: string;
  /** Pins the header row to the top of containerClassName's own scroll
   * container (only useful together with a max-height containerClassName --
   * a page-level table has nothing shorter than the viewport to stick to). */
  stickyHeader?: boolean;
  /** Pass the query's `loading` flag: while true and there are no rows yet, skeleton rows replace the empty message. */
  loading?: boolean;
  /** Names this table's saved column choice (defaults to the page path plus the column names). Set it when one page shows two tables with the same columns. */
  tableId?: string;
  /** Set false to hide the "Columns" picker (a small preview list that has no use for it). */
  columnPicker?: boolean;
};

/** Shared, reusable table for portal list pages -- headless via
 * @tanstack/react-table (same library sarvaya-dashboard's own DataTable
 * uses), styled with this app's own Tailwind tokens rather than a component
 * library. Always renders as a single wide table with a horizontal scroll
 * container (no separate mobile card layout -- confirmed with the user:
 * that's the wanted responsive behavior here, matching sarvaya-dashboard's
 * own table). Selection/permission-gating/row actions all stay as ordinary
 * column cells the caller defines -- this component only owns rendering +
 * client-side pagination + the optional expanded-row slot above. */
export function DataTable<TData>({
  columns,
  data,
  getRowId,
  pageSize = 25,
  paginate = true,
  isRowExpanded,
  renderRowDetail,
  rowClassName,
  onRowClick,
  emptyMessage = "No results.",
  containerClassName,
  stickyHeader = false,
  loading = false,
  tableId,
  columnPicker = true,
}: DataTableProps<TData>) {
  const pathname = usePathname();
  // Only columns with a plain-text header can be turned off (a checkbox or actions column has none and always stays).
  const toggleable = columns.flatMap((c) => {
    const id =
      "id" in c && c.id
        ? c.id
        : "accessorKey" in c && c.accessorKey
          ? String(c.accessorKey).replace(/\./g, "_")
          : typeof c.header === "string"
            ? c.header
            : null;
    return id && typeof c.header === "string" ? [{ id, label: c.header }] : [];
  });
  const storageKey = `table-columns:${tableId ?? `${pathname}:${toggleable.map((c) => c.id).join("|")}`}`;
  const [visibility, setVisibility] = useState<VisibilityState>({});
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      setVisibility(saved ? (JSON.parse(saved) as VisibilityState) : {});
    } catch {
      setVisibility({});
    }
  }, [storageKey]);
  const changeVisibility = (next: VisibilityState) => {
    setVisibility(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      /* private window: the choice just isn't remembered */
    }
  };
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table can't be safely memoized (file opts out via "use no memo")
  const table = useReactTable({
    data,
    columns,
    getRowId: getRowId as ((row: TData, index: number) => string) | undefined,
    getCoreRowModel: getCoreRowModel(),
    ...(paginate ? { getPaginationRowModel: getPaginationRowModel() } : {}),
    initialState: { pagination: { pageSize } },
    state: { columnVisibility: visibility },
    onColumnVisibilityChange: (u) =>
      changeVisibility(typeof u === "function" ? u(visibility) : u),
  });
  const visibleCount = table.getVisibleLeafColumns().length;
  const shownToggleable = toggleable.filter((c) => visibility[c.id] !== false);

  const rows = table.getRowModel().rows;
  const { pageIndex, pageSize: currentPageSize } = table.getState().pagination;
  const totalRows = table.getFilteredRowModel().rows.length;

  const picker =
    columnPicker && toggleable.length > 1 ? (
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-600 hover:bg-black/[0.06] hover:text-ink-900"
          aria-label="Choose columns"
        >
          <HugeiconsIcon icon={DashboardCircleEditIcon} size={18} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Show columns</DropdownMenuLabel>
            {toggleable.map((c) => {
              const on = visibility[c.id] !== false;
              const last = on && shownToggleable.length === 1;
              return (
                <DropdownMenuItem
                  key={c.id}
                  closeOnClick={false}
                  disabled={last}
                  onClick={() =>
                    changeVisibility({ ...visibility, [c.id]: !on })
                  }
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border",
                      on
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-ink-400 bg-card",
                    )}
                  >
                    {on && <Check size={12} strokeWidth={3} />}
                  </span>
                  {c.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  return (
    <div>
      <Table containerClassName={containerClassName}>
        <TableHeader
          className={cn(stickyHeader && "sticky top-0 z-10 bg-card")}
        >
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header, i) => (
                <TableHead
                  key={header.id}
                  className={
                    (
                      header.column.columnDef.meta as
                        { className?: string } | undefined
                    )?.className
                  }
                >
                  {picker && i === headerGroup.headers.length - 1 ? (
                    <span className="flex w-full items-center justify-between gap-space-2">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                      {picker}
                    </span>
                  ) : header.isPlaceholder ? null : (
                    flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        {rows.length === 0 && loading ? (
          <TableBody>
            {Array.from({ length: 5 }, (_, r) => (
              <TableRow key={r} className="hover:bg-transparent">
                {Array.from({ length: visibleCount }, (_c, c) => (
                  <TableCell key={c}>
                    <Skeleton className="h-4 w-full max-w-[160px]" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        ) : rows.length === 0 ? (
          <TableBody>
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={visibleCount}
                className="py-space-4 text-center text-ink-400"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          </TableBody>
        ) : (
          <TableBody>
            {rows.map((row) => {
              const expanded = isRowExpanded?.(row.original) ?? false;
              return (
                <Fragment key={row.id}>
                  <TableRow
                    className={cn(
                      onRowClick && "cursor-pointer",
                      expanded && "border-b-0",
                      rowClassName?.(row.original),
                    )}
                    onClick={
                      onRowClick ? () => onRowClick(row.original) : undefined
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={
                          (
                            cell.column.columnDef.meta as
                              { className?: string } | undefined
                          )?.className
                        }
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  {expanded && renderRowDetail && (
                    <TableRow>
                      <TableCell
                        colSpan={row.getVisibleCells().length}
                        className="pb-space-3"
                      >
                        {renderRowDetail(row.original)}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        )}
      </Table>

      {paginate && totalRows > currentPageSize && (
        <div className="mt-space-3 flex flex-col items-center justify-between gap-space-2 border-t border-line pt-space-3 md:flex-row">
          <p className="text-[12px] text-ink-400">
            Showing {pageIndex * currentPageSize + 1}–
            {Math.min((pageIndex + 1) * currentPageSize, totalRows)} of{" "}
            {totalRows}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-space-2">
            <Button
              size="md"
              variant="secondary"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ArrowLeft size={13} /> Prev
            </Button>
            <span className="text-[12px] font-semibold text-ink-600">
              Page {pageIndex + 1} of {Math.max(1, table.getPageCount())}
            </span>
            <Button
              size="md"
              variant="secondary"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next <ArrowRight size={13} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
