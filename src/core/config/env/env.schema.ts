import { z } from 'zod'
import { LOG_LEVELS } from '@/shared/constants'
import type { LogLevel } from '@/shared/constants'
import { AppEnv } from '@/shared/types'
import type { EnvConfig } from './env.type'

const logLevel = Object.keys(LOG_LEVELS) as LogLevel[]
const durationString = /^\d+(s|m|h|d|w|y)$/

export const envSchema: z.ZodType<EnvConfig> = z.object({
  PORT: z.coerce.number().int().positive().max(65535),
  NODE_ENV: z.enum([AppEnv.DEVELOPMENT, AppEnv.PRODUCTION]),
  BASE_URL: z.string(),
  COOKIE_DOMAIN: z.string().min(1).optional(),
  CORS_ORIGINS: z
    .string()
    .optional()
    .transform((value) =>
      (value ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    ),
  LOG_LEVEL_CONSOLE: z.enum(logLevel),
  LOG_LEVEL_FILE: z.enum(logLevel),
  LOG_LEVEL_ERROR_FILE: z.enum(logLevel),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  DATABASE_URL: z.url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES: z.string().regex(durationString),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES: z.string().regex(durationString),
  EMAIL_FROM: z.string(),
  RESEND_API_KEY: z.string(),
  RESET_TOKEN_EXPIRES: z.string().regex(durationString),
  FRONTEND_URL: z.url(),
})
