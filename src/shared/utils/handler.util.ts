import type { NextFunction, RequestHandler, Response } from 'express'

/**
 * Bridges a strongly typed handler (post-validate) onto Express's `RequestHandler`.
 * Zod transforms (e.g. string -> lowercased email) don't match Express's declared body/query
 * types, so route registration needs this adapter; controller signatures stay fully typed.
 */
export const asValidatedHandler = <TReq>(
  handler: (req: TReq, res: Response, next: NextFunction) => Promise<void>
): RequestHandler => handler as unknown as RequestHandler
