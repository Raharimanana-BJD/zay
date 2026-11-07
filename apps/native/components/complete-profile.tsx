import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { View } from "react-native";
import z from "zod";

import { Field } from "@/components/auth-fields";
import { AuthShell } from "@/components/auth-shell";
import {
  Action,
  Muted,
  SectionLabel,
  Segment,
  TextLink,
} from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";
import { useErrorToast } from "@/lib/use-action";
import { queryClient, trpc, trpcClient } from "@/utils/trpc";

const E164_PHONE = /^\+[1-9]\d{7,14}$/;

type Role = "client" | "driver";

/**
 * The only screen of an account without a phone, after a Google sign up
 * (spec 0005). The server refuses every other action until it is done.
 */
export function CompleteProfile() {
  const { t, locale } = useI18n();
  const showError = useErrorToast();
  const [role, setRole] = useState<Role>("client");

  const schema = z.object({
    phone: z.string().trim().regex(E164_PHONE, t("auth.phoneInvalid")),
  });

  const form = useForm({
    defaultValues: { phone: "+261" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      try {
        await trpcClient.me.completeProfile.mutate({
          phone: value.phone.trim(),
          role,
          locale,
        });
      } catch (error) {
        showError(error);
        return;
      }
      // The role may have changed: the session and me.get are read again.
      await authClient.getSession().catch(() => undefined);
      await queryClient.invalidateQueries({
        queryKey: trpc.me.get.queryKey(),
      });
    },
  });

  return (
    <AuthShell
      body={t("complete.body")}
      footer={
        <>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Action
                isLoading={isSubmitting}
                label={t("complete.action")}
                onPress={form.handleSubmit}
              />
            )}
          </form.Subscribe>
          <TextLink
            label={t("profile.signOut")}
            onPress={async () => {
              await authClient.signOut();
              queryClient.clear();
            }}
          />
        </>
      }
      hasBack={false}
      icon="person-outline"
      title={t("complete.title")}
    >
      <form.Field name="phone">
        {(field) => (
          <Field
            autoComplete="tel"
            error={field.state.meta.errors[0]?.message}
            keyboardType="phone-pad"
            label={t("auth.phone")}
            onBlur={field.handleBlur}
            onChangeText={field.handleChange}
            onSubmitEditing={form.handleSubmit}
            placeholder="+261 32 00 000 00"
            value={field.state.value}
          />
        )}
      </form.Field>
      <View className="gap-3">
        <SectionLabel>{t("complete.role")}</SectionLabel>
        <Segment<Role>
          onChange={setRole}
          options={[
            { value: "client", label: t("auth.asClient") },
            { value: "driver", label: t("auth.asDriver") },
          ]}
          value={role}
        />
        {role === "driver" ? <Muted>{t("auth.driverHint")}</Muted> : null}
      </View>
    </AuthShell>
  );
}
