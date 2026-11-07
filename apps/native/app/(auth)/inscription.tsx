import { useForm } from "@tanstack/react-form";
import { router } from "expo-router";
import { useToast } from "heroui-native";
import { useState } from "react";
import { View } from "react-native";
import z from "zod";

import { Field } from "@/components/auth-fields";
import { AuthShell, openVerification } from "@/components/auth-shell";
import { Action, Muted, Segment, TextLink } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";

const E164_PHONE = /^\+[1-9]\d{7,14}$/;
const MIN_PASSWORD = 8;
const MIN_NAME = 2;
/** A new driver starts as owner, and picks the real situation in the Dossier tab. */
const DEFAULT_RELATION = "owner";

type Role = "client" | "driver";

export default function SignUpScreen() {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const [role, setRole] = useState<Role>("client");

  const schema = z.object({
    name: z.string().trim().min(MIN_NAME, t("auth.nameInvalid")),
    email: z.email(t("auth.emailInvalid")),
    phone: z.string().trim().regex(E164_PHONE, t("auth.phoneInvalid")),
    password: z.string().min(MIN_PASSWORD, t("auth.passwordInvalid")),
  });

  const form = useForm({
    defaultValues: { name: "", email: "", phone: "+261", password: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      const email = value.email.trim();
      const result = await authClient.signUp.email({
        name: value.name.trim(),
        email,
        phone: value.phone.trim(),
        password: value.password,
        locale,
      });
      if (result.error) {
        toast.show({
          variant: "danger",
          label:
            result.error.code === "PHONE_NUMBER_ALREADY_USED"
              ? t("errors.PHONE_TAKEN")
              : result.error.message || t("errors.generic"),
        });
        return;
      }
      // The account opens once the emailed code is checked.
      openVerification(email, role === "driver" ? DEFAULT_RELATION : undefined);
    },
  });

  return (
    <AuthShell
      body={t("auth.signUpBody")}
      footer={
        <>
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Action
                isLoading={isSubmitting}
                label={t("auth.create")}
                onPress={form.handleSubmit}
              />
            )}
          </form.Subscribe>
          <TextLink
            label={t("auth.signInAction")}
            onPress={() => router.back()}
            prefix={t("auth.haveAccount")}
          />
        </>
      }
      title={t("auth.createAccount")}
    >
      <View className="gap-3">
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
      <View className="gap-4">
        <form.Field name="name">
          {(field) => (
            <Field
              autoComplete="name"
              error={field.state.meta.errors[0]?.message}
              label={t("auth.name")}
              onBlur={field.handleBlur}
              onChangeText={field.handleChange}
              placeholder={t("auth.namePlaceholder")}
              value={field.state.value}
            />
          )}
        </form.Field>
        <form.Field name="email">
          {(field) => (
            <Field
              autoCapitalize="none"
              autoComplete="email"
              error={field.state.meta.errors[0]?.message}
              keyboardType="email-address"
              label={t("auth.email")}
              onBlur={field.handleBlur}
              onChangeText={field.handleChange}
              placeholder={t("auth.emailPlaceholder")}
              value={field.state.value}
            />
          )}
        </form.Field>
        <form.Field name="phone">
          {(field) => (
            <Field
              autoComplete="tel"
              error={field.state.meta.errors[0]?.message}
              keyboardType="phone-pad"
              label={t("auth.phone")}
              onBlur={field.handleBlur}
              onChangeText={field.handleChange}
              placeholder="+261 32 00 000 00"
              value={field.state.value}
            />
          )}
        </form.Field>
        <form.Field name="password">
          {(field) => (
            <Field
              autoComplete="new-password"
              error={field.state.meta.errors[0]?.message}
              label={t("auth.password")}
              onBlur={field.handleBlur}
              onChangeText={field.handleChange}
              placeholder="••••••••"
              secureTextEntry
              value={field.state.value}
            />
          )}
        </form.Field>
      </View>
    </AuthShell>
  );
}
