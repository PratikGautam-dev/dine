"use client";

import Link from "next/link";
import { readinessStatus, useReadiness } from "@/components/portal/channels/ChannelPanels";
import { Badge } from "@/components/erp-ui/Badge";
import { CHANNELS, type Channel } from "@/lib/erp/erp";

const READY_LABEL: Record<Channel, string> = {
  online: "Connected",
  pos: "Ready",
  whatsapp: "Connected",
};

/** One line at the top of a channel's working page: is it set up, and where to manage that. Nothing for people without the channels permission. */
export function ChannelStatusStrip({ channel }: { channel: Channel }) {
  const { data, error } = useReadiness(channel);
  if (error)
    return (
      <div className="mb-space-4 rounded-md border border-line bg-card px-space-4 py-space-2 text-[13.5px] text-error">
        Couldn&apos;t load the {CHANNELS[channel].label} status: {error.message}
      </div>
    );
  if (!data) return null;
  const st = readinessStatus(data);
  const label = data.ready ? READY_LABEL[channel] : st.label;
  return (
    <div className="mb-space-4 flex flex-col items-start gap-space-2 rounded-md border border-line bg-card px-space-3 py-space-3 text-[13.5px] md:flex-row md:flex-wrap md:items-center md:gap-space-3 md:px-space-4 md:py-space-2">
      <Badge className="shrink-0" tone={data.ready ? "success" : st.tone}>
        {label}
      </Badge>
      <div className="flex w-full min-w-0 items-baseline justify-between gap-space-2 md:w-auto md:flex-1 md:gap-space-3">
        <span className="min-w-0 text-ink-600">
          {data.ready
            ? `${CHANNELS[channel].label} is set up.`
            : data.in_plan
              ? `${CHANNELS[channel].label} isn't fully set up yet.`
              : data.ended
                ? `Your ${CHANNELS[channel].label} plan has ended.`
                : `You haven't bought ${CHANNELS[channel].label} yet.`}
        </span>
        <Link
          href={`/portal/settings/channels/${channel}`}
          className="shrink-0 font-semibold text-brand-600 hover:underline"
        >
          Manage in Settings →
        </Link>
      </div>
    </div>
  );
}
