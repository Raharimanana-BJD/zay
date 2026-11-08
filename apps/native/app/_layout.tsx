import "@/global.css";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { preventAutoHideAsync } from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { HeroUINativeProvider } from "heroui-native";
import { useCallback, useEffect, useState } from "react";
import { Text } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { Uniwind } from "uniwind";

import { CompleteProfile } from "@/components/complete-profile";
import { BootSplash } from "@/components/splash";
import { Action, Loading, Screen, Title } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { I18nProvider, type Locale, useI18n } from "@/lib/i18n";
import { RegisteringContext } from "@/lib/registering";
import { queryClient, trpc } from "@/utils/trpc";

Uniwind.setTheme("light");
// The native splash stays until BootSplash, its animated copy, is drawn (spec 0005).
preventAutoHideAsync().catch(() => undefined);

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

  const [splashGone, setSplashGone] = useState(false);
  const hideSplash = useCallback(() => setSplashGone(true), []);
  const isSignedIn = Boolean(session);
  // At startup the role comes from me.get, so the splash waits for it, unless it fails.
  const booting = isPending || (isSignedIn && me.isPending && !me.isError);

  return (
    <>
      <RouteContent
        // Offline, me.get is missing: the server still guards every action.
        isIncomplete={isSignedIn && me.data?.isComplete === false}
        isSignedIn={isSignedIn}
        isWaiting={splashGone ? isPending : booting}
        registering={registering}
        // The server's answer wins. The stored session keeps a ride reachable when offline.
        role={me.data?.role ?? session?.user.role}
        setRegistering={setRegistering}
      />
      {splashGone ? null : (
        <BootSplash onHidden={hideSplash} ready={!booting} />
      )}
    </>
  );
}

function RouteContent({
  isIncomplete,
  isWaiting,
  isSignedIn,
  registering,
  role,
  setRegistering,
}: {
  isIncomplete: boolean;
  isWaiting: boolean;
  isSignedIn: boolean;
  registering: boolean;
  role: string | null | undefined;
  setRegistering: (value: boolean) => void;
}) {
  if (isWaiting) {
    return <Loading />;
  }
  // A Google account without a phone sees only this screen (spec 0005).
  if (isIncomplete && !registering) {
    return <CompleteProfile />;
  }
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
