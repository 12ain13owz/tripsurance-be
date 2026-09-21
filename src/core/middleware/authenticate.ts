import { AppError } from '@/core/error'
import { ERRORS, ErrorSeverity, HttpStatus } from '@/shared/constants'
import { verifyAccessToken } from '../security'
import type { Request, Response, NextFunction } from 'express'

const BEARER_PREFIX = 'Bearer '

export const authenticate = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith(BEARER_PREFIX)) {
      throw new AppError(ERRORS.AUTH.MISSING_TOKEN, HttpStatus.UNAUTHORIZED, ErrorSeverity.WARN)
        .withOperation('authenticate')
        .withEndpoint(req)
    }

    const payload = verifyAccessToken(header.slice(BEARER_PREFIX.length).trim())
    req.user = payload
    next()
  } catch (error) {
    next(error)
  }
}
