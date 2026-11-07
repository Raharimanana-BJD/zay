import Ionicons from "@expo/vector-icons/Ionicons";
import { Text, View } from "react-native";

import { Card, INK, Pill } from "@/components/ui";
import { formatAr, formatDate } from "@/lib/format";
import { type TKey, useI18n } from "@/lib/i18n";

export interface HistoryItem {
  agreedPriceAr: number | null;
  category: string | null;
  createdAt: Date | string;
  declaredAmountAr: number | null;
  destination: string;
  id: string;
  paymentStatus: string | null;
  pickup: string;
  status: string;
  withdrawn?: boolean;
}

const DONE = "COMPLETED";

/** One past ride: when, where from and to, and the money. */
export function HistoryRow({ item }: { item: HistoryItem }) {
  const { t, locale } = useI18n();
  const status = item.withdrawn ? "status.WITHDRAWN" : `status.${item.status}`;
  const isDone = !item.withdrawn && item.status === DONE;
  const meta = [
    item.category ? t(`category.${item.category}` as TKey) : null,
    item.paymentStatus
      ? `${t(`payment.${item.paymentStatus}` as TKey)} · ${formatAr(item.declaredAmountAr)}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Card>
      <View className="flex-row items-center justify-between gap-3">
        <Text className="font-semibold text-muted text-sm">
          {formatDate(item.createdAt, locale)}
        </Text>
        <Pill label={t(status as TKey)} tone={isDone ? "success" : "neutral"} />
      </View>
      <View className="gap-2">
        <View className="flex-row items-center gap-3">
          <View className="size-2.5 rounded-full bg-foreground" />
          <Text
            className="flex-1 font-semibold text-base text-foreground"
            numberOfLines={1}
          >
            {item.pickup}
          </Text>
        </View>
        <View className="ml-1 h-3 w-0.5 bg-border" />
        <View className="flex-row items-center gap-2">
          <Ionicons color={INK} name="location" size={14} />
          <Text
            className="flex-1 font-semibold text-base text-foreground"
            numberOfLines={1}
          >
            {item.destination}
          </Text>
        </View>
      </View>
      <View className="flex-row items-end justify-between gap-3 border-separator border-t pt-3">
        <Text className="shrink text-muted text-sm" numberOfLines={2}>
          {meta || t("booking.agreed")}
        </Text>
        <Text className="font-black text-foreground text-lg">
          {formatAr(item.agreedPriceAr)}
        </Text>
      </View>
    </Card>
  );
}
