import { useLocalSearchParams } from "expo-router";
import { useToast } from "heroui-native";
import { useEffect } from "react";

import { Action } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";
import { ENV } from "../src/env";

const BANNED = /ban/i;

/**
 * "Continuer avec Google", on the sign in and sign up screens. A new email
 * opens an account, which then asks for its phone (spec 0005).
 */
export function GoogleButton() {
  const { t } = useI18n();
  const { toast } = useToast();
  if (!ENV.EXPO_PUBLIC_GOOGLE_SIGN_IN) {
    return null;
  }

  const signIn = async () => {
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
      errorCallbackURL: "/connexion?error=google",
    });
    if (result.error) {
      toast.show({ variant: "danger", label: t("auth.googleFailed") });
    }
  };

  return (
    <Action
      icon="logo-google"
      label={t("auth.google")}
      onPress={signIn}
      variant="secondary"
    />
  );
}

/** Google comes back to the sign in screen with `?error=` when it failed. */
export function useGoogleErrorToast() {
  const { t } = useI18n();
  const { toast } = useToast();
  const { error } = useLocalSearchParams<{ error?: string | string[] }>();
  const code = Array.isArray(error) ? error.at(-1) : error;
  useEffect(() => {
    if (!code) {
      return;
    }
    const label = BANNED.test(code)
      ? t("auth.signInFailed")
      : t("auth.googleFailed");
    toast.show({ variant: "danger", label });
  }, [code, toast, t]);
}
