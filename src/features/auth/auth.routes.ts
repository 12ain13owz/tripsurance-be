import { Router } from 'express'
import { authenticate, validate } from '@/core/middleware'
import { asHandler } from '@/shared/utils'
import * as authController from './auth.controller'
import { authSchema } from './auth.schema'

const router = Router()
router.post('/sign-in', validate(authSchema.signIn.body), authController.signIn)
router.post('/sign-out', authController.signOut)
router.post('/refresh', authController.refresh)
router.get('/me', authenticate, asHandler(authController.me))
router.post(
  '/change-password',
  authenticate,
  validate(authSchema.changePassword.body),
  asHandler(authController.changePassword)
)
router.post(
  '/forgot-password',
  validate(authSchema.forgotPassword.body),
  authController.forgotPassword
)
router.post(
  '/reset-password',
  validate(authSchema.resetPassword.body),
  authController.resetPassword
)

export const authRouter = router
