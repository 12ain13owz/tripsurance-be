import { Router } from 'express'
import { validate } from '@/core/middlewares'
import * as authController from './auth.controller'
import { authSchema } from './auth.schema'

const router = Router()
router.post('/sign-in', validate(authSchema.signIn.body), authController.signIn)
router.post('/sign-out', authController.signOut)

export const authRouter = router
