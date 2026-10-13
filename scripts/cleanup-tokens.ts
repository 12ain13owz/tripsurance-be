import { logger } from '@/core/logger'
import { cleanupExpiredTokens, TOKEN_RETENTION_MS } from '@/features/auth'

const main = async (): Promise<void> => {
  const result = await cleanupExpiredTokens(TOKEN_RETENTION_MS)
  logger.info('Token cleanup complete', result)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error('Token cleanup failed', { error })
    process.exit(1)
  })
