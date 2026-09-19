import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { TableForm } from "../types";
import type { WizardDispatch } from "../useWizardState";

type Props = {
  deptIndex: number;
  tables: TableForm[];
  dispatch: WizardDispatch;
  /** A single venue always has at least one table -- hide Remove on the last one. */
  keepAtLeastOne?: boolean;
};

/** One row per physical table: a name guests never see (staff reference) and
 * how many people it seats -- the real inputs to nearest-fit table assignment. */
export function TableRows({ deptIndex, tables, dispatch, keepAtLeastOne }: Props) {
  return (
    <div className="space-y-space-2">
      {tables.map((table, tableIndex) => (
        <div key={tableIndex} className="flex items-center gap-space-3">
          <Input
            aria-label={`Table ${tableIndex + 1} name`}
            placeholder={`Table name (e.g. T${tableIndex + 1})`}
            value={table.name}
            onChange={(e) =>
              dispatch({ type: "setTableField", deptIndex, tableIndex, field: "name", value: e.target.value })
            }
            className="max-w-xs"
          />
          <div className="flex items-center gap-space-2">
            <Input
              aria-label={`Table ${tableIndex + 1} seats`}
              type="number"
              min={1}
              max={50}
              value={table.capacity}
              onChange={(e) =>
                dispatch({ type: "setTableField", deptIndex, tableIndex, field: "capacity", value: e.target.value })
              }
              className="w-20"
            />
            <span className="text-[12.5px] text-ink-600">seats</span>
          </div>
          {!(keepAtLeastOne && tables.length === 1) && (
            <button
              type="button"
              onClick={() => dispatch({ type: "removeTable", deptIndex, tableIndex })}
              className="ml-auto flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-error hover:underline"
            >
              <Trash2 size={13} /> Remove
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
