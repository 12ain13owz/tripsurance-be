import { Router } from 'express'
import { authenticate, validate } from '@/core/middlewares'
import { asHandler } from '@/shared/utils'
import * as authController from './auth.controller'
import { authSchema } from './auth.schema'

const router = Router()
router.post('/sign-in', validate(authSchema.signIn.body), authController.signIn)
router.post('/sign-out', authController.signOut)
router.post('/refresh', authController.refresh)
router.get('/me', authenticate, asHandler(authController.me))

export const authRouter = router
