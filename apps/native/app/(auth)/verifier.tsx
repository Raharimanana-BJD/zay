import { useLocalSearchParams } from "expo-router";
import { useToast } from "heroui-native";
import { useEffect, useState } from "react";

import { CodeInput, OTP_LENGTH } from "@/components/auth-fields";
import { AuthShell } from "@/components/auth-shell";
import { Action, TextLink } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";
import { clearPendingVerification } from "@/lib/pending-verification";
import { useSetRegistering } from "@/lib/registering";
import { queryClient, trpc, trpcClient } from "@/utils/trpc";

type Relation = "owner" | "renter" | "employee";
const RELATIONS: readonly string[] = ["owner", "renter", "employee"];

const isRelation = (value: unknown): value is Relation =>
  typeof value === "string" && RELATIONS.includes(value);

/** Checks the emailed code. A right code opens the session. */
export default function VerifyEmailScreen() {
  const { t } = useI18n();
  const { toast } = useToast();
  const setRegistering = useSetRegistering();
  const params = useLocalSearchParams<{ email: string; relation?: string }>();
  const email = params.email ?? "";
  const relation = isRelation(params.relation) ? params.relation : undefined;
  const [code, setCode] = useState("");
  const [isInvalid, setIsInvalid] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isSending, setIsSending] = useState(false);
  // Leaving this screen (back, or the session it opens) ends the wait for a code.
  useEffect(
    () => () => {
      clearPendingVerification();
    },
    []
  );

  const verify = async (otp: string) => {
    if (otp.length !== OTP_LENGTH || isChecking) {
      return;
    }
    setIsChecking(true);
    setIsInvalid(false);
    // A new driver keeps this screen until the account becomes a driver account.
    setRegistering(Boolean(relation));
    const result = await authClient.emailOtp.verifyEmail({ email, otp });
    if (result.error) {
      setRegistering(false);
      setIsChecking(false);
      setIsInvalid(true);
      setCode("");
      const label =
        result.error.code === "INVALID_OTP"
          ? t("auth.codeWrong")
          : t("auth.codeExpired");
      toast.show({ variant: "danger", label });
      return;
    }
    if (!relation) {
      return;
    }
    try {
      await trpcClient.driver.register.mutate({ employmentRelation: relation });
    } catch {
      toast.show({ variant: "danger", label: t("errors.network") });
    } finally {
      await queryClient.invalidateQueries(trpc.me.get.queryFilter());
      setRegistering(false);
    }
  };

  const resend = async () => {
    setIsSending(true);
    const result = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    });
    setIsSending(false);
    toast.show(
      result.error
        ? { variant: "danger", label: t("errors.generic") }
        : { variant: "success", label: t("auth.resent") }
    );
  };

  return (
    <AuthShell
      body={t("auth.verifyBody", { email })}
      footer={
        <Action
          isDisabled={code.length !== OTP_LENGTH}
          isLoading={isChecking}
          label={t("auth.verify")}
          onPress={() => verify(code)}
        />
      }
      icon="mail-outline"
      title={t("auth.verifyTitle")}
    >
      <CodeInput
        isInvalid={isInvalid}
        onChange={(next) => {
          setCode(next);
          setIsInvalid(false);
        }}
        onComplete={verify}
        value={code}
      />
      <TextLink
        isDisabled={isSending}
        label={t("auth.resend")}
        onPress={resend}
        prefix={t("auth.noCode")}
      />
    </AuthShell>
  );
}
