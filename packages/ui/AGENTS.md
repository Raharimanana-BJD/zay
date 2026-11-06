# UI package

## Overview

Shared shadcn/ui components and styles, built on Base UI and Tailwind. Only `apps/web` uses it; the mobile app has its own component library.

## Key files

| File | Owns |
|---|---|
| `src/components/` | Shared components, one file each |
| `src/styles/globals.css` | Design tokens and global styles |
| `src/lib/utils.ts` | The `cn` helper |
| `components.json` | shadcn style and aliases |

## Commands

Run this from the root to add shared components:

```bash
npx shadcn@latest add <component> -c packages/ui
```

## Conventions

- Import by full path, for example `@zay-app/ui/components/button`.
- Put web only blocks in `apps/web`, and keep this package to reusable components.

## Gotchas

- The tokens follow the design reference named in the root `AGENTS.md` (spec 0002). `apps/native/global.css` copies the same values, so change both together.
- `components.json` here and in `apps/web` have to stay aligned.

## Agent skills

- [shadcn](../../.agents/skills/shadcn/): `shadcn/ui`, adding and styling components
- [vercel-composition-patterns](../../.agents/skills/vercel-composition-patterns/): `vercel-labs/agent-skills`, reusable component APIs

_Drafted by /audit from the repo, worth a quick human pass. Edit freely: once a line stops matching this draft, later runs treat it as curated and will flag rather than overwrite it._
