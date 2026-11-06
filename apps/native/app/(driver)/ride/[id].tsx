import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useToast } from "heroui-native";
import { useState } from "react";
import { Linking, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { OfflineBanner } from "@/components/offline-banner";
import { ReasonSheet } from "@/components/reason-sheet";
import { ReportButton } from "@/components/report-button";
import {
  Action,
  Card,
  Heading,
  Loading,
  Muted,
  Notice,
  Row,
  Stepper,
} from "@/components/ui";
import { type MapMarker, ZayMap } from "@/components/zay-map";
import { formatAr, formatDistance } from "@/lib/format";
import { type TKey, useI18n } from "@/lib/i18n";
import { useAction, useErrorToast } from "@/lib/use-action";
import { queryClient, trpc, trpcClient } from "@/utils/trpc";

const POLL_MS = 3000;
const AR_STEP = 100;

type Step = "DRIVER_ARRIVING" | "ARRIVED" | "IN_PROGRESS" | "COMPLETED";
const NEXT: Record<string, { to: Step; label: TKey }> = {
  ACCEPTED: { to: "DRIVER_ARRIVING", label: "ride.goToClient" },
  DRIVER_ARRIVING: { to: "ARRIVED", label: "ride.arrived" },
  ARRIVED: { to: "IN_PROGRESS", label: "ride.start" },
  IN_PROGRESS: { to: "COMPLETED", label: "ride.finish" },
};
const WITHDRAW_REASONS = ["driver_unavailable", "other"] as const;
const ARRIVED_REASONS = [
  "client_absent",
  "driver_unavailable",
  "other",
] as const;

const openDirections = (lat: number, lng: number) =>
  Linking.openURL(
    `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
  );

function PaymentForm({
  bookingId,
  agreedAr,
  declaredAr,
  disputed,
  refresh,
}: {
  bookingId: string;
  agreedAr: number;
  declaredAr: number | null;
  disputed: boolean;
  refresh: () => void;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [amount, setAmount] = useState(declaredAr ?? agreedAr);
  const declare = useAction<{ amountAr: number }>(
    (input) => trpcClient.driver.declarePayment.mutate({ ...input, bookingId }),
    refresh
  );
  if (disputed) {
    return <Notice tone="warning">{t("payment.disputedDriver")}</Notice>;
  }
  return (
    <Card>
      <Heading>{t("payment.declareTitle")}</Heading>
      <Muted>{t("payment.declareHint")}</Muted>
      <Stepper
        label={formatAr(amount)}
        max={agreedAr * 2}
        min={0}
        onChange={setAmount}
        step={AR_STEP}
        value={amount}
      />
      <Action
        isLoading={declare.isPending}
        label={t("payment.declare")}
        onPress={() => {
          declare.run({ amountAr: amount });
          toast.show({ variant: "success", label: t("payment.declared") });
        }}
      />
    </Card>
  );
}

export default function RideScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const router = useRouter();
  const showError = useErrorToast();
  const [withdrawing, setWithdrawing] = useState(false);
  const query = useQuery({
    ...trpc.driver.ride.queryOptions({ id }),
    refetchInterval: POLL_MS,
  });
  const ride = query.data;
  const refresh = () => {
    query.refetch();
    queryClient.invalidateQueries(trpc.driver.home.queryFilter());
  };
  const advance = useAction<{ to: Step }>(
    (input) =>
      trpcClient.driver.advanceRide.mutate({ ...input, bookingId: id }),
    refresh
  );
  const withdraw = useAction<{ reasonCode: string; reasonNote?: string }>(
    (input) => trpcClient.driver.withdraw.mutate({ ...input, bookingId: id }),
    () => {
      refresh();
      router.replace("/accueil");
    }
  );
  const answerDestination = useMutation({
    mutationFn: (accept: boolean) =>
      trpcClient.driver.answerDestination.mutate({ bookingId: id, accept }),
    onError: showError,
    onSettled: refresh,
  });

  if (!ride) {
    // After a withdrawal this booking is no longer the driver's.
    return query.isError ? (
      <SafeAreaView className="flex-1 gap-3 bg-background p-4">
        <Notice tone="warning">{t("ride.gone")}</Notice>
        <Action
          label={t("common.back")}
          onPress={() => router.replace("/accueil")}
        />
      </SafeAreaView>
    ) : (
      <Loading />
    );
  }

  const next = NEXT[ride.status];
  const headingToClient =
    ride.status === "ACCEPTED" || ride.status === "DRIVER_ARRIVING";
  const isOver =
    ride.status === "COMPLETED" ||
    ride.status === "DISPUTED" ||
    ride.status === "CANCELLED";
  const canWithdraw =
    ride.status === "ACCEPTED" ||
    ride.status === "DRIVER_ARRIVING" ||
    ride.status === "ARRIVED";
  const target = headingToClient
    ? { lat: ride.pickupLat, lng: ride.pickupLng }
    : { lat: ride.destinationLat, lng: ride.destinationLng };
  const markers: MapMarker[] = [
    { id: "pickup", kind: "pickup", lat: ride.pickupLat, lng: ride.pickupLng },
    {
      id: "destination",
      kind: "destination",
      lat: ride.destinationLat,
      lng: ride.destinationLng,
    },
  ];
  const change = ride.destinationChange;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="h-[30%]">
        <ZayMap label={t("home.map")} markers={markers} />
      </View>
      <ScrollView contentContainerClassName="gap-3 p-4 pb-8">
        <OfflineBanner />
        <Heading>{t(`status.${ride.status}` as TKey)}</Heading>
        {change ? (
          <Card>
            <Heading>{t("destination.driverTitle")}</Heading>
            <Row
              label={t("destination.oldPrice")}
              value={formatAr(change.oldPriceAr)}
            />
            <Row
              label={t("destination.newPrice")}
              strong
              value={formatAr(change.newPriceAr)}
            />
            <Row
              label={t("driver.tripDistance")}
              value={formatDistance(change.newDistanceM)}
            />
            <Action
              isLoading={answerDestination.isPending}
              label={t("common.accept")}
              onPress={() => answerDestination.mutate(true)}
            />
            <Action
              label={t("offer.refuse")}
              onPress={() => answerDestination.mutate(false)}
              variant="tertiary"
            />
          </Card>
        ) : null}
        <Card>
          <Row label={t("ride.client")} value={ride.clientName} />
          <Row label={t("home.pickup")} value={ride.pickup} />
          {ride.pickupNote ? <Muted>{ride.pickupNote}</Muted> : null}
          <Row label={t("home.destination")} value={ride.destination} />
          {ride.destinationNote ? <Muted>{ride.destinationNote}</Muted> : null}
          <Row
            label={t("booking.agreed")}
            strong
            value={formatAr(ride.agreedPriceAr)}
          />
        </Card>
        {next ? (
          <Action
            isLoading={advance.isPending}
            label={t(next.label)}
            onPress={() => advance.run({ to: next.to })}
          />
        ) : null}
        {isOver ? null : (
          <View className="gap-2">
            <Action
              label={t("ride.directions")}
              onPress={() => openDirections(target.lat, target.lng)}
              variant="secondary"
            />
            <Action
              label={t("tracking.callClient")}
              onPress={() => Linking.openURL(`tel:${ride.clientPhone}`)}
              variant="secondary"
            />
          </View>
        )}
        {(ride.status === "COMPLETED" || ride.status === "DISPUTED") &&
        ride.paymentStatus ? (
          <PaymentForm
            agreedAr={ride.agreedPriceAr as number}
            bookingId={id}
            declaredAr={ride.declaredAmountAr}
            disputed={ride.paymentStatus === "disputed"}
            refresh={refresh}
          />
        ) : null}
        {ride.declaredAmountAr === null ? null : (
          <Row
            label={t("payment.declared")}
            value={`${formatAr(ride.declaredAmountAr)} · ${t(`payment.${ride.paymentStatus}` as TKey)}`}
          />
        )}
        {canWithdraw ? (
          <Action
            label={t("ride.withdraw")}
            onPress={() => setWithdrawing(true)}
            variant="tertiary"
          />
        ) : null}
        <ReportButton bookingId={id} />
        {isOver ? (
          <Action
            label={t("ride.backHome")}
            onPress={() => router.replace("/accueil")}
          />
        ) : null}
      </ScrollView>
      <ReasonSheet
        confirmLabel={t("ride.withdrawConfirm")}
        isLoading={withdraw.isPending}
        labelPrefix="cancel"
        message={t("ride.withdrawHint")}
        onClose={() => setWithdrawing(false)}
        onConfirm={(answer) => {
          withdraw.run(answer);
          setWithdrawing(false);
        }}
        reasons={ride.status === "ARRIVED" ? ARRIVED_REASONS : WITHDRAW_REASONS}
        title={t("ride.withdraw")}
        visible={withdrawing}
      />
    </SafeAreaView>
  );
}
