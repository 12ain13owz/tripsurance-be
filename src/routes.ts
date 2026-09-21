import { Router } from 'express'
import { authRouter } from '@/features/auth'
import { docsRouter } from '@/features/docs'
import { healthRouter } from '@/features/health'
import { countryRouter } from './features/country'

const router = Router()

router.use('/health', healthRouter)
router.use('/docs', docsRouter)
router.use('/auth', authRouter)
router.use('/countries', countryRouter)

export const mainRoutes = router
