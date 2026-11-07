import { Tabs } from "expo-router";

import { ZayTabBar } from "@/components/tab-bar";
import { useI18n } from "@/lib/i18n";

const ICONS = {
  accueil: "home-outline",
  revenus: "cash-outline",
  dossier: "document-text-outline",
  compte: "person-outline",
} as const;

export default function DriverTabs() {
  const { t } = useI18n();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "#f5f3ee" },
      }}
      tabBar={(props) => <ZayTabBar {...props} icons={ICONS} />}
    >
      <Tabs.Screen name="accueil" options={{ title: t("nav.home") }} />
      <Tabs.Screen name="revenus" options={{ title: t("nav.earnings") }} />
      <Tabs.Screen name="dossier" options={{ title: t("nav.vehicle") }} />
      <Tabs.Screen name="compte" options={{ title: t("nav.profile") }} />
    </Tabs>
  );
}
