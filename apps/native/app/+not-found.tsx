import { Link, Stack } from "expo-router";
import { Text } from "react-native";

import { Screen, Title } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

export default function NotFoundScreen() {
  const { t } = useI18n();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen>
        <Title>{t("common.notFound")}</Title>
        <Link href="/">
          <Text className="font-medium text-base text-foreground underline">
            {t("common.back")}
          </Text>
        </Link>
      </Screen>
    </>
  );
}
