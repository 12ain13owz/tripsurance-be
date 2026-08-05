# Node Starter (Express + TypeScript)

A production-ready template for building REST APIs with Node.js, Express, and TypeScript. It ships with a clean, feature-based architecture, structured logging, centralized error handling, rate limiting, and ready-to-use OpenAPI documentation.

> Building a new feature with an AI assistant? Read [`AGENTS.md`](./AGENTS.md) first — it documents the conventions and provides a step-by-step recipe for adding features consistently.

## Tech Stack

- Node.js (ESM)
- Express 5
- TypeScript 6
- Zod (environment validation)
- Winston + winston-daily-rotate-file (logging)
- ESLint 10 + Prettier
- Scalar API Reference (OpenAPI docs UI)
- Docker / Docker Compose

## Requirements

- Node.js >= 20
- npm >= 10
- Docker (optional)

## Getting Started

1. Install dependencies

```bash
npm install
```

2. Create the environment files

```bash
npm run setup-env
```

3. Start the development server

```bash
npm run dev
```

The server starts at http://localhost:3000

## Environment Variables

Environment files are loaded based on `NODE_ENV`:

- `NODE_ENV=development` -> `.env.dev`
- `NODE_ENV=production` -> `.env.prod`

Values are validated at startup with Zod (see `src/core/config/env/env.schema.ts`); the process exits if any variable is missing or invalid.

Example values from `.env.example`:

```env
PORT="3000"
NODE_ENV="development"
BASE_URL="http://localhost:3000"
CORS_ORIGINS="http://localhost:3000,http://localhost:4000,http://localhost:4200"
LOG_LEVEL_CONSOLE="debug"
LOG_LEVEL_FILE="info"
LOG_LEVEL_ERROR_FILE="error"
SHUTDOWN_TIMEOUT_MS="10000"
```

## Available Scripts

- `npm run dev`: run with `tsx --watch` using `.env.dev`
- `npm run build`: clean `dist`, compile TypeScript, then rewrite path aliases (`tsc-alias`)
- `npm start`: run the compiled build using `.env.prod`
- `npm run fix`: auto-fix ESLint issues and format with Prettier
- `npm run clean`: remove the `dist` directory
- `npm run setup-env`: generate `.env.dev` and `.env.prod` from `.env.example`
- `npm test`: run the test suite once (Vitest)
- `npm run test:watch`: run the test suite in watch mode

## API Endpoints

- `GET /health`: health check (success)
- `GET /health/error`: health check that simulates an error
- `GET /docs`: API documentation page

The standard response envelope is:

```json
{
  "message": "...",
  "timestamp": "ISO-8601",
  "data": {}
}
```

## API Documentation

Served by the `docs` feature (`src/features/docs/`) using [Scalar](https://github.com/scalar/scalar) as the UI, with the OpenAPI spec bundled at runtime (`@apidevtools/swagger-parser`):

- UI: `GET /docs`
- Bundled OpenAPI JSON: `GET /docs/openapi.json`
- Spec entry point: `src/features/docs/spec/openapi.yaml`
- Schemas: `src/features/docs/spec/components/models`
- Responses: `src/features/docs/spec/components/responses`
- Paths: `src/features/docs/spec/paths`

Open the docs in the browser at:

http://localhost:3000/docs

## Logging

- Console and file logging via Winston
- Daily-rotated files organized by year/month
- Log location: `logs/YYYY/MM`
- Separate general (`.log`) and error (`.error.log`) files

## Testing

Tests run on [Vitest](https://vitest.dev/) and live next to the code they cover as `<name>.test.ts` (e.g. `src/core/error/app-error.test.ts`), mirroring the `src/` layout — no separate `test/` folder.

```bash
npm test          # run once
npm run test:watch  # watch mode
```

## Docker

Run with Docker Compose:

```bash
docker compose up -d --build
```

Stop the container:

```bash
docker compose down
```

The image compiles TypeScript at build time and runs the compiled output (`npm start`), with `NODE_ENV=production` by default. Run `npm run setup-env` first so `.env.prod` exists — `docker-compose.yml` loads it via `env_file` (it is not copied into the image).

## Project Structure

```text
.
|- scripts/
|  |- setup-env.ts
|  \- tsconfig.json
|- src/
|  |- core/                   # App infrastructure (not feature-specific)
|  |  |- config/              # Env loading + Zod validation + runtime options (cors/helmet/rate-limit)
|  |  |  \- env/              # EnvConfig type, Zod schema, loader, barrel
|  |  |- error/               # AppError, error logger, error middleware
|  |  |- logger/              # Winston logger setup
|  |  \- server/              # Server bootstrap + graceful shutdown
|  |- features/               # Feature modules (one folder per feature)
|  |  |- docs/                # OpenAPI spec + Scalar API reference UI
|  |  \- health/              # Health check (success + simulated error)
|  |- shared/                 # Cross-cutting building blocks
|  |  |- constants/           # HttpStatus, messages (SUCCESS/ERRORS/LOG), app constants
|  |  |- types/               # Shared types + Express augmentation
|  |  \- utils/               # Helpers (e.g. createResponse)
|  |- main.ts                 # App entry point + middleware wiring
|  \- routes.ts               # Root router (mounts every feature router)
|- docker-compose.yml
|- Dockerfile
|- eslint.config.mjs
|- package.json
\- tsconfig.json
```

## Contributing / Adding Features

This project follows a strict, consistent structure. Before adding or changing a feature, read [`AGENTS.md`](./AGENTS.md) for the conventions and the feature-creation recipe (with an `auth/login` example). Always run `npm run fix` and `npm run build` before committing.

## License

MIT
