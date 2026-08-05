import jwt from 'jsonwebtoken'
import { env } from '@/core/config'
import { AppError } from '@/core/error'
import { ERRORS, ErrorSeverity, HttpStatus } from '@/shared/constants'
import type { AccessTokenPayload, RefreshTokenPayload } from './jwt.type'
import type { SignOptions } from 'jsonwebtoken'

const accessExpires = env.JWT_ACCESS_EXPIRES as SignOptions['expiresIn']
const refreshExpires = env.JWT_REFRESH_EXPIRES as SignOptions['expiresIn']

export const signAccessToken = (sub: string) =>
  jwt.sign({ sub }, env.JWT_ACCESS_SECRET, { expiresIn: accessExpires })

export const signRefreshToken = (sub: string): string =>
  jwt.sign({ sub }, env.JWT_REFRESH_SECRET, { expiresIn: refreshExpires })

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload
  } catch {
    throw new AppError(
      ERRORS.GENERIC.UNAUTHORIZED,
      HttpStatus.UNAUTHORIZED,
      ErrorSeverity.WARN
    ).withOperation('verifyAccessToken')
  }
}

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload
  } catch {
    throw new AppError(
      ERRORS.GENERIC.UNAUTHORIZED,
      HttpStatus.UNAUTHORIZED,
      ErrorSeverity.WARN
    ).withOperation('verifyRefreshToken')
  }
}
