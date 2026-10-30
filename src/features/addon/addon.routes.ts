import { Router } from 'express'
import { validate } from '@/core/middleware'
import * as addonController from './addon.controller'
import { addonSchema } from './addon.schema'

const router = Router()

router.get('/', addonController.list)
router.get('/:id', validate(addonSchema.get), addonController.get)
router.post('/', validate(addonSchema.create), addonController.create)
router.patch('/reorder', validate(addonSchema.reorder), addonController.reorder)
router.patch('/:id', validate(addonSchema.update), addonController.update)

export const addonAdminRouter = router
