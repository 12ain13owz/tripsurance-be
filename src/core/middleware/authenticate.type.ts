import type { AccessTokenPayload } from '../security'
import type { Request } from 'express'
import type { ParamsDictionary, Query } from 'express-serve-static-core'

export type AuthenticatedRequest<
  P = ParamsDictionary,
  ResBody = unknown,
  ReqBody = unknown,
  ReqQuery = Query,
> = Request<P, ResBody, ReqBody, ReqQuery> & { user: AccessTokenPayload }
