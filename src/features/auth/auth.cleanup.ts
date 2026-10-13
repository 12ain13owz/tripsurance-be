import { logger } from '@/core/logger'
import { parseDuration } from '@/shared/utils'
import { AUTH_LOG } from './auth.const'
import { cleanupExpiredTokens } from './auth.service'

// Dead tokens are kept for a week so a suspicious session can still be traced, then dropped
const TOKEN_RETENTION_MS = parseDuration('7d')
const CLEANUP_INTERVAL_MS = parseDuration('1d')

const runCleanup = async (): Promise<void> => {
  try {
    const { refreshTokens, passwordResetTokens } = await cleanupExpiredTokens(TOKEN_RETENTION_MS)
    logger.info(AUTH_LOG.tokenCleanup(refreshTokens, passwordResetTokens), { source: false })
  } catch (error) {
    logger.error(error)
  }
}

// Runs once now, then daily. unref() keeps the timer from holding the process open on shutdown
export const startTokenCleanup = (): void => {
  void runCleanup()
  setInterval(() => void runCleanup(), CLEANUP_INTERVAL_MS).unref()
}
