# Zay

## Product

Zay is a taxi and tuk-tuk booking platform for Toliara, Madagascar. One mobile app serves both clients and drivers, and the admin team works in a web back office. The plan is in `docs/scope/_root/scope.md`, and the full requirements (in French) are in `cahier_des_charges_plateforme_taxi_toliara.md`.

## Stack

- **Language / Runtime**: TypeScript, Bun
- **Monorepo**: Turborepo with Bun workspaces
- **Apps**: `apps/native` (Expo), `apps/web` (TanStack Start), `apps/server` (Hono)
- **Key dependencies**: tRPC, Drizzle with PostgreSQL, Better Auth, Varlock
- **Package manager**: Bun

## Build approach

Tracer Bullet (une vraie course marche d'abord de bout en bout, puis chaque tranche renforce ce fil).

## Commands

```bash
# Install (also generates the env types)
bun install

# First run: start PostgreSQL, then apply the schema
bun run db:start
bun run db:push

# Dev: all apps, or one of them
bun run dev
bun run dev:server   # http://localhost:3000
bun run dev:web      # http://localhost:3001
bun run dev:native

# Build and type check
bun run build
bun run check-types

# Lint and format
bun run check
bun run fix

# After changing an .env.schema, or the auth config
bun run env:generate
bun run auth:generate
```

No test runner or CI is set up yet.

## Specs

Stored in `docs/specs/`. Format: `docs/specs/NNNN-title.md`.

## Rules

- Business rules live on the server. Prices, offers, timers and ride status changes are checked there, never only in a client.
- `apps/web` and `apps/native` reach data through tRPC over HTTP. From `@zay-app/api` they import types only, and they never import `@zay-app/db` or `@zay-app/auth`.
- Each app owns its env schema in `.env.schema` and reads values through its generated `ENV`. Shared packages never read env values; they receive them, as in `createDb(ENV)` and `createAuth(ENV, db)`.
- Never edit generated files: `src/env.ts`, `apps/web/src/routeTree.gen.ts`, `packages/db/src/schema/auth.ts`.
- Packages ship TypeScript source with no build step. Import by full path, for example `@zay-app/api/routers/index`.
- Dependencies used by several workspaces take their version from the catalog in the root `package.json` (`catalog:`).
- Bun's automatic env loading is turned off. Run tools that need env values from the owning app, through Varlock.
- `DESIGN-shopify.md` is not an adopted reference yet. Scope feature 6 decides whether to keep it.

## Agent skills

Skills live in `.agents/skills/`, with links from `.claude/skills/`. Each workspace doc lists its own.

- [turborepo](.agents/skills/turborepo/): `vercel/turborepo`, tasks, caching and monorepo structure
- [ultracite](.agents/skills/ultracite/): `haydenbleasel/ultracite`, linting and formatting

## Context files

- [apps/native/AGENTS.md](apps/native/AGENTS.md): the Expo mobile app for clients and drivers
- [apps/server/AGENTS.md](apps/server/AGENTS.md): the Hono API server and its services
- [apps/web/AGENTS.md](apps/web/AGENTS.md): the TanStack Start web app and back office
- [packages/api/AGENTS.md](packages/api/AGENTS.md): tRPC routers and business rules
- [packages/auth/AGENTS.md](packages/auth/AGENTS.md): Better Auth setup
- [packages/db/AGENTS.md](packages/db/AGENTS.md): Drizzle schema and local PostgreSQL
- [packages/ui/AGENTS.md](packages/ui/AGENTS.md): shared shadcn/ui components for the web

---

# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `bunx ultracite fix`
- **Check for issues**: `bunx ultracite check`
- **Diagnose setup**: `bunx ultracite doctor`

Biome (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### Framework-Specific Guidance

**Next.js:**

- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**

- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**

- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Biome Can't Help

Biome will catch most mechanical issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run `bunx ultracite fix` before committing to ensure compliance.
