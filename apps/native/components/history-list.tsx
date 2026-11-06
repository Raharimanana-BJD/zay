import { Text, View } from "react-native";

import { Card, Row } from "@/components/ui";
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

export function HistoryRow({ item }: { item: HistoryItem }) {
  const { t, locale } = useI18n();
  const status = item.withdrawn ? "status.WITHDRAWN" : `status.${item.status}`;
  return (
    <Card>
      <View className="flex-row justify-between gap-3">
        <Text className="text-muted text-sm">
          {formatDate(item.createdAt, locale)}
        </Text>
        <Text className="font-medium text-foreground text-sm">
          {t(status as TKey)}
        </Text>
      </View>
      <Text className="font-medium text-base text-foreground">
        {item.pickup} → {item.destination}
      </Text>
      {item.category ? (
        <Row
          label={t("booking.category")}
          value={t(`category.${item.category}` as TKey)}
        />
      ) : null}
      <Row label={t("booking.agreed")} value={formatAr(item.agreedPriceAr)} />
      {item.paymentStatus ? (
        <Row
          label={t("payment.title")}
          value={`${t(`payment.${item.paymentStatus}` as TKey)} · ${formatAr(item.declaredAmountAr)}`}
        />
      ) : null}
    </Card>
  );
}
