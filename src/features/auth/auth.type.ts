import type { User } from '@/generated/prisma/client'
import type { AppResponse, ReqOf } from '@/shared/types'
import type { authSchema } from './auth.schema'

export type SafeUser = Omit<User, 'password'>

export type AuthReq<K extends keyof typeof authSchema> = ReqOf<typeof authSchema, K>

export interface AuthSession {
  user: SafeUser
  accessToken: string
  refreshToken: string
}

export type SignInRes = AppResponse<Omit<AuthSession, 'refreshToken'>>
