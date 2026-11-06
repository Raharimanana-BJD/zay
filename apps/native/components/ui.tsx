import Ionicons from "@expo/vector-icons/Ionicons";
import { Button, Spinner } from "heroui-native";
import type { ComponentProps, ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useI18n } from "@/lib/i18n";

export function Screen({
  children,
  scroll = true,
}: {
  children: ReactNode;
  scroll?: boolean;
}) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {scroll ? (
        <ScrollView
          contentContainerClassName="gap-4 p-4 pb-10"
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        children
      )}
    </SafeAreaView>
  );
}

export const Title = ({ children }: { children: ReactNode }) => (
  <Text
    accessibilityRole="header"
    className="font-bold text-3xl text-foreground"
  >
    {children}
  </Text>
);

export const Heading = ({ children }: { children: ReactNode }) => (
  <Text
    accessibilityRole="header"
    className="font-bold text-foreground text-xl"
  >
    {children}
  </Text>
);

export const Body = ({ children }: { children: ReactNode }) => (
  <Text className="text-base text-foreground">{children}</Text>
);

export const Muted = ({ children }: { children: ReactNode }) => (
  <Text className="text-muted text-sm">{children}</Text>
);

export const Card = ({ children }: { children: ReactNode }) => (
  <View className="gap-2 rounded-2xl bg-surface-secondary p-4">{children}</View>
);

export function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: ReactNode;
  strong?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between gap-4">
      <Text className="shrink text-muted text-sm">{label}</Text>
      <Text
        className={
          strong
            ? "shrink font-bold text-foreground text-lg"
            : "shrink font-medium text-base text-foreground"
        }
      >
        {value}
      </Text>
    </View>
  );
}

type ActionProps = {
  label: string;
  onPress: () => void;
  isLoading?: boolean;
  isDisabled?: boolean;
  variant?: ComponentProps<typeof Button>["variant"];
};

/** A large pill: easy to hit with a thumb, including while driving. */
export function Action({
  label,
  onPress,
  isLoading,
  isDisabled,
  variant = "primary",
}: ActionProps) {
  return (
    <Button
      className="min-h-14 rounded-full"
      isDisabled={isDisabled || isLoading}
      onPress={onPress}
      size="lg"
      variant={variant}
    >
      {isLoading ? (
        <Spinner color="default" size="sm" />
      ) : (
        <Button.Label>{label}</Button.Label>
      )}
    </Button>
  );
}

export function Segment<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View className="flex-row gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            className={`min-h-14 flex-1 items-center justify-center rounded-2xl px-2 py-2 ${
              selected ? "bg-foreground" : "bg-surface-tertiary"
            }`}
            key={option.value}
            onPress={() => onChange(option.value)}
          >
            <Text
              className={`font-medium text-sm ${selected ? "text-background" : "text-foreground"}`}
            >
              {option.label}
            </Text>
            {option.hint ? (
              <Text
                className={`text-xs ${selected ? "text-background" : "text-muted"}`}
              >
                {option.hint}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stepper({
  value,
  label,
  onChange,
  step = 1,
  min,
  max,
}: {
  value: number;
  label: string;
  onChange: (value: number) => void;
  step?: number;
  min: number;
  max: number;
}) {
  const { t } = useI18n();
  const button = (name: "remove" | "add", next: number, hint: string) => (
    <Pressable
      accessibilityLabel={hint}
      accessibilityRole="button"
      accessibilityState={{ disabled: next < min || next > max }}
      className="size-12 items-center justify-center rounded-full bg-surface-tertiary disabled:opacity-40"
      disabled={next < min || next > max}
      onPress={() => onChange(next)}
    >
      <Ionicons color="#000000" name={name} size={24} />
    </Pressable>
  );
  return (
    <View className="flex-row items-center justify-between gap-3">
      {button("remove", value - step, t("common.less"))}
      <Text className="flex-1 text-center font-bold text-foreground text-xl">
        {label}
      </Text>
      {button("add", value + step, t("common.more"))}
    </View>
  );
}

export const Loading = () => (
  <View className="flex-1 items-center justify-center bg-background">
    <Spinner size="lg" />
  </View>
);

export function Notice({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "warning" | "danger";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-surface-tertiary",
    warning: "bg-warning",
    danger: "bg-danger",
  };
  const text = tone === "neutral" ? "text-foreground" : "text-white";
  return (
    <View className={`rounded-xl p-3 ${tones[tone]}`}>
      <Text className={`font-medium text-sm ${text}`}>{children}</Text>
    </View>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <View className="items-center p-8">
      <Text className="text-center text-muted">{label}</Text>
    </View>
  );
}
