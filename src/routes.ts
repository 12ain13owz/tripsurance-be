import { Router } from 'express'
import { authenticate } from '@/core/middleware'
import { authRouter } from '@/features/auth'
import { countryAdminRouter, countryPublicRouter } from '@/features/country'
import { docsRouter } from '@/features/docs'
import { healthRouter } from '@/features/health'

export const publicRoutes = Router()
export const adminRoutes = Router()

publicRoutes.use('/health', healthRouter)
publicRoutes.use('/docs', docsRouter)
publicRoutes.use('/auth', authRouter)
publicRoutes.use('/countries', countryPublicRouter)

adminRoutes.use(authenticate)
adminRoutes.use('/countries', countryAdminRouter)
