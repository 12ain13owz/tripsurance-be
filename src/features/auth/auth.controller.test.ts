import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '@/app'
import { AppError } from '@/core/error'
import { ErrorSeverity, HttpStatus } from '@/shared/constants'
import type { AppResponse } from '@/shared/types'
import { AUTH_ERRORS } from './auth.const'
import type { AuthSession, SafeUser } from './auth.type'

const login = vi.fn<(email: string, password: string) => Promise<AuthSession>>()
const verifyRefreshToken = vi.fn(() => ({ sub: 'user-1', exp: 1893456000 }))

vi.mock('./auth.service', () => ({
  login: async (email: string, password: string) => login(email, password),
}))

vi.mock('@/core/security', () => ({
  verifyRefreshToken: () => verifyRefreshToken(),
}))

const app = createApp()
const validBody = { email: 'jane@example.com', password: 'correct-password' }
const session: AuthSession = {
  user: {
    id: 'user-1',
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    role: 'ADMIN',
    isActive: true,
    isEmailVerified: true,
    invitedById: null,
    invitationTokenHash: null,
    lastInvitationSentAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
}

beforeEach(() => {
  login.mockReset()
  verifyRefreshToken.mockClear()
})

describe('POST /auth/sign-in', () => {
  it('returns 200 with the user and access token, without the refresh token, on valid credentials', async () => {
    login.mockResolvedValue(session)

    const res = await request(app).post('/auth/sign-in').send(validBody)
    const body = res.body as AppResponse<{
      user: SafeUser
      accessToken: string
      refreshToken?: string
    }>

    expect(res.status).toBe(HttpStatus.OK)
    expect(body.data?.user).toEqual({
      ...session.user,
      createdAt: session.user.createdAt.toISOString(),
      updatedAt: session.user.updatedAt.toISOString(),
    })
    expect(body.data?.accessToken).toBe('access-token')
    expect(body.data?.refreshToken).toBeUndefined()
  })

  it('sets an httpOnly refreshToken cookie on valid credentials', async () => {
    login.mockResolvedValue(session)

    const res = await request(app).post('/auth/sign-in').send(validBody)
    const cookies = res.headers['set-cookie'] as unknown as string[]

    expect(cookies.some((cookie) => cookie.startsWith('refreshToken=refresh-token'))).toBe(true)
    expect(cookies.some((cookie) => /HttpOnly/i.test(cookie))).toBe(true)
  })

  it('returns 400 and does not call the service when the body fails validation', async () => {
    const res = await request(app)
      .post('/auth/sign-in')
      .send({ email: 'not-an-email', password: 'short' })

    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(login).not.toHaveBeenCalled()
  })

  it('forwards a service AppError to the error handler with its status and message', async () => {
    login.mockRejectedValue(
      new AppError(AUTH_ERRORS.INVALID_CREDENTIALS, HttpStatus.UNAUTHORIZED, ErrorSeverity.WARN)
    )

    const res = await request(app).post('/auth/sign-in').send(validBody)
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED)
    expect(body.message).toBe(AUTH_ERRORS.INVALID_CREDENTIALS)
  })
})
