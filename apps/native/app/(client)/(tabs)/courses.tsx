import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";

import { HistoryRow } from "@/components/history-list";
import {
  Action,
  Card,
  EmptyState,
  INK,
  Loading,
  Screen,
  Segment,
  Title,
} from "@/components/ui";
import { type TKey, useI18n } from "@/lib/i18n";
import { trpc } from "@/utils/trpc";

type View_ = "current" | "history";

export default function ClientRides() {
  const { t } = useI18n();
  const router = useRouter();
  const [view, setView] = useState<View_>("current");
  const active = useQuery(trpc.client.activeBooking.queryOptions());
  const history = useQuery(trpc.client.history.queryOptions({ page: 1 }));
  const { refetch: refetchActive } = active;
  const { refetch: refetchHistory } = history;
  useFocusEffect(
    useCallback(() => {
      refetchActive();
      refetchHistory();
    }, [refetchActive, refetchHistory])
  );

  const book = {
    label: t("rides.book"),
    onPress: () => router.push("/reserver"),
  };
  const hasHistory = Boolean(history.data?.length);

  const current = () => {
    if (active.data === undefined) {
      return <Loading />;
    }
    if (!active.data) {
      return hasHistory ? (
        <EmptyState
          action={book}
          body={t("rides.noCurrentBody")}
          icon="car-outline"
          label={t("rides.noCurrent")}
        />
      ) : (
        <EmptyState
          action={book}
          body={t("rides.emptyBody")}
          label={t("history.empty")}
        />
      );
    }
    const ride = active.data;
    return (
      <Card>
        <View className="flex-row items-center gap-4">
          <View className="size-12 items-center justify-center rounded-full bg-brand">
            <Ionicons color={INK} name="car" size={22} />
          </View>
          <View className="flex-1">
            <Text className="font-bold text-muted text-xs uppercase tracking-widest">
              {t("rides.current")}
            </Text>
            <Text className="font-bold text-foreground text-lg">
              {t(`status.${ride.status}` as TKey)}
            </Text>
          </View>
        </View>
        <Action
          label={t("rides.open")}
          onPress={() => router.push(`/booking/${ride.id}`)}
        />
      </Card>
    );
  };

  const past = () => {
    if (history.data === undefined) {
      return <Loading />;
    }
    if (!hasHistory) {
      return (
        <EmptyState
          action={book}
          body={t("rides.emptyBody")}
          label={t("history.empty")}
        />
      );
    }
    return history.data?.map((item) => (
      <HistoryRow item={item} key={item.id} />
    ));
  };

  return (
    <Screen>
      <Title>{t("nav.rides")}</Title>
      <Segment<View_>
        onChange={setView}
        options={[
          { value: "current", label: t("rides.current") },
          { value: "history", label: t("rides.history") },
        ]}
        value={view}
      />
      <View className="gap-3 pt-2">
        {view === "current" ? current() : past()}
      </View>
    </Screen>
  );
}
