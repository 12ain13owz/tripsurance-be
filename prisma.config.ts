/// <reference types="node" />

import { existsSync } from 'node:fs'
import { defineConfig } from 'prisma/config'

const envFile = process.env.NODE_ENV === 'production' ? '.env.prod' : '.env.dev'
if (existsSync(envFile)) process.loadEnvFile(envFile)

export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
})
