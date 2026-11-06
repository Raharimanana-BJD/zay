import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

import { HistoryRow } from "@/components/history-list";
import { EmptyState, Loading, Screen, Title } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/utils/trpc";

export default function ClientHistory() {
  const { t } = useI18n();
  const history = useQuery(trpc.client.history.queryOptions({ page: 1 }));
  const { refetch } = history;
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );
  return (
    <Screen>
      <Title>{t("nav.rides")}</Title>
      {history.isPending ? <Loading /> : null}
      {history.data?.length === 0 ? (
        <EmptyState label={t("history.empty")} />
      ) : null}
      {history.data?.map((item) => (
        <HistoryRow item={item} key={item.id} />
      ))}
    </Screen>
  );
}
