import { useMutation, useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@zay-app/api/routers/index";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Spinner, Switch } from "heroui-native";
import { useEffect, useRef, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { OfflineBanner } from "@/components/offline-banner";
import { ReasonSheet } from "@/components/reason-sheet";
import { Sheet } from "@/components/sheet";
import {
  Action,
  Body,
  Card,
  Heading,
  Muted,
  Notice,
  Row,
  Screen,
  Stepper,
} from "@/components/ui";
import { type MapMarker, ZayMap } from "@/components/zay-map";
import { useDriverPosition } from "@/lib/driver-location";
import { formatAr, formatDistance } from "@/lib/format";
import { type TKey, useI18n } from "@/lib/i18n";
import { useAction, useErrorToast } from "@/lib/use-action";
import { useCountdown } from "@/lib/use-countdown";
import { trpc, trpcClient } from "@/utils/trpc";

type Offer = NonNullable<
  inferRouterOutputs<AppRouter>["driver"]["home"]["offer"]
>;

const POLL_MS = 3000;
const DEFAULT_POSITION_S = 15;
const PRICE_REASONS = [
  "distance_differs",
  "difficult_road",
  "difficult_destination",
  "other",
] as const;

type Answer =
  | { action: "accept" | "refuse" }
  | { action: "counter"; amountAr: number }
  | {
      action: "propose";
      amountAr: number;
      reasonCode: string;
      reasonNote?: string;
    };

function IncomingOffer({
  offer,
  updatedAt,
  refresh,
}: {
  offer: Offer;
  updatedAt: number;
  refresh: () => void;
}) {
  const { t } = useI18n();
  const left = useCountdown(offer.expiresInS, updatedAt);
  const start = offer.clientCounterAr ?? offer.quotedAr;
  const [amount, setAmount] = useState(start);
  const [editing, setEditing] = useState(false);
  const [needsReason, setNeedsReason] = useState(false);
  const answer = useAction<Answer>(
    (input) =>
      trpcClient.driver.answerOffer.mutate({
        ...input,
        offerId: offer.id,
      } as never),
    refresh
  );
  const isCounterTurn = offer.status === "negotiating" && !offer.waitingClient;
  const isWaiting =
    offer.status === "priced" ||
    (offer.status === "negotiating" && offer.waitingClient);

  return (
    <Card>
      <View className="flex-row items-center justify-between">
        <Heading>
          {isCounterTurn ? t("driver.counterReceived") : t("driver.newRequest")}
        </Heading>
        <Text
          accessibilityLabel={t("offer.timeLeft", { n: left })}
          className="font-bold text-2xl text-foreground"
        >
          {left}s
        </Text>
      </View>
      <Row label={t("home.pickup")} value={offer.pickup} />
      {offer.pickupNote ? <Muted>{offer.pickupNote}</Muted> : null}
      <Row label={t("home.destination")} value={offer.destination} />
      {offer.destinationNote ? <Muted>{offer.destinationNote}</Muted> : null}
      <Row
        label={t("driver.tripDistance")}
        value={formatDistance(offer.distanceM)}
      />
      {offer.toPickupM === null ? null : (
        <Row
          label={t("driver.toPickup")}
          value={formatDistance(offer.toPickupM)}
        />
      )}
      <Row
        label={t("booking.category")}
        value={`${t(`category.${offer.category}` as TKey)} · ${t("home.passengers", { n: offer.passengers })}`}
      />
      <Row
        label={isCounterTurn ? t("driver.clientPrice") : t("offer.indicative")}
        strong
        value={formatAr(isCounterTurn ? offer.clientCounterAr : offer.quotedAr)}
      />
      {isWaiting ? (
        <View className="flex-row items-center gap-2 py-1">
          <Spinner size="sm" />
          <Body>
            {t("driver.waitingClient", {
              amount: formatAr(offer.currentPriceAr),
            })}
          </Body>
        </View>
      ) : (
        <View className="gap-2">
          <Action
            isLoading={answer.isPending}
            label={t("driver.acceptPrice", {
              amount: formatAr(
                isCounterTurn ? offer.clientCounterAr : offer.quotedAr
              ),
            })}
            onPress={() => answer.run({ action: "accept" })}
          />
          {!isCounterTurn || offer.canCounter ? (
            <Action
              label={
                isCounterTurn ? t("driver.lastPrice") : t("driver.proposePrice")
              }
              onPress={() => setEditing(true)}
              variant="secondary"
            />
          ) : null}
        </View>
      )}
      <Action
        label={t("offer.refuse")}
        onPress={() => answer.run({ action: "refuse" })}
        variant="tertiary"
      />
      <Sheet
        onClose={() => setEditing(false)}
        title={isCounterTurn ? t("driver.lastPrice") : t("driver.proposePrice")}
        visible={editing}
      >
        <Muted>
          {t("offer.range", {
            min: formatAr(offer.minAr),
            max: formatAr(offer.maxAr),
          })}
        </Muted>
        <Stepper
          label={formatAr(amount)}
          max={offer.maxAr}
          min={offer.minAr}
          onChange={setAmount}
          step={offer.roundingAr}
          value={amount}
        />
        <Action
          label={t("common.continue")}
          onPress={() => {
            setEditing(false);
            if (isCounterTurn) {
              answer.run({ action: "counter", amountAr: amount });
            } else {
              setNeedsReason(true);
            }
          }}
        />
      </Sheet>
      <ReasonSheet
        confirmLabel={t("driver.sendPrice", { amount: formatAr(amount) })}
        labelPrefix="price"
        onClose={() => setNeedsReason(false)}
        onConfirm={(reason) => {
          answer.run({ action: "propose", amountAr: amount, ...reason });
          setNeedsReason(false);
        }}
        reasons={PRICE_REASONS}
        title={t("driver.priceReason")}
        visible={needsReason}
      />
    </Card>
  );
}

export default function DriverHome() {
  const { t } = useI18n();
  const router = useRouter();
  const showError = useErrorToast();
  const home = useQuery({
    ...trpc.driver.home.queryOptions(),
    refetchInterval: POLL_MS,
  });
  const data = home.data;
  const { refetch } = home;
  const availability = useMutation({
    mutationFn: (input: { isOnline: boolean; isAvailable: boolean }) =>
      trpcClient.driver.setAvailability.mutate(input),
    onError: showError,
    onSettled: () => refetch(),
  });
  const location = useDriverPosition(
    Boolean(data?.isOnline),
    data?.positionIntervalS ?? DEFAULT_POSITION_S
  );

  const offerId = data?.offer?.id;
  const seenOffer = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (offerId && offerId !== seenOffer.current) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(
        () => undefined
      );
    }
    seenOffer.current = offerId;
  }, [offerId]);

  const rideId = data?.ride?.id;
  const opened = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (rideId && rideId !== opened.current) {
      router.push(`/ride/${rideId}`);
    }
    opened.current = rideId;
  }, [rideId, router]);

  const markers: MapMarker[] = location.coords
    ? [
        {
          id: "driver",
          kind: "driver",
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        },
      ]
    : [];
  if (data?.offer) {
    markers.push(
      {
        id: "pickup",
        kind: "pickup",
        lat: data.offer.pickupLat,
        lng: data.offer.pickupLng,
      },
      {
        id: "destination",
        kind: "destination",
        lat: data.offer.destinationLat,
        lng: data.offer.destinationLng,
      }
    );
  }

  return (
    <Screen scroll={false}>
      <View className="h-[30%]">
        <ZayMap label={t("home.map")} markers={markers} />
      </View>
      <ScrollView contentContainerClassName="gap-3 p-4">
        <OfflineBanner />
        {data?.blockers.map((code) => (
          <Notice key={code} tone="warning">
            {t(`errors.${code}` as TKey)}
          </Notice>
        ))}
        {location.state === "denied" ? (
          <Notice tone="danger">{t("driver.gpsDenied")}</Notice>
        ) : null}
        {data?.ride ? (
          <Action
            label={t("driver.openRide")}
            onPress={() => router.push(`/ride/${data.ride?.id}`)}
          />
        ) : null}
        {data?.offer ? (
          <IncomingOffer
            key={data.offer.id}
            offer={data.offer}
            refresh={refetch}
            updatedAt={home.dataUpdatedAt}
          />
        ) : null}
        <Card>
          <View className="min-h-12 flex-row items-center justify-between">
            <View className="shrink">
              <Body>{t("driver.online")}</Body>
              <Muted>{t("driver.onlineHint")}</Muted>
            </View>
            <Switch
              accessibilityLabel={t("driver.online")}
              isDisabled={availability.isPending}
              isSelected={Boolean(data?.isOnline)}
              onSelectedChange={(isOnline) =>
                availability.mutate({ isOnline, isAvailable: false })
              }
            />
          </View>
          <View className="min-h-12 flex-row items-center justify-between">
            <View className="shrink">
              <Body>{t("driver.available")}</Body>
              <Muted>{t("driver.availableHint")}</Muted>
            </View>
            <Switch
              accessibilityLabel={t("driver.available")}
              isDisabled={availability.isPending || !data?.isOnline}
              isSelected={Boolean(data?.isAvailable)}
              onSelectedChange={(isAvailable) =>
                availability.mutate({ isOnline: true, isAvailable })
              }
            />
          </View>
        </Card>
        <Card>
          <Row label={t("earnings.rides")} value={data?.today.rides ?? 0} />
          <Row
            label={t("earnings.collected")}
            value={formatAr(data?.today.collectedAr ?? 0)}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}
