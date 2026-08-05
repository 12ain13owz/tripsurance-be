import { env } from '@/core/config'
import { logger } from '@/core/logger'
import { APP_GENERIC } from '@/shared/constants'
import type { Express } from 'express'
import type { Server } from 'http'

let serverInstance: Server | null = null
let isShuttingDown = false

export const startServer = (app: Express, port: number): void => {
  serverInstance = app.listen(port, () =>
    logger.info(APP_GENERIC.serverListening(env.BASE_URL), { source: false })
  )

  process.on('unhandledRejection', handleFatalError)
  process.on('uncaughtException', handleFatalError)

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

export const handleFatalError = (error: unknown): void => {
  logger.error(error)
  shutdown(1)
}

export const shutdown = (exitCode = 0): void => {
  if (isShuttingDown) {
    return
  }
  isShuttingDown = true

  if (!serverInstance) {
    process.exit(exitCode)
  }

  // Hard ceiling so a stuck connection can't block process exit past the orchestrator's grace period.
  const forceExit = setTimeout(() => {
    logger.error('Forced shutdown: server did not close in time', { source: false })
    process.exit(exitCode)
  }, env.SHUTDOWN_TIMEOUT_MS)
  forceExit.unref()

  serverInstance.close(() => {
    clearTimeout(forceExit)
    process.exit(exitCode)
  })
}
