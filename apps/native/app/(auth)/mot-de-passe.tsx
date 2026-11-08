import { router, useLocalSearchParams } from "expo-router";
import { useToast } from "heroui-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import z from "zod";

import { CodeInput, Field, OTP_LENGTH } from "@/components/auth-fields";
import { AuthShell } from "@/components/auth-shell";
import { Action, TextLink } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";
import {
  clearPendingVerification,
  savePendingVerification,
} from "@/lib/pending-verification";

const MIN_PASSWORD = 8;
const OTP_TYPE = "forget-password";

type Step = "email" | "code" | "password";

/** Forgot password: the email, the emailed code, then a new password. */
export default function ResetPasswordScreen() {
  const { t } = useI18n();
  const { toast } = useToast();
  // Set when the app reopens on this flow after Android closed it (see index).
  const resumed = useLocalSearchParams<{ email?: string }>().email;
  const [step, setStep] = useState<Step>(resumed ? "code" : "email");
  const [email, setEmail] = useState(resumed ?? "");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string>();
  const [isBusy, setIsBusy] = useState(false);

  // The wait for a code lasts while this flow is on screen, past the email step.
  useEffect(() => {
    if (step === "email") {
      clearPendingVerification();
    } else {
      savePendingVerification({ kind: "reset-password", email });
    }
  }, [step, email]);
  useEffect(
    () => () => {
      clearPendingVerification();
    },
    []
  );

  const fail = (label: string) => toast.show({ variant: "danger", label });
  const codeError = (errorCode?: string) =>
    errorCode === "INVALID_OTP" ? t("auth.codeWrong") : t("auth.codeExpired");

  const requestCode = async () => {
    const parsed = z.email().safeParse(email.trim());
    if (!parsed.success) {
      setError(t("auth.emailInvalid"));
      return;
    }
    setError(undefined);
    setIsBusy(true);
    // The answer is the same whether the account exists or not.
    const result = await authClient.emailOtp.requestPasswordReset({
      email: parsed.data,
    });
    setIsBusy(false);
    if (result.error) {
      fail(t("errors.generic"));
      return;
    }
    setEmail(parsed.data);
    setCode("");
    setStep("code");
  };

  // Checks the code without using it, so a wrong one is caught before the password step.
  const checkCode = async (otp: string) => {
    if (otp.length !== OTP_LENGTH || isBusy) {
      return;
    }
    setIsBusy(true);
    const result = await authClient.emailOtp.checkVerificationOtp({
      email,
      otp,
      type: OTP_TYPE,
    });
    setIsBusy(false);
    if (result.error) {
      setCode("");
      fail(codeError(result.error.code));
      return;
    }
    setStep("password");
  };

  const reset = async () => {
    if (password.length < MIN_PASSWORD) {
      setError(t("auth.passwordInvalid"));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    setError(undefined);
    setIsBusy(true);
    const result = await authClient.emailOtp.resetPassword({
      email,
      otp: code,
      password,
    });
    setIsBusy(false);
    if (result.error) {
      setCode("");
      setStep("code");
      fail(codeError(result.error.code));
      return;
    }
    toast.show({ variant: "success", label: t("auth.resetDone") });
    router.back();
  };

  const back = () => {
    setError(undefined);
    if (step === "email") {
      router.back();
    } else {
      setStep(step === "password" ? "code" : "email");
    }
  };

  if (step === "email") {
    return (
      <AuthShell
        body={t("auth.resetBody")}
        icon="lock-closed-outline"
        onBack={back}
        title={t("auth.resetTitle")}
      >
        <Field
          autoCapitalize="none"
          autoComplete="email"
          autoFocus
          error={error}
          keyboardType="email-address"
          label={t("auth.email")}
          onChangeText={setEmail}
          onSubmitEditing={requestCode}
          placeholder={t("auth.emailPlaceholder")}
          value={email}
        />
        <Action
          isLoading={isBusy}
          label={t("auth.sendCode")}
          onPress={requestCode}
        />
      </AuthShell>
    );
  }

  if (step === "code") {
    return (
      <AuthShell
        body={t("auth.verifyBody", { email })}
        footer={
          <Action
            isDisabled={code.length !== OTP_LENGTH}
            isLoading={isBusy}
            label={t("auth.verify")}
            onPress={() => checkCode(code)}
          />
        }
        icon="mail-outline"
        onBack={back}
        title={t("auth.codeTitle")}
      >
        <CodeInput onChange={setCode} onComplete={checkCode} value={code} />
        <TextLink
          isDisabled={isBusy}
          label={t("auth.resend")}
          onPress={requestCode}
          prefix={t("auth.noCode")}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      body={t("auth.newPasswordBody")}
      footer={
        <Action
          isDisabled={!(password && confirm)}
          isLoading={isBusy}
          label={t("common.save")}
          onPress={reset}
        />
      }
      icon="lock-closed-outline"
      onBack={back}
      title={t("auth.newPassword")}
    >
      <View className="gap-4">
        <Field
          autoComplete="new-password"
          autoFocus
          label={t("auth.newPassword")}
          onChangeText={(value) => {
            setPassword(value);
            setError(undefined);
          }}
          placeholder="••••••••"
          secureTextEntry
          value={password}
        />
        <Field
          autoComplete="new-password"
          error={error}
          label={t("auth.confirmPassword")}
          onChangeText={(value) => {
            setConfirm(value);
            setError(undefined);
          }}
          onSubmitEditing={reset}
          placeholder="••••••••"
          secureTextEntry
          value={confirm}
        />
      </View>
    </AuthShell>
  );
}
