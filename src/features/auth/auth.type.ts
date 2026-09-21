import type { User } from '@/generated/prisma/client'

export type SafeUser = Omit<User, 'password'>

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
