import Ionicons from "@expo/vector-icons/Ionicons";
import type { ComponentProps } from "react";
import { Pressable, Text, View } from "react-native";

import { INK } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import type { ImageSource } from "@/lib/pick-image";

type IconName = ComponentProps<typeof Ionicons>["name"];

function SourceTile({
  icon,
  label,
  onPress,
  isDisabled,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  isDisabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(isDisabled) }}
      className={`min-h-28 flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-surface px-3 py-4 active:bg-surface-tertiary ${isDisabled ? "opacity-50" : ""}`}
      disabled={isDisabled}
      onPress={onPress}
    >
      <View className="size-11 items-center justify-center rounded-full bg-brand">
        <Ionicons color={INK} name={icon} size={22} />
      </View>
      <Text className="text-center font-bold text-foreground text-sm">
        {label}
      </Text>
    </Pressable>
  );
}

/** The two ways to add a picture: take it now, or import it from the gallery. */
export function SourceChoice({
  onPick,
  isDisabled,
}: {
  onPick: (source: ImageSource) => void;
  isDisabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <View className="flex-row gap-3">
      <SourceTile
        icon="camera"
        isDisabled={isDisabled}
        label={t("source.camera")}
        onPress={() => onPick("camera")}
      />
      <SourceTile
        icon="images"
        isDisabled={isDisabled}
        label={t("source.library")}
        onPress={() => onPick("library")}
      />
    </View>
  );
}
