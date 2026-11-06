import { useForm } from "@tanstack/react-form";
import { FieldError, Input, Label, TextField, useToast } from "heroui-native";
import { useState } from "react";
import { Image, Text, View } from "react-native";
import z from "zod";

import { Action, Muted, Screen, Segment, Title } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { type Locale, useI18n } from "@/lib/i18n";
import { useSetRegistering } from "@/lib/registering";
import { queryClient, trpc, trpcClient } from "@/utils/trpc";

const E164_PHONE = /^\+[1-9]\d{7,14}$/;
const MIN_PASSWORD = 8;
const MIN_NAME = 2;

type Mode = "signIn" | "client" | "driver";
type Relation = "owner" | "renter" | "employee";

function Field({
  label,
  error,
  ...input
}: {
  label: string;
  error?: string;
} & React.ComponentProps<typeof Input>) {
  return (
    <TextField isInvalid={Boolean(error)}>
      <Label>{label}</Label>
      <Input {...input} />
      {error ? <FieldError>{error}</FieldError> : null}
    </TextField>
  );
}

export default function AuthScreen() {
  const { t, locale, setLocale } = useI18n();
  const { toast } = useToast();
  const setRegistering = useSetRegistering();
  const [mode, setMode] = useState<Mode>("signIn");
  const [relation, setRelation] = useState<Relation>("owner");
  const isSignIn = mode === "signIn";

  const schema = z.object({
    name: isSignIn
      ? z.string()
      : z.string().trim().min(MIN_NAME, t("auth.nameInvalid")),
    email: z.email(t("auth.emailInvalid")),
    phone: isSignIn
      ? z.string()
      : z.string().trim().regex(E164_PHONE, t("auth.phoneInvalid")),
    password: z.string().min(MIN_PASSWORD, t("auth.passwordInvalid")),
  });

  const fail = (message?: string) =>
    toast.show({ variant: "danger", label: message || t("errors.generic") });

  const signUp = async (value: z.infer<typeof schema>) => {
    const isDriver = mode === "driver";
    setRegistering(isDriver);
    const result = await authClient.signUp.email({
      name: value.name.trim(),
      email: value.email.trim(),
      phone: value.phone.trim(),
      password: value.password,
      locale,
    });
    if (result.error) {
      setRegistering(false);
      const key =
        result.error.code === "PHONE_NUMBER_ALREADY_USED"
          ? t("errors.PHONE_TAKEN")
          : result.error.message;
      fail(key);
      return;
    }
    if (!isDriver) {
      return;
    }
    try {
      await trpcClient.driver.register.mutate({ employmentRelation: relation });
    } catch {
      fail(t("errors.network"));
    } finally {
      await queryClient.invalidateQueries(trpc.me.get.queryFilter());
      setRegistering(false);
    }
  };

  const form = useForm({
    defaultValues: { name: "", email: "", phone: "+261", password: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      if (mode !== "signIn") {
        await signUp(value);
        return;
      }
      const result = await authClient.signIn.email({
        email: value.email.trim(),
        password: value.password,
      });
      if (result.error) {
        fail(t("auth.signInFailed"));
      }
    },
  });

  const relations: { value: Relation; label: string }[] = [
    { value: "owner", label: t("relation.owner") },
    { value: "renter", label: t("relation.renter") },
    { value: "employee", label: t("relation.employee") },
  ];

  return (
    <Screen>
      <Image
        accessibilityLabel="Zay"
        className="size-16"
        resizeMode="contain"
        source={require("@/assets/images/logo.png")}
      />
      <Title>{t("auth.welcome")}</Title>
      <Muted>{t("auth.tagline")}</Muted>
      <Segment<Locale>
        onChange={setLocale}
        options={[
          { value: "fr", label: "Français" },
          { value: "mg", label: "Malagasy" },
        ]}
        value={locale}
      />
      <Segment<Mode>
        onChange={setMode}
        options={[
          { value: "signIn", label: t("auth.signIn") },
          { value: "client", label: t("auth.asClient") },
          { value: "driver", label: t("auth.asDriver") },
        ]}
        value={mode}
      />
      <View className="gap-3">
        {isSignIn ? null : (
          <form.Field name="name">
            {(field) => (
              <Field
                autoComplete="name"
                error={field.state.meta.errors[0]?.message}
                label={t("auth.name")}
                onBlur={field.handleBlur}
                onChangeText={field.handleChange}
                value={field.state.value}
              />
            )}
          </form.Field>
        )}
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
              value={field.state.value}
            />
          )}
        </form.Field>
        {isSignIn ? null : (
          <form.Field name="phone">
            {(field) => (
              <Field
                autoComplete="tel"
                error={field.state.meta.errors[0]?.message}
                keyboardType="phone-pad"
                label={t("auth.phone")}
                onBlur={field.handleBlur}
                onChangeText={field.handleChange}
                value={field.state.value}
              />
            )}
          </form.Field>
        )}
        <form.Field name="password">
          {(field) => (
            <Field
              autoComplete={isSignIn ? "current-password" : "new-password"}
              error={field.state.meta.errors[0]?.message}
              label={t("auth.password")}
              onBlur={field.handleBlur}
              onChangeText={field.handleChange}
              secureTextEntry
              value={field.state.value}
            />
          )}
        </form.Field>
        {mode === "driver" ? (
          <View className="gap-2">
            <Text className="font-medium text-foreground text-sm">
              {t("relation.title")}
            </Text>
            <Segment<Relation>
              onChange={setRelation}
              options={relations}
              value={relation}
            />
          </View>
        ) : null}
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Action
              isLoading={isSubmitting}
              label={isSignIn ? t("auth.signIn") : t("auth.create")}
              onPress={form.handleSubmit}
            />
          )}
        </form.Subscribe>
      </View>
    </Screen>
  );
}
