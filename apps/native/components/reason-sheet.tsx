import { Input } from "heroui-native";
import { useState } from "react";
import { Pressable, Text } from "react-native";

import { Sheet } from "@/components/sheet";
import { Action, Muted } from "@/components/ui";
import { type TKey, useI18n } from "@/lib/i18n";

export interface ReasonAnswer {
  reasonCode: string;
  reasonNote?: string;
}

/** A choice of reason, with a note required for `other`. Also used for reports. */
export function ReasonSheet({
  visible,
  title,
  message,
  confirmLabel,
  reasons,
  labelPrefix,
  isLoading,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  reasons: readonly string[];
  labelPrefix: "cancel" | "report" | "price" | "dispute";
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (answer: ReasonAnswer) => void;
}) {
  const { t } = useI18n();
  const [code, setCode] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const needsNote = code === "other" && !note.trim();
  return (
    <Sheet onClose={onClose} title={title} visible={visible}>
      {message ? <Muted>{message}</Muted> : null}
      {reasons.map((reason) => {
        const selected = reason === code;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            className={`min-h-12 justify-center rounded-xl px-4 py-3 ${
              selected ? "bg-foreground" : "bg-surface-tertiary"
            }`}
            key={reason}
            onPress={() => setCode(reason)}
          >
            <Text className={selected ? "text-background" : "text-foreground"}>
              {t(`${labelPrefix}.${reason}` as TKey)}
            </Text>
          </Pressable>
        );
      })}
      <Input
        accessibilityLabel={t("common.note")}
        onChangeText={setNote}
        placeholder={t("common.note")}
        value={note}
      />
      <Action
        isDisabled={!code || needsNote}
        isLoading={isLoading}
        label={confirmLabel}
        onPress={() => {
          if (code) {
            onConfirm({
              reasonCode: code,
              reasonNote: note.trim() || undefined,
            });
          }
        }}
      />
    </Sheet>
  );
}
