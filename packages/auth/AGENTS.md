# Auth package

## Overview

The Better Auth setup, with email and password sign in, the Expo plugin and the admin plugin. It exports a `createAuth` factory, and `apps/server` calls it with its env values and database.

## Key files

| File | Owns |
|---|---|
| `src/index.ts` | `createAuth`, the `AuthConfig` type and the `Session` type |

## Conventions

- After changing plugins or schema options, run `bun run auth:generate` from the root, review the schema change, then apply it through Drizzle.

## Gotchas

- Every HTTP route of the admin plugin is closed through `CLOSED_PATHS`, with the email OTP sign in and email change routes. The server calls these actions through `auth.api`, after its own role checks.
- The role cannot be chosen at sign up. Every new account starts as `client`.
- `trustedOrigins` holds fixed values next to `CORS_ORIGIN`: `zay-app://`, `exp://` and `http://localhost:8081`. A new app scheme or client origin has to be added here, or its sign in requests are rejected.
- Cookies are set with `SameSite=None` and `Secure`, so the deployed server has to use HTTPS.
- `@better-auth/core` and `@better-auth/drizzle-adapter` are pinned in this package's manifest, while `better-auth` and `@better-auth/expo` come from the root catalog. Update all four together.

## Agent skills

- [better-auth-best-practices](../../.agents/skills/better-auth-best-practices/): `better-auth/skills`, server and client setup
- [better-auth-security-best-practices](../../.agents/skills/better-auth-security-best-practices/): `better-auth/skills`, rate limits, sessions, secrets
- [email-and-password-best-practices](../../.agents/skills/email-and-password-best-practices/): `better-auth/skills`, sign in, verification, password reset

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
