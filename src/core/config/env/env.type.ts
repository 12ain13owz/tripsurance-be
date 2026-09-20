import type { LogLevel } from '@/shared/constants'
import type { AppEnv } from '@/shared/types'

export type EnvConfig = {
  PORT: number
  NODE_ENV: AppEnv
  BASE_URL: string
  COOKIE_DOMAIN?: string
  CORS_ORIGINS: string[]
  LOG_LEVEL_CONSOLE: LogLevel
  LOG_LEVEL_FILE: LogLevel
  LOG_LEVEL_ERROR_FILE: LogLevel
  SHUTDOWN_TIMEOUT_MS: number
  DATABASE_URL: string
  JWT_ACCESS_SECRET: string
  JWT_ACCESS_EXPIRES: string
  JWT_REFRESH_SECRET: string
  JWT_REFRESH_EXPIRES: string
  EMAIL_FROM: string
  RESEND_API_KEY: string
  RESET_TOKEN_EXPIRES: string
  FRONTEND_URL: string
}
