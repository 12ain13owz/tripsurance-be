import type { Country } from '@/generated/prisma/client'
import { HttpStatus, SUCCESS } from '@/shared/constants'
import { createResponse } from '@/shared/utils'
import * as countryService from './country.service'
import type { CountryIdParams, UpdateCountryInput } from './country.schema'
import type { Request, Response, NextFunction } from 'express'

export const list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data: Country[] = await countryService.list()
    const response = createResponse(SUCCESS.UTIL.list('country'), data)

    res.status(HttpStatus.OK).json(response)
  } catch (error) {
    next(error)
  }
}

export const listActive = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data: Country[] = await countryService.listActive()
    const response = createResponse(SUCCESS.UTIL.list('country'), data)

    res.status(HttpStatus.OK).json(response)
  } catch (error) {
    next(error)
  }
}

export const update = async (
  req: Request<CountryIdParams, unknown, UpdateCountryInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params
    const { isActive } = req.body

    const data: Country = await countryService.update(id, isActive)
    const response = createResponse(SUCCESS.UTIL.update('country'), data)

    res.status(HttpStatus.OK).json(response)
  } catch (error) {
    next(error)
  }
}
