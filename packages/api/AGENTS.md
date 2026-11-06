# API package

## Overview

The tRPC layer, where Zay's business rules live. The server mounts it, and the web and native apps import its `AppRouter` type to get typed calls.

## Key files

| File | Owns |
|---|---|
| `src/index.ts` | tRPC setup: `router`, `publicProcedure`, `protectedProcedure` |
| `src/context.ts` | The `Context` type: `session` and `db` |
| `src/routers/index.ts` | `appRouter` and the `AppRouter` type |

## Conventions

- Mount every new router in `appRouter`.
- Use `db` and `session` from the context. This package never creates its own clients; `apps/server` builds the context.

## Gotchas

- `protectedProcedure` only checks that a user is signed in. It does not check roles yet, so client, driver and admin access still has to be added (scope features 3 and 26).

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
