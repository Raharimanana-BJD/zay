import {
  focusManager,
  onlineManager,
  QueryClient,
} from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@zay-app/api/routers/index";
import { addNetworkStateListener } from "expo-network";
import { AppState, Platform } from "react-native";

import { authClient } from "@/lib/auth-client";

import { ENV } from "../src/env";

// Screens read the server again every few seconds, but never in the background.
AppState.addEventListener("change", (state) => {
  focusManager.setFocused(state === "active");
});
onlineManager.setEventListener((setOnline) => {
  const subscription = addNetworkStateListener((network) => {
    setOnline(Boolean(network.isConnected));
  });
  return () => subscription.remove();
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 2000 },
  },
});

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${ENV.EXPO_PUBLIC_SERVER_URL}/trpc`,
      fetch(url, options) {
        return fetch(url, {
          ...options,
          // Better Auth Expo forwards the session cookie manually on native.
          credentials: Platform.OS === "web" ? "include" : "omit",
        });
      },
      async headers() {
        if (Platform.OS === "web") {
          return {};
        }
        const headers = new Map<string, string>();
        const cookies = await authClient.getCookie();
        if (cookies) {
          headers.set("Cookie", cookies);
        }
        return Object.fromEntries(headers);
      },
    }),
  ],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: trpcClient,
  queryClient,
});
