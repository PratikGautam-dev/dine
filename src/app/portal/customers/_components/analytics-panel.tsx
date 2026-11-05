"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Repeat, Users, Wallet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatTile } from "@/components/portal/StatTile";
import { SectionDonut } from "@/components/portal/SectionDonut";
import { rupees } from "@/lib/foodOrders";
import type { CustomerAnalytics } from "@/hooks/useCustomerAnalytics";

function weekLabel(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Customers page's Analytics tab -- every number here is derived from data the app already
 * maintains (list_patients()/the loyalty ledger), no new tracking added. */
export function AnalyticsPanel({ analytics }: { analytics: CustomerAnalytics | null }) {
  if (!analytics) {
    return (
      <Card className="flex min-h-[200px] items-center justify-center p-space-4 text-[13px] text-ink-400">
        Loading…
      </Card>
    );
  }

  const tierData = Object.entries(analytics.tier_distribution)
    .filter(([, count]) => count > 0)
    .map(([tier, count]) => ({ department_name: tier === "None" ? "No tier yet" : tier, count }));

  const trendData = analytics.signups_by_week.map((w) => ({ label: weekLabel(w.week_start), count: w.count }));

  return (
    <div className="space-y-space-4">
      <div className="grid grid-cols-1 gap-space-3 sm:grid-cols-3">
        <StatTile
          icon={<Users size={22} />}
          label="Total customers"
          value={analytics.total_customers}
          deltaPct={null}
          hint="In your directory"
          tone="brand"
          filled
        />
        <StatTile
          icon={<Repeat size={22} />}
          label="Repeat rate"
          value={`${analytics.repeat_rate_pct}%`}
          deltaPct={null}
          hint="Customers with 2+ orders"
          tone="warning"
          filled
        />
        <StatTile
          icon={<Wallet size={22} />}
          label="Avg. spend / customer"
          value={rupees(analytics.avg_spend_paise)}
          deltaPct={null}
          hint="Lifetime average"
          tone="info"
          filled
        />
      </div>

      <div className="grid grid-cols-1 gap-space-4 lg:grid-cols-2">
        <SectionDonut
          data={tierData}
          title="Loyalty tier distribution"
          subtitle="Every customer, by current tier"
          unit="customers"
          emptyText="No customers yet."
        />
        <Card className="p-space-4">
          <div className="mb-space-3">
            <h3 className="text-[15px] font-bold text-ink-900">New customers per week</h3>
            <p className="text-hint">Last {trendData.length} weeks</p>
          </div>
          {trendData.every((w) => w.count === 0) ? (
            <div className="flex h-[220px] items-center justify-center text-[13px] text-ink-400">
              No new customers in this window.
            </div>
          ) : (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip
                    contentStyle={{ fontSize: 12.5, borderRadius: 8, borderColor: "var(--line)" }}
                    formatter={(value: number) => [`${value} new`, ""]}
                  />
                  <Bar dataKey="count" fill="#e21220" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
