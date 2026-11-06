import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";

import { useI18n } from "@/lib/i18n";

const icon =
  (name: keyof typeof Ionicons.glyphMap) =>
  ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons color={color} name={name} size={size} />
  );

export default function ClientTabs() {
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
        name="reserver"
        options={{ title: t("nav.book"), tabBarIcon: icon("car") }}
      />
      <Tabs.Screen
        name="courses"
        options={{ title: t("nav.rides"), tabBarIcon: icon("time") }}
      />
      <Tabs.Screen
        name="profil"
        options={{ title: t("nav.profile"), tabBarIcon: icon("person") }}
      />
    </Tabs>
  );
}
