import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { Input, useToast } from "heroui-native";
import { useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Action, Body, Heading, Loading, Muted, Screen } from "@/components/ui";
import { TOLIARA, ZayMap } from "@/components/zay-map";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/utils/trpc";

export interface Place {
  districtId?: string;
  label: string;
  landmarkId?: string;
  lat: number;
  lng: number;
  note?: string;
}

export const toPlaceInput = ({ label, ...place }: Place) => ({
  ...place,
  // A place chosen by GPS or on the map has no name, so its note carries the label.
  note:
    place.note || (place.districtId || place.landmarkId ? undefined : label),
});

export async function currentPlace(label: string): Promise<Place | null> {
  const { granted } = await Location.requestForegroundPermissionsAsync();
  if (!granted) {
    return null;
  }
  const { coords } = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return { lat: coords.latitude, lng: coords.longitude, label };
}

function PlaceRow({
  title,
  hint,
  onPress,
}: {
  title: string;
  hint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      className="min-h-14 justify-center border-border border-b py-2"
      onPress={onPress}
    >
      <Body>{title}</Body>
      {hint ? <Muted>{hint}</Muted> : null}
    </Pressable>
  );
}

function MapPicker({
  start,
  onCancel,
  onPick,
}: {
  start: { lat: number; lng: number };
  onCancel: () => void;
  onPick: (lat: number, lng: number) => void;
}) {
  const { t } = useI18n();
  const center = useRef(start);
  // Set once: the map must not jump back while the rider moves it.
  const initial = useRef(start);
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1">
        <ZayMap
          center={initial.current}
          label={t("place.mapHint")}
          onCenterChange={(next) => {
            center.current = next;
          }}
        />
        <View
          className="absolute top-1/2 left-1/2 -mt-5 -ml-5 size-10 items-center justify-center"
          pointerEvents="none"
        >
          <View className="size-5 rounded-full border-4 border-white bg-black" />
        </View>
      </View>
      <View className="gap-2 p-4">
        <Muted>{t("place.mapHint")}</Muted>
        <Action
          label={t("place.confirmPoint")}
          onPress={() => onPick(center.current.lat, center.current.lng)}
        />
        <Action
          label={t("common.back")}
          onPress={onCancel}
          variant="tertiary"
        />
      </View>
    </SafeAreaView>
  );
}

/** GPS, map, district or landmark, then an optional local description (cahier §13.2). */
export function PlacePicker({
  visible,
  title,
  onClose,
  onPick,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onPick: (place: Place) => void;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const places = useQuery({
    ...trpc.me.places.queryOptions(),
    enabled: visible,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const [search, setSearch] = useState("");
  const [onMap, setOnMap] = useState(false);
  const [draft, setDraft] = useState<Place | null>(null);
  const [note, setNote] = useState("");
  const [locating, setLocating] = useState(false);

  const query = search.trim().toLocaleLowerCase();
  const matches = (name: string) =>
    !query || name.toLocaleLowerCase().includes(query);
  const landmarks = places.data?.landmarks.filter((row) => matches(row.name)) ?? [];
  const districts = places.data?.districts.filter((row) => matches(row.name)) ?? [];

  const close = () => {
    setDraft(null);
    setNote("");
    setSearch("");
    setOnMap(false);
    onClose();
  };

  const useGps = async () => {
    setLocating(true);
    try {
      const place = await currentPlace(t("place.myPosition"));
      if (place) {
        setDraft(place);
      } else {
        toast.show({ variant: "warning", label: t("place.gpsDenied") });
      }
    } catch {
      toast.show({ variant: "warning", label: t("place.gpsFailed") });
    } finally {
      setLocating(false);
    }
  };

  let content = (
    <Screen>
      <Heading>{title}</Heading>
      <Input
        accessibilityLabel={t("place.search")}
        onChangeText={setSearch}
        placeholder={t("place.search")}
        value={search}
      />
      <Action
        isLoading={locating}
        label={t("place.useGps")}
        onPress={useGps}
        variant="secondary"
      />
      <Action
        label={t("place.onMap")}
        onPress={() => setOnMap(true)}
        variant="secondary"
      />
      {places.isPending ? <Loading /> : null}
      {landmarks.length > 0 ? <Heading>{t("place.landmarks")}</Heading> : null}
      {landmarks.map((row) => (
        <PlaceRow
          key={row.id}
          onPress={() =>
            setDraft({
              lat: row.lat,
              lng: row.lng,
              label: row.name,
              landmarkId: row.id,
            })
          }
          title={row.name}
        />
      ))}
      {districts.length > 0 ? <Heading>{t("place.districts")}</Heading> : null}
      {districts.map((row) => (
        <PlaceRow
          key={row.id}
          onPress={() =>
            setDraft({
              lat: row.lat,
              lng: row.lng,
              label: row.name,
              districtId: row.id,
            })
          }
          title={row.name}
        />
      ))}
      <Action label={t("common.back")} onPress={close} variant="tertiary" />
    </Screen>
  );

  if (draft) {
    content = (
      <Screen>
        <Heading>{draft.label}</Heading>
        <Text className="text-muted">{t("place.noteHint")}</Text>
        <Input
          accessibilityLabel={t("place.note")}
          onChangeText={setNote}
          placeholder={t("place.note")}
          value={note}
        />
        <Action
          label={t("common.confirm")}
          onPress={() => {
            onPick({ ...draft, note: note.trim() || undefined });
            close();
          }}
        />
        <Action
          label={t("common.back")}
          onPress={() => setDraft(null)}
          variant="tertiary"
        />
      </Screen>
    );
  } else if (onMap) {
    content = (
      <MapPicker
        onCancel={() => setOnMap(false)}
        onPick={(lat, lng) =>
          setDraft({ lat, lng, label: t("place.mapPoint") })
        }
        start={TOLIARA}
      />
    );
  }

  return (
    <Modal animationType="slide" onRequestClose={close} visible={visible}>
      {content}
    </Modal>
  );
}
