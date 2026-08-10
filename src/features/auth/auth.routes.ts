import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { passwordResetLimitOptions } from '@/core/config'
import { authenticate, validate } from '@/core/middleware'
import { asHandler } from '@/shared/utils'
import * as authController from './auth.controller'
import { authSchema } from './auth.schema'

const router = Router()
const passwordLimiter = rateLimit(passwordResetLimitOptions)

router.post('/sign-in', validate(authSchema.signIn.body), authController.signIn)
router.post('/sign-out', authController.signOut)
router.post('/refresh', authController.refresh)
router.get('/me', authenticate, asHandler(authController.me))
router.post(
  '/change-password',
  passwordLimiter,
  authenticate,
  validate(authSchema.changePassword.body),
  asHandler(authController.changePassword)
)
router.post(
  '/forgot-password',
  passwordLimiter,
  validate(authSchema.forgotPassword.body),
  authController.forgotPassword
)
router.post(
  '/reset-password',
  passwordLimiter,
  validate(authSchema.resetPassword.body),
  authController.resetPassword
)
router.get('/sessions', authenticate, asHandler(authController.listSessions))
router.delete(
  '/sessions/:id',
  authenticate,
  validate(authSchema.revokeSession.params, 'params'),
  asHandler(authController.revokeSession)
)
router.delete('/sessions', authenticate, asHandler(authController.revokeOtherSessions))

export const authRouter = router
