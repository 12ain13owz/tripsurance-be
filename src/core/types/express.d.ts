import type { AccessTokenPayload } from '@/core/security'

declare global {
  namespace Express {
    interface Request {
      user?: AccessTokenPayload
    }
  }
}
