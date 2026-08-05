import { Router } from 'express'
import * as healthController from './health.controller'

const router = Router()

router.get('/', healthController.successController)
router.get('/error', healthController.errorController)

export const healthRouter = router
