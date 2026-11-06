# Web app

## Overview

The Zay web app, built with TanStack Start on Vite, and the home of the admin back office. It runs on port 3001 and reaches all data through the API server. The current routes are still the starter pages.

## Key files

| File | Owns |
|---|---|
| `src/routes/` | File based routes |
| `src/routes/_auth/route.tsx` | Layout for signed in pages, redirects to `/login` without a session |
| `src/router.tsx` | Router, query client and tRPC client setup |
| `src/lib/auth-client.ts` | Better Auth client |
| `src/middleware/auth.ts` | Reads the session on the server by forwarding request headers |
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
- Routes under `_auth` set `ssr: false`, so their session check runs in the browser.
- The redirect in `_auth` protects pages only. Every sensitive action still needs its own check on the server.

## Agent skills

- [shadcn](../../.agents/skills/shadcn/): `shadcn/ui`, adding and composing components
- [vercel-react-best-practices](../../.agents/skills/vercel-react-best-practices/): `vercel-labs/agent-skills`, React performance
- [vercel-composition-patterns](../../.agents/skills/vercel-composition-patterns/): `vercel-labs/agent-skills`, component structure
- [web-design-guidelines](../../.agents/skills/web-design-guidelines/): `vercel-labs/agent-skills`, UI and accessibility review

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
