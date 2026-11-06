import { Badge } from "@zay-app/ui/components/badge";
import {
  CircleDotIcon,
  ClockIcon,
  type LucideIcon,
  MinusCircleIcon,
  TriangleAlertIcon,
} from "lucide-react";

import {
  BOOKING_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  REPORT_STATUS_LABELS,
  VERIFICATION_STATUS_LABELS,
} from "@/lib/labels";

type Tone = "active" | "waiting" | "neutral" | "problem";

const TONES: Record<
  Tone,
  {
    variant: "default" | "secondary" | "outline" | "destructive";
    icon: LucideIcon;
  }
> = {
  active: { variant: "default", icon: CircleDotIcon },
  waiting: { variant: "secondary", icon: ClockIcon },
  neutral: { variant: "outline", icon: MinusCircleIcon },
  problem: { variant: "destructive", icon: TriangleAlertIcon },
};

const KINDS = {
  booking: {
    labels: BOOKING_STATUS_LABELS,
    tones: {
      SEARCHING: "active",
      OFFERED: "active",
      ACCEPTED: "active",
      DRIVER_ARRIVING: "active",
      ARRIVED: "active",
      IN_PROGRESS: "active",
      PENDING: "waiting",
      COMPLETED: "waiting",
      CANCELLED: "neutral",
      EXPIRED: "neutral",
      NO_DRIVER_FOUND: "problem",
      DISPUTED: "problem",
    },
  },
  verification: {
    labels: VERIFICATION_STATUS_LABELS,
    tones: {
      approved: "active",
      pending: "waiting",
      changes_requested: "waiting",
      rejected: "problem",
      suspended: "problem",
    },
  },
  report: {
    labels: REPORT_STATUS_LABELS,
    tones: {
      in_progress: "active",
      open: "waiting",
      resolved: "waiting",
      closed: "neutral",
    },
  },
  payment: {
    labels: PAYMENT_STATUS_LABELS,
    tones: {
      paid: "active",
      pending: "waiting",
      partial: "waiting",
      disputed: "problem",
    },
  },
} as const satisfies Record<
  string,
  { labels: Record<string, string>; tones: Record<string, Tone> }
>;

export default function StatusBadge({
  kind,
  status,
}: {
  kind: keyof typeof KINDS;
  status: string;
}) {
  const { labels, tones } = KINDS[kind];
  const tone = (tones as Record<string, Tone>)[status] ?? "neutral";
  const { variant, icon: Icon } = TONES[tone];
  return (
    <Badge variant={variant}>
      <Icon aria-hidden="true" />
      {(labels as Record<string, string>)[status] ?? status}
    </Badge>
  );
}
