import type { Response } from 'express'

interface CustomResponseLocals {
  user: string
}

// for custom res.locals
type AppRes = Response & { locals: CustomResponseLocals }
