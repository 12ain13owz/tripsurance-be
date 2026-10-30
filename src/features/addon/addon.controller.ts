import type { Addon } from '@/generated/prisma/client'
import { HttpStatus, SUCCESS } from '@/shared/constants'
import { createResponse } from '@/shared/utils'
import * as addonService from './addon.service'
import type {
  AddonIdParams,
  CreateAddonInput,
  ReorderAddonInput,
  UpdateAddonInput,
} from './addon.schema'
import type { NextFunction, Request, Response } from 'express'

export const list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data: Addon[] = await addonService.list()
    const response = createResponse(SUCCESS.UTIL.list('addon'), data)

    res.status(HttpStatus.OK).json(response)
  } catch (error) {
    next(error)
  }
}

export const get = async (
  req: Request<AddonIdParams>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params

    const data: Addon = await addonService.get(id)
    const response = createResponse(SUCCESS.UTIL.fetch('addon'), data)

    res.status(HttpStatus.OK).json(response)
  } catch (error) {
    next(error)
  }
}

export const create = async (
  req: Request<unknown, unknown, CreateAddonInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data: Addon = await addonService.create(req.body)
    const response = createResponse(SUCCESS.UTIL.create('addon'), data)

    res.status(HttpStatus.CREATED).json(response)
  } catch (error) {
    next(error)
  }
}

export const update = async (
  req: Request<AddonIdParams, unknown, UpdateAddonInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params

    const data: Addon = await addonService.update(id, req.body)
    const response = createResponse(SUCCESS.UTIL.update('addon'), data)

    res.status(HttpStatus.OK).json(response)
  } catch (error) {
    next(error)
  }
}

export const reorder = async (
  req: Request<unknown, unknown, ReorderAddonInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data: Addon[] = await addonService.reorder(req.body)
    const response = createResponse(SUCCESS.UTIL.reorder('addon'), data)

    res.status(HttpStatus.OK).json(response)
  } catch (error) {
    next(error)
  }
}
