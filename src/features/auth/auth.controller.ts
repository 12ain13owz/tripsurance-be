import { verifyRefreshToken } from '@/core/security'
import { HttpStatus } from '@/shared/constants'
import { createResponse } from '@/shared/utils'
import { AUTH_MESSAGES } from './auth.const'
import { setRefreshCookie } from './auth.cookie'
import * as authService from './auth.service'
import type { AuthReq, SignInData } from './auth.type'
import type { Response, NextFunction } from 'express'

export const signIn = async (
  req: AuthReq<'signIn'>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body
    const { refreshToken, ...session } = await authService.login(email, password)
    const { exp } = verifyRefreshToken(refreshToken)

    setRefreshCookie(res, refreshToken, exp)

    const data: SignInData = session
    const response = createResponse(AUTH_MESSAGES.SIGN_IN, data)
    res.status(HttpStatus.OK).json(response)
  } catch (error) {
    next(error)
  }
}
