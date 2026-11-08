# Server

## Overview

The Hono API server, running on Bun. It owns the secrets, creates the database and auth clients, and exposes auth and tRPC over HTTP. Feature logic belongs in `packages/api`, not here.

## Key files

| File | Owns |
|---|---|
| `src/index.ts` | The Hono app, CORS, and the `/api/auth/*`, `/trpc/*`, `/files/*` and `/` routes |
| `src/dispatcher.ts` | Calls `runDispatchTick` every second, for the search groups and timers |
| `src/files.ts` | Stores and reads files on the server disk, and implements `FileAccess` |
| `scripts/` | Admin creation, seeds and the verification scripts |
| `src/services.ts` | Creates `db` and `auth` from `ENV`, the one place they are built |
| `src/context.ts` | Builds the tRPC context: `db`, `auth`, `files`, headers and the session |
| `src/env.server.ts` | Loads Varlock, then exports `ENV` |
| `.env.schema` | Server env schema, also the source for `packages/db` |
| `tsdown.config.ts` | Production build, bundles the `@zay-app/*` packages |

## Commands

Run these from `apps/server`, or use `bun run dev:server` from the root to start in dev mode.

```bash
bun run build          # outputs to dist/
bun run start          # runs dist/index.mjs
bun run auth:generate  # regenerates the auth schema in packages/db
bun run admin:create --email <email> --name <name> --phone <phone>  # creates an admin, asks for the password
bun run seed:backoffice  # test data for the back office, stops if already seeded
SEED_PASSWORD=<password> bun run seed:mobile  # places, zones and accounts for the mobile app
bun run db:verify      # checks the data model on a full ride
bun run verify:mobile  # runs the mobile flows and scenarios A to G against the rules
```

## Conventions

- In server code, import `ENV` from `./env.server`, so Varlock loads before any value is read.
- Add new shared services to `src/services.ts`, and pass them to procedures through `src/context.ts`.

## Gotchas

- `auth:generate` loads the auth instance from `src/services.ts`, so that file must keep exporting `auth`.
- CORS allows a single origin, `CORS_ORIGIN`, with credentials on. This is the web app's address.
- Files sent by drivers go to `uploads/`, which git ignores. A hosted server needs a disk that survives a restart.
- Read rights follow the key prefix: `up-doc-` goes to the team and the driver who owns it, `up-photo-` to any signed in account, `up-avatar-<userId>-` to its owner, the team, and the other side of an active ride. Size and formats per kind live in `UPLOAD_KINDS` in `src/files.ts`; the format is read from the first bytes, never the file name.
- Image answers carry `Content-Security-Policy: sandbox`. PDFs do not, because Chrome refuses to show its PDF viewer for a sandboxed response; they rely on the browser viewer, which runs no page script.
- The seeds and verification scripts write to the database, so run them on a test database.

## Agent skills

- [hono](../../.agents/skills/hono/): `honojs/skills`, Hono routes, middleware and testing

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
