import type { Country } from '@/generated/prisma/client'
import { HttpStatus, SUCCESS } from '@/shared/constants'
import { createResponse } from '@/shared/utils'
import * as countryService from './country.service'
import type { CountryIdParams, CreateCountryInput, UpdateCountryInput } from './country.schema'
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

export const create = async (
  req: Request<unknown, unknown, CreateCountryInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { isoCode } = req.body // typed เป็น string จริง ไม่ใช่ any
    const data: Country = await countryService.create(isoCode)
    const response = createResponse(SUCCESS.UTIL.create('country'), data)
    res.status(HttpStatus.CREATED).json(response)
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

export const remove = async (
  req: Request<CountryIdParams>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params
    await countryService.remove(id)

    const response = createResponse(SUCCESS.UTIL.delete('country'))
    res.status(HttpStatus.OK).json(response)
  } catch (error) {
    next(error)
  }
}
