import { AppError } from '@/core/error'
import { ErrorSeverity, HttpStatus, SUCCESS } from '@/shared/constants'
import { createResponse } from '@/shared/utils'
import type { NextFunction, Request, Response } from 'express'

export const successController = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const response = createResponse(SUCCESS.GENERIC.OK)
    res.status(HttpStatus.OK).json(response)
  } catch (error) {
    next(error)
  }
}

export const errorController = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    throw new AppError('Test error function', HttpStatus.BAD_REQUEST, ErrorSeverity.ERROR)
      .withOperation('errorController')
      .withEndpoint(req)
      .withMetadata({
        userId: 1,
        name: 'John Doe',
        active: false,
        items: ['1', 2, true, null, undefined, new Date()],
        description: null,
        email: undefined,
        createdAt: new Date(),
      })
  } catch (error) {
    next(error)
  }
}
