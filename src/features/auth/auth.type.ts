import type { AuthenticatedRequest } from '@/core/middleware'
import type { User } from '@/generated/prisma/client'
import type { ReqOf } from '@/shared/types'
import type { authSchema } from './auth.schema'

export type SafeUser = Omit<User, 'password'>
export type AuthReq<K extends keyof typeof authSchema> = ReqOf<typeof authSchema, K>
export type ProtectedAuthReq<K extends keyof typeof authSchema> = AuthenticatedRequest<AuthReq<K>>

export interface AuthSession {
  user: SafeUser
  accessToken: string
  refreshToken: string
}

export type SignInData = Omit<AuthSession, 'refreshToken'>

export interface SessionSummary {
  id: string
  createdAt: Date
  expiresAt: Date
  isCurrent: boolean
}
