import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@zay-app/api/routers/index";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { Spinner, Switch } from "heroui-native";
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

import { OfflineBanner } from "@/components/offline-banner";
import { ReasonSheet } from "@/components/reason-sheet";
import { Sheet } from "@/components/sheet";
import {
  Action,
  Body,
  Card,
  Greeting,
  Heading,
  INK,
  Muted,
  Notice,
  Row,
  Screen,
  StatTile,
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

/** What still blocks the driver, with the way to the Dossier tab. */
function DossierBanner({ codes }: { codes: string[] }) {
  const { t } = useI18n();
  const router = useRouter();
  const title = codes.includes("ACCOUNT_NOT_APPROVED")
    ? t("driver.dossierTitle")
    : t("driver.blocked");
  return (
    <View className="gap-4 rounded-3xl bg-foreground p-5">
      <View className="flex-row gap-3">
        <View className="size-10 items-center justify-center rounded-full bg-brand">
          <Ionicons color={INK} name="warning-outline" size={20} />
        </View>
        <View className="flex-1 gap-1">
          <Text
            accessibilityRole="header"
            className="font-bold text-lg text-white"
          >
            {title}
          </Text>
          {codes.map((code) => (
            <Text className="text-sm text-white/75 leading-5" key={code}>
              {t(`errors.${code}` as TKey)}
            </Text>
          ))}
        </View>
      </View>
      <Action
        label={t("driver.dossierAction")}
        onPress={() => router.push("/dossier")}
        trailingIcon="chevron-forward"
        variant="brand"
      />
    </View>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  isDisabled,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  isDisabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View
      className={`min-h-16 flex-row items-center justify-between gap-4 ${isDisabled ? "opacity-50" : ""}`}
    >
      <View className="shrink gap-0.5">
        <Text className="font-bold text-foreground text-lg">{label}</Text>
        <Muted>{hint}</Muted>
      </View>
      <Switch
        accessibilityLabel={label}
        isDisabled={isDisabled}
        isSelected={value}
        onSelectedChange={onChange}
      />
    </View>
  );
}

export default function DriverHome() {
  const { t } = useI18n();
  const router = useRouter();
  const showError = useErrorToast();
  const me = useQuery(trpc.me.get.queryOptions());
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

  const blockers = data?.blockers ?? [];

  return (
    <Screen>
      <Greeting name={me.data?.name} />
      <View className="h-44 overflow-hidden rounded-3xl bg-map">
        <ZayMap label={t("home.map")} markers={markers} />
      </View>
      <OfflineBanner />
      {location.state === "denied" ? (
        <Notice tone="danger">{t("driver.gpsDenied")}</Notice>
      ) : null}
      {data?.ride ? (
        <Action
          icon="navigate"
          label={t("driver.openRide")}
          onPress={() => router.push(`/ride/${data.ride?.id}`)}
          variant="brand"
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
      {blockers.length > 0 ? <DossierBanner codes={blockers} /> : null}
      <View className="rounded-3xl bg-surface px-5 py-2 shadow-black/5 shadow-sm">
        <ToggleRow
          hint={t("driver.onlineHint")}
          isDisabled={availability.isPending}
          label={t("driver.online")}
          onChange={(isOnline) =>
            availability.mutate({ isOnline, isAvailable: false })
          }
          value={Boolean(data?.isOnline)}
        />
        <View className="h-px bg-separator" />
        <ToggleRow
          hint={t("driver.availableHint")}
          isDisabled={availability.isPending || !data?.isOnline}
          label={t("driver.available")}
          onChange={(isAvailable) =>
            availability.mutate({ isOnline: true, isAvailable })
          }
          value={Boolean(data?.isAvailable)}
        />
      </View>
      <View className="flex-row gap-3">
        <StatTile label={t("earnings.rides")} value={data?.today.rides ?? 0} />
        <StatTile
          label={t("earnings.collected")}
          value={formatAr(data?.today.collectedAr ?? 0)}
        />
      </View>
    </Screen>
  );
}
