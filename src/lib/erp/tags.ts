import {
  Alert02Icon,
  Clock01Icon,
  CrownIcon,
  DeliveryTruck01Icon,
  DiamondIcon,
  FavouriteIcon,
  GiftIcon,
  PercentIcon,
  ShoppingCart01Icon,
  StarIcon,
  Tag01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import type { Segment } from "@/lib/erp/crm";

/** Customers > Tags (backend: services/customer_tags.py). */
export type TagColor =
  "purple" | "blue" | "green" | "amber" | "red" | "pink" | "teal" | "grey";
export type TagIcon =
  | "tag"
  | "crown"
  | "heart"
  | "star"
  | "gift"
  | "users"
  | "diamond"
  | "cart"
  | "clock"
  | "truck"
  | "percent"
  | "alert";
export type TagStatus = "active" | "draft" | "inactive";
export type TagKind = "manual" | "rule" | "system";
export type TagAppliesTo = "all" | "tiers" | "selected" | "business";
export type TagSource = "manual" | "rule" | "system";
export type TagTier = "regular" | "silver" | "gold" | "platinum";

export type CustomerTag = {
  id: string;
  name: string;
  /** The name again, for older callers. */
  tag: string;
  description: string | null;
  color: TagColor;
  icon: TagIcon;
  kind: TagKind;
  applies_to: TagAppliesTo;
  membership_filter: TagTier[];
  status: TagStatus;
  notes: string | null;
  customers: number;
  created_at: string;
  updated_at: string;
};

export type TagSummary = {
  total_tags: number;
  tags_created_this_month: number;
  tagged_customers: number;
  tagged_this_month: number;
  tagged_last_month: number;
  auto_tagged: number;
  manually_tagged: number;
  multi_tagged: number;
  top_tags: {
    id: string;
    name: string;
    color: TagColor;
    icon: TagIcon;
    customers: number;
  }[];
  by_tier: Partial<Record<Segment, number>>;
};

export type TaggedCustomer = {
  id: string;
  customer_code: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  status: "active" | "blocked";
  segment: Segment;
  last_order_at: string | null;
  last_order_minor: number | null;
  tags: {
    id: string;
    name: string;
    color: TagColor;
    icon: TagIcon;
    source: TagSource;
  }[];
  tag_source: TagSource;
};

export type TagForm = {
  name: string;
  description: string;
  color: TagColor;
  icon: TagIcon;
  applies_to: TagAppliesTo;
  membership_filter: TagTier[];
  status: TagStatus;
  notes: string;
};

export const EMPTY_TAG: TagForm = {
  name: "",
  description: "",
  color: "purple",
  icon: "tag",
  applies_to: "all",
  membership_filter: [],
  status: "active",
  notes: "",
};

/** Chip (tint + text), swatch and solid tile per colour. */
export const TAG_COLOR: Record<
  TagColor,
  { chip: string; swatch: string; tile: string }
> = {
  purple: {
    chip: "bg-purple-50 text-purple-700",
    swatch: "bg-purple-500",
    tile: "bg-purple-500 text-white",
  },
  blue: {
    chip: "bg-blue-50 text-blue-700",
    swatch: "bg-blue-500",
    tile: "bg-blue-500 text-white",
  },
  green: {
    chip: "bg-emerald-50 text-emerald-700",
    swatch: "bg-emerald-500",
    tile: "bg-emerald-600 text-white",
  },
  amber: {
    chip: "bg-amber-50 text-amber-700",
    swatch: "bg-amber-400",
    tile: "bg-amber-500 text-white",
  },
  red: {
    chip: "bg-red-50 text-red-700",
    swatch: "bg-red-500",
    tile: "bg-red-500 text-white",
  },
  pink: {
    chip: "bg-pink-50 text-pink-700",
    swatch: "bg-pink-400",
    tile: "bg-pink-500 text-white",
  },
  teal: {
    chip: "bg-teal-50 text-teal-700",
    swatch: "bg-teal-500",
    tile: "bg-teal-600 text-white",
  },
  grey: {
    chip: "bg-black/[0.05] text-ink-700",
    swatch: "bg-ink-400",
    tile: "bg-ink-600 text-white",
  },
};
export const TAG_COLORS = Object.keys(TAG_COLOR) as TagColor[];

export const TAG_ICON: Record<TagIcon, typeof Tag01Icon> = {
  tag: Tag01Icon,
  crown: CrownIcon,
  heart: FavouriteIcon,
  star: StarIcon,
  gift: GiftIcon,
  users: UserGroupIcon,
  diamond: DiamondIcon,
  cart: ShoppingCart01Icon,
  clock: Clock01Icon,
  truck: DeliveryTruck01Icon,
  percent: PercentIcon,
  alert: Alert02Icon,
};
export const TAG_ICONS = Object.keys(TAG_ICON) as TagIcon[];

export const APPLIES_TO_LABEL: Record<TagAppliesTo, string> = {
  all: "All customers",
  tiers: "Membership tiers",
  selected: "Selected customers",
  business: "B2B accounts",
};

export const SOURCE_LABEL: Record<TagSource, string> = {
  manual: "Manual",
  rule: "Rule-based",
  system: "System",
};

/** Ready-made starting points for Add tag (name, look, a line of description). */
export const TAG_TEMPLATES: {
  name: string;
  color: TagColor;
  icon: TagIcon;
  description: string;
}[] = [
  {
    name: "VIP",
    color: "purple",
    icon: "crown",
    description: "High value customers with strong purchase history.",
  },
  {
    name: "Frequent Buyer",
    color: "blue",
    icon: "cart",
    description: "Buys often.",
  },
  {
    name: "New Customer",
    color: "teal",
    icon: "users",
    description: "Joined recently.",
  },
  {
    name: "High Spender",
    color: "pink",
    icon: "diamond",
    description: "Spends well above average.",
  },
  {
    name: "Discount Lover",
    color: "red",
    icon: "percent",
    description: "Frequently uses discounts and offers.",
  },
  {
    name: "Loyalty Member",
    color: "green",
    icon: "heart",
    description: "Enrolled in the loyalty programme.",
  },
  {
    name: "At-Risk",
    color: "red",
    icon: "alert",
    description: "Buying less often than before.",
  },
  {
    name: "Wholesale",
    color: "purple",
    icon: "truck",
    description: "B2B / bulk buyers.",
  },
  {
    name: "Birthday",
    color: "amber",
    icon: "gift",
    description: "Birthday coming up.",
  },
  {
    name: "Festival Buyer",
    color: "amber",
    icon: "star",
    description: "Active during festival seasons.",
  },
];
