import { z } from 'zod'
import { AppError } from '@/core/error'
import { ERRORS, ErrorSeverity, HttpStatus } from '@/shared/constants'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { ZodType } from 'zod'

type RequestSource = 'body' | 'query' | 'params'

const readSource = (req: Request, source: RequestSource): unknown => {
  if (source === 'params') {
    return req.params
  }
  if (source === 'query') {
    return req.query
  }
  return req.body
}

const writeSource = (req: Request, source: RequestSource, data: unknown): void => {
  if (source === 'params') {
    req.params = data as Request['params']
    return
  }

  if (source === 'query') {
    Object.defineProperty(req, 'query', {
      value: data,
      writable: true,
      configurable: true,
      enumerable: true,
    })
    return
  }

  req.body = data
}

/** Validate (and parse) a request segment against a Zod schema before the controller runs. */
export const validate =
  <TSchema extends ZodType>(schema: TSchema, source: RequestSource = 'body'): RequestHandler =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(readSource(req, source))

    if (!result.success) {
      const { fieldErrors, formErrors } = z.flattenError(result.error)
      next(
        new AppError(
          ERRORS.GENERIC.VALIDATION_ERROR,
          HttpStatus.UNPROCESSABLE_ENTITY,
          ErrorSeverity.WARN
        )
          .withOperation('validate')
          .withEndpoint(req)
          .withMetadata({ source, fieldErrors, formErrors })
      )
      return
    }

    writeSource(req, source, result.data)
    next()
  }
