import Ionicons from "@expo/vector-icons/Ionicons";
import type { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type IconName, INK } from "@/components/ui";

type TabBarProps = Parameters<
  NonNullable<ComponentProps<typeof Tabs>["tabBar"]>
>[0];

const INACTIVE = "#a8a49b";
const BOTTOM_GAP = 12;

/** The floating white bar: icons only, a yellow dot under the open tab (spec 0005, AC-2). */
export function ZayTabBar({
  state,
  descriptors,
  emitter,
  navigateToTab,
  icons,
}: TabBarProps & { icons: Record<string, IconName> }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="absolute inset-x-0 bottom-0 px-6"
      pointerEvents="box-none"
      style={{ paddingBottom: insets.bottom + BOTTOM_GAP }}
    >
      <View
        accessibilityRole="tablist"
        className="flex-row rounded-[28px] bg-surface px-2 py-2 shadow-black/10 shadow-lg"
        style={{ elevation: 8 }}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const label = options.title ?? route.name;
          const icon = icons[route.name] ?? "ellipse-outline";
          const onPress = () => {
            const event = emitter.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!(focused || event.defaultPrevented)) {
              navigateToTab(route.key);
            }
          };
          return (
            <Pressable
              accessibilityLabel={label}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              className="min-h-14 flex-1 items-center justify-center gap-1.5 rounded-3xl active:bg-surface-tertiary"
              key={route.key}
              onPress={onPress}
            >
              <Ionicons
                color={focused ? INK : INACTIVE}
                name={
                  focused ? (icon.replace("-outline", "") as IconName) : icon
                }
                size={24}
              />
              <View
                className={`size-1.5 rounded-full ${focused ? "bg-brand" : "bg-transparent"}`}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
