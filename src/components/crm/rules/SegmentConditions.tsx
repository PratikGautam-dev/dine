"use client";

import {
  Add01Icon,
  Delete02Icon,
  DragDropVerticalIcon,
  FilterHorizontalIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Row } from "@/components/crm/rules/ConditionBuilder";
import { cn } from "@/lib/cn";
import {
  FIELD_META,
  defaultCondition,
  isGroup,
  type Condition,
  type ConditionField,
  type Match,
  type SegmentCondition,
} from "@/lib/erp/rules";

const FIELDS = Object.keys(FIELD_META) as ConditionField[];
const MAX = 10;

type Drag = { from: number; to: number; dy: number; settling: boolean };
type Sort = {
  setRow: (index: number, el: HTMLDivElement | null) => void;
  drag: Drag | null;
  shift: (index: number) => number;
  start: (e: React.PointerEvent, index: number) => void;
  move: (e: React.PointerEvent) => void;
  end: () => void;
  key: (e: React.KeyboardEvent, index: number) => void;
  count: number;
};
const SortContext = createContext<Sort | null>(null);

/** A list whose rows can be moved: a row follows the pointer while the others slide out of its way, then it settles into its place. */
function SortableList({
  count,
  onMove,
  children,
}: {
  count: number;
  onMove: (from: number, to: number) => void;
  children: ReactNode;
}) {
  const rows = useRef<(HTMLDivElement | null)[]>([]);
  const [drag, setDrag] = useState<Drag | null>(null);
  const geo = useRef<{
    tops: number[];
    heights: number[];
    gap: number;
    startY: number;
  } | null>(null);

  const start = (e: React.PointerEvent, index: number) => {
    const els = rows.current.slice(0, count);
    if (els.some((r) => !r)) return;
    const tops = els.map((r) => r!.offsetTop);
    const heights = els.map((r) => r!.offsetHeight);
    const gap = count > 1 ? tops[1] - (tops[0] + heights[0]) : 0;
    geo.current = { tops, heights, gap, startY: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ from: index, to: index, dy: 0, settling: false });
  };
  const move = (e: React.PointerEvent) => {
    const g = geo.current;
    if (!drag || drag.settling || !g) return;
    const dy = e.clientY - g.startY;
    const centre = g.tops[drag.from] + g.heights[drag.from] / 2 + dy;
    let to = 0;
    g.tops.forEach((top, j) => {
      if (j !== drag.from && centre > top + g.heights[j] / 2) to += 1;
    });
    setDrag({ ...drag, dy, to });
  };
  const end = () => {
    const g = geo.current;
    if (!drag || drag.settling || !g) return;
    const { from, to } = drag;
    // where the dragged row's top ends up once the others have shifted
    const slot =
      to > from
        ? g.tops[to] + g.heights[to] - g.heights[from]
        : to < from
          ? g.tops[to]
          : g.tops[from];
    setDrag({ from, to, dy: slot - g.tops[from], settling: true });
    window.setTimeout(() => {
      geo.current = null;
      setDrag(null);
      if (from !== to) onMove(from, to);
    }, 180);
  };
  const shift = (index: number) => {
    const g = geo.current;
    if (!drag || !g || index === drag.from) return 0;
    const size = g.heights[drag.from] + g.gap;
    if (drag.from < drag.to && index > drag.from && index <= drag.to)
      return -size;
    if (drag.to < drag.from && index >= drag.to && index < drag.from)
      return size;
    return 0;
  };
  const key = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "ArrowUp" && index > 0) {
      e.preventDefault();
      onMove(index, index - 1);
    } else if (e.key === "ArrowDown" && index < count - 1) {
      e.preventDefault();
      onMove(index, index + 1);
    }
  };
  return (
    <SortContext.Provider
      value={{
        setRow: (i, el) => {
          rows.current[i] = el;
        },
        drag,
        shift,
        start,
        move,
        end,
        key,
        count,
      }}
    >
      <div className="relative flex flex-col gap-space-2">{children}</div>
    </SortContext.Provider>
  );
}

/** One row of a SortableList, with its drag handle. */
function Movable({ index, children }: { index: number; children: ReactNode }) {
  const sort = useContext(SortContext)!;
  const dragging = sort.drag?.from === index;
  const dy = dragging ? sort.drag!.dy : sort.shift(index);
  const settling = dragging ? sort.drag!.settling : sort.drag !== null;
  return (
    <div
      ref={(el) => {
        sort.setRow(index, el);
      }}
      style={{
        transform: dy ? `translateY(${dy}px)` : undefined,
        transition: settling ? "transform 170ms ease" : undefined,
      }}
      className={cn(
        "relative flex items-start gap-space-1 rounded-md",
        dragging && "z-10 bg-card shadow-[var(--shadow-md)] ring-1 ring-line",
      )}
    >
      <button
        type="button"
        aria-label={`Move condition ${index + 1} (drag, or use the up and down arrow keys)`}
        title="Drag to reorder"
        onPointerDown={(e) => sort.start(e, index)}
        onPointerMove={sort.move}
        onPointerUp={sort.end}
        onPointerCancel={sort.end}
        onKeyDown={(e) => sort.key(e, index)}
        className={cn(
          "mt-2 flex h-7 w-6 shrink-0 touch-none items-center justify-center rounded text-ink-400 hover:bg-black/[0.05] hover:text-ink-700",
          dragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        <HugeiconsIcon icon={DragDropVerticalIcon} size={16} />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

const moved = <T,>(items: T[], from: number, to: number): T[] => {
  const next = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

function MatchChoice({
  value,
  onChange,
  all,
  any,
  name,
}: {
  value: Match;
  onChange: (m: Match) => void;
  all: string;
  any: string;
  name: string;
}) {
  return (
    <span
      className="flex flex-wrap items-center gap-space-2 max-md:flex-col max-md:items-stretch"
      role="radiogroup"
      aria-label={name}
    >
      {(
        [
          ["all", all],
          ["any", any],
        ] as const
      ).map(([m, label]) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={value === m}
          onClick={() => onChange(m)}
          className={cn(
            "flex items-center gap-space-2 rounded-md border px-space-3 py-1.5 text-[13px] font-medium",
            value === m
              ? "border-brand-600 bg-card text-ink-900"
              : "border-line bg-card text-ink-700 hover:bg-black/[0.03]",
          )}
        >
          <span
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded-full border",
              value === m ? "border-brand-700" : "border-ink-400",
            )}
          >
            {value === m && (
              <span className="h-2 w-2 rounded-full bg-brand-700" />
            )}
          </span>
          {label}
        </button>
      ))}
    </span>
  );
}

/** The Segment Builder's conditions: rows of field / comparison / value, joined by All (AND) or Any (OR), plus groups matched as one condition. */
export function SegmentConditions({
  conditions,
  match,
  tags,
  onChange,
}: {
  conditions: SegmentCondition[];
  match: Match;
  tags: { id: string; name: string }[];
  onChange: (conditions: SegmentCondition[], match: Match) => void;
}) {
  // bumped when a row is removed, so the rows below it start afresh instead of keeping the removed row's typed text
  const [version, setVersion] = useState(0);
  const set = (next: SegmentCondition[]) => onChange(next, match);
  const total = conditions.reduce(
    (n, c) => n + (isGroup(c) ? c.group.length : 1),
    0,
  );
  const replace = (i: number, c: SegmentCondition) =>
    set(conditions.map((x, j) => (j === i ? c : x)));
  const remove = (i: number) => {
    set(conditions.filter((_, j) => j !== i));
    setVersion(version + 1);
  };

  return (
    <div>
      <div className="mb-space-3 flex items-start gap-space-2">
        <span className="mt-0.5 text-brand-700">
          <HugeiconsIcon icon={FilterHorizontalIcon} size={20} />
        </span>
        <div>
          <h3 className="text-[15px] font-bold text-ink-900">
            Segment Conditions
          </h3>
          <p className="text-[12.5px] text-ink-600">
            Add one or more conditions to filter customers. Use AND/OR to build
            the logic.
          </p>
        </div>
      </div>
      <div className="mb-space-3 flex flex-wrap items-center gap-space-3 rounded-md bg-brand-50 p-space-2 pl-space-3 max-md:flex-col max-md:items-stretch max-md:gap-space-2 max-md:p-space-3">
        <span className="text-[13px] font-semibold text-ink-900">Match</span>
        <MatchChoice
          name="Match"
          value={match}
          onChange={(m) => onChange(conditions, m)}
          all="All Conditions (AND)"
          any="Any Condition (OR)"
        />
      </div>
      <SortableList
        count={conditions.length}
        onMove={(from, to) => {
          set(moved(conditions, from, to));
          setVersion(version + 1);
        }}
      >
        {conditions.map((c, i) => (
          <Movable key={`${version}-${i}`} index={i}>
            {isGroup(c) ? (
              <div className="rounded-md border border-dashed border-brand-600/50 bg-brand-50/40 p-space-2">
                <div className="mb-space-2 flex flex-wrap items-center gap-space-2">
                  <HugeiconsIcon
                    icon={UserGroupIcon}
                    size={16}
                    className="text-brand-700"
                  />
                  <span className="text-[13px] font-semibold text-ink-900">
                    Group
                  </span>
                  <MatchChoice
                    name="Group match"
                    value={c.match}
                    onChange={(m) => replace(i, { ...c, match: m })}
                    all="All of these (AND)"
                    any="Any of these (OR)"
                  />
                  <button
                    type="button"
                    aria-label="Remove group"
                    onClick={() => remove(i)}
                    className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-ink-400 hover:bg-black/[0.05] hover:text-ink-700"
                  >
                    <HugeiconsIcon icon={Delete02Icon} size={16} />
                  </button>
                </div>
                <SortableList
                  count={c.group.length}
                  onMove={(from, to) => {
                    replace(i, { ...c, group: moved(c.group, from, to) });
                    setVersion(version + 1);
                  }}
                >
                  {c.group.map((x, k) => (
                    <Movable key={`${version}-${i}-${k}`} index={k}>
                      <Row
                        c={x}
                        fields={FIELDS}
                        tags={tags}
                        onChange={(nc) =>
                          replace(i, {
                            ...c,
                            group: c.group.map((y, m) => (m === k ? nc : y)),
                          })
                        }
                        onRemove={
                          c.group.length > 1
                            ? () => {
                                replace(i, {
                                  ...c,
                                  group: c.group.filter((_, m) => m !== k),
                                });
                                setVersion(version + 1);
                              }
                            : undefined
                        }
                      />
                    </Movable>
                  ))}
                </SortableList>
                {total < MAX && (
                  <button
                    type="button"
                    onClick={() =>
                      replace(i, {
                        ...c,
                        group: [...c.group, defaultCondition(FIELDS[0])],
                      })
                    }
                    className="mt-space-2 flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline"
                  >
                    <HugeiconsIcon icon={Add01Icon} size={14} /> Add to group
                  </button>
                )}
              </div>
            ) : (
              <Row
                c={c}
                fields={FIELDS}
                tags={tags}
                onChange={(nc) => replace(i, nc)}
                onRemove={conditions.length > 1 ? () => remove(i) : undefined}
              />
            )}
          </Movable>
        ))}
      </SortableList>
      {total < MAX && (
        <div className="mt-space-3 flex flex-wrap gap-space-2 max-md:flex-col">
          <button
            type="button"
            onClick={() => set([...conditions, defaultCondition("tier")])}
            className="flex items-center gap-1 rounded-md border border-brand-600 px-space-3 py-1.5 text-[13px] font-semibold text-brand-700 hover:bg-brand-50 max-md:justify-center max-md:py-space-2"
          >
            <HugeiconsIcon icon={Add01Icon} size={14} /> Add Condition
          </button>
          <button
            type="button"
            onClick={() =>
              set([
                ...conditions,
                {
                  group: [
                    defaultCondition("tier") as Condition,
                    defaultCondition("total_spend"),
                  ],
                  match: "any",
                },
              ])
            }
            className="flex items-center gap-1 rounded-md border border-line px-space-3 py-1.5 text-[13px] font-semibold text-ink-800 hover:bg-black/[0.03] max-md:justify-center max-md:py-space-2"
          >
            <HugeiconsIcon icon={UserGroupIcon} size={14} /> Add Group (OR)
          </button>
        </div>
      )}
    </div>
  );
}
