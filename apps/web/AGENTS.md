# Web app

## Overview

The Zay web app, built with TanStack Start on Vite, and the home of the admin back office. It runs on port 3001 and reaches all data through the API server. The back office lives under `/admin`, and the team signs in at `/login`.

## Key files

| File | Owns |
|---|---|
| `src/routes/` | File based routes |
| `src/routes/admin/route.tsx` | Layout for `/admin`: redirects to `/login` without a session, and shows access denied outside the team |
| `src/routes/admin/_reserve/` | Pages for the `admin` role only: settings, team and audit log |
| `src/components/admin/` | Shell, list controls, status badges and live map of the back office |
| `src/lib/labels.ts` | French labels for the codes in `packages/api/src/domain/codes.ts` |
| `src/router.tsx` | Router, query client and tRPC client setup |
| `src/lib/auth-client.ts` | Better Auth client |
| `vite.config.ts` | Vite plugins and the dev port |

## Commands

Run these from `apps/web`, or use `bun run dev:web` from the root to start in dev mode.

```bash
bun run build
bun run serve        # preview the production build
bun run check-types  # runs vite build first, so it is slower than plain tsc
```

To add blocks that only this app uses, run the shadcn CLI from this folder.

## Conventions

- Use shared components from `@zay-app/ui`, and put app only components in `src/components/`.
- Client env values must be public and start with `VITE_`. Declare them in `.env.schema`.

## Gotchas

- `src/routeTree.gen.ts` is generated and ignored by git, so never edit it. That is why `check-types` builds first.
- Routes under `/admin` set `ssr: false`, so their session check runs in the browser.
- The live map adds `VITE_CARTO_API_KEY` to CARTO requests through `transformRequest`, because the shared map component builds the style URL without a key.
- The guard in `/admin` protects pages only. Every sensitive action still needs its own check on the server.

## Agent skills

- [shadcn](../../.agents/skills/shadcn/): `shadcn/ui`, adding and composing components
- [vercel-react-best-practices](../../.agents/skills/vercel-react-best-practices/): `vercel-labs/agent-skills`, React performance
- [vercel-composition-patterns](../../.agents/skills/vercel-composition-patterns/): `vercel-labs/agent-skills`, component structure
- [web-design-guidelines](../../.agents/skills/web-design-guidelines/): `vercel-labs/agent-skills`, UI and accessibility review
- [recharts](../../.agents/skills/recharts/): `andy-spike/skills`, the dashboard charts

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
