import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "heroui-native";
import { useState } from "react";
import { Text, View } from "react-native";

import { ChangePassword } from "@/components/change-password";
import { ReportButton } from "@/components/report-button";
import { Sheet } from "@/components/sheet";
import {
  Group,
  GroupRow,
  Screen,
  SectionLabel,
  Segment,
  Title,
} from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { type Locale, useI18n } from "@/lib/i18n";
import { queryClient, trpc, trpcClient } from "@/utils/trpc";

const initialOf = (name?: string) =>
  name?.trim().charAt(0).toUpperCase() || "Z";

export function ProfileScreen() {
  const { t, locale, setLocale } = useI18n();
  const { toast } = useToast();
  const me = useQuery(trpc.me.get.queryOptions());
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const saveLocale = useMutation({
    mutationFn: (next: Locale) =>
      trpcClient.me.setLocale.mutate({ locale: next }),
    onError: () =>
      toast.show({ variant: "danger", label: t("errors.network") }),
  });
  const name = me.data?.name;
  const phone = me.data?.phone ?? "—";

  return (
    <Screen>
      <Title>{t("nav.profile")}</Title>
      <View className="flex-row items-center gap-4 rounded-3xl bg-surface p-5 shadow-black/5 shadow-sm">
        <View
          accessibilityElementsHidden
          className="size-16 items-center justify-center rounded-full bg-foreground"
          importantForAccessibility="no-hide-descendants"
        >
          <Text className="font-black text-2xl text-white">
            {initialOf(name)}
          </Text>
        </View>
        <View className="flex-1">
          <Text
            className="font-black text-foreground text-xl"
            numberOfLines={1}
          >
            {name ?? " "}
          </Text>
          <Text className="text-base text-muted">{phone}</Text>
        </View>
      </View>

      <SectionLabel>{t("profile.info")}</SectionLabel>
      <Group>
        <GroupRow
          isFirst
          label={t("auth.email")}
          value={me.data?.email ?? "—"}
        />
        <GroupRow label={t("auth.phone")} value={phone} />
      </Group>

      <SectionLabel>{t("profile.language")}</SectionLabel>
      <Segment<Locale>
        onChange={(next) => {
          setLocale(next);
          saveLocale.mutate(next);
        }}
        options={[
          { value: "fr", label: "Français" },
          { value: "mg", label: "Malagasy" },
        ]}
        value={locale}
      />

      <SectionLabel>{t("profile.security")}</SectionLabel>
      <Group>
        <GroupRow
          isFirst
          label={t("profile.changePassword")}
          onPress={() => setIsChangingPassword(true)}
        />
      </Group>

      <SectionLabel>{t("profile.help")}</SectionLabel>
      <Group>
        <ReportButton asRow />
        <GroupRow
          label={t("profile.signOut")}
          onPress={async () => {
            await authClient.signOut();
            queryClient.clear();
          }}
          tone="danger"
        />
      </Group>

      <Sheet
        onClose={() => setIsChangingPassword(false)}
        title={t("profile.changePassword")}
        visible={isChangingPassword}
      >
        <ChangePassword onDone={() => setIsChangingPassword(false)} />
      </Sheet>
    </Screen>
  );
}
