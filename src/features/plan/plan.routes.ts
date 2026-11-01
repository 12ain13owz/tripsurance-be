import { Router } from 'express'
import { validate } from '@/core/middleware'
import * as planController from './plan.controller'
import { planSchema } from './plan.schema'

const planPublicRouter = Router()
const planAdminRouter = Router()

planPublicRouter.get('/', validate(planSchema.listActive), planController.listActive)

planAdminRouter.get('/', planController.list)
planAdminRouter.get('/:id', validate(planSchema.get), planController.get)
planAdminRouter.post('/', validate(planSchema.create), planController.create)
planAdminRouter.patch('/reorder', validate(planSchema.reorder), planController.reorder)
planAdminRouter.patch('/:id', validate(planSchema.update), planController.update)

export { planPublicRouter, planAdminRouter }
