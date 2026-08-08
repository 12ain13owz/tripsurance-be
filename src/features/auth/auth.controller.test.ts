import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '@/app'
import { AppError } from '@/core/error'
import { ERRORS, ErrorSeverity, HttpStatus } from '@/shared/constants'
import type { AppResponse } from '@/shared/types'
import { AUTH_ERRORS, AUTH_MESSAGES } from './auth.const'
import type { AuthSession, SafeUser } from './auth.type'

const signInMock = vi.fn<(email: string, password: string) => Promise<AuthSession>>()
const signOutMock = vi.fn<(refreshToken: string | null) => Promise<void>>()
const refreshMock = vi.fn<(refreshToken: string) => Promise<AuthSession>>()
const verifyRefreshToken = vi.fn(() => ({ sub: 'user-1', exp: 1893456000 }))

vi.mock('./auth.service', () => ({
  signIn: async (email: string, password: string) => signInMock(email, password),
  signOut: async (refreshToken: string | null) => signOutMock(refreshToken),
  refresh: async (refreshToken: string) => refreshMock(refreshToken),
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
  signInMock.mockReset()
  signOutMock.mockReset()
  refreshMock.mockReset()
  verifyRefreshToken.mockClear()
})

describe('POST /auth/sign-in', () => {
  it('returns 200 with the user and access token, without the refresh token, on valid credentials', async () => {
    signInMock.mockResolvedValue(session)

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
    signInMock.mockResolvedValue(session)

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
    expect(signInMock).not.toHaveBeenCalled()
  })

  it('forwards a service AppError to the error handler with its status and message', async () => {
    signInMock.mockRejectedValue(
      new AppError(AUTH_ERRORS.INVALID_CREDENTIALS, HttpStatus.UNAUTHORIZED, ErrorSeverity.WARN)
    )

    const res = await request(app).post('/auth/sign-in').send(validBody)
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED)
    expect(body.message).toBe(AUTH_ERRORS.INVALID_CREDENTIALS)
  })
})

describe('POST /auth/sign-out', () => {
  it('returns 200 with the sign-out message and clears the refreshToken cookie', async () => {
    signOutMock.mockResolvedValue(undefined)

    const res = await request(app)
      .post('/auth/sign-out')
      .set('Cookie', 'refreshToken=refresh-token')
    const body = res.body as AppResponse<undefined>
    const cookies = res.headers['set-cookie'] as unknown as string[]

    expect(res.status).toBe(HttpStatus.OK)
    expect(body.message).toBe(AUTH_MESSAGES.SIGN_OUT)
    expect(cookies.some((cookie) => cookie.startsWith('refreshToken=;'))).toBe(true)
    expect(cookies.some((cookie) => /Max-Age=0/.test(cookie))).toBe(true)
  })

  it('passes the cookie value straight through to the service', async () => {
    signOutMock.mockResolvedValue(undefined)

    await request(app).post('/auth/sign-out').set('Cookie', 'refreshToken=refresh-token')
    expect(signOutMock).toHaveBeenCalledWith('refresh-token')
  })

  it('still returns 200 and calls the service with null when there is no refreshToken cookie', async () => {
    signOutMock.mockResolvedValue(undefined)

    const res = await request(app).post('/auth/sign-out')
    expect(res.status).toBe(HttpStatus.OK)
    expect(signOutMock).toHaveBeenCalledWith(null)
  })

  it('forwards a service AppError to the error handler with its status and message', async () => {
    signOutMock.mockRejectedValue(
      new AppError('Could not sign out', HttpStatus.INTERNAL_SERVER_ERROR, ErrorSeverity.ERROR)
    )

    const res = await request(app).post('/auth/sign-out')
    const body = res.body as AppResponse<undefined>
    expect(res.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(body.message).toBe('Could not sign out')
  })
})

describe('POST /auth/refresh', () => {
  it('returns 200 with the new session, without refreshToken, and sets a new refreshToken cookie', async () => {
    refreshMock.mockResolvedValue(session)

    const res = await request(app)
      .post('/auth/refresh')
      .set('Cookie', 'refreshToken=old-refresh-token')
    const body = res.body as AppResponse<{
      user: SafeUser
      accessToken: string
      refreshToken?: string
    }>
    const cookies = res.headers['set-cookie'] as unknown as string[]

    expect(res.status).toBe(HttpStatus.OK)
    expect(body.message).toBe(AUTH_MESSAGES.REFRESH)
    expect(body.data?.accessToken).toBe('access-token')
    expect(body.data?.refreshToken).toBeUndefined()
    expect(cookies.some((cookie) => cookie.startsWith('refreshToken=refresh-token'))).toBe(true)
  })

  it('passes the cookie value straight through to the service', async () => {
    refreshMock.mockResolvedValue(session)

    await request(app).post('/auth/refresh').set('Cookie', 'refreshToken=old-refresh-token')
    expect(refreshMock).toHaveBeenCalledWith('old-refresh-token')
  })

  it('returns 401 MISSING_TOKEN and does not call the service when there is no refreshToken cookie', async () => {
    const res = await request(app).post('/auth/refresh')
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED)
    expect(body.message).toBe(ERRORS.AUTH.MISSING_TOKEN)
    expect(refreshMock).not.toHaveBeenCalled()
  })

  it('forwards a service AppError (e.g. a reused or invalid token) to the error handler', async () => {
    refreshMock.mockRejectedValue(
      new AppError(ERRORS.AUTH.INVALID_TOKEN, HttpStatus.UNAUTHORIZED, ErrorSeverity.WARN)
    )

    const res = await request(app)
      .post('/auth/refresh')
      .set('Cookie', 'refreshToken=old-refresh-token')
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED)
    expect(body.message).toBe(ERRORS.AUTH.INVALID_TOKEN)
  })
})
