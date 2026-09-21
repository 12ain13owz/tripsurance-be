# AGENTS.md

Guidance for AI assistants (and humans) working in this repository. Read this **before** creating or modifying a feature so changes stay consistent without re-reading the whole codebase every time.

If anything here conflicts with the actual code, the code wins — update this file in the same change.

---

## 1. What this project is

**tripsurance-be** is the backend for a trip/travel insurance sales platform. This service covers the **admin side only** — internal staff (admin, super admin) who manage the platform. It does **not** serve end-customer/policyholder flows (no public quote/purchase API here — that's a separate concern/service if/when it exists).

Consequences of "admin-only, invite-based" that shape how features get built:

- **No self-registration.** `User` accounts are created via invite (`invitedById`/`invitationTokenHash` on the `User` model, `prisma/schema/user.prisma`) — there is no public sign-up endpoint and none should be added. Auth today only exposes sign-in (`POST /auth/sign-in`).
- **Two roles only** — `ADMIN`, `SUPER_ADMIN` (`Role` enum, `prisma/schema/user.prisma`). No customer/policyholder role exists in this codebase.
- When adding a feature, ask "is this something an admin does to manage the platform?" — if it's customer-facing (getting a quote, buying a policy, filing a claim as the end user), confirm with the person assigning the work before building it here.

Technically, it's a feature-based REST API: **Node.js (ESM) + Express 5 + TypeScript 6**. Environment is validated with Zod, logging uses Winston, and errors flow through a single error middleware. It started from a generic starter template and has since diverged into this domain-specific backend — most of what follows in this doc is the starter's conventions, still enforced.

Already wired up in this project (diverged from the bare `node-express-ts-starter` base — check that repo if you need the generic, auth-free version):

- **Database / ORM** — Prisma (`prisma/schema/`), client exported from `@/core/database/prisma`.
- **Auth** — JWT access + refresh tokens (`@/core/security/jwt.ts`), sign-in/refresh/sign-out flows in `src/features/auth/`. Refresh token travels as an httpOnly cookie (`auth.cookie.ts`); access token is returned in the response body and expected as a `Bearer` header on protected routes.
- **Custom middleware folder** — `src/core/middleware/` exists: `validate.ts` (Zod request validation) and `authenticate.ts` (verifies the access token, attaches the payload to `req.user`), each wired per-route (see `auth.routes.ts`).

Still not wired up — add only when a consuming feature actually needs it, don't pre-build speculatively:

- **i18n / structured messages** — `AppError`/`createResponse` take a plain `string` message. Do not introduce a `{ key, message, params }` message shape or an i18n layer speculatively; that's a real requirement of specific downstream products, not a default this starter should carry.

### Testing

Test runner: **Vitest** (`npm test` / `npm run test:watch`, config in `vitest.config.ts`).

**Do not write tests while building or changing a feature. Write tests only when the developer explicitly asks for them** — e.g. "add tests for X". Don't infer this from context (a feature "looking done" is not a request). Writing tests against code the developer hasn't asked to lock down yet means rewriting them on every behavior change, which costs more tokens than writing them once, on request, against settled code.

When tests are requested, follow this standard so output stays consistent across the codebase:

- **Placement & naming** — `<name>.test.ts` beside the file under test (e.g. `error-logger.ts` -> `error-logger.test.ts`), mirroring the production layering. No separate `test/` or `__tests__/` folder.
- **Structure** — one `describe` per exported function/class; one `it` per behavior. Name `it` blocks after the observable outcome ("returns undefined when stack has no frames"), not implementation steps or generic labels ("test 1", "works").
- **Mocking** —
  - Keep `vi.fn()` mocks as local typed variables and assert against those variables directly; don't read a mock back off a property whose declared type comes from an external interface (e.g. Express's `Response`) — that trips `@typescript-eslint/unbound-method` because the rule checks the declared type, not the runtime value.
  - When partially mocking a module, use `vi.mock(path, async (importOriginal) => ({ ...await importOriginal<typeof X>(), overriddenExport: ... }))`, typing `X` via a top-level `import type * as X from 'path'` — never an inline `typeof import('path')` (banned by lint).
- **Assertions** — prefer `toEqual`/`toMatchObject` for object shape, `toBe` for primitives. Avoid loosely-typed matchers like `expect.any(Array)` where they trigger `@typescript-eslint/no-unsafe-assignment`; assert the field(s) individually instead.
- **Coverage priority** — cover branches, edge cases, and any bug uncovered while writing the test (document it with a test rather than silently fixing it, unless asked to fix). Skip near-zero-risk one-liners (trivial wrappers, pure re-exports) unless asked.
- **Lint/type clean** — test files follow the same rules as production code (§3): no `any`, unused params prefixed `_`, etc. `npm run fix` and `npm run build` must both pass.
- Run `npm test` before calling a change done whenever test files were touched (see §8).

## 2. Architecture & layering

```
src/
  core/      # Infrastructure, app-wide. Knows nothing about specific features.
    config/     # env loading + Zod validation, runtime options (cors/helmet/rate-limit)
    error/      # AppError, error logger, error middleware
    logger/     # Winston setup
    middleware/ # custom route middleware (validate, authenticate)
    server/     # bootstrap + graceful shutdown
  features/  # Business features. One folder per feature. May import core + shared.
  shared/    # Pure building blocks (constants, types, utils). No feature/business logic.
  main.ts    # Entry point: middleware wiring + startServer
  routes.ts  # Root router: mounts every feature router
```

Dependency direction (never break this):

```
features  ->  core  ->  shared
features  ->  shared
```

- `shared/` must not import from `core/` or `features/`.
- `core/` must not import from `features/`.
- Features must not import from other features. If two features need the same logic, lift it into `core/` or `shared/`.

## 3. Hard conventions (do not deviate)

### Imports & module system

- ESM only. Use the `@/` path alias for anything under `src/` (configured in `tsconfig.json`). Use relative imports only for files inside the same feature/folder.
- Import groups are enforced by ESLint (`import/order`), separated by blank lines, in this order:
  1. builtin + external (e.g. `node:path`, `express`)
  2. internal `@/...`
  3. relative `./...`
  4. `type` imports (always last group)
- Type-only imports must use `import type { ... }` (auto-fixed on save / `npm run fix`).

### Formatting (Prettier)

- 2-space indent, single quotes, **no semicolons**, trailing commas `es5`, print width 100, arrow parens always, LF line endings.

### TypeScript

- `strict` is on, plus `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`.
- `any` is banned (`@typescript-eslint/no-explicit-any`). Use `unknown` + narrowing.
- Prefix intentionally unused params with `_` (e.g. `_req`, `_next`).
- Every Promise must be awaited or handled (`no-floating-promises`).

#### `null` vs `undefined`

- Prefer `null` for a value _we_ deliberately return to mean "intentionally absent" in our own
  domain logic — e.g. a lookup that found nothing, matching how Prisma itself already returns
  `null` for nullable columns and missing records (`User | null`).
- Keep `undefined` for optional parameters/properties (`foo?: string`) — that's the language's own
  idiom; don't fight it by requiring callers to pass `null` explicitly.
- Keep `undefined` for values sourced from an external dependency/runtime API that already returns
  `undefined` (`process.env.X`, `Array.prototype.find`, etc.) — don't convert at the boundary.
- Keep `undefined` anywhere the logging or response layer treats it as a deliberate **elision**
  sentinel — don't "fix" these. `extractMetadata` (`core/logger/logger.ts`) drops any metadata key
  whose value is `undefined` but logs `null` values as-is, and `JSON.stringify` drops `undefined`
  object fields but serializes `null` explicitly (see `error.middleware.ts`'s dev-only `data`
  field). Swapping one of these to `null` isn't a no-op — a field that was cleanly omitted from a
  log line or response body would start showing up as an explicit `null`. `core/logger/stack.ts`'s
  `getCallerSource` is the concrete example: it looks like a "value we control, prefer null" case,
  but it feeds straight into that elision path, so it stays `undefined`.

### Logging & env

- Never use `console.*` for app logging — use the Winston `logger` from `@/core/logger` (`console.info`/`warn`/`error` are only tolerated inside `core/config/env/env.ts`, for bootstrap messages that run before the logger/env are ready).
- Never read `process.env` directly outside `core/config`. Import the validated `env` from `@/core/config`.
- Console-only bootstrap strings live in the `LOG` constant (`@/shared/constants`), never in `SUCCESS`/`ERRORS` — those two are API-response message pools only. See §4.

### File naming (kebab-case + role suffix)

| Role             | Pattern                   | Example                       |
| ---------------- | ------------------------- | ----------------------------- |
| Routes           | `<feature>.routes.ts`     | `auth.routes.ts`              |
| Controller       | `<feature>.controller.ts` | `auth.controller.ts`          |
| Service          | `<feature>.service.ts`    | `auth.service.ts`             |
| Validation (Zod) | `<feature>.schema.ts`     | `auth.schema.ts`              |
| Types            | `<feature>.type.ts`       | `auth.type.ts`                |
| Middleware       | `<name>.ts`               | `authenticate.ts`             |
| Constants        | `<name>.const.ts`         | `message.const.ts`            |
| Barrel           | `index.ts`                | re-exports the public surface |

Skip files you genuinely don't need — e.g. `src/features/health/` only has `health.routes.ts` + `health.controller.ts` (no service, no schema) because there's nothing to validate or delegate. Keep the naming when you do add a file.

The `<feature>.type.ts` role isn't feature-only — the same rule applies to any `core/` module that exports a type (`validate.type.ts`, `authenticate.type.ts`, `mailer.type.ts`, `error.type.ts`). Split a type into its own `<name>.type.ts` as soon as it's exported, even if only one file currently consumes it — don't wait for a second consumer before splitting, and don't leave it inlined in the implementation file "because nothing else uses it yet" (`core/middleware/authenticate.ts` and `validate.ts` are the reference examples).

Middleware is the one exception to the role-suffix rule: files under `src/core/middleware/` (e.g. `validate.ts`, `authenticate.ts`) skip the `.middleware.ts` suffix — the folder itself already says "middleware", so the suffix would be redundant. Feature-local middleware, if a feature ever needs its own, follows the same no-suffix rule.

### Function naming (controller ↔ service)

A controller's exported function name must match its service function name exactly (e.g. `authController.signIn` calls `authService.signIn`) — this lets a reader trace `controller.X` -> `service.X` without guessing. Diverge only when the HTTP-facing name and the business action are genuinely different concepts — e.g. `authController.me` calls `authService.getProfile`: `/me` is a REST/whoami convention, not a description of what happens. This should stay rare; don't reach for it just because a shorter or catchier controller name is tempting.

Within a function name, don't repeat the entity its feature module already identifies via the namespaced import (`countryService.list()`, not `countryService.listCountry()`) — the import alias already carries that context. Use the bare CRUD verb (`list`, `create`, `update`, `remove`) whenever the feature module manages a single entity end-to-end. Only qualify the verb with the entity name (`listSessions`, `revokeSession`) when the feature module manages more than one entity/concern and the bare verb alone would be ambiguous — e.g. `auth` handles sign-in, password reset, and sessions in one file, so `authService.list()` wouldn't say what it lists.

**Messages:** generic, reusable text (CRUD success/fail wording, HTTP-generic errors) belongs in `SUCCESS`/`ERRORS` in `shared/constants/message.const.ts` — extend it, don't duplicate. A feature may keep its own `<feature>.const.ts` (e.g. `auth.const.ts`) only for messages specific to that feature's domain (e.g. "Invalid email or password") that wouldn't make sense reused elsewhere. Default to the shared file when in doubt.

### Config (`src/core/config/`)

| File                | Responsibility                                                             |
| ------------------- | -------------------------------------------------------------------------- |
| `env/env.type.ts`   | `EnvConfig` type — hand-authored, no side effects                          |
| `env/env.schema.ts` | Zod schema typed as `z.ZodType<EnvConfig>`, so schema and type can't drift |
| `env/env.ts`        | Resolves the right `.env.*` file, validates via `envSchema`, exports `env` |
| `env/index.ts`      | Barrel — re-exports `env` + `EnvConfig`                                    |
| `options.ts`        | Env-dependent middleware options (cors/helmet/rate-limit)                  |
| `index.ts`          | Barrel — import `env` and options from here                                |

Import `env` from `@/core/config`, never from `./env/env`. Add env-dependent middleware options to `options.ts`, not `shared/`. Numeric env vars use `z.coerce.number()` (not `.transform(Number)`, which silently lets `NaN` through) with explicit bounds (`.int().positive()`, `.max(...)` where a natural ceiling exists).

## 4. The response & error contract

**Every** success response is built with `createResponse` (`@/shared/utils`) so the envelope stays uniform:

```ts
{ message: string, timestamp: string, data?: T }
```

- Response messages come from `SUCCESS`/`ERRORS` in `@/shared/constants`, or from a feature-local `<feature>.const.ts` for messages specific to that feature's domain (see §3) — never hardcoded inline strings. These are plain strings — no i18n key/message object (see §1).
- Console-only strings (startup/config logs, never sent to a client) come from the separate `LOG` constant in the same file. Don't mix the two: if it's only ever passed to `console.*`, it belongs in `LOG`, not `SUCCESS`/`ERRORS`.
- HTTP codes come from the `HttpStatus` enum, never magic numbers.
- To raise an error, `throw new AppError(message, status, severity)` and chain context, then call `next(error)`. The global `errorHandler` (`core/error/error.middleware.ts`, wired in `app.ts`) formats it (full details in development, message-only in production).
- Malformed JSON request bodies never reach a controller — `express.json()` throws before routing, and the error isn't an `AppError`. `errorHandler` detects this case (`SyntaxError` with `.type === 'entity.parse.failed'`) and normalizes it to a `400` `AppError` (`ERRORS.GENERIC.INVALID_JSON_BODY`) instead of leaking the raw parser message and defaulting to `500`. Follow the same normalize-before-formatting approach for any other non-`AppError` exception that has a well-known client-facing meaning.

`AppError` builder methods:

```ts
throw new AppError(ERRORS.GENERIC.UNAUTHORIZED, HttpStatus.UNAUTHORIZED, ErrorSeverity.WARN)
  .withOperation('login') // logical operation name
  .withEndpoint(req) // method, url, params, query, body
  .withMetadata({ email }) // extra structured context (no secrets/passwords)
```

## 5. Controller pattern (copy this shape)

Controllers are thin: validate input, call a service, return via `createResponse`. Always `async`, return `Promise<void>`, wrap in `try/catch`, and forward errors with `next(error)`.

Reference implementation in this repo: `src/features/health/` (routes + controller only — a real CRUD feature would add `.service.ts` and `.schema.ts` too, as below).

Before calling `createResponse`, assign the payload to a locally-typed `data` constant instead of
passing the service's return value straight through. This makes the response shape visible to
whoever opens the controller — no need to jump into the service or type file to know what's
being sent — and, since the type is a plain assignment (not an object literal), it still won't
catch excess properties on its own; if a field must never leave the service (a token, a hash),
strip it explicitly via destructuring before this assignment, not just via the type. Name the
type `<Feature><Action>Data` (e.g. `LoginData`) — it describes the `data` field's shape, not the
full response envelope — and keep the local variable named `data` so it matches
`createResponse`'s own parameter name. Likewise, assign `createResponse`'s result to its own
`response` constant before calling `res.json` — don't nest the call inside `.json(...)`. Keeping
each step (`data` -> `response` -> `res.status(...).json(response)`) on its own line reads as a
sequence of named steps instead of one dense expression:

```ts
import { HttpStatus, SUCCESS } from '@/shared/constants'
import { createResponse } from '@/shared/utils'

import * as authService from './auth.service'

import type { LoginData } from './auth.type'
import type { LoginInput } from './auth.schema'
import type { NextFunction, Request, Response } from 'express'

export const login = async (
  req: Request<unknown, unknown, LoginInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body
    const data: LoginData = await authService.login({ email, password })
    const response = createResponse(SUCCESS.AUTH.LOGIN, data)
    res.status(HttpStatus.OK).json(response)
  } catch (error) {
    next(error)
  }
}
```

`req.body` is typed straight off `LoginInput` — the type Express's own `Request<Params, ResBody, ReqBody>` generic expects — not parsed again in the controller. Validation already happened at the route (see §7); by the time this function runs, `req.body` is guaranteed to match `LoginInput`.

Routers create a `Router()` and export it as `<feature>Router`:

```ts
import { Router } from 'express'
import { validate } from '@/core/middleware'

import * as authController from './auth.controller'
import { authSchema } from './auth.schema'

const router = Router()

router.post('/login', validate(authSchema.login), authController.login)

export const authRouter = router
```

## 6. Recipe — add a new feature (example: `auth` / login)

Follow these steps in order. Skip files you genuinely don't need (e.g. a read-only feature may not need a service), but keep the naming.

1. **Create the folder** `src/features/auth/`.

2. **Validation** — `auth.schema.ts` (use Zod, the same validator already used for env):

```ts
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export const authSchema = {
  login: { body: loginSchema },
} as const

export type LoginInput = z.infer<typeof loginSchema>
```

Group every schema under its action, keyed by the request segment(s) it validates (`body`/`params`/`query` — the `ValidatedShape` type, `core/middleware/validate.type.ts`). An action needing more than one segment lists both, e.g. `update: { body: updateSchema, params: idParamsSchema }`. Export the plain input type(s) (`z.infer<typeof loginSchema>`) next to the schema they're inferred from — that's what the controller types `req` against (§5), one hop away instead of several.

3. **Service** — `auth.service.ts`. Put business logic here, not in the controller. Throw `AppError` for expected failures:

```ts
import { AppError } from '@/core/error'
import { ERRORS, ErrorSeverity, HttpStatus } from '@/shared/constants'

import type { LoginInput } from './auth.schema'

export const login = async ({ email, password }: LoginInput) => {
  const user = await findUserByEmail(email) // replace with real lookup
  if (!user || !verifyPassword(user, password)) {
    throw new AppError(ERRORS.GENERIC.UNAUTHORIZED, HttpStatus.UNAUTHORIZED, ErrorSeverity.WARN)
      .withOperation('login')
      .withMetadata({ email }) // never log the password
  }
  return { token: issueToken(user) }
}
```

4. **Controller** — `auth.controller.ts` (see the pattern in section 5).

5. **Routes** — `auth.routes.ts` (see section 5). Export `authRouter`.

6. **Barrel** — `auth/index.ts`:

```ts
export * from './auth.routes'
```

7. **Add messages** to `src/shared/constants/message.const.ts` instead of inline strings — extend `SUCCESS`/`ERRORS` (API-facing) or `LOG` (console-only, see §4):

```ts
export const SUCCESS = {
  // ...existing...
  AUTH: {
    LOGIN: 'Logged in successfully',
    LOGOUT: 'Logged out successfully',
  },
}
```

8. **Register the router** in `src/routes.ts`:

```ts
import { authRouter } from '@/features/auth'
// ...
router.use('/auth', authRouter)
```

9. **Document the endpoint** (OpenAPI) — write this once manual testing (§8) confirms the endpoint's behavior, not while first implementing it; land it together with the tests in the same follow-up change. The spec lives in `src/features/docs/spec/` — the `docs` feature reads it from disk at runtime (`SwaggerParser.bundle`) to serve `/docs/openapi.json` and the Scalar UI, so it ships inside the feature folder, not a top-level `docs/` directory. Add a path file under `src/features/docs/spec/paths/auth/`, reference it from `src/features/docs/spec/openapi.yaml`, and reuse shared schemas/responses where possible. Because `tsc` only compiles `.ts` files, `npm run build` copies this `spec/` tree into `dist/` via the `copy-assets` script (`package.json`) — if the spec ever moves, keep that copy step pointed at the new path.

   **`summary` vs `description`** — `summary` is the operation's display name in the docs UI (Scalar) and must stay a short verb phrase, 2–4 words, Title Case, no trailing punctuation (`Sign in`, `List sessions`, `Revoke other sessions`) — mirror the short name already used for the same request in `tripsurance.postman_collection.json` where one exists. Everything else — behavior, edge cases, rate limits, side effects, gotchas for the client — goes in `description`, not `summary`. Don't restate the summary at the start of the description; write description as if summary weren't there. `operationId` (camelCase, e.g. `signIn`, `listSessions`) is separate from both and used for codegen, not display — keep it short too but it doesn't need to match `summary` word-for-word.

10. **Verify** (section 7).

## 7. Middleware

Third-party middleware (`cors`, `helmet`, `express-rate-limit`, `morgan`) is configured as plain options in `core/config/options.ts` and applied directly in `main.ts`. Custom middleware lives in `src/core/middleware/` (see `validate.ts`, `authenticate.ts`), one file per concern, exported from its `index.ts`:

- Cross-feature middleware goes in `src/core/middleware/`.
- Feature-specific middleware can live in the feature folder instead.
- Wire global middleware in `main.ts`; wire per-route middleware (like `validate`, `authenticate`) directly on the route.

### `validate` — one call per route, keyed by segment

`validate` (`core/middleware/validate.ts`) takes a single `ValidatedShape` object — `{ body?, params?, query? }`, the same grouping used in `<feature>.schema.ts` (§6 step 2) — and validates every segment present on it in one middleware call, replacing `req.<segment>` with the parsed/transformed data:

```ts
router.post('/sign-in', validate(authSchema.signIn), authController.signIn)
router.patch(
  '/:id',
  authenticate,
  validate(countrySchema.update), // validates params AND body in one call
  asHandler(countryController.update)
)
```

There's no separate "which segment" argument to pass or forget — the object's own keys (`body`/`params`/`query`) are the source. Don't split one route's validation across multiple `validate(...)` calls; group everything the route needs into one schema entry instead.

### Typing `req`

Type a controller's `req` directly off Express's own `Request<Params, ResBody, ReqBody, ReqQuery>` generic, using the input type(s) exported next to the schema (§6 step 2) — not a hand-written shape, not a generic-inference chain:

```ts
export const update = async (
  req: Request<CountryIdParams, unknown, UpdateCountryInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { id } = req.params      // typed, not any
  const { isActive } = req.body  // typed, not any
  ...
```

Leave the `ResBody` slot (2nd position) as `unknown` — the response shape is controlled through `createResponse` (§4), not through this generic. Omit a position you don't need (e.g. `Request<unknown, unknown, CreateCountryInput>` for a body-only route, `Request<CountryIdParams>` for a params-only one).

For a route behind `authenticate` (`core/middleware/authenticate.ts`, verifies the `Authorization: Bearer` token and sets `req.user` before calling `next()`) whose handler reads `req.user`: don't re-check it for `undefined` in the controller or service — that's re-validating something `authenticate` already guarantees. Instead use `AuthenticatedRequest<Params, ResBody, ReqBody, ReqQuery>` (`core/middleware/authenticate.type.ts`) in place of `Request<...>` — same generic positions, plus `user: AccessTokenPayload` guaranteed present (globally it's `AccessTokenPayload | undefined` on `core/types/express.d.ts`, since most routes aren't authenticated):

```ts
export const changePassword = async (
  req: AuthenticatedRequest<unknown, unknown, ChangePasswordInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const { sub: userId } = req.user // no `?`, no null check
  const { currentPassword, newPassword } = req.body
  ...
```

A handler with no body/params to read (e.g. `GET /me`) just uses `AuthenticatedRequest` with no type arguments — every position defaults the same way `Request`'s own generics do.

Express's `RequestHandler` type can't structurally accept a handler whose `req` is narrower than the base `Request` (`user` isn't a generic slot like `body`/`params`/`query`, so Express can't infer it) — wrap the handler with `asHandler` (`shared/utils/handler.util.ts`) at the route registration site to bridge it:

```ts
router.get('/me', authenticate, asHandler(authController.me))
```

`asHandler` is a generic, dependency-free adapter (`<TReq>(handler) => RequestHandler`) — it belongs in `shared/` because it doesn't know about `AuthenticatedRequest` or any other concrete type; `TReq` is inferred from whatever handler you pass in, so you never need to write the type argument explicitly. Reuse the same `asHandler` for any other middleware that narrows `req` beyond what Express's own generics express — don't write a new one-off adapter per middleware.

**The pairing rule (all three or none):** `authenticate` middleware, `AuthenticatedRequest` typing, and `asHandler` always travel together. A route without `authenticate` never needs `AuthenticatedRequest` or `asHandler` — plain `Request<...>` is both correct and sufficient, even if the handler is otherwise identical in shape (`country`'s `create`/`update`/`remove` are `authenticate`-gated but never read `req.user`, so they stay on plain `Request<...>` with no `asHandler`).

## 8. Definition of done

A feature moves through these stages, in order:

1. **Implement** the feature per the shapes in §5–6.
2. **Manual test** the endpoint (e.g. via Postman) — happy path + main error paths.
3. Once manual testing confirms the behavior is correct, **write tests** (§1) and the
   **OpenAPI doc** (§6 step 9) together, in the same follow-up change.
4. Run:

```bash
npm run fix     # ESLint --fix + Prettier
npm run build   # type-check + compile (must pass with no errors)
npm test        # run whenever test files exist for the touched code (see §1 Testing)
```

It's fine to land stage 1 as its own commit before stages 2–3 are finished — just don't
call the feature "done" (or open it for review/PR) until docs + tests land. A feature is
only complete once all four stages pass and the router is mounted in `src/routes.ts`.

## 9. Quick do / don't

- DO keep controllers thin; push logic into services.
- DO use `createResponse`, `HttpStatus`, `AppError`, and the message constants.
- DO put console-only strings in `LOG`, not `SUCCESS`/`ERRORS` (see §4).
- DO add new env vars to the Zod schema (`core/config/env/env.schema.ts`), the `EnvConfig` type (`core/config/env/env.type.ts`), and `.env.example`; use `z.coerce.number()` for numeric ones.
- DON'T import across features, hardcode response strings, throw raw `Error`, use `any`, read `process.env` directly, or use `console.log`.
- DON'T put secrets (passwords, tokens) into `AppError` metadata or logs.
- DON'T add i18n message keys speculatively — this is a starter derivative; add them when a real feature needs them (see §1).

## 10. Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) with a bullet-list body.

**Title** (≤72 chars, imperative, English):

```
<type>(<scope>): <summary>
```

| Type       | Use for                         |
| ---------- | ------------------------------- |
| `feat`     | New user-facing behavior        |
| `fix`      | Bug fix                         |
| `refactor` | Code change, no behavior change |
| `test`     | Tests only                      |
| `chore`    | Tooling, deps, config           |
| `docs`     | Documentation only              |

**Scope:** feature or area — `health`, `config`, `logger`, `error`, `server`, `shared`, `docs`, …

**Body:** bullet list (`-`), one meaningful change per line. Focus on _why_ and impact, not every file touched. Omit body for trivial one-line fixes.

```
fix(logger): prevent metadata from clobbering reserved log fields

- Filter `rest` metadata against RESERVED_LOG_KEYS before spreading it into the
  winston log call, mirroring the guard already used on read
- Tighten `LogMetadata` type so `message`/`level`/`timestamp` are rejected at
  compile time
```

**Do:** match existing repo style; group related changes in one commit; write title as a command ("add", "fix", "remove").

**Don't:** paste full diffs; list every renamed method; use past tense ("added", "fixed"); commit secrets (`.env`, credentials).

## 11. Change approval

- Before editing any code, list the specific changes you plan to make and wait for explicit go-ahead — don't start editing on your own initiative just because a request implies a code change.
- Exception: if the user's message already gives the go-ahead ("confirm, go ahead", "fix it", "implement this"), proceed without a separate list-first round.
- This covers all code changes, not just git actions — see §12 Git workflow below for commit/push-specific rules.
- **If not explicitly asked for, don't do it — ask first, every time.** This includes actions taken only to "verify" or "try out" an idea (running a script, renaming/moving/deleting a file to simulate some condition, installing something) — not just feature edits. A question ("how do I get X working?") is a request for an answer, not a request to go implement or experiment with X.
- Never rename, move, or delete a file — even "temporarily," even inside a cleanup/`finally` step — unless the user asked for that specific file to be touched. This happened once already: a local CI-simulation experiment (nobody asked for) deleted `.env.prod`, an untracked, unrecoverable file with real production secrets, via a careless cleanup step. Verify behavior by reading/inspecting or working in a disposable scratch copy, never by modifying real project files and "restoring" them after.

## 12. Git workflow

- Work **one logical change per commit** — small, reviewable slices; do not batch unrelated changes.
- **Do NOT run `git commit` or `git push`** unless the user explicitly asks.
- When the user wants to commit themselves, provide a suggested commit message (§10 format) instead of committing.
