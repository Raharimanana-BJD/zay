import { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";

import { authClient } from "@/lib/auth-client";

const IMAGE_CLASS = "h-16 w-20 rounded-xl bg-surface-tertiary";

/** Files need the session, and a native image request does not send the cookie by itself. */
function useSessionCookie() {
  const [cookie, setCookie] = useState<string | null>(null);
  useEffect(() => {
    Promise.resolve(authClient.getCookie())
      .then(setCookie)
      .catch(() => undefined);
  }, []);
  return cookie;
}

export function AuthImage({
  uri,
  label,
  className = IMAGE_CLASS,
  fit = "cover",
}: {
  uri: string;
  label: string;
  className?: string;
  fit?: "contain" | "cover";
}) {
  const cookie = useSessionCookie();
  if (!cookie) {
    return <View className={className} />;
  }
  return (
    <Image
      accessibilityLabel={label}
      className={className}
      resizeMode={fit}
      source={{ uri, headers: { Cookie: cookie } }}
    />
  );
}

const AVATAR_SIZES = {
  md: { box: "size-12", letter: "text-lg" },
  lg: { box: "size-16", letter: "text-2xl" },
} as const;

export const initialOf = (name?: string | null) =>
  name?.trim().charAt(0).toUpperCase() || "Z";

/**
 * A round profile photo. Without a photo, or once the server refuses it (the ride
 * ended), it shows the first letter of the name instead.
 */
export function Avatar({
  uri,
  name,
  size = "md",
}: {
  uri?: string | null;
  name?: string | null;
  size?: keyof typeof AVATAR_SIZES;
}) {
  const cookie = useSessionCookie();
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const { box, letter } = AVATAR_SIZES[size];
  const showsPhoto = Boolean(uri && cookie && failedUri !== uri);
  return (
    <View
      accessibilityElementsHidden
      className={`${box} items-center justify-center overflow-hidden rounded-full bg-foreground`}
      importantForAccessibility="no-hide-descendants"
    >
      {showsPhoto && uri && cookie ? (
        <Image
          className={box}
          onError={() => setFailedUri(uri)}
          source={{ uri, headers: { Cookie: cookie } }}
        />
      ) : (
        <Text className={`font-black text-white ${letter}`}>
          {initialOf(name)}
        </Text>
      )}
    </View>
  );
}
