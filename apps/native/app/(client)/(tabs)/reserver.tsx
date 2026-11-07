import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OfflineBanner } from "@/components/offline-banner";
import {
  currentPlace,
  type Place,
  PlacePicker,
  toPlaceInput,
} from "@/components/place-picker";
import {
  Action,
  Greeting,
  INK,
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
/** The floating tab bar: its height plus the gap under it. */
const TAB_BAR_SPACE = 104;

function PlaceField({
  label,
  value,
  placeholder,
  kind,
  onPress,
}: {
  label: string;
  value?: string;
  placeholder: string;
  kind: "pickup" | "destination";
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityHint={placeholder}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      accessibilityRole="button"
      className="min-h-16 flex-row items-center gap-4 rounded-2xl bg-surface px-5 py-3 active:opacity-80"
      onPress={onPress}
    >
      {kind === "pickup" ? (
        <View className="size-3 rounded-full bg-foreground" />
      ) : (
        <Ionicons color={INK} name="location-outline" size={16} />
      )}
      <View className="flex-1">
        <Text className="font-bold text-muted text-xs uppercase tracking-widest">
          {label}
        </Text>
        <Text
          className={`text-lg ${value ? "font-bold text-foreground" : "font-medium text-field-placeholder"}`}
          numberOfLines={1}
        >
          {value ?? placeholder}
        </Text>
      </View>
    </Pressable>
  );
}

export default function BookScreen() {
  const { t, has } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = useQuery(trpc.me.get.queryOptions());
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

  let searchLabel = t("home.search");
  if (!destination) {
    searchLabel = t("home.chooseDestination");
  }

  return (
    <Screen scroll={false}>
      <ScrollView
        contentContainerClassName="gap-4 px-6 pt-4"
        contentContainerStyle={{
          paddingBottom: insets.bottom + TAB_BAR_SPACE + 16,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Greeting name={me.data?.name} />
        <View className="h-64 overflow-hidden rounded-3xl bg-map">
          <ZayMap
            label={t("home.map")}
            line={quote.data?.line}
            markers={markers}
          />
          <View
            className="absolute top-4 left-4 flex-row items-center gap-1.5 rounded-full bg-surface px-4 py-2 shadow-black/10 shadow-sm"
            pointerEvents="none"
          >
            <Ionicons color={INK} name="location-outline" size={14} />
            <Text className="font-bold text-foreground text-sm">
              {t("home.city")}
            </Text>
          </View>
        </View>
        <OfflineBanner />
        {active.data ? (
          <Action
            icon="navigate"
            label={t("home.resume")}
            onPress={() => router.push(`/booking/${active.data?.id}`)}
            variant="brand"
          />
        ) : null}
        <View className="gap-3">
          <PlaceField
            kind="pickup"
            label={t("home.pickup")}
            onPress={() => setPicking("pickup")}
            placeholder={t("place.myPosition")}
            value={pickup?.label}
          />
          <PlaceField
            kind="destination"
            label={t("home.destination")}
            onPress={() => setPicking("destination")}
            placeholder={t("home.whereTo")}
            value={destination?.label}
          />
        </View>
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
          label={String(passengers)}
          max={MAX_PASSENGERS}
          min={1}
          onChange={setPassengers}
          title={t("home.passengersLabel")}
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
          icon={destination ? undefined : "search"}
          isDisabled={!(available && !active.data) || quote.isPending}
          isLoading={create.isPending}
          label={searchLabel}
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
