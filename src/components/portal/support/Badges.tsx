import { Badge } from "@/components/ui/Badge";
import {
  PRIORITY_LABEL,
  PRIORITY_TONE,
  STATUS_LABEL,
  STATUS_TONE,
  type SupportPriority,
  type SupportStatus,
} from "@/lib/support";

export const StatusBadge = ({ status }: { status: SupportStatus }) => (
  <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
);

export const PriorityBadge = ({ priority }: { priority: SupportPriority }) => {
  const tone = PRIORITY_TONE[priority];
  // Badge has no "error" tone; urgent borrows the error colours.
  return tone === "error" ? (
    <Badge tone="warning" className="bg-error-tint text-error">
      {PRIORITY_LABEL[priority]}
    </Badge>
  ) : (
    <Badge tone={tone}>{PRIORITY_LABEL[priority]}</Badge>
  );
};
