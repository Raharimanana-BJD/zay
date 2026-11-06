# Native app

## Overview

The single Zay mobile app, built with Expo and React Native, for both clients and drivers. The demo targets Android. Spec 0003 records the mobile decisions, and it is still `Assumed` until `/architect` ratifies it.

## Key files

| File | Owns |
|---|---|
| `app/` | Expo Router routes, one group per space: `(auth)`, `(client)`, `(driver)` |
| `lib/auth-client.ts` | Better Auth client, stores the session in SecureStore |
| `utils/trpc.ts` | tRPC client and the shared `queryClient` |
| `components/ui.tsx` | Base components of the app |
| `components/zay-map.tsx` | The map: Leaflet inside a WebView |
| `lib/i18n/` | French and Malagasy dictionaries, and `useI18n` |
| `lib/use-action.ts` | Sends a sensitive action with a request id, so a retry does not act twice |
| `lib/driver-location.ts` | Sends the driver position to the server |
| `app.json` | Expo config: scheme, Android package, plugins |
| `babel-plugins/hermes-async-arrow-rest-params.js` | Temporary Hermes workaround |

## Commands

Run these from `apps/native`, or use `bun run dev:native` from the root to start Metro.

```bash
bun run android      # build and install a development build
bun run prebuild     # regenerate the native folders
bun run check-types
```

## Conventions

- Build UI with HeroUI Native and Uniwind. This app does not use `packages/ui`, which is for the web only.
- Import app files through the `@/` alias.
- Put every visible text in both `lib/i18n/fr.ts` and `lib/i18n/mg.ts`. Server error codes are shown through `errors.<CODE>` keys.
- Send sensitive actions through `useAction`.
- The app is light theme only, and screens read the server again every 3 seconds. There are no push notifications yet.
- Change native settings in `app.json`. The `android/` and `ios/` folders are generated and ignored by git, so edits made there are lost.
- Client env values must be public and start with `EXPO_PUBLIC_`. Declare them in `.env.schema`.

## Gotchas

- Native requests send the session cookie by hand: `utils/trpc.ts` uses `credentials: "omit"` and adds the cookie from `authClient.getCookie()`. Keep this for any new client that calls the server.
- On a real phone, `EXPO_PUBLIC_SERVER_URL` must be an address the phone can reach, not `localhost`.
- If the `scheme` in `app.json` changes, update `trustedOrigins` in `packages/auth/src/index.ts` too.
- `com.anonymous.zayapp` in `app.json` is still a placeholder package name.
- There is no `eas.json` yet, so EAS builds are not set up.
- The map loads Leaflet and its tiles from the internet, so it stays empty without a network.
- Remove the Hermes Babel plugin once the issue linked at the top of that file is fixed.

## Agent skills

- [expo-overview](../../.agents/skills/expo-overview/): `expo/skills`, the starting point for any Expo or EAS task
- [expo-router](../../.agents/skills/expo-router/): `expo/skills`, routes and navigation
- [expo-native-ui](../../.agents/skills/expo-native-ui/): `expo/skills`, native looking screens
- [expo-data-fetching](../../.agents/skills/expo-data-fetching/): `expo/skills`, network requests, caching, offline
- [expo-dev-client](../../.agents/skills/expo-dev-client/): `expo/skills`, development builds
- [eas-app-stores](../../.agents/skills/eas-app-stores/): `expo/skills`, EAS builds and store submission
- [eas-workflows](../../.agents/skills/eas-workflows/): `expo/skills`, EAS workflow files
- [heroui-native](../../.agents/skills/heroui-native/): `heroui-inc/heroui`, the component library
- [vercel-react-native-skills](../../.agents/skills/vercel-react-native-skills/): `vercel-labs/agent-skills`, React Native performance

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
