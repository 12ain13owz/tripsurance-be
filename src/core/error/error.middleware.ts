import { env } from '@/core/config'
import { logger } from '@/core/logger'
import { ERRORS, ErrorSeverity, HttpStatus } from '@/shared/constants'
import { AppEnv } from '@/shared/types'
import { createResponse } from '@/shared/utils'
import { AppError } from './app-error'
import { ErrorLogger } from './error-logger'
import type { NextFunction, Request, Response } from 'express'

const isJsonBodyError = (error: Error): boolean =>
  error instanceof SyntaxError && 'type' in error && error.type === 'entity.parse.failed'

export const errorHandler = async (
  error: AppError | Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): Promise<void> => {
  try {
    const normalized = isJsonBodyError(error)
      ? new AppError(ERRORS.GENERIC.INVALID_JSON_BODY, HttpStatus.BAD_REQUEST, ErrorSeverity.WARN)
      : error

    const structured = ErrorLogger.log(normalized)
    const status =
      normalized instanceof AppError ? normalized.status : HttpStatus.INTERNAL_SERVER_ERROR
    const message = normalized.message ? normalized.message : ERRORS.GENERIC.INTERNAL_SERVER_ERROR

    // Production: only message + timestamp reach the client.
    // Development: attach structured details (status, context, stack) for debugging.
    const data =
      env.NODE_ENV === AppEnv.DEVELOPMENT
        ? {
            name: structured.error.name,
            status: structured.status,
            severity: structured.severity,
            context: structured.context,
            stack: structured.error.stack,
          }
        : undefined
    const response = createResponse(message, data)

    res.status(status).json(response)
  } catch (error) {
    logger.error(error)
    const data = env.NODE_ENV === AppEnv.DEVELOPMENT ? error : undefined
    const response = createResponse(ERRORS.GENERIC.INTERNAL_SERVER_ERROR, data)

    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(response)
  }
}
