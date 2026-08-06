import { verifyRefreshToken } from '@/core/security'
import { HttpStatus } from '@/shared/constants'
import { createResponse } from '@/shared/utils'
import { AUTH_MESSAGES } from './auth.const'
import { setRefreshCookie } from './auth.cookie'
import * as authService from './auth.service'
import type { AuthReq, SignInRes } from './auth.type'
import type { Response, NextFunction } from 'express'

export const signIn = async (
  req: AuthReq<'signIn'>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body
    const result = await authService.login(email, password)
    const refreshToken = verifyRefreshToken(result.refreshToken)

    setRefreshCookie(res, result.refreshToken, refreshToken.exp)

    const response: SignInRes = createResponse(AUTH_MESSAGES.LOGIN, result)
    res.status(HttpStatus.OK).json(response)
  } catch (error) {
    next(error)
  }
}
