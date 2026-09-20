/**
 * Wrapper that loads the appropriate .env file (without dotenv) then spawns
 * the Prisma CLI, forwarding all arguments.
 *
 * Usage: tsx scripts/prisma-env.ts [--env-file=<file>] <prisma command> [args...]
 * e.g.   tsx scripts/prisma-env.ts generate
 *        tsx scripts/prisma-env.ts migrate dev
 *        tsx scripts/prisma-env.ts --env-file=.env.prod migrate deploy
 *
 * Pass --env-file=<file> to load a different file (e.g. .env.prod for the
 * Supabase environment) instead of the default `.env.dev`. A flag (not an
 * env var) so this works the same via `npm run` on Windows/macOS/Linux.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const rawArgs = process.argv.slice(2)
const envFileArg = rawArgs.find((arg) => arg.startsWith('--env-file='))
const envFile = envFileArg ? envFileArg.slice('--env-file='.length) : '.env.dev'
const envPath = resolve(root, envFile)

// Parse KEY="VALUE" lines from the env file (if present), ignoring comments and
// blanks. When the file is absent we fall back to whatever is already in
// process.env (e.g. Render/CI secrets), so migrations still work there.
const parsed = existsSync(envPath)
  ? Object.fromEntries(
      readFileSync(envPath, 'utf-8')
        .split('\n')
        .filter((line) => line.trim() && !line.trim().startsWith('#'))
        .map((line) => {
          const eqIdx = line.indexOf('=')
          const key = line.slice(0, eqIdx).trim()
          const raw = line.slice(eqIdx + 1).trim()
          const value = raw.replace(/^["']|["']$/g, '')
          return [key, value]
        })
    )
  : {}

const prismaBin = resolve(root, 'node_modules', 'prisma', 'build', 'index.js')
const args = rawArgs.filter((arg) => !arg.startsWith('--env-file='))

const result = spawnSync(process.execPath, [prismaBin, ...args], {
  stdio: 'inherit',
  env: { ...process.env, ...parsed },
  cwd: root,
})

process.exit(result.status ?? 1)
