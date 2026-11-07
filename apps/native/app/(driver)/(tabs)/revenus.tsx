import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { Text, View } from "react-native";

import { HistoryRow } from "@/components/history-list";
import {
  EmptyState,
  Loading,
  Screen,
  SectionLabel,
  Title,
} from "@/components/ui";
import { formatAr } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/utils/trpc";

export default function EarningsScreen() {
  const { t } = useI18n();
  const home = useQuery(trpc.driver.home.queryOptions());
  const history = useQuery(trpc.driver.history.queryOptions({ page: 1 }));
  const { refetch: refetchHome } = home;
  const { refetch: refetchHistory } = history;
  useFocusEffect(
    useCallback(() => {
      refetchHome();
      refetchHistory();
    }, [refetchHome, refetchHistory])
  );
  const today = home.data?.today;
  const renderHistory = () => {
    if (history.data === undefined) {
      return <Loading />;
    }
    if (!history.data?.length) {
      return (
        <View className="rounded-3xl bg-surface py-10">
          <EmptyState
            body={t("earnings.emptyBody")}
            icon="cash-outline"
            isOnCard
            label={t("history.empty")}
          />
        </View>
      );
    }
    return history.data.map((item) => (
      <HistoryRow
        item={{
          ...item,
          agreedPriceAr: item.agreedPriceAr ?? item.offerPriceAr,
          withdrawn: item.offerStatus === "withdrawn",
        }}
        key={item.id}
      />
    ));
  };

  return (
    <Screen>
      <Title>{t("nav.earnings")}</Title>
      <SectionLabel>{t("earnings.today")}</SectionLabel>
      <View className="gap-4 rounded-3xl bg-foreground p-6">
        <View className="gap-1">
          <Text className="font-semibold text-sm text-white/70">
            {t("earnings.collected")}
          </Text>
          <Text className="font-black text-4xl text-white">
            {formatAr(today?.collectedAr ?? 0)}
          </Text>
        </View>
        <View className="flex-row border-white/15 border-t pt-4">
          <View className="flex-1 gap-1">
            <Text className="font-semibold text-white/70 text-xs">
              {t("nav.rides")}
            </Text>
            <Text className="font-black text-lg text-white">
              {today?.rides ?? 0}
            </Text>
          </View>
          <View className="w-px bg-white/15" />
          <View className="flex-1 items-end gap-1">
            <Text className="font-semibold text-white/70 text-xs">
              {t("earnings.agreed")}
            </Text>
            <Text className="font-black text-lg text-white">
              {formatAr(today?.agreedAr ?? 0)}
            </Text>
          </View>
        </View>
      </View>
      <SectionLabel>{t("earnings.history")}</SectionLabel>
      <View className="gap-3">{renderHistory()}</View>
    </Screen>
  );
}
