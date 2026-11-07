import { Tabs } from "expo-router";

import { ZayTabBar } from "@/components/tab-bar";
import { useI18n } from "@/lib/i18n";

const ICONS = {
  reserver: "car-outline",
  courses: "time-outline",
  profil: "person-outline",
} as const;

export default function ClientTabs() {
  const { t } = useI18n();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "#f5f3ee" },
      }}
      tabBar={(props) => <ZayTabBar {...props} icons={ICONS} />}
    >
      <Tabs.Screen name="reserver" options={{ title: t("nav.book") }} />
      <Tabs.Screen name="courses" options={{ title: t("nav.rides") }} />
      <Tabs.Screen name="profil" options={{ title: t("nav.profile") }} />
    </Tabs>
  );
}
