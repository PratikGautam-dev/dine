import { useImmerReducer } from "use-immer";
import {
  FeatureKey,
  TableForm,
  TenantType,
  WizardState,
  emptyDepartment,
  emptyTable,
  emptyTopic,
  initialWizardState,
} from "./types";

type Action =
  | { type: "set"; field: keyof WizardState; value: unknown }
  | { type: "toggleFeature"; key: FeatureKey }
  | { type: "setTenantType"; value: TenantType }
  | { type: "addDepartment" }
  | { type: "removeDepartment"; deptIndex: number }
  | { type: "setDepartmentName"; deptIndex: number; name: string }
  | { type: "addTable"; deptIndex: number }
  | { type: "removeTable"; deptIndex: number; tableIndex: number }
  | { type: "setTableField"; deptIndex: number; tableIndex: number; field: keyof TableForm; value: string }
  | { type: "toggleOperatingDay"; day: string }
  | { type: "addTopic" }
  | { type: "removeTopic"; topicIndex: number }
  | { type: "setTopicField"; topicIndex: number; field: "topicLabel" | "answerText"; value: string };

function reducer(draft: WizardState, action: Action) {
  switch (action.type) {
    case "set":
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (draft as any)[action.field] = action.value;
      return;
    case "toggleFeature": {
      const i = draft.enabledFeatures.indexOf(action.key);
      if (i === -1) draft.enabledFeatures.push(action.key);
      else draft.enabledFeatures.splice(i, 1);
      return;
    }
    case "setTenantType": {
      draft.tenantType = action.value;
      // A single venue has no section concept -- collapse (or seed) the
      // departments array to exactly one section under a fixed internal name
      // the backend requires but the venue UI never shows, keeping its tables.
      // Switching back to "restaurant" leaves whatever's there alone so no
      // data already entered is silently thrown away.
      if (action.value === "clinic") {
        if (draft.departments.length === 0) draft.departments.push(emptyDepartment());
        else if (draft.departments.length > 1) {
          const [first, ...rest] = draft.departments;
          first.tables.push(...rest.flatMap((d) => d.tables));
          draft.departments.length = 1;
        }
        const dept = draft.departments[0];
        dept.name = "Main";
        if (dept.tables.length === 0) dept.tables.push(emptyTable());
      }
      return;
    }
    case "addDepartment": {
      const dept = emptyDepartment();
      dept.tables.push(emptyTable());
      draft.departments.push(dept);
      return;
    }
    case "removeDepartment":
      draft.departments.splice(action.deptIndex, 1);
      return;
    case "setDepartmentName":
      draft.departments[action.deptIndex].name = action.name;
      return;
    case "addTable":
      draft.departments[action.deptIndex].tables.push(emptyTable());
      return;
    case "removeTable":
      draft.departments[action.deptIndex].tables.splice(action.tableIndex, 1);
      return;
    case "setTableField":
      draft.departments[action.deptIndex].tables[action.tableIndex][action.field] = action.value;
      return;
    case "toggleOperatingDay": {
      const i = draft.operatingDays.indexOf(action.day);
      if (i === -1) draft.operatingDays.push(action.day);
      else draft.operatingDays.splice(i, 1);
      return;
    }
    case "addTopic":
      draft.topics.push(emptyTopic());
      return;
    case "removeTopic":
      draft.topics.splice(action.topicIndex, 1);
      return;
    case "setTopicField":
      draft.topics[action.topicIndex][action.field] = action.value;
      return;
  }
}

export function useWizardState() {
  return useImmerReducer(reducer, undefined, initialWizardState);
}

export type WizardDispatch = ReturnType<typeof useWizardState>[1];
