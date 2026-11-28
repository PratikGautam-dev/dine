import { Badge } from "@/components/erp-ui/Badge";
import {
  ORDER_CHANNEL_LABEL,
  ORDER_STATUS_TONE,
  PAYMENT_STATUS_TONE,
  humanize,
  type OrderChannel,
  type Order,
} from "@/lib/erp/erp";

export function ChannelBadge({ channel }: { channel: OrderChannel }) {
  return (
    <Badge tone={channel === "pos" ? "brand" : channel === "whatsapp" ? "success" : "violet"}>
      {ORDER_CHANNEL_LABEL[channel] ?? humanize(channel)}
    </Badge>
  );
}

export function OrderStatusBadge({ status }: { status: Order["status"] }) {
  return (
    <Badge tone={ORDER_STATUS_TONE[status]}>
      {status === "confirmed" ? "Placed" : humanize(status)}
    </Badge>
  );
}

export function PaymentStatusBadge({ status }: { status: Order["payment_status"] }) {
  return <Badge tone={PAYMENT_STATUS_TONE[status]}>{humanize(status)}</Badge>;
}
