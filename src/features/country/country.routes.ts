import { Router } from 'express'
import { authenticate, validate } from '@/core/middleware'
import * as countryController from './country.controller'
import { countrySchema } from './country.schema'

const router = Router()

router.get('/', countryController.list)
router.post('/', authenticate, validate(countrySchema.create), countryController.create)
router.patch('/:id', authenticate, validate(countrySchema.update), countryController.update)
router.delete('/:id', authenticate, validate(countrySchema.remove), countryController.remove)

export const countryRouter = router
