/// <reference types="node" />

import { existsSync } from 'node:fs'
import { defineConfig } from 'prisma/config'

if (existsSync('.env.dev')) process.loadEnvFile('.env.dev')

export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'],
  },
})
