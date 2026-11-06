import { useQuery } from "@tanstack/react-query";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";

import { HistoryRow } from "@/components/history-list";
import {
  Card,
  EmptyState,
  Heading,
  Loading,
  Row,
  Screen,
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
  return (
    <Screen>
      <Title>{t("nav.earnings")}</Title>
      <Card>
        <Heading>{t("earnings.today")}</Heading>
        <Row label={t("earnings.rides")} value={today?.rides ?? 0} />
        <Row
          label={t("earnings.agreed")}
          value={formatAr(today?.agreedAr ?? 0)}
        />
        <Row
          label={t("earnings.collected")}
          strong
          value={formatAr(today?.collectedAr ?? 0)}
        />
      </Card>
      <Heading>{t("earnings.history")}</Heading>
      {history.isPending ? <Loading /> : null}
      {history.data?.length === 0 ? (
        <EmptyState label={t("history.empty")} />
      ) : null}
      {history.data?.map((item) => (
        <HistoryRow
          item={{
            ...item,
            agreedPriceAr: item.agreedPriceAr ?? item.offerPriceAr,
            withdrawn: item.offerStatus === "withdrawn",
          }}
          key={item.id}
        />
      ))}
    </Screen>
  );
}
