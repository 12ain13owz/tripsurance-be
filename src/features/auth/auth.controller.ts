import { AppError } from '@/core/error'
import type { AuthenticatedRequest } from '@/core/middleware/authenticate'
import { verifyRefreshToken } from '@/core/security'
import { ERRORS, ErrorSeverity, HttpStatus } from '@/shared/constants'
import { createResponse } from '@/shared/utils'
import { AUTH_MESSAGES } from './auth.const'
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from './auth.cookie'
import * as authService from './auth.service'
import type { AuthReq, SafeUser, SignInData } from './auth.type'
import type { Request, Response, NextFunction } from 'express'

export const signIn = async (
  req: AuthReq<'signIn'>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body
    const { refreshToken, ...session } = await authService.signIn(email, password)
    const { exp } = verifyRefreshToken(refreshToken)

    setRefreshCookie(res, refreshToken, exp)

    const data: SignInData = session
    const response = createResponse(AUTH_MESSAGES.SIGN_IN, data)
    res.status(HttpStatus.OK).json(response)
  } catch (error) {
    next(error)
  }
}

export const signOut = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentToken = readRefreshCookie(req)
    await authService.signOut(currentToken)

    clearRefreshCookie(res)
    const response = createResponse(AUTH_MESSAGES.SIGN_OUT)
    res.status(HttpStatus.OK).json(response)
  } catch (error) {
    next(error)
  }
}

export const refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const currentToken = readRefreshCookie(req)
    if (!currentToken) {
      throw new AppError(
        ERRORS.AUTH.MISSING_TOKEN,
        HttpStatus.UNAUTHORIZED,
        ErrorSeverity.WARN
      ).withOperation('refresh')
    }

    const { refreshToken, ...session } = await authService.refresh(currentToken)
    const { exp } = verifyRefreshToken(refreshToken)

    setRefreshCookie(res, refreshToken, exp)

    const data: SignInData = session
    const response = createResponse(AUTH_MESSAGES.REFRESH, data)
    res.status(HttpStatus.OK).json(response)
  } catch (error) {
    next(error)
  }
}

export const me = async (
  req: AuthenticatedRequest,
  res: Response,
  nexT: NextFunction
): Promise<void> => {
  try {
    const data: SafeUser = await authService.getProfile(req.user.sub)
    const response = createResponse(AUTH_MESSAGES.ME, data)
    res.status(HttpStatus.OK).json(response)
  } catch (error) {
    nexT(error)
  }
}
