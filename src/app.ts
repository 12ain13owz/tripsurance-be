import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import morgan from 'morgan'
import { corsOptions, helmetOptions, rateLimitOptions } from '@/core/config'
import { errorHandler } from '@/core/error'
import { adminRoutes, publicRoutes } from '@/routes'
import type { Express } from 'express'

export const createApp = (): Express => {
  const app = express()

  app.use(cors(corsOptions))
  app.use(helmet(helmetOptions))
  app.use(rateLimit(rateLimitOptions))
  app.use(morgan('dev'))
  app.use(express.json())

  app.use(publicRoutes)
  app.use('/admin', adminRoutes)
  app.use(errorHandler)

  return app
}
