import { Router } from 'express'
import { docsRouter } from '@/features/docs'
import { healthRouter } from '@/features/health'

const router = Router()

router.use('/health', healthRouter)
router.use('/docs', docsRouter)

export const mainRoutes = router
