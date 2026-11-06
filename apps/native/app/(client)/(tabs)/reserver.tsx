import { useMutation, useQuery } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { OfflineBanner } from "@/components/offline-banner";
import {
  currentPlace,
  type Place,
  PlacePicker,
  toPlaceInput,
} from "@/components/place-picker";
import {
  Action,
  Muted,
  Notice,
  Screen,
  Segment,
  Stepper,
} from "@/components/ui";
import { type MapMarker, ZayMap } from "@/components/zay-map";
import { formatAr, formatDistance } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useAction } from "@/lib/use-action";
import { trpc, trpcClient } from "@/utils/trpc";

type Category = "car" | "tuk_tuk" | "auto";
const MAX_PASSENGERS = 4;

function PlaceField({
  label,
  value,
  onPress,
}: {
  label: string;
  value?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className="min-h-14 justify-center rounded-xl bg-surface-tertiary px-4 py-2"
      onPress={onPress}
    >
      <Text className="text-muted text-xs">{label}</Text>
      <Text
        className={`text-base ${value ? "font-medium text-foreground" : "text-muted"}`}
        numberOfLines={1}
      >
        {value ?? label}
      </Text>
    </Pressable>
  );
}

export default function BookScreen() {
  const { t, has } = useI18n();
  const router = useRouter();
  const [pickup, setPickup] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [picking, setPicking] = useState<"pickup" | "destination" | null>(null);
  const [category, setCategory] = useState<Category>("auto");
  const [passengers, setPassengers] = useState(1);
  const requested = useRef(false);

  // A ride survives a closed app or a lost connection: bring the rider back to it.
  const active = useQuery(trpc.client.activeBooking.queryOptions());
  const { refetch } = active;
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  useEffect(() => {
    if (requested.current) {
      return;
    }
    requested.current = true;
    currentPlace(t("place.myPosition"))
      .then((place) => {
        if (place) {
          setPickup((current) => current ?? place);
        }
      })
      .catch(() => undefined);
  }, [t]);

  const quote = useMutation({
    mutationFn: () =>
      trpcClient.client.quote.mutate({
        pickup: toPlaceInput(pickup as Place),
        destination: toPlaceInput(destination as Place),
        passengers,
      }),
  });
  const { mutate: requestQuote } = quote;
  // biome-ignore lint/correctness/useExhaustiveDependencies: each of these changes the price
  useEffect(() => {
    if (pickup && destination) {
      requestQuote();
    }
  }, [pickup, destination, passengers, requestQuote]);

  const create = useAction<object>(
    async (input) => {
      const created = await trpcClient.client.createBooking.mutate({
        ...(input as { clientRequestId: string }),
        category,
        passengers,
        pickup: toPlaceInput(pickup as Place),
        destination: toPlaceInput(destination as Place),
      });
      router.push(`/booking/${created.id}`);
    },
    () => refetch()
  );

  const quoteOf = (value: "car" | "tuk_tuk") =>
    quote.data?.quotes.find((row) => row.category === value);
  const hintOf = (value: "car" | "tuk_tuk") => {
    if (!quote.data) {
      return;
    }
    const row = quoteOf(value);
    return row ? formatAr(row.amountAr) : t("home.tooSmall");
  };

  const markers: MapMarker[] = [];
  if (pickup) {
    markers.push({ id: "pickup", kind: "pickup", ...pickup });
  }
  if (destination) {
    markers.push({ id: "destination", kind: "destination", ...destination });
  }

  const quoteError = quote.error ? `errors.${quote.error.message}` : null;
  const available =
    category === "auto"
      ? Boolean(quote.data?.quotes.length)
      : Boolean(quoteOf(category));

  return (
    <Screen scroll={false}>
      <View className="h-[34%]">
        <ZayMap
          label={t("home.map")}
          line={quote.data?.line}
          markers={markers}
        />
      </View>
      <ScrollView
        contentContainerClassName="gap-3 p-4"
        keyboardShouldPersistTaps="handled"
      >
        <OfflineBanner />
        {active.data ? (
          <Action
            label={t("home.resume")}
            onPress={() => router.push(`/booking/${active.data?.id}`)}
          />
        ) : null}
        <PlaceField
          label={t("home.pickup")}
          onPress={() => setPicking("pickup")}
          value={pickup?.label}
        />
        <PlaceField
          label={t("home.destination")}
          onPress={() => setPicking("destination")}
          value={destination?.label}
        />
        {quoteError ? (
          <Notice tone="warning">
            {has(quoteError) ? t(quoteError) : t("errors.network")}
          </Notice>
        ) : null}
        <Segment<Category>
          onChange={setCategory}
          options={[
            { value: "auto", label: t("category.auto") },
            { value: "car", label: t("category.car"), hint: hintOf("car") },
            {
              value: "tuk_tuk",
              label: t("category.tuk_tuk"),
              hint: hintOf("tuk_tuk"),
            },
          ]}
          value={category}
        />
        <Stepper
          label={t("home.passengers", { n: passengers })}
          max={MAX_PASSENGERS}
          min={1}
          onChange={setPassengers}
          value={passengers}
        />
        {quote.data ? (
          <Muted>
            {t("home.estimate", {
              distance: formatDistance(quote.data.distanceM),
            })}
            {quote.data.distanceSource === "fallback"
              ? ` ${t("home.fallback")}`
              : ""}
          </Muted>
        ) : null}
        <Action
          isDisabled={!(available && !active.data) || quote.isPending}
          isLoading={create.isPending}
          label={t("home.search")}
          onPress={() => create.run({})}
        />
      </ScrollView>
      <PlacePicker
        onClose={() => setPicking(null)}
        onPick={(place) =>
          picking === "pickup" ? setPickup(place) : setDestination(place)
        }
        title={picking === "pickup" ? t("home.pickup") : t("home.destination")}
        visible={picking !== null}
      />
    </Screen>
  );
}
