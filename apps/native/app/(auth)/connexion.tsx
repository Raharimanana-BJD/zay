import { useForm } from "@tanstack/react-form";
import { router, useLocalSearchParams } from "expo-router";
import { useToast } from "heroui-native";
import { useEffect } from "react";
import { Image, Text, View } from "react-native";
import z from "zod";
import { Field } from "@/components/auth-fields";
import { openVerification } from "@/components/auth-shell";
import { KeyboardAwareScrollView, SafeAreaView } from "@/components/styled";
import { Action, TextLink } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";
import { ENV } from "../../src/env";

const MIN_PASSWORD = 8;

export default function SignInScreen() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { error: oauthError } = useLocalSearchParams<{ error?: string }>();

  const schema = z.object({
    email: z.email(t("auth.emailInvalid")),
    password: z.string().min(MIN_PASSWORD, t("auth.passwordInvalid")),
  });

  // Google only opens accounts that exist, and comes back here with an error otherwise.
  useEffect(() => {
    if (oauthError) {
      toast.show({ variant: "danger", label: t("auth.googleFailed") });
    }
  }, [oauthError, toast, t]);

  const signInWithGoogle = async () => {
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
      errorCallbackURL: "/connexion?error=google",
    });
    if (result.error) {
      toast.show({ variant: "danger", label: t("auth.googleFailed") });
    }
  };

  const form = useForm({
    defaultValues: { email: "", password: "" },
    validators: { onSubmit: schema },
    onSubmit: async ({ value }) => {
      const email = value.email.trim();
      const result = await authClient.signIn.email({
        email,
        password: value.password,
      });
      if (result.error?.code === "EMAIL_NOT_VERIFIED") {
        // The server has just sent a new code.
        openVerification(email);
        return;
      }
      if (result.error) {
        toast.show({ variant: "danger", label: t("auth.signInFailed") });
      }
    },
  });

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerClassName="grow gap-5 px-6 pt-6 pb-6"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Image
          accessibilityIgnoresInvertColors
          className="h-44 w-full"
          resizeMode="contain"
          source={require("@/assets/images/welcome.png")}
        />
        <View className="gap-2">
          <Text
            accessibilityRole="header"
            className="font-black text-3xl text-foreground tracking-tight"
          >
            {t("auth.welcomeBack")}
          </Text>
          <Text className="text-base text-muted">
            {t("auth.welcomeBackBody")}
          </Text>
        </View>
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
        <form.Field name="password">
          {(field) => (
            <Field
              autoComplete="current-password"
              error={field.state.meta.errors[0]?.message}
              label={t("auth.password")}
              onBlur={field.handleBlur}
              onChangeText={field.handleChange}
              onSubmitEditing={form.handleSubmit}
              placeholder="••••••••"
              secureTextEntry
              value={field.state.value}
            />
          )}
        </form.Field>
        <View className="-mt-2 items-end">
          <TextLink
            label={t("auth.forgot")}
            onPress={() => router.push("/mot-de-passe")}
          />
        </View>
        <View className="mt-auto gap-2">
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Action
                isLoading={isSubmitting}
                label={t("auth.signInAction")}
                onPress={form.handleSubmit}
              />
            )}
          </form.Subscribe>
          {ENV.EXPO_PUBLIC_GOOGLE_SIGN_IN ? (
            <Action
              icon="logo-google"
              label={t("auth.google")}
              onPress={signInWithGoogle}
              variant="secondary"
            />
          ) : null}
          <TextLink
            label={t("auth.createAccount")}
            onPress={() => router.push("/inscription")}
            prefix={t("auth.noAccount")}
          />
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
