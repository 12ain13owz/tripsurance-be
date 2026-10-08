import { Router } from 'express'
import { validate } from '@/core/middleware'
import * as countryController from './country.controller'
import { countrySchema } from './country.schema'

export const countryPublicRouter = Router()
export const countryAdminRouter = Router()

countryPublicRouter.get('/', countryController.listActive)

countryAdminRouter.get('/', countryController.list)
countryAdminRouter.patch('/:id', validate(countrySchema.update), countryController.update)
