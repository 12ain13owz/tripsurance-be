import { Router } from 'express'
import { authenticate, validate } from '@/core/middleware'
import * as countryController from './country.controller'
import { countrySchema } from './country.schema'

const router = Router()

router.get('/', countryController.list)
router.post('/', authenticate, validate(countrySchema.create.body), countryController.create)
router.patch(
  '/:id',
  authenticate,
  validate(countrySchema.update.params, 'params'),
  validate(countrySchema.update.body),
  countryController.update
)
router.delete(
  '/:id',
  authenticate,
  validate(countrySchema.remove.params, 'params'),
  countryController.remove
)

export const countryRouter = router
