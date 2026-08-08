import type { NextFunction, RequestHandler, Response } from 'express'

/**
 * Bridges a handler typed with a narrower/extended `Request` (e.g. post-validate body,
 * or `req.user` guaranteed by an auth middleware) onto Express's structural `RequestHandler`.
 * Express can't infer non-generic augmentations like `req.user`, so route registration
 * needs this adapter; the handler's own signature stays fully typed.
 */
export const asHandler = <TReq>(
  handler: (req: TReq, res: Response, next: NextFunction) => Promise<void> | void
): RequestHandler => handler as unknown as RequestHandler
