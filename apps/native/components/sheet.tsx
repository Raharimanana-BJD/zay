import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { Heading } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

export function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior="padding"
        className="flex-1 justify-end bg-black/40"
      >
        <View className="max-h-[85%] gap-3 rounded-t-3xl bg-background p-4 pb-8">
          <View className="flex-row items-center justify-between gap-3">
            <View className="shrink">
              <Heading>{title}</Heading>
            </View>
            <Pressable
              accessibilityRole="button"
              className="min-h-12 justify-center px-2"
              onPress={onClose}
            >
              <Text className="font-medium text-foreground">
                {t("common.close")}
              </Text>
            </Pressable>
          </View>
          <ScrollView
            contentContainerClassName="gap-3"
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
