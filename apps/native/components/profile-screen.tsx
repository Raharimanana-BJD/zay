import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQuery } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { Spinner, useToast } from "heroui-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Avatar } from "@/components/auth-image";
import { ChangePassword } from "@/components/change-password";
import { ReportButton } from "@/components/report-button";
import { Sheet } from "@/components/sheet";
import {
  Group,
  GroupRow,
  INK,
  Screen,
  SectionLabel,
  Segment,
  Title,
} from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { type Locale, useI18n } from "@/lib/i18n";
import { uploadFile } from "@/lib/upload";
import { useErrorToast } from "@/lib/use-action";
import { queryClient, trpc, trpcClient } from "@/utils/trpc";

const PHOTO_QUALITY = 0.6;

type PhotoSource = "camera" | "library";

/** Opens the camera or the gallery, cropped to a square. Null when cancelled. */
async function pickSquarePhoto(source: PhotoSource) {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: PHOTO_QUALITY,
  };
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error("CAMERA_DENIED");
    }
  }
  const picked =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = picked.assets?.[0];
  return picked.canceled || !asset ? null : asset.uri;
}

export function ProfileScreen() {
  const { t, locale, setLocale } = useI18n();
  const { toast } = useToast();
  const me = useQuery(trpc.me.get.queryOptions());
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const saveLocale = useMutation({
    mutationFn: (next: Locale) =>
      trpcClient.me.setLocale.mutate({ locale: next }),
    onError: () =>
      toast.show({ variant: "danger", label: t("errors.network") }),
  });
  const showError = useErrorToast();
  const [isPhotoMenuOpen, setIsPhotoMenuOpen] = useState(false);
  const changePhoto = useMutation({
    mutationFn: async (source: PhotoSource) => {
      const uri = await pickSquarePhoto(source);
      if (uri) {
        const storageKey = await uploadFile(uri, "avatar");
        await trpcClient.me.setImage.mutate({ storageKey });
      }
    },
    onError: showError,
    onSettled: () => me.refetch(),
  });
  const removePhoto = useMutation({
    mutationFn: () => trpcClient.me.removeImage.mutate(),
    onError: showError,
    onSettled: () => me.refetch(),
  });
  const isSavingPhoto = changePhoto.isPending || removePhoto.isPending;
  const choosePhoto = (source: PhotoSource) => {
    setIsPhotoMenuOpen(false);
    changePhoto.mutate(source);
  };
  const name = me.data?.name;
  const phone = me.data?.phone ?? "—";
  const imageUrl = me.data?.imageUrl ?? null;

  return (
    <Screen>
      <Title>{t("nav.profile")}</Title>
      <View className="flex-row items-center gap-4 rounded-3xl bg-surface p-5 shadow-black/5 shadow-sm">
        <Pressable
          accessibilityLabel={t("photo.edit")}
          accessibilityRole="button"
          accessibilityState={{ busy: isSavingPhoto }}
          disabled={isSavingPhoto}
          onPress={() => setIsPhotoMenuOpen(true)}
        >
          <Avatar name={name} size="lg" uri={imageUrl} />
          {isSavingPhoto ? (
            <View className="absolute inset-0 items-center justify-center rounded-full bg-black/40">
              <Spinner color="#ffffff" />
            </View>
          ) : null}
          <View className="absolute -right-1 -bottom-1 size-7 items-center justify-center rounded-full border-2 border-surface bg-brand">
            <Ionicons color={INK} name="camera" size={14} />
          </View>
        </Pressable>
        <View className="flex-1">
          <Text
            className="font-black text-foreground text-xl"
            numberOfLines={1}
          >
            {name ?? " "}
          </Text>
          <Text className="text-base text-muted">{phone}</Text>
        </View>
      </View>

      <SectionLabel>{t("profile.info")}</SectionLabel>
      <Group>
        <GroupRow
          isFirst
          label={t("auth.email")}
          value={me.data?.email ?? "—"}
        />
        <GroupRow label={t("auth.phone")} value={phone} />
      </Group>

      <SectionLabel>{t("profile.language")}</SectionLabel>
      <Segment<Locale>
        onChange={(next) => {
          setLocale(next);
          saveLocale.mutate(next);
        }}
        options={[
          { value: "fr", label: "Français" },
          { value: "mg", label: "Malagasy" },
        ]}
        value={locale}
      />

      <SectionLabel>{t("profile.security")}</SectionLabel>
      <Group>
        <GroupRow
          isFirst
          label={t("profile.changePassword")}
          onPress={() => setIsChangingPassword(true)}
        />
      </Group>

      <SectionLabel>{t("profile.help")}</SectionLabel>
      <Group>
        <ReportButton asRow />
        <GroupRow
          label={t("profile.signOut")}
          onPress={async () => {
            await authClient.signOut();
            queryClient.clear();
          }}
          tone="danger"
        />
      </Group>

      <Sheet
        onClose={() => setIsPhotoMenuOpen(false)}
        title={t("photo.title")}
        visible={isPhotoMenuOpen}
      >
        <Group>
          <GroupRow
            isFirst
            label={t("photo.take")}
            onPress={() => choosePhoto("camera")}
          />
          <GroupRow
            label={t("photo.pick")}
            onPress={() => choosePhoto("library")}
          />
          {imageUrl ? (
            <GroupRow
              label={t("photo.remove")}
              onPress={() => {
                setIsPhotoMenuOpen(false);
                removePhoto.mutate();
              }}
              tone="danger"
            />
          ) : null}
        </Group>
      </Sheet>

      <Sheet
        onClose={() => setIsChangingPassword(false)}
        title={t("profile.changePassword")}
        visible={isChangingPassword}
      >
        <ChangePassword onDone={() => setIsChangingPassword(false)} />
      </Sheet>
    </Screen>
  );
}
