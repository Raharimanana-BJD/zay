import { onlineManager } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";

import { Notice } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

const subscribe = (listener: () => void) => onlineManager.subscribe(listener);

/** What is on screen is the last reliable information, and it says so (cahier §14). */
export function OfflineBanner() {
  const { t } = useI18n();
  const isOnline = useSyncExternalStore(subscribe, () =>
    onlineManager.isOnline()
  );
  return isOnline ? null : (
    <Notice tone="warning">{t("common.offline")}</Notice>
  );
}
