import { HttpStatus, SUCCESS } from '@/shared/constants'
import { createResponse } from '@/shared/utils'
import * as planService from './plan.service'
import type {
  CreatePlanInput,
  ListActivePlanQuery,
  PlanIdParams,
  ReorderPlanInput,
  UpdatePlanInput,
} from './plan.schema'
import type { PlanAdminData, PlanData } from './plan.type'
import type { NextFunction, Request, Response } from 'express'

export const list = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const data: PlanAdminData[] = await planService.list()
    const response = createResponse(SUCCESS.UTIL.list('plan'), data)

    res.status(HttpStatus.OK).json(response)
  } catch (error) {
    next(error)
  }
}

export const listActive = async (
  req: Request<unknown, unknown, unknown, ListActivePlanQuery>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { country } = req.query

    const data: PlanData[] = await planService.listActive(country)
    const response = createResponse(SUCCESS.UTIL.list('plan'), data)

    res.status(HttpStatus.OK).json(response)
  } catch (error) {
    next(error)
  }
}

export const get = async (
  req: Request<PlanIdParams>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params

    const data: PlanAdminData = await planService.get(id)
    const response = createResponse(SUCCESS.UTIL.fetch('plan'), data)

    res.status(HttpStatus.OK).json(response)
  } catch (error) {
    next(error)
  }
}

export const create = async (
  req: Request<unknown, unknown, CreatePlanInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data: PlanAdminData = await planService.create(req.body)
    const response = createResponse(SUCCESS.UTIL.create('plan'), data)

    res.status(HttpStatus.CREATED).json(response)
  } catch (error) {
    next(error)
  }
}

export const update = async (
  req: Request<PlanIdParams, unknown, UpdatePlanInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params

    const data: PlanAdminData = await planService.update(id, req.body)
    const response = createResponse(SUCCESS.UTIL.update('plan'), data)

    res.status(HttpStatus.OK).json(response)
  } catch (error) {
    next(error)
  }
}

export const reorder = async (
  req: Request<unknown, unknown, ReorderPlanInput>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data: PlanAdminData[] = await planService.reorder(req.body)
    const response = createResponse(SUCCESS.UTIL.reorder('plan'), data)

    res.status(HttpStatus.OK).json(response)
  } catch (error) {
    next(error)
  }
}
