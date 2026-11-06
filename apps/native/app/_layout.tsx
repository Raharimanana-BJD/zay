import "@/global.css";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { HeroUINativeProvider } from "heroui-native";
import { useEffect, useState } from "react";
import { Text } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { Uniwind } from "uniwind";

import { Action, Loading, Screen, Title } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { I18nProvider, type Locale, useI18n } from "@/lib/i18n";
import { RegisteringContext } from "@/lib/registering";
import { queryClient, trpc } from "@/utils/trpc";

Uniwind.setTheme("light");

function StaffNotice() {
  const { t } = useI18n();
  return (
    <Screen>
      <Title>{t("auth.staffTitle")}</Title>
      <Text className="text-base text-muted">{t("auth.staffBody")}</Text>
      <Action
        label={t("profile.signOut")}
        onPress={() => authClient.signOut()}
        variant="secondary"
      />
    </Screen>
  );
}

function Routes() {
  const { setLocale } = useI18n();
  const { data: session, isPending } = authClient.useSession();
  const [registering, setRegistering] = useState(false);
  const me = useQuery({
    ...trpc.me.get.queryOptions(),
    enabled: Boolean(session),
  });
  const savedLocale = me.data?.locale;
  useEffect(() => {
    if (savedLocale === "fr" || savedLocale === "mg") {
      setLocale(savedLocale as Locale);
    }
  }, [savedLocale, setLocale]);

  if (isPending) {
    return <Loading />;
  }
  // The server's answer wins. The stored session keeps a ride reachable when offline.
  const role = me.data?.role ?? session?.user.role;
  const isSignedIn = Boolean(session);
  if (isSignedIn && !registering && role !== "client" && role !== "driver") {
    return role ? <StaffNotice /> : <Loading />;
  }
  return (
    <RegisteringContext.Provider value={setRegistering}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Protected guard={!isSignedIn || registering}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected
          guard={isSignedIn && !registering && role === "client"}
        >
          <Stack.Screen name="(client)" />
        </Stack.Protected>
        <Stack.Protected
          guard={isSignedIn && !registering && role === "driver"}
        >
          <Stack.Screen name="(driver)" />
        </Stack.Protected>
      </Stack>
    </RegisteringContext.Provider>
  );
}

export default function Layout() {
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <I18nProvider>
            <HeroUINativeProvider>
              <StatusBar style="dark" />
              <Routes />
            </HeroUINativeProvider>
          </I18nProvider>
        </KeyboardProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
