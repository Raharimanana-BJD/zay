import Ionicons from "@expo/vector-icons/Ionicons";
import { InputOTP, REGEXP_ONLY_DIGITS } from "heroui-native";
import { type ComponentProps, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { MUTED_INK } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

export const OTP_LENGTH = 6;

const PLACEHOLDER_INK = "#a8a49b";

/** An uppercase label over a white field. A secure field gets an eye to show the text. */
export function Field({
  label,
  error,
  secureTextEntry,
  ...input
}: {
  label: string;
  error?: string;
} & ComponentProps<typeof TextInput>) {
  const { t } = useI18n();
  const [isFocused, setIsFocused] = useState(false);
  const [isHidden, setIsHidden] = useState(Boolean(secureTextEntry));
  let border = "border-border";
  if (error) {
    border = "border-danger";
  } else if (isFocused) {
    border = "border-foreground";
  }
  return (
    <View className="gap-2">
      <Text className="font-bold text-muted text-xs uppercase tracking-widest">
        {label}
      </Text>
      <View
        className={`min-h-14 flex-row items-center rounded-2xl border bg-surface ${border}`}
      >
        <TextInput
          {...input}
          accessibilityLabel={label}
          className="min-h-14 flex-1 px-5 font-medium text-base text-foreground"
          onBlur={(event) => {
            setIsFocused(false);
            input.onBlur?.(event);
          }}
          onFocus={(event) => {
            setIsFocused(true);
            input.onFocus?.(event);
          }}
          placeholderTextColor={PLACEHOLDER_INK}
          secureTextEntry={isHidden}
        />
        {secureTextEntry ? (
          <Pressable
            accessibilityLabel={
              isHidden ? t("auth.showPassword") : t("auth.hidePassword")
            }
            accessibilityRole="button"
            className="size-14 items-center justify-center"
            onPress={() => setIsHidden((hidden) => !hidden)}
          >
            <Ionicons
              color={MUTED_INK}
              name={isHidden ? "eye-off-outline" : "eye-outline"}
              size={22}
            />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text accessibilityRole="alert" className="text-danger text-sm">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** The 6 digit code from a Zay email. `onComplete` fires on the last digit. */
export function CodeInput({
  value,
  onChange,
  onComplete,
  isInvalid,
}: {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  isInvalid?: boolean;
}) {
  return (
    <InputOTP
      isInvalid={isInvalid}
      maxLength={OTP_LENGTH}
      onChange={onChange}
      onComplete={onComplete}
      pattern={REGEXP_ONLY_DIGITS}
      textInputProps={{
        autoComplete: "one-time-code",
        textContentType: "oneTimeCode",
        autoFocus: true,
      }}
      value={value}
    >
      <InputOTP.Group className="w-full justify-between gap-2">
        {({ slots }) =>
          slots.map((slot) => (
            <InputOTP.Slot
              className="h-16 flex-1 rounded-2xl border border-border bg-surface"
              index={slot.index}
              key={slot.index}
            />
          ))
        }
      </InputOTP.Group>
    </InputOTP>
  );
}
