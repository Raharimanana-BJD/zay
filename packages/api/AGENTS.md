# API package

## Overview

The tRPC layer, where Zay's business rules live. The server mounts it, and the web and native apps import its `AppRouter` type to get typed calls.

## Key files

| File | Owns |
|---|---|
| `src/index.ts` | tRPC setup: `router` and the public, protected, staff, admin, client and driver procedures |
| `src/context.ts` | The `Context` type: `session`, `db`, `auth`, `headers` and `files` |
| `src/routers/index.ts` | `appRouter` and the `AppRouter` type |
| `src/routers/` | `client`, `driver`, `me`, and `admin/` for the team |
| `src/domain/` | Business rules: `dispatch`, `offers`, `rides`, `trip`, `booking-status`, and the codes in `codes.ts` |

## Conventions

- Mount every new router in `appRouter`.
- Use `db` and `session` from the context. This package never creates its own clients; `apps/server` builds the context.

## Gotchas

- `protectedProcedure` only checks that a user is signed in. Use `clientProcedure`, `driverProcedure`, `staffProcedure` or `adminProcedure` for anything tied to a role.
- `user.phone` can be null (a Google account before "Compléter mon profil"). `clientProcedure` and `driverProcedure` build on `completeProcedure`, which answers `PROFILE_INCOMPLETE` then; use `completeProcedure` for any new action outside those roles (as `me.report` does). The rule lives in `src/domain/profile.ts`.
- `user.image` is written only by `me.setImage` and `me.removeImage`, which check the key belongs to the caller.

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
