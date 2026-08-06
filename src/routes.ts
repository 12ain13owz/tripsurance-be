import { Router } from 'express'
import { authRouter } from '@/features/auth'
import { docsRouter } from '@/features/docs'
import { healthRouter } from '@/features/health'

const router = Router()

router.use('/health', healthRouter)
router.use('/docs', docsRouter)
router.use('/auth', authRouter)

export const mainRoutes = router
