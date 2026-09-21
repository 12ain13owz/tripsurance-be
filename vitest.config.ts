import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    env: {
      NODE_ENV: 'development',
      PORT: '3000',
      BASE_URL: 'http://localhost:3000',
      CORS_ORIGINS: '',
      LOG_LEVEL_CONSOLE: 'error',
      LOG_LEVEL_FILE: 'error',
      LOG_LEVEL_ERROR_FILE: 'error',
      SHUTDOWN_TIMEOUT_MS: '10000',
      DATABASE_URL: 'postgresql://user_postgres:pass_postgres@localhost:5432/tripsurance',
      JWT_ACCESS_SECRET: 'access-token-at-least-32-characters',
      JWT_ACCESS_EXPIRES: '1d',
      JWT_REFRESH_SECRET: 'refresh-token-at-least-32-characters',
      JWT_REFRESH_EXPIRES: '7d',
      EMAIL_FROM: 'Tripsurance <no-reply@tripsurance.com>',
      RESEND_API_KEY: 're_test_00000000000000000000000000',
      RESET_TOKEN_EXPIRES: '30m',
      FRONTEND_URL: 'http://localhost:4000',
      STRIPE_SECRET_KEY: 'sk_test_00000000000000000000000000',
      STRIPE_PUBLISHABLE_KEY: 'pk_test_00000000000000000000000000',
      STRIPE_WEBHOOK_SECRET: 'whsec_test_00000000000000000000000000',
    },
  },
})
