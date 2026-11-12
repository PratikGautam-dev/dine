import type { CrmRule } from "@/lib/erp/rules";
import {
  ChartBarLineIcon,
  CustomerSupportIcon,
  DeliveryTruck01Icon,
  GiftIcon,
  Tag01Icon,
  Ticket01Icon,
  UserCheck01Icon,
} from "@hugeicons/core-free-icons";

export type Tier = "regular" | "silver" | "gold" | "platinum" | "inactive";
export type BenefitTier = Exclude<Tier, "inactive">;
export const TIERS: Tier[] = [
  "regular",
  "silver",
  "gold",
  "platinum",
  "inactive",
];
export const BENEFIT_TIERS: BenefitTier[] = [
  "regular",
  "silver",
  "gold",
  "platinum",
];

export const TIER_LABEL: Record<Tier, string> = {
  regular: "Regular",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  inactive: "Inactive",
};

/** Tint and ink for a tier's crown, pill and card accent. */
export const TIER_STYLE: Record<Tier, string> = {
  regular: "bg-success-tint text-success",
  silver: "bg-black/[0.06] text-ink-600",
  gold: "bg-warning-tint text-warning",
  platinum: "bg-info-tint text-info",
  inactive: "bg-error-tint text-error",
};

export type MemberStatus = "active" | "expiring" | "paused" | "expired";
export const STATUS_META: Record<
  MemberStatus,
  { label: string; pill: string; dot: string }
> = {
  active: {
    label: "Active",
    pill: "bg-success-tint text-success",
    dot: "bg-success",
  },
  expiring: {
    label: "Expiring Soon",
    pill: "bg-warning-tint text-warning",
    dot: "bg-warning",
  },
  paused: {
    label: "Paused",
    pill: "bg-black/[0.06] text-ink-600",
    dot: "bg-ink-400",
  },
  expired: {
    label: "Expired",
    pill: "bg-error-tint text-error",
    dot: "bg-error",
  },
};

export type Source =
  "website" | "mobile_app" | "in_store" | "referral" | "campaign";
export const SOURCE_LABEL: Record<Source, string> = {
  website: "Website",
  mobile_app: "Mobile App",
  in_store: "In-store",
  referral: "Referral",
  campaign: "Campaign",
};

export type TierPlan = {
  tier: Tier;
  description: string | null;
  annual_fee_minor: number;
  validity_months: number | null;
  is_active: boolean;
  members: number;
  key_benefits: string[];
};
export type Overview = {
  tiers: TierPlan[];
  kpis: {
    total_members: number;
    total_delta_pct: number | null;
    active_members: number;
    new_this_month: number;
    revenue_minor: number;
    revenue_delta_pct: number | null;
  };
};

export type Member = {
  id: string;
  customer_code: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  segment: Tier | "not_member";
  joined_at: string;
  expires_at: string | null;
  source: Source;
  paused: boolean;
  loyalty_spend_minor: number;
  member_status: MemberStatus;
};
export type MembersResponse = {
  items: Member[];
  total: number;
  kpis: {
    total_members: number;
    total_delta_pct: number | null;
    active_members: number;
    active_pct: number;
    expiring_this_month: number;
    revenue_minor: number;
    revenue_delta_pct: number | null;
  };
  tier_summary: {
    tier: BenefitTier;
    members: number;
    share_pct: number;
    avg_spend_minor: number;
    renewal_rate_pct: number | null;
  }[];
};
export type Renewal = {
  id: string;
  customer_id: string;
  customer_name: string;
  tier: Tier;
  amount_minor: number;
  created_at: string;
};

export type BenefitType =
  | "loyalty_reward"
  | "loyalty_multiplier"
  | "coupon"
  | "shipping"
  | "access"
  | "service"
  | "price";
export const BENEFIT_TYPE: Record<
  BenefitType,
  { label: string; icon: typeof GiftIcon }
> = {
  loyalty_reward: { label: "Loyalty Reward", icon: GiftIcon },
  loyalty_multiplier: { label: "Loyalty Multiplier", icon: ChartBarLineIcon },
  coupon: { label: "Coupon Benefit", icon: Ticket01Icon },
  shipping: { label: "Shipping Benefit", icon: DeliveryTruck01Icon },
  access: { label: "Access Benefit", icon: Tag01Icon },
  service: { label: "Service Benefit", icon: CustomerSupportIcon },
  price: { label: "Price Benefit", icon: UserCheck01Icon },
};
export type Benefit = {
  id: string;
  name: string;
  benefit_type: BenefitType;
  usage_limit: string | null;
  status: "active" | "draft";
  /** A tier present = included; the text is its value ("1.25x"), "" when it just applies. */
  tiers: Partial<Record<BenefitTier, string>>;
};
export type BenefitsResponse = {
  items: Benefit[];
  kpis: {
    total: number;
    active: number;
    tier_links: number;
    members_using: number;
    members: number;
  };
  summary: {
    tier: BenefitTier;
    benefits: { name: string; value: string | null }[];
  }[];
};

/** A built-in qualification rule (Membership > Rules): its thresholds are membership settings, read live. */
export type QualificationRule = {
  id: string;
  kind: "qualification";
  name: string;
  /** The built-in name: what an empty name in the edit dialog goes back to. */
  default_name: string;
  applies_to: string;
  /** Chosen "applies to" / "action" (null when the rule has no choice) and the values it accepts. */
  applies_value: string | null;
  action_value: string | null;
  applies_choices: string[];
  action_choices: string[];
  trigger_text: string;
  action_text: string;
  frequency: "real_time";
  /** Paused: a tier is never awarded, and a paused inactive rule never fires. */
  status: "active" | "paused";
  /** Can be paused (every rule but the one that starts membership). */
  pausable: boolean;
  system: true;
  /** The points (or days) setting an edit changes; null = nothing to configure. */
  field: string | null;
  value: number | null;
  /** Tiers only: minimum spend since joining and minimum orders (0 = none). */
  min_spend_minor: number | null;
  min_orders: number | null;
};
export type RulesResponse = {
  qualification: QualificationRule[];
  automations: CrmRule[];
  kpis: {
    total: number;
    active: number;
    automated_upgrades: number;
    expiring_30d: number;
    automation_events_this_month: number;
  };
};

export type HistoryEntry = {
  id: number;
  action: string;
  created_at: string;
  detail: Record<string, unknown>;
  actor: string;
};

export const pctText = (n: number | null) =>
  n === null ? null : `${n >= 0 ? "+" : ""}${n}%`;
