import { router } from "expo-router";
import type { ReactNode } from "react";
import { Image, Text, View } from "react-native";
import { KeyboardAwareScrollView, SafeAreaView } from "@/components/styled";

import { BackButton, IconBadge, type IconName } from "@/components/ui";
import { savePendingVerification } from "@/lib/pending-verification";

/** The frame of every sign in screen: back, badge, title, body, then the form. */
export function AuthShell({
  title,
  body,
  icon,
  hasBack = true,
  onBack,
  children,
  footer,
}: {
  title: string;
  body?: ReactNode;
  icon?: IconName;
  hasBack?: boolean;
  onBack?: () => void;
  children?: ReactNode;
  /** Pinned at the bottom of the screen, like the main button. */
  footer?: ReactNode;
}) {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerClassName="grow gap-6 px-6 pt-4 pb-6"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {hasBack ? <BackButton onPress={onBack} /> : null}
        {icon ? <IconBadge name={icon} /> : null}
        <View className="gap-2">
          <Text
            accessibilityRole="header"
            className="font-black text-3xl text-foreground tracking-tight"
          >
            {title}
          </Text>
          {body ? (
            <Text className="text-base text-muted leading-6">{body}</Text>
          ) : null}
        </View>
        {children}
        {footer ? <View className="mt-auto gap-2 pt-4">{footer}</View> : null}
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}

/** A line icon sitting on the yellow Zay shape. */
export function BlobArt({
  source,
  label,
  children,
}: {
  source?: number;
  label?: string;
  children?: ReactNode;
}) {
  return (
    <View className="h-56 w-64 items-center justify-center self-center">
      <Image
        accessibilityIgnoresInvertColors
        className="absolute inset-0 h-56 w-64"
        resizeMode="contain"
        source={require("@/assets/images/blob.png")}
      />
      {source ? (
        <Image
          accessibilityLabel={label}
          className="size-24"
          resizeMode="contain"
          source={source}
        />
      ) : (
        children
      )}
    </View>
  );
}

/** Opens the code screen. A new driver carries the relation chosen at sign up. */
export const openVerification = (email: string, relation?: string) => {
  savePendingVerification({ email, relation });
  router.push({
    pathname: "/verifier",
    params: relation ? { email, relation } : { email },
  });
};
