import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "heroui-native";

import { ReportButton } from "@/components/report-button";
import {
  Action,
  Card,
  Heading,
  Row,
  Screen,
  Segment,
  Title,
} from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { type Locale, useI18n } from "@/lib/i18n";
import { queryClient, trpc, trpcClient } from "@/utils/trpc";

export function ProfileScreen() {
  const { t, locale, setLocale } = useI18n();
  const { toast } = useToast();
  const me = useQuery(trpc.me.get.queryOptions());
  const saveLocale = useMutation({
    mutationFn: (next: Locale) =>
      trpcClient.me.setLocale.mutate({ locale: next }),
    onError: () =>
      toast.show({ variant: "danger", label: t("errors.network") }),
  });
  return (
    <Screen>
      <Title>{t("nav.profile")}</Title>
      <Card>
        <Row label={t("auth.name")} value={me.data?.name ?? "—"} />
        <Row label={t("auth.phone")} value={me.data?.phone ?? "—"} />
        <Row label={t("auth.email")} value={me.data?.email ?? "—"} />
      </Card>
      <Heading>{t("profile.language")}</Heading>
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
      <Heading>{t("profile.help")}</Heading>
      <ReportButton />
      <Action
        label={t("profile.signOut")}
        onPress={async () => {
          await authClient.signOut();
          queryClient.clear();
        }}
        variant="secondary"
      />
    </Screen>
  );
}
