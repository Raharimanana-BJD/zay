import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@zay-app/api/routers/index";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Spinner, useToast } from "heroui-native";
import { useEffect, useRef, useState } from "react";
import { Linking, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AuthImage } from "@/components/auth-image";
import { OfflineBanner } from "@/components/offline-banner";
import {
  type Place,
  PlacePicker,
  toPlaceInput,
} from "@/components/place-picker";
import { ReasonSheet } from "@/components/reason-sheet";
import { ReportButton } from "@/components/report-button";
import { Sheet } from "@/components/sheet";
import {
  Action,
  Body,
  Card,
  Heading,
  Loading,
  Muted,
  Notice,
  Row,
  Stepper,
} from "@/components/ui";
import { type MapMarker, ZayMap } from "@/components/zay-map";
import { formatAge, formatAr, formatDistance } from "@/lib/format";
import { type TKey, useI18n } from "@/lib/i18n";
import { useAction, useErrorToast } from "@/lib/use-action";
import { useCountdown } from "@/lib/use-countdown";
import { queryClient, trpc, trpcClient } from "@/utils/trpc";

type Booking = inferRouterOutputs<AppRouter>["client"]["booking"];
type Offer = Booking["offers"][number];

const POLL_MS = 3000;
const CANCEL_REASONS = [
  "client_changed_mind",
  "driver_absent",
  "other",
] as const;
const DISPUTE_REASONS = ["payment", "price", "behavior", "other"] as const;
const ENDED = [
  "COMPLETED",
  "DISPUTED",
  "CANCELLED",
  "EXPIRED",
  "NO_DRIVER_FOUND",
];

function OfferCard({
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
  const [countering, setCountering] = useState(false);
  const [amount, setAmount] = useState(offer.currentPriceAr ?? offer.quotedAr);
  type Answer =
    | { action: "accept" | "refuse" }
    | { action: "counter"; amountAr: number };
  const answer = useAction<Answer>(
    (input) =>
      trpcClient.client.answerOffer.mutate({
        ...input,
        offerId: offer.id,
      } as never),
    refresh
  );
  const vehicle = [offer.make, offer.model].filter(Boolean).join(" ");
  return (
    <Card>
      <View className="flex-row items-center gap-3">
        {offer.photoUrl ? (
          <AuthImage label={vehicle} uri={offer.photoUrl} />
        ) : null}
        <View className="flex-1">
          <Text className="font-bold text-foreground text-lg">
            {t(`category.${offer.category}` as TKey)} ·{" "}
            {formatAr(offer.currentPriceAr)}
          </Text>
          <Muted>
            {offer.driverName} · {vehicle}
            {offer.registration ? ` · ${offer.registration}` : ""}
          </Muted>
          <Muted>
            {t("offer.seats", { n: offer.capacity })}
            {offer.distanceM === null
              ? ""
              : ` · ${t("offer.away", { distance: formatDistance(offer.distanceM) })}`}
          </Muted>
        </View>
      </View>
      <Row label={t("offer.indicative")} value={formatAr(offer.quotedAr)} />
      {offer.reasonCode ? (
        <Muted>{t(`price.${offer.reasonCode}` as TKey)}</Muted>
      ) : null}
      <Muted>{t("offer.timeLeft", { n: left })}</Muted>
      {offer.waitingDriver ? (
        <View className="flex-row items-center gap-2">
          <Spinner size="sm" />
          <Body>
            {t("offer.waitingDriver", {
              amount: formatAr(offer.currentPriceAr),
            })}
          </Body>
        </View>
      ) : (
        <View className="gap-2">
          <Action
            isLoading={answer.isPending}
            label={t("offer.accept", {
              amount: formatAr(offer.currentPriceAr),
            })}
            onPress={() => answer.run({ action: "accept" })}
          />
          {offer.canCounter ? (
            <Action
              label={t("offer.counter")}
              onPress={() => setCountering(true)}
              variant="secondary"
            />
          ) : null}
          <Action
            label={t("offer.refuse")}
            onPress={() => answer.run({ action: "refuse" })}
            variant="tertiary"
          />
        </View>
      )}
      <Sheet
        onClose={() => setCountering(false)}
        title={t("offer.counter")}
        visible={countering}
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
          step={100}
          value={amount}
        />
        <Muted>{t("offer.counterOnce")}</Muted>
        <Action
          isLoading={answer.isPending}
          label={t("offer.sendCounter")}
          onPress={() => {
            answer.run({ action: "counter", amountAr: amount });
            setCountering(false);
          }}
        />
      </Sheet>
    </Card>
  );
}

function Searching({
  booking,
  updatedAt,
  refresh,
}: {
  booking: Booking;
  updatedAt: number;
  refresh: () => void;
}) {
  const { t } = useI18n();
  return (
    <View className="gap-3">
      {booking.lastChange?.type === "driver_replaced" ? (
        <Notice tone="warning">{t("booking.driverLeft")}</Notice>
      ) : null}
      {booking.offers.length === 0 ? (
        <View className="flex-row items-center gap-3 py-2">
          <Spinner />
          <View className="flex-1">
            <Heading>{t("booking.searching")}</Heading>
            <Muted>
              {booking.search
                ? t("booking.round", {
                    n: booking.search.round,
                    max: booking.search.maxRounds,
                  })
                : ""}
            </Muted>
          </View>
        </View>
      ) : (
        <Heading>{t("booking.compare")}</Heading>
      )}
      {booking.offers.map((offer) => (
        <OfferCard
          key={offer.id}
          offer={offer}
          refresh={refresh}
          updatedAt={updatedAt}
        />
      ))}
    </View>
  );
}

const STEPS = ["ACCEPTED", "DRIVER_ARRIVING", "ARRIVED", "IN_PROGRESS"];

function ActiveRide({
  booking,
  refresh,
}: {
  booking: Booking;
  refresh: () => void;
}) {
  const { t } = useI18n();
  const showError = useErrorToast();
  const driver = booking.driver;
  const [picking, setPicking] = useState(false);
  const [preview, setPreview] = useState<{
    place: Place;
    newPriceAr: number;
  } | null>(null);
  const request = useAction<{ destination: ReturnType<typeof toPlaceInput> }>(
    (input) =>
      trpcClient.client.requestDestination.mutate({
        ...input,
        bookingId: booking.id,
      }),
    refresh
  );
  const canChangeDestination =
    (booking.status === "ACCEPTED" || booking.status === "DRIVER_ARRIVING") &&
    !booking.destinationChange;
  return (
    <View className="gap-3">
      <Heading>{t(`status.${booking.status}` as TKey)}</Heading>
      <View className="flex-row gap-1">
        {STEPS.map((step, index) => (
          <View
            className={`h-1.5 flex-1 rounded-full ${
              index <= STEPS.indexOf(booking.status)
                ? "bg-foreground"
                : "bg-surface-tertiary"
            }`}
            key={step}
          />
        ))}
      </View>
      {driver?.position?.isStale ? (
        <Notice tone="warning">
          {t("tracking.stale", { age: formatAge(driver.position.ageS, t) })}
        </Notice>
      ) : null}
      {driver && !driver.position ? (
        <Notice>{t("tracking.none")}</Notice>
      ) : null}
      {driver ? (
        <Card>
          <View className="flex-row items-center gap-3">
            {driver.photoUrl ? (
              <AuthImage label={driver.model} uri={driver.photoUrl} />
            ) : null}
            <View className="flex-1">
              <Text className="font-bold text-foreground text-lg">
                {driver.name}
              </Text>
              <Muted>
                {t(`category.${driver.category}` as TKey)} ·{" "}
                {[driver.make, driver.model].filter(Boolean).join(" ")}
                {driver.registration ? ` · ${driver.registration}` : ""}
              </Muted>
            </View>
          </View>
          <Row
            label={t("booking.agreed")}
            strong
            value={formatAr(booking.agreedPriceAr)}
          />
          <Action
            label={t("tracking.call")}
            onPress={() => Linking.openURL(`tel:${driver.phone}`)}
            variant="secondary"
          />
        </Card>
      ) : null}
      {booking.destinationChange ? (
        <Notice>
          {t("destination.waiting", {
            amount: formatAr(booking.destinationChange.newPriceAr),
          })}
        </Notice>
      ) : null}
      {canChangeDestination ? (
        <Action
          label={t("destination.change")}
          onPress={() => setPicking(true)}
          variant="secondary"
        />
      ) : null}
      <PlacePicker
        onClose={() => setPicking(false)}
        onPick={async (place) => {
          try {
            const result = await trpcClient.client.previewDestination.mutate({
              bookingId: booking.id,
              destination: toPlaceInput(place),
            });
            setPreview({ place, newPriceAr: result.newPriceAr });
          } catch (error) {
            showError(error);
          }
        }}
        title={t("destination.change")}
        visible={picking}
      />
      <Sheet
        onClose={() => setPreview(null)}
        title={t("destination.confirmTitle")}
        visible={preview !== null}
      >
        <Row
          label={t("destination.oldPrice")}
          value={formatAr(booking.agreedPriceAr)}
        />
        <Row
          label={t("destination.newPrice")}
          strong
          value={formatAr(preview?.newPriceAr)}
        />
        <Muted>{t("destination.explain")}</Muted>
        <Action
          isLoading={request.isPending}
          label={t("destination.send")}
          onPress={() => {
            if (preview) {
              request.run({ destination: toPlaceInput(preview.place) });
              setPreview(null);
            }
          }}
        />
      </Sheet>
    </View>
  );
}

function Ended({
  booking,
  refresh,
}: {
  booking: Booking;
  refresh: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const { toast } = useToast();
  const [disputing, setDisputing] = useState(false);
  const dispute = useAction<{ reasonCode: string; reasonNote?: string }>(
    (input) =>
      trpcClient.client.disputePayment.mutate({
        ...input,
        bookingId: booking.id,
      }),
    refresh
  );
  const { payment } = booking;
  const isCompleted =
    booking.status === "COMPLETED" || booking.status === "DISPUTED";
  return (
    <View className="gap-3">
      <Heading>{t(`status.${booking.status}` as TKey)}</Heading>
      {booking.status === "NO_DRIVER_FOUND" ? (
        <Body>{t("booking.noDriver")}</Body>
      ) : null}
      {booking.status === "CANCELLED" && booking.lastChange?.reasonCode ? (
        <Muted>{t(`cancel.${booking.lastChange.reasonCode}` as TKey)}</Muted>
      ) : null}
      {isCompleted && payment ? (
        <Card>
          <Row
            label={t("booking.agreed")}
            strong
            value={formatAr(payment.agreedAmountAr)}
          />
          <Row
            label={t("payment.declared")}
            value={formatAr(payment.declaredAmountAr)}
          />
          <Row
            label={t("payment.title")}
            value={t(`payment.${payment.status}` as TKey)}
          />
        </Card>
      ) : null}
      {isCompleted && payment?.status !== "disputed" ? (
        <Action
          label={t("payment.dispute")}
          onPress={() => setDisputing(true)}
          variant="secondary"
        />
      ) : null}
      <Action
        label={t("booking.newRide")}
        onPress={() => router.replace("/reserver")}
      />
      <ReasonSheet
        confirmLabel={t("payment.dispute")}
        isLoading={dispute.isPending}
        labelPrefix="dispute"
        onClose={() => setDisputing(false)}
        onConfirm={(answer) => {
          dispute.run(answer);
          setDisputing(false);
          toast.show({ variant: "success", label: t("payment.disputeSent") });
        }}
        reasons={DISPUTE_REASONS}
        title={t("payment.dispute")}
        visible={disputing}
      />
    </View>
  );
}

function useStatusAlert(status?: string, offers?: number) {
  const previous = useRef<string | null>(null);
  const key = status ? `${status}:${offers ?? 0}` : null;
  useEffect(() => {
    if (previous.current && key && previous.current !== key) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined
      );
    }
    previous.current = key;
  }, [key]);
}

export default function BookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const query = useQuery({
    ...trpc.client.booking.queryOptions({ id }),
    refetchInterval: (state) =>
      state.state.data && ENDED.includes(state.state.data.status)
        ? false
        : POLL_MS,
  });
  const booking = query.data;
  const refresh = () => {
    query.refetch();
    queryClient.invalidateQueries(trpc.client.activeBooking.queryFilter());
  };
  const cancel = useAction<{ reasonCode: string; reasonNote?: string }>(
    (input) => trpcClient.client.cancel.mutate({ ...input, bookingId: id }),
    refresh
  );
  useStatusAlert(booking?.status, booking?.offers.length);

  if (!booking) {
    return query.isError ? (
      <SafeAreaView className="flex-1 gap-3 bg-background p-4">
        <Notice tone="warning">{t("errors.network")}</Notice>
        <Action label={t("common.retry")} onPress={() => query.refetch()} />
        <Action
          label={t("common.back")}
          onPress={() => router.replace("/reserver")}
          variant="tertiary"
        />
      </SafeAreaView>
    ) : (
      <Loading />
    );
  }

  const markers: MapMarker[] = [
    { id: "pickup", kind: "pickup", ...booking.pickup },
    { id: "destination", kind: "destination", ...booking.destination },
  ];
  const position = booking.driver?.position;
  if (position) {
    markers.push({
      id: "driver",
      kind: "driver",
      lat: position.lat,
      lng: position.lng,
      stale: position.isStale,
    });
  }
  const isSearching =
    booking.status === "SEARCHING" ||
    booking.status === "OFFERED" ||
    booking.status === "PENDING";
  const isEnded = ENDED.includes(booking.status);
  const canCancel = !isEnded && booking.status !== "IN_PROGRESS";

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <View className="h-[30%]">
        <ZayMap label={t("home.map")} markers={markers} />
      </View>
      <ScrollView
        contentContainerClassName="gap-3 p-4 pb-8"
        keyboardShouldPersistTaps="handled"
      >
        <OfflineBanner />
        <Muted>
          {booking.pickup.label} → {booking.destination.label}
        </Muted>
        {isSearching ? (
          <Searching
            booking={booking}
            refresh={refresh}
            updatedAt={query.dataUpdatedAt}
          />
        ) : null}
        {isEnded ? <Ended booking={booking} refresh={refresh} /> : null}
        {isSearching || isEnded ? null : (
          <ActiveRide booking={booking} refresh={refresh} />
        )}
        {canCancel ? (
          <Action
            label={t("booking.cancel")}
            onPress={() => setCancelling(true)}
            variant="tertiary"
          />
        ) : null}
        {booking.status === "IN_PROGRESS" ? (
          <Muted>{t("booking.inRideHelp")}</Muted>
        ) : null}
        {isSearching ? null : <ReportButton bookingId={booking.id} />}
      </ScrollView>
      <ReasonSheet
        confirmLabel={t("booking.cancelConfirm")}
        isLoading={cancel.isPending}
        labelPrefix="cancel"
        onClose={() => setCancelling(false)}
        onConfirm={(answer) => {
          cancel.run(answer);
          setCancelling(false);
        }}
        reasons={CANCEL_REASONS}
        title={t("booking.cancel")}
        visible={cancelling}
      />
    </SafeAreaView>
  );
}
