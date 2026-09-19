import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { DepartmentForm } from "../types";
import type { WizardDispatch } from "../useWizardState";
import { TableRows } from "./TableRows";

type Props = {
  deptIndex: number;
  department: DepartmentForm;
  dispatch: WizardDispatch;
};

export function DepartmentCard({ deptIndex, department, dispatch }: Props) {
  return (
    <div className="mb-space-4 rounded-lg border border-line bg-card p-space-4 shadow-[var(--shadow-sm)]">
      <div className="mb-space-3 flex items-center gap-space-3">
        <Input
          placeholder="Section name (e.g. Main Hall, Patio)"
          value={department.name}
          onChange={(e) => dispatch({ type: "setDepartmentName", deptIndex, name: e.target.value })}
          className="max-w-sm font-semibold"
        />
        <button
          type="button"
          onClick={() => dispatch({ type: "removeDepartment", deptIndex })}
          className="ml-auto flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-error hover:underline"
        >
          <Trash2 size={13} /> Remove section
        </button>
      </div>

      <TableRows deptIndex={deptIndex} tables={department.tables} dispatch={dispatch} />

      <button
        type="button"
        onClick={() => dispatch({ type: "addTable", deptIndex })}
        className="mt-space-3 flex items-center gap-1 text-[13px] font-semibold text-brand-600 hover:underline"
      >
        <Plus size={14} /> Add table
      </button>
    </div>
  );
}
