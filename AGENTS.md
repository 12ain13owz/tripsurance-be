# AGENTS.md

Guidance for AI assistants (and humans) working in this repository. Read this **before** creating or modifying a feature so changes stay consistent without re-reading the whole codebase every time.

If anything here conflicts with the actual code, the code wins — update this file in the same change.

---

## 1. What this project is

A feature-based REST API **starter**: **Node.js (ESM) + Express 5 + TypeScript 6**. Environment is validated with Zod, logging uses Winston, and errors flow through a single error middleware. It ships as a clean base for new projects to build on top of.

Not wired up yet — add inside the existing structure when a consuming project needs it, don't pre-build it speculatively:

- **Database / ORM** — none.
- **Auth** — none (`req.user`, JWT, sessions, etc. don't exist).
- **Custom middleware folder** — cors/helmet/rate-limit are plain option objects (`core/config/options.ts`) wired directly in `main.ts`, not middleware functions. There is no `core/middleware/` folder until a feature actually needs one (auth guard, request validation, ...).
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
    config/    # env loading + Zod validation, runtime options (cors/helmet/rate-limit)
    error/     # AppError, error logger, error middleware
    logger/    # Winston setup
    server/    # bootstrap + graceful shutdown
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
| Middleware       | `<name>.middleware.ts`    | `authenticate.middleware.ts`  |
| Constants        | `<name>.const.ts`         | `message.const.ts`            |
| Barrel           | `index.ts`                | re-exports the public surface |

Skip files you genuinely don't need — e.g. `src/features/health/` only has `health.routes.ts` + `health.controller.ts` (no service, no schema) because there's nothing to validate or delegate. Keep the naming when you do add a file.

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

- Response messages come from `SUCCESS` / `ERRORS` in `@/shared/constants` (extend them, don't hardcode strings). These are plain strings — no i18n key/message object (see §1).
- Console-only strings (startup/config logs, never sent to a client) come from the separate `LOG` constant in the same file. Don't mix the two: if it's only ever passed to `console.*`, it belongs in `LOG`, not `SUCCESS`/`ERRORS`.
- HTTP codes come from the `HttpStatus` enum, never magic numbers.
- To raise an error, `throw new AppError(message, status, severity)` and chain context, then call `next(error)`. The global `errorHandler` in `main.ts` formats it (full details in development, message-only in production).

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

```ts
import { HttpStatus, SUCCESS } from '@/shared/constants'
import { createResponse } from '@/shared/utils'

import * as authService from './auth.service'
import { loginSchema } from './auth.schema'

import type { NextFunction, Request, Response } from 'express'

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const credentials = loginSchema.parse(req.body)
    const result = await authService.login(credentials)
    res.status(HttpStatus.OK).json(createResponse(SUCCESS.AUTH.LOGIN, result))
  } catch (error) {
    next(error)
  }
}
```

Routers create a `Router()` and export it as `<feature>Router`:

```ts
import { Router } from 'express'

import * as authController from './auth.controller'

const router = Router()

router.post('/login', authController.login)

export const authRouter = router
```

## 6. Recipe — add a new feature (example: `auth` / login)

Follow these steps in order. Skip files you genuinely don't need (e.g. a read-only feature may not need a service), but keep the naming.

1. **Create the folder** `src/features/auth/`.

2. **Validation** — `auth.schema.ts` (use Zod, the same validator already used for env):

```ts
import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

export type LoginInput = z.infer<typeof loginSchema>
```

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

9. **Document the endpoint** (OpenAPI): the spec lives in `src/features/docs/spec/` — the `docs` feature reads it from disk at runtime (`SwaggerParser.bundle`) to serve `/docs/openapi.json` and the Scalar UI, so it ships inside the feature folder, not a top-level `docs/` directory. Add a path file under `src/features/docs/spec/paths/auth/`, reference it from `src/features/docs/spec/openapi.yaml`, and reuse shared schemas/responses where possible. Because `tsc` only compiles `.ts` files, `npm run build` copies this `spec/` tree into `dist/` via the `copy-assets` script (`package.json`) — if the spec ever moves, keep that copy step pointed at the new path.

10. **Verify** (section 7).

## 7. Middleware

There's no `core/middleware/` folder yet — the only middleware wired up today is third-party (`cors`, `helmet`, `express-rate-limit`, `morgan`), configured as plain options in `core/config/options.ts` and applied directly in `main.ts`. When a feature needs actual custom middleware (auth guard, request validation, etc.):

- Cross-feature middleware goes in `src/core/middleware/`, one file per concern (`<name>.middleware.ts`), exported from its `index.ts`.
- Feature-specific middleware can live in the feature folder instead.
- Wire global middleware in `main.ts`.

## 8. Definition of done — always run before finishing

```bash
npm run fix     # ESLint --fix + Prettier
npm run build   # type-check + compile (must pass with no errors)
npm test        # run whenever test files exist for the touched code (see §1 Testing)
```

A change is complete only when these succeed and the new feature router is mounted in `src/routes.ts`.

## 9. Quick do / don't

- DO keep controllers thin; push logic into services.
- DO use `createResponse`, `HttpStatus`, `AppError`, and the message constants.
- DO put console-only strings in `LOG`, not `SUCCESS`/`ERRORS` (see §4).
- DO add new env vars to the Zod schema (`core/config/env/env.schema.ts`), the `EnvConfig` type (`core/config/env/env.type.ts`), and `.env.example`; use `z.coerce.number()` for numeric ones.
- DON'T import across features, hardcode response strings, throw raw `Error`, use `any`, read `process.env` directly, or use `console.log`.
- DON'T put secrets (passwords, tokens) into `AppError` metadata or logs.
- DON'T add a database, auth, i18n message keys, or a `core/middleware/` folder speculatively — this is a starter; add them when a real feature needs them (see §1).

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

## 11. Git workflow

- Work **one logical change per commit** — small, reviewable slices; do not batch unrelated changes.
- **Do NOT run `git commit` or `git push`** unless the user explicitly asks.
- When the user wants to commit themselves, provide a suggested commit message (§10 format) instead of committing.
