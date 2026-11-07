import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Spinner } from "heroui-native";
import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "@/components/styled";

import { useI18n } from "@/lib/i18n";

export type IconName = keyof typeof Ionicons.glyphMap;

/** The same ink as the theme, for icons that take a raw color. */
export const INK = "#0a0a0a";
export const MUTED_INK = "#77736b";
export const BRAND = "#f7c910";

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
          contentContainerClassName="gap-4 px-6 pt-6 pb-36"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
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
    className="font-black text-4xl text-foreground tracking-tight"
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

/** The small uppercase label above a group, like INFORMATIONS. */
export const SectionLabel = ({ children }: { children: ReactNode }) => (
  <Text
    accessibilityRole="header"
    className="mt-2 font-bold text-muted text-xs uppercase tracking-widest"
  >
    {children}
  </Text>
);

export const Body = ({ children }: { children: ReactNode }) => (
  <Text className="text-base text-foreground">{children}</Text>
);

export const Muted = ({ children }: { children: ReactNode }) => (
  <Text className="text-muted text-sm leading-5">{children}</Text>
);

export const Card = ({ children }: { children: ReactNode }) => (
  <View className="gap-3 rounded-3xl bg-surface p-5 shadow-black/5 shadow-sm">
    {children}
  </View>
);

/** A white group of rows split by hairlines, like the profile lists. */
export const Group = ({ children }: { children: ReactNode }) => (
  <View className="overflow-hidden rounded-3xl bg-surface shadow-black/5 shadow-sm">
    {children}
  </View>
);

export function GroupRow({
  label,
  value,
  onPress,
  tone = "default",
  isFirst,
}: {
  label: string;
  value?: ReactNode;
  onPress?: () => void;
  tone?: "default" | "danger";
  isFirst?: boolean;
}) {
  const content = (
    <>
      <Text
        className={
          onPress
            ? `flex-1 font-semibold text-base ${tone === "danger" ? "text-danger" : "text-foreground"}`
            : "flex-1 text-base text-muted"
        }
      >
        {label}
      </Text>
      {value === undefined ? null : (
        <Text className="shrink font-bold text-base text-foreground">
          {value}
        </Text>
      )}
      {onPress ? (
        <Ionicons color="#b8b4ab" name="chevron-forward" size={18} />
      ) : null}
    </>
  );
  const className = `min-h-14 flex-row items-center gap-3 px-5 py-4 ${isFirst ? "" : "border-separator border-t"}`;
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      className={`${className} active:bg-surface-tertiary`}
      onPress={onPress}
    >
      {content}
    </Pressable>
  ) : (
    <View className={className}>{content}</View>
  );
}

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
            ? "shrink font-black text-foreground text-lg"
            : "shrink font-semibold text-base text-foreground"
        }
      >
        {value}
      </Text>
    </View>
  );
}

type ActionVariant = "primary" | "secondary" | "tertiary" | "brand";

const ACTION_STYLES: Record<
  ActionVariant,
  { box: string; label: string; spinner: string }
> = {
  primary: { box: "bg-foreground", label: "text-white", spinner: "#ffffff" },
  brand: { box: "bg-brand", label: "text-foreground", spinner: INK },
  secondary: {
    box: "border border-border bg-surface",
    label: "text-foreground",
    spinner: INK,
  },
  tertiary: { box: "bg-transparent", label: "text-foreground", spinner: INK },
};

/** A large button: easy to hit with a thumb, including while driving. */
export function Action({
  label,
  onPress,
  isLoading,
  isDisabled,
  variant = "primary",
  icon,
  trailingIcon,
}: {
  label: string;
  onPress: () => void;
  isLoading?: boolean;
  isDisabled?: boolean;
  variant?: ActionVariant;
  icon?: IconName;
  /** Drawn after the label, like a chevron. */
  trailingIcon?: IconName;
}) {
  const disabled = Boolean(isDisabled || isLoading);
  const style = ACTION_STYLES[variant];
  const muted = isDisabled && !isLoading && variant !== "tertiary";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: Boolean(isLoading) }}
      className={`min-h-14 flex-row items-center justify-center gap-2 rounded-2xl px-5 active:opacity-80 ${
        muted ? "bg-surface-secondary" : style.box
      }`}
      disabled={disabled}
      onPress={onPress}
    >
      {isLoading ? (
        <Spinner color={style.spinner} size="sm" />
      ) : (
        <>
          {icon ? (
            <Ionicons
              color={muted ? "#a8a49b" : style.spinner}
              name={icon}
              size={18}
            />
          ) : null}
          <Text
            className={`font-bold text-base ${muted ? "text-field-placeholder" : style.label}`}
          >
            {label}
          </Text>
          {trailingIcon ? (
            <Ionicons
              color={muted ? "#a8a49b" : style.spinner}
              name={trailingIcon}
              size={18}
            />
          ) : null}
        </>
      )}
    </Pressable>
  );
}

/** A text link, like "Mot de passe oublié ?". */
export function TextLink({
  label,
  prefix,
  onPress,
  isDisabled,
}: {
  label: string;
  prefix?: string;
  onPress: () => void;
  isDisabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityState={{ disabled: Boolean(isDisabled) }}
      className="min-h-11 flex-row flex-wrap items-center justify-center gap-1 active:opacity-60"
      disabled={isDisabled}
      hitSlop={6}
      onPress={onPress}
    >
      {prefix ? <Text className="text-muted text-sm">{prefix}</Text> : null}
      <Text className="font-bold text-foreground text-sm">{label}</Text>
    </Pressable>
  );
}

export function BackButton({ onPress }: { onPress?: () => void }) {
  const { t } = useI18n();
  return (
    <Pressable
      accessibilityLabel={t("common.back")}
      accessibilityRole="button"
      className="size-12 items-center justify-center rounded-full bg-surface active:opacity-70"
      hitSlop={6}
      onPress={onPress ?? (() => router.back())}
    >
      <Ionicons color={INK} name="chevron-back" size={20} />
    </Pressable>
  );
}

/** A round white badge holding one icon, above a title. */
export const IconBadge = ({
  name,
  size = "lg",
}: {
  name: IconName;
  size?: "md" | "lg";
}) => (
  <View
    className={`items-center justify-center rounded-full bg-surface ${size === "lg" ? "size-20" : "size-16"}`}
  >
    <Ionicons color={INK} name={name} size={size === "lg" ? 30 : 24} />
  </View>
);

/** Black when chosen, white otherwise: categories, language, role. */
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
    <View accessibilityRole="radiogroup" className="flex-row gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            className={`min-h-13 flex-1 items-center justify-center rounded-2xl px-1.5 py-2 active:opacity-80 ${
              selected ? "bg-foreground" : "border border-border bg-surface"
            }`}
            key={option.value}
            onPress={() => onChange(option.value)}
          >
            <Text
              adjustsFontSizeToFit
              className={`font-bold text-sm ${selected ? "text-white" : "text-foreground"}`}
              minimumFontScale={0.75}
              numberOfLines={1}
            >
              {option.label}
            </Text>
            {option.hint ? (
              <Text
                className={`font-medium text-xs ${selected ? "text-brand" : "text-muted"}`}
                numberOfLines={1}
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

/** Minus in an outline, plus in the Zay yellow. */
export function Stepper({
  value,
  label,
  onChange,
  step = 1,
  min,
  max,
  title,
}: {
  value: number;
  label: string;
  onChange: (value: number) => void;
  step?: number;
  min: number;
  max: number;
  /** Shown on the left, with the value next to the buttons. */
  title?: string;
}) {
  const { t } = useI18n();
  const button = (name: "remove" | "add", next: number, hint: string) => {
    const disabled = next < min || next > max;
    return (
      <Pressable
        accessibilityLabel={hint}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        className={`size-11 items-center justify-center rounded-full active:opacity-70 ${
          name === "add" ? "bg-brand" : "border border-border bg-surface"
        } ${disabled ? "opacity-40" : ""}`}
        disabled={disabled}
        hitSlop={4}
        onPress={() => onChange(next)}
      >
        <Ionicons color={INK} name={name} size={22} />
      </Pressable>
    );
  };
  if (title) {
    return (
      <View className="min-h-14 flex-row items-center gap-3">
        <Text className="flex-1 font-semibold text-base text-foreground">
          {title}
        </Text>
        {button("remove", value - step, t("common.less"))}
        <Text className="min-w-8 text-center font-bold text-foreground text-lg">
          {label}
        </Text>
        {button("add", value + step, t("common.more"))}
      </View>
    );
  }
  return (
    <View className="flex-row items-center justify-between gap-3">
      {button("remove", value - step, t("common.less"))}
      <Text className="flex-1 text-center font-black text-2xl text-foreground">
        {label}
      </Text>
      {button("add", value + step, t("common.more"))}
    </View>
  );
}

/** A small rounded tag, like "En attente". */
export function Pill({
  label,
  tone = "brand",
}: {
  label: string;
  tone?: "brand" | "success" | "danger" | "neutral";
}) {
  const tones = {
    brand: "bg-brand-soft text-brand-ink",
    success: "bg-success/10 text-success",
    danger: "bg-danger/10 text-danger",
    neutral: "bg-surface-secondary text-foreground",
  };
  return (
    <Text
      className={`self-start overflow-hidden rounded-full px-3 py-1.5 font-bold text-xs ${tones[tone]}`}
    >
      {label}
    </Text>
  );
}

/** "Bonjour" and the first name, on the home of each space. */
export function Greeting({ name }: { name?: string }) {
  const { t } = useI18n();
  return (
    <View className="min-h-12 justify-center">
      <Text className="font-semibold text-muted text-sm">
        {t("home.hello")}
      </Text>
      <Text
        accessibilityRole="header"
        className="font-black text-2xl text-foreground"
        numberOfLines={1}
      >
        {name ?? " "}
      </Text>
    </View>
  );
}

export function StatTile({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <View className="flex-1 gap-2 rounded-3xl bg-surface p-5 shadow-black/5 shadow-sm">
      <Text className="font-semibold text-muted text-sm" numberOfLines={2}>
        {label}
      </Text>
      <Text className="font-black text-2xl text-foreground" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export const Loading = () => (
  <View className="flex-1 items-center justify-center bg-background p-8">
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
    neutral: { box: "bg-surface", icon: "information-circle" as const },
    warning: { box: "bg-brand-soft", icon: "alert-circle" as const },
    danger: { box: "bg-danger/10", icon: "alert-circle" as const },
  };
  const ink = { neutral: INK, warning: "#7a5800", danger: "#b3261e" }[tone];
  return (
    <View
      accessibilityRole="alert"
      className={`flex-row items-start gap-3 rounded-2xl p-4 ${tones[tone].box}`}
    >
      <Ionicons color={ink} name={tones[tone].icon} size={20} />
      <Text
        className="flex-1 font-medium text-sm leading-5"
        style={{ color: ink }}
      >
        {children}
      </Text>
    </View>
  );
}

export function EmptyState({
  label,
  body,
  icon = "time-outline",
  action,
  isOnCard,
}: {
  label: string;
  body?: string;
  icon?: IconName;
  action?: { label: string; onPress: () => void };
  /** On a white card, the icon sits on a cream circle instead of a white one. */
  isOnCard?: boolean;
}) {
  return (
    <View className="items-center gap-3 px-6 py-12">
      <View
        className={`mb-2 size-20 items-center justify-center rounded-full ${isOnCard ? "bg-surface-tertiary" : "bg-surface"}`}
      >
        <Ionicons color="#a8a49b" name={icon} size={30} />
      </View>
      <Text className="text-center font-bold text-foreground text-lg">
        {label}
      </Text>
      {body ? (
        <Text className="text-center text-base text-muted leading-6">
          {body}
        </Text>
      ) : null}
      {action ? (
        <View className="mt-3">
          <Action label={action.label} onPress={action.onPress} />
        </View>
      ) : null}
    </View>
  );
}
