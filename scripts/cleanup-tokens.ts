import { logger } from '@/core/logger'
import { cleanupExpiredTokens } from '@/features/auth/auth.service'

const main = async (): Promise<void> => {
  const result = await cleanupExpiredTokens()
  logger.info('Token cleanup complete', result)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logger.error('Token cleanup failed', { error })
    process.exit(1)
  })
