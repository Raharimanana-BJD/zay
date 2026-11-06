import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";

import { useI18n } from "@/lib/i18n";

const icon =
  (name: keyof typeof Ionicons.glyphMap) =>
  ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons color={color} name={name} size={size} />
  );

export default function DriverTabs() {
  const { t } = useI18n();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#000000",
        tabBarInactiveTintColor: "#5e5e5e",
      }}
    >
      <Tabs.Screen
        name="accueil"
        options={{ title: t("nav.home"), tabBarIcon: icon("speedometer") }}
      />
      <Tabs.Screen
        name="revenus"
        options={{ title: t("nav.earnings"), tabBarIcon: icon("cash") }}
      />
      <Tabs.Screen
        name="dossier"
        options={{ title: t("nav.vehicle"), tabBarIcon: icon("document-text") }}
      />
      <Tabs.Screen
        name="compte"
        options={{ title: t("nav.profile"), tabBarIcon: icon("person") }}
      />
    </Tabs>
  );
}
