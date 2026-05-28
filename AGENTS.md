# Fictrio — conventions for agents

Social app for rating/reviewing films, shows and books. Bun workspaces +
Turborepo monorepo: `apps/api` (NestJS + Fastify + Prisma + PostgreSQL +
Redis), `apps/web` (Next.js + React + Tailwind + shadcn/ui + TanStack
Query), `packages/contracts` (shared Zod schemas).

These rules encode mistakes that have already been fixed once. Follow them
so they don't come back.

## Workflow

- Work on a branch named `feat/…`, `fix/…`, `chore/…`, `perf/…`,
  `refactor/…` or `docs/…`. One logical change per branch; don't mix
  unrelated edits.
- After each change run the relevant checks and keep them green:
  `bun run typecheck`, `bun run lint`, and `bun run build` when the build
  surface changed. DB changes: `bun run db:migrate`.
- Commit message format: `type: short imperative summary`. **Do not add a
  `Co-Authored-By` trailer.**
- The database is the source of truth designed in the coursework
  (`report/`, `fictrio.dbml`). Match it — don't invent a new model.
- If you hit a blocker, missing info, or a decision that needs the author,
  say so and stop rather than guessing.

## Source of truth for types: `@fictrio/contracts`

- API request/response shapes live **once** in `packages/contracts` as Zod
  schemas. Never hand-mirror a backend type in the frontend.
  - Backend DTO classes set `static readonly schema = <contractSchema>` so
    the global `ZodValidationPipe` can validate by metatype.
  - Frontend `*-api.ts` files import `type`s via `z.infer` re-exports.
- Wire dates are ISO strings (`z.iso.datetime`), not `Date`. Prisma `Date`
  values become strings over JSON — type them as strings on the client.
- `packages/contracts` is consumed through its built `dist/` (package
  `exports`). Run its `build` (Turbo does this via `^build`) — TS source
  with `.js`-extension relative imports won't resolve at runtime otherwise.
- Keep the contract enums (`workKind`, `listVisibility`, …) in sync with the
  Prisma enums; Prisma stays the source of truth for the database, contracts
  for the wire.

## Backend (`apps/api`)

### Config & secrets
- Never fall back to a hardcoded secret. Required env (e.g. `JWT_SECRET`)
  must throw if missing (`getJwtSecret`). `.env.example` documents every var.
- No magic-number sentinels in the schema. "Unknown" is SQL `NULL`
  (`progress.value_max` is nullable, not `-1`).
- Don't leave `nest new` scaffolding (`AppController`/`AppService`). Empty
  placeholder modules must carry a `TODO` pointing at the PLAN stage.

### Auth & security
- JWT lives in an **HttpOnly** cookie (`fictrio_session`) set by the server;
  it never goes in the response body or `localStorage`.
- CSRF uses the double-submit pattern: `GET /auth/csrf` sets a readable
  `fictrio_csrf` cookie; the global `CsrfGuard` requires a matching
  `X-CSRF-Token` header on every non-safe method.
- `JwtAuthGuard` reads the cookie. Endpoints that are public but richer for
  the owner use `OptionalJwtAuthGuard` and pass `user?.id`.
- `main.ts` registers `@fastify/helmet` and `@fastify/rate-limit`; CORS uses
  `credentials: true`. Passwords are hashed with argon2.
- Seed reference data (roles) in a migration — don't upsert it at runtime on
  every request.

### Database / Prisma
- Search goes through the `works_search_gin_idx` GIN index via
  `to_tsvector(...) @@ websearch_to_tsquery(...)`. Never `ILIKE '%q%'` on a
  btree column. Verify the plan with `EXPLAIN` (expect a Bitmap Index Scan).
- Paginate in SQL with `LIMIT/OFFSET` (or a UNION ALL for merged feeds).
  Never fetch every row and slice in JS.
- The `(list_id, position)` UNIQUE index is checked per row, so a direct
  `position = position + 1` collides mid-statement. Re-number positions in
  two bulk statements: stash into disjoint negatives, then assign finals.
- Serialize concurrent writes that depend on a computed value (next list
  position) with `SELECT … FOR UPDATE` and compute inside the transaction.
- Raw SQL must be parameterized via `Prisma.sql` tagged templates /
  `Prisma.join`. No string interpolation of user input.
- An error-mapping helper should be typed `never` and always throw (map known
  Prisma codes to HTTP exceptions, re-throw the rest) — no trailing
  `throw error` at the call site.

### REST conventions
- Name route params by resource (`:reviewId`, `:commentId`), not a generic
  `:postId`.
- A collection route that would collide with `/:id` gets its own prefix
  (current-user lists are `GET /me/lists`, not `/lists/mine`).
- Validation failures return a `details: [{ path, message }]` array; the
  frontend renders them per field.
- Module layout per feature: `*.controller.ts`, `*.service.ts`, `*.dto.ts`,
  `*.module.ts`. Never return `passwordHash` to clients.

## Frontend (`apps/web`)

> `apps/web/AGENTS.md` also applies: this is a newer Next.js than your
> training data — read `node_modules/next/dist/docs/` before using Next APIs.

### Data fetching
- All requests go through `lib/api.ts` (`apiRequest`): `credentials:
  "include"`, auto `X-CSRF-Token`, `ApiError` with `issues` for field errors.
- Query keys come from the `qk` factory in `lib/query-keys.ts`. Never inline
  a `["work", id]`-style literal; add a key to the factory instead.
- Server state belongs in TanStack Query, not Zustand. The session is
  `useSession()` over `useQuery(qk.session, getMe)` (401 ⇒ signed out). After
  a mutation, invalidate the matching `qk` key(s).
- Infinite lists use the `useInfiniteScroll` hook (sentinel + observer), not a
  bespoke effect or a window scroll listener.

### UI
- Build forms and controls from the shadcn primitives in `components/ui`
  (`Button`, `Input`, `Textarea`, `Select`, `Card`, `Skeleton`) — don't
  hand-write `<button className="inline-flex h-10 …">` strings.
- Reuse the shared building blocks: `SiteHeader`, `StateCard` (loading/
  error/empty), `UserBadge`, `FormField` (label + control + aria-wired
  error), `lib/format` (`formatDate`, `getWorksCountLabel`).
- Destructive actions use `<Button variant="destructive">` (red), not an
  ad-hoc `hover:border-destructive` treatment.
- Use the design tokens (`bg-primary`, `text-destructive`, `--fictrio-*`),
  not raw hex values, in JSX.
- Interface text is Russian. Keep `alt`, `aria-*`, focus rings and semantic
  HTML.

## TypeScript

- No `any`, `as` casts without cause, non-null `!`, or `@ts-ignore`. Narrow
  with `find`/type guards instead of asserting (`getSortBy`).
- Validate untrusted input at the boundary with the contract schemas.
