import { useToast } from "heroui-native";
import { useState } from "react";
import { View } from "react-native";

import { Field } from "@/components/auth-fields";
import { Action } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";

const MIN_PASSWORD = 8;

/** Asks the current password, and signs out the other devices. */
export function ChangePassword({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);

  const close = () => {
    setCurrent("");
    setNext("");
    setError(undefined);
    onDone();
  };

  const save = async () => {
    if (next.length < MIN_PASSWORD) {
      setError(t("auth.passwordInvalid"));
      return;
    }
    setIsSaving(true);
    const result = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    });
    setIsSaving(false);
    if (result.error) {
      toast.show({
        variant: "danger",
        label:
          result.error.code === "INVALID_PASSWORD"
            ? t("profile.passwordWrong")
            : t("errors.generic"),
      });
      return;
    }
    toast.show({ variant: "success", label: t("profile.passwordChanged") });
    close();
  };

  return (
    <View className="gap-3">
      <Field
        autoComplete="current-password"
        label={t("profile.currentPassword")}
        onChangeText={setCurrent}
        secureTextEntry
        value={current}
      />
      <Field
        autoComplete="new-password"
        error={error}
        label={t("auth.newPassword")}
        onChangeText={(value) => {
          setNext(value);
          setError(undefined);
        }}
        secureTextEntry
        value={next}
      />
      <Action
        isDisabled={!current}
        isLoading={isSaving}
        label={t("common.save")}
        onPress={save}
      />
    </View>
  );
}
