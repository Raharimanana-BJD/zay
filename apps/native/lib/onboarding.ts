import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";

const STORAGE_KEY = "zay-onboarded";

/** The welcome slides show once, on the first launch of the app. */
export function useOnboarded() {
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((value) => setOnboarded(value === "1"))
      .catch(() => setOnboarded(true));
  }, []);
  return onboarded;
}

export const markOnboarded = () =>
  SecureStore.setItemAsync(STORAGE_KEY, "1").catch(() => undefined);
