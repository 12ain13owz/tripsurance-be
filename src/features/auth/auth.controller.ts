import { AppError } from '@/core/error'
import type { AuthenticatedRequest } from '@/core/middleware/authenticate'
import { verifyRefreshToken } from '@/core/security'
import { ERRORS, ErrorSeverity, HttpStatus } from '@/shared/constants'
import { createResponse } from '@/shared/utils'
import { AUTH_MESSAGES } from './auth.const'
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from './auth.cookie'
import * as authService from './auth.service'
import type { AuthReq, ProtectedAuthReq, SafeUser, SignInData } from './auth.type'
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
    const userId = req.user.sub
    const data: SafeUser = await authService.getProfile(userId)
    const response = createResponse(AUTH_MESSAGES.ME, data)

    res.status(HttpStatus.OK).json(response)
  } catch (error) {
    nexT(error)
  }
}

export const changePassword = async (
  req: ProtectedAuthReq<'changePassword'>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.user.sub
    const { currentPassword, newPassword } = req.body
    await authService.changePassword(userId, currentPassword, newPassword)

    const response = createResponse(AUTH_MESSAGES.CHANGE_PASSWORD)

    res.status(HttpStatus.OK).json(response)
  } catch (error) {
    next(error)
  }
}

export const forgotPassword = async (
  req: AuthReq<'forgotPassword'>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body
    await authService.forgotPassword(email)

    const response = createResponse(AUTH_MESSAGES.FORGOT_PASSWORD)

    res.status(HttpStatus.OK).json(response)
  } catch (error) {
    next(error)
  }
}

export const resetPassword = async (
  req: AuthReq<'resetPassword'>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token, newPassword } = req.body
    await authService.resetPassword(token, newPassword)

    const response = createResponse(AUTH_MESSAGES.RESET_PASSWORD)

    res.status(HttpStatus.OK).json(response)
  } catch (error) {
    next(error)
  }
}
