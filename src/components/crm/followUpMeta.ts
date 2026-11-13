import {
  Alert02Icon,
  Calendar03Icon,
  Call02Icon,
  CheckmarkCircle02Icon,
  Crown02Icon,
  GiftIcon,
  Invoice02Icon,
  Mail01Icon,
  Refresh01Icon,
  Store01Icon,
  WhatsappIcon,
} from "@hugeicons/core-free-icons";
import type {
  FollowUpChannel,
  FollowUpPriority,
  FollowUpStatus,
  FollowUpType,
} from "@/lib/erp/crm";

export type Icon = typeof Call02Icon;
export const FOLLOW_UP_TYPE: Record<
  FollowUpType,
  { label: string; icon: Icon; chip: string }
> = {
  call: {
    label: "Call",
    icon: Call02Icon,
    chip: "bg-emerald-50 text-emerald-700",
  },
  whatsapp: {
    label: "WhatsApp",
    icon: WhatsappIcon,
    chip: "bg-emerald-50 text-emerald-700",
  },
  email: {
    label: "Email",
    icon: Mail01Icon,
    chip: "bg-purple-50 text-purple-700",
  },
  in_store: {
    label: "In-store",
    icon: Store01Icon,
    chip: "bg-amber-50 text-amber-700",
  },
  birthday: {
    label: "Birthday Reminder",
    icon: GiftIcon,
    chip: "bg-amber-50 text-amber-700",
  },
  win_back: {
    label: "Win-back",
    icon: Refresh01Icon,
    chip: "bg-red-50 text-red-700",
  },
  membership_renewal: {
    label: "Membership Renewal",
    icon: Crown02Icon,
    chip: "bg-purple-50 text-purple-700",
  },
  payment_reminder: {
    label: "Payment Reminder",
    icon: Invoice02Icon,
    chip: "bg-blue-50 text-blue-700",
  },
};
export const FOLLOW_UP_CHANNEL: Record<
  FollowUpChannel,
  { label: string; icon: Icon }
> = {
  call: { label: "Call", icon: Call02Icon },
  whatsapp: { label: "WhatsApp", icon: WhatsappIcon },
  email: { label: "Email", icon: Mail01Icon },
  in_store: { label: "In-store", icon: Store01Icon },
};
export const FOLLOW_UP_PRIORITY: Record<
  FollowUpPriority,
  { label: string; chip: string }
> = {
  high: { label: "High", chip: "bg-red-50 text-red-700" },
  medium: { label: "Medium", chip: "bg-amber-50 text-amber-700" },
  low: { label: "Low", chip: "bg-emerald-50 text-emerald-700" },
};
export const FOLLOW_UP_STATUS: Record<
  FollowUpStatus,
  { label: string; chip: string; icon: Icon }
> = {
  scheduled: {
    label: "Scheduled",
    chip: "bg-blue-50 text-blue-700",
    icon: Calendar03Icon,
  },
  in_progress: {
    label: "In Progress",
    chip: "bg-blue-50 text-blue-700",
    icon: Refresh01Icon,
  },
  completed: {
    label: "Completed",
    chip: "bg-emerald-50 text-emerald-700",
    icon: CheckmarkCircle02Icon,
  },
  overdue: {
    label: "Overdue",
    chip: "bg-red-50 text-red-700",
    icon: Alert02Icon,
  },
  missed: {
    label: "Missed",
    chip: "bg-red-50 text-red-700",
    icon: Alert02Icon,
  },
};
