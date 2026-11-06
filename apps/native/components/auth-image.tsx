import { useEffect, useState } from "react";
import { Image, View } from "react-native";

import { authClient } from "@/lib/auth-client";

const IMAGE_CLASS = "h-16 w-20 rounded-xl bg-surface-tertiary";

/** Files need the session, and a native image request does not send the cookie by itself. */
export function AuthImage({ uri, label }: { uri: string; label: string }) {
  const [cookie, setCookie] = useState<string | null>(null);
  useEffect(() => {
    Promise.resolve(authClient.getCookie())
      .then(setCookie)
      .catch(() => undefined);
  }, []);
  if (!cookie) {
    return <View className={IMAGE_CLASS} />;
  }
  return (
    <Image
      accessibilityLabel={label}
      className={IMAGE_CLASS}
      source={{ uri, headers: { Cookie: cookie } }}
    />
  );
}
