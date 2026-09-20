import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '@/app'
import { AppError } from '@/core/error'
import { ERRORS, ErrorSeverity, HttpStatus, SUCCESS } from '@/shared/constants'
import type { AppResponse } from '@/shared/types'
import { AUTH_ERRORS, AUTH_MESSAGES } from './auth.const'
import type { AuthSession, SafeUser, SessionSummary } from './auth.type'

const signInMock = vi.fn<(email: string, password: string) => Promise<AuthSession>>()
const signOutMock = vi.fn<(refreshToken: string | null) => Promise<void>>()
const refreshMock = vi.fn<(refreshToken: string) => Promise<AuthSession>>()
const getProfileMock = vi.fn<(userId: string) => Promise<SafeUser>>()
const changePasswordMock =
  vi.fn<
    (
      userId: string,
      currentPassword: string,
      newPassword: string,
      currentToken: string | null
    ) => Promise<void>
  >()
const forgotPasswordMock = vi.fn<(email: string) => Promise<void>>()
const resetPasswordMock = vi.fn<(token: string, newPassword: string) => Promise<AuthSession>>()
const listSessionsMock =
  vi.fn<(userId: string, currentToken: string | null) => Promise<SessionSummary[]>>()
const revokeSessionMock = vi.fn<(userId: string, sessionId: string) => Promise<void>>()
const revokeOtherSessionsMock =
  vi.fn<(userId: string, currentToken: string | null) => Promise<void>>()
const verifyRefreshToken = vi.fn(() => ({ sub: 'user-1', exp: 1893456000 }))
const verifyAccessTokenMock = vi.fn<(token: string) => { sub: string; iat: number; exp: number }>()

vi.mock('./auth.service', () => ({
  signIn: async (email: string, password: string) => signInMock(email, password),
  signOut: async (refreshToken: string | null) => signOutMock(refreshToken),
  refresh: async (refreshToken: string) => refreshMock(refreshToken),
  getProfile: async (userId: string) => getProfileMock(userId),
  changePassword: async (
    userId: string,
    currentPassword: string,
    newPassword: string,
    currentToken: string | null
  ) => changePasswordMock(userId, currentPassword, newPassword, currentToken),
  forgotPassword: async (email: string) => forgotPasswordMock(email),
  resetPassword: async (token: string, newPassword: string) =>
    resetPasswordMock(token, newPassword),
  listSessions: async (userId: string, currentToken: string | null) =>
    listSessionsMock(userId, currentToken),
  revokeSession: async (userId: string, sessionId: string) => revokeSessionMock(userId, sessionId),
  revokeOtherSessions: async (userId: string, currentToken: string | null) =>
    revokeOtherSessionsMock(userId, currentToken),
}))

vi.mock('@/core/security', () => ({
  verifyRefreshToken: () => verifyRefreshToken(),
  verifyAccessToken: (token: string) => verifyAccessTokenMock(token),
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
  getProfileMock.mockReset()
  changePasswordMock.mockReset()
  forgotPasswordMock.mockReset()
  resetPasswordMock.mockReset()
  listSessionsMock.mockReset()
  revokeSessionMock.mockReset()
  revokeOtherSessionsMock.mockReset()
  verifyRefreshToken.mockClear()
  verifyAccessTokenMock.mockReset().mockReturnValue({ sub: 'user-1', iat: 0, exp: 1893456000 })
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

describe('GET /auth/me', () => {
  it('returns 200 with the current user profile for a valid bearer token', async () => {
    getProfileMock.mockResolvedValue(session.user)

    const res = await request(app).get('/auth/me').set('Authorization', 'Bearer access-token')
    const body = res.body as AppResponse<SafeUser>

    expect(res.status).toBe(HttpStatus.OK)
    expect(body.message).toBe(AUTH_MESSAGES.ME)
    expect(body.data).toEqual({
      ...session.user,
      createdAt: session.user.createdAt.toISOString(),
      updatedAt: session.user.updatedAt.toISOString(),
    })
    expect(getProfileMock).toHaveBeenCalledWith('user-1')
  })

  it('returns 401 MISSING_TOKEN and never calls the service when there is no Authorization header', async () => {
    const res = await request(app).get('/auth/me')
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED)
    expect(body.message).toBe(ERRORS.AUTH.MISSING_TOKEN)
    expect(getProfileMock).not.toHaveBeenCalled()
  })

  it('returns 401 and never calls the service when the bearer token is invalid or expired', async () => {
    verifyAccessTokenMock.mockImplementation(() => {
      throw new AppError(ERRORS.GENERIC.UNAUTHORIZED, HttpStatus.UNAUTHORIZED, ErrorSeverity.WARN)
    })

    const res = await request(app).get('/auth/me').set('Authorization', 'Bearer garbage')
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED)
    expect(body.message).toBe(ERRORS.GENERIC.UNAUTHORIZED)
    expect(getProfileMock).not.toHaveBeenCalled()
  })

  it('forwards a service AppError (e.g. the account was disabled) to the error handler', async () => {
    getProfileMock.mockRejectedValue(
      new AppError(AUTH_ERRORS.ACCOUNT_DISABLED, HttpStatus.UNAUTHORIZED, ErrorSeverity.WARN)
    )

    const res = await request(app).get('/auth/me').set('Authorization', 'Bearer access-token')
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED)
    expect(body.message).toBe(AUTH_ERRORS.ACCOUNT_DISABLED)
  })
})

describe('POST /auth/change-password', () => {
  const validBody = {
    currentPassword: 'CurrentPass1!',
    newPassword: 'NewStrong1!',
    confirmPassword: 'NewStrong1!',
  }

  it('returns 200 with the change-password message and calls the service with the bearer user id', async () => {
    changePasswordMock.mockResolvedValue(undefined)

    const res = await request(app)
      .post('/auth/change-password')
      .set('Authorization', 'Bearer access-token')
      .send(validBody)
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.OK)
    expect(body.message).toBe(AUTH_MESSAGES.CHANGE_PASSWORD)
    expect(changePasswordMock).toHaveBeenCalledWith('user-1', 'CurrentPass1!', 'NewStrong1!', null)
  })

  it('passes the refreshToken cookie value through to the service as currentToken', async () => {
    changePasswordMock.mockResolvedValue(undefined)

    await request(app)
      .post('/auth/change-password')
      .set('Authorization', 'Bearer access-token')
      .set('Cookie', 'refreshToken=current-refresh-token')
      .send(validBody)

    expect(changePasswordMock).toHaveBeenCalledWith(
      'user-1',
      'CurrentPass1!',
      'NewStrong1!',
      'current-refresh-token'
    )
  })

  it('returns 401 MISSING_TOKEN and never calls the service when there is no Authorization header', async () => {
    const res = await request(app).post('/auth/change-password').send(validBody)
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED)
    expect(body.message).toBe(ERRORS.AUTH.MISSING_TOKEN)
    expect(changePasswordMock).not.toHaveBeenCalled()
  })

  it('returns 422 and never calls the service when newPassword fails the complexity rules', async () => {
    const res = await request(app)
      .post('/auth/change-password')
      .set('Authorization', 'Bearer access-token')
      .send({ ...validBody, newPassword: 'weak', confirmPassword: 'weak' })

    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(changePasswordMock).not.toHaveBeenCalled()
  })

  it('forwards a service AppError (e.g. the current password is wrong) to the error handler', async () => {
    changePasswordMock.mockRejectedValue(
      new AppError(
        AUTH_ERRORS.INVALID_CURRENT_PASSWORD,
        HttpStatus.UNAUTHORIZED,
        ErrorSeverity.WARN
      )
    )

    const res = await request(app)
      .post('/auth/change-password')
      .set('Authorization', 'Bearer access-token')
      .send(validBody)
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED)
    expect(body.message).toBe(AUTH_ERRORS.INVALID_CURRENT_PASSWORD)
  })
})

describe('POST /auth/forgot-password', () => {
  it('returns 200 with the identical response whether or not the email matches an account', async () => {
    forgotPasswordMock.mockResolvedValue(undefined)

    const foundRes = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'jane@example.com' })
    const notFoundRes = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'missing@example.com' })

    expect(foundRes.status).toBe(HttpStatus.OK)
    expect(notFoundRes.status).toBe(HttpStatus.OK)
    expect((foundRes.body as AppResponse<undefined>).message).toBe(
      (notFoundRes.body as AppResponse<undefined>).message
    )
  })

  it('returns 422 and never calls the service for a malformed email', async () => {
    const res = await request(app).post('/auth/forgot-password').send({ email: 'not-an-email' })

    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(forgotPasswordMock).not.toHaveBeenCalled()
  })
})

describe('POST /auth/reset-password', () => {
  const validBody = {
    token: 'raw-reset-token',
    newPassword: 'NewStrong1!',
    confirmPassword: 'NewStrong1!',
  }

  it('returns 200 with the reset-password message on success', async () => {
    resetPasswordMock.mockResolvedValue(session)

    const res = await request(app).post('/auth/reset-password').send(validBody)
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
    expect(body.message).toBe(AUTH_MESSAGES.RESET_PASSWORD)
    expect(resetPasswordMock).toHaveBeenCalledWith('raw-reset-token', 'NewStrong1!')
  })

  it('sets a new httpOnly refreshToken cookie on successful reset', async () => {
    resetPasswordMock.mockResolvedValue(session)

    const res = await request(app).post('/auth/reset-password').send(validBody)
    const cookies = res.headers['set-cookie'] as unknown as string[]

    expect(cookies.some((cookie) => cookie.startsWith('refreshToken=refresh-token'))).toBe(true)
    expect(cookies.some((cookie) => /HttpOnly/i.test(cookie))).toBe(true)
  })

  it('returns 422 and never calls the service when the passwords do not match', async () => {
    const res = await request(app)
      .post('/auth/reset-password')
      .send({ ...validBody, confirmPassword: 'Different1!' })

    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(resetPasswordMock).not.toHaveBeenCalled()
  })

  it('forwards a service AppError (e.g. an invalid or expired token) to the error handler', async () => {
    resetPasswordMock.mockRejectedValue(
      new AppError(ERRORS.AUTH.INVALID_TOKEN, HttpStatus.UNAUTHORIZED, ErrorSeverity.WARN)
    )

    const res = await request(app).post('/auth/reset-password').send(validBody)
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED)
    expect(body.message).toBe(ERRORS.AUTH.INVALID_TOKEN)
  })
})

describe('GET /auth/sessions', () => {
  const sessions: SessionSummary[] = [
    {
      id: 'session-1',
      createdAt: new Date('2026-08-08T09:00:00.000Z'),
      expiresAt: new Date('2026-08-09T09:00:00.000Z'),
      isCurrent: true,
    },
    {
      id: 'session-2',
      createdAt: new Date('2026-08-07T09:00:00.000Z'),
      expiresAt: new Date('2026-08-10T09:00:00.000Z'),
      isCurrent: false,
    },
  ]

  it('returns 200 with the session list for a valid bearer token', async () => {
    listSessionsMock.mockResolvedValue(sessions)

    const res = await request(app).get('/auth/sessions').set('Authorization', 'Bearer access-token')
    const body = res.body as AppResponse<SessionSummary[]>

    expect(res.status).toBe(HttpStatus.OK)
    expect(body.message).toBe(SUCCESS.UTIL.list('sessions'))
    expect(body.data).toEqual([
      {
        ...sessions[0],
        createdAt: sessions[0].createdAt.toISOString(),
        expiresAt: sessions[0].expiresAt.toISOString(),
      },
      {
        ...sessions[1],
        createdAt: sessions[1].createdAt.toISOString(),
        expiresAt: sessions[1].expiresAt.toISOString(),
      },
    ])
  })

  it('passes the bearer user id and the refreshToken cookie value through to the service', async () => {
    listSessionsMock.mockResolvedValue(sessions)

    await request(app)
      .get('/auth/sessions')
      .set('Authorization', 'Bearer access-token')
      .set('Cookie', 'refreshToken=current-refresh-token')

    expect(listSessionsMock).toHaveBeenCalledWith('user-1', 'current-refresh-token')
  })

  it('calls the service with null when there is no refreshToken cookie', async () => {
    listSessionsMock.mockResolvedValue(sessions)

    await request(app).get('/auth/sessions').set('Authorization', 'Bearer access-token')

    expect(listSessionsMock).toHaveBeenCalledWith('user-1', null)
  })

  it('returns 401 MISSING_TOKEN and never calls the service when there is no Authorization header', async () => {
    const res = await request(app).get('/auth/sessions')
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED)
    expect(body.message).toBe(ERRORS.AUTH.MISSING_TOKEN)
    expect(listSessionsMock).not.toHaveBeenCalled()
  })

  it('forwards a service AppError to the error handler', async () => {
    listSessionsMock.mockRejectedValue(
      new AppError(
        ERRORS.GENERIC.INTERNAL_SERVER_ERROR,
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorSeverity.ERROR
      )
    )

    const res = await request(app).get('/auth/sessions').set('Authorization', 'Bearer access-token')
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(body.message).toBe(ERRORS.GENERIC.INTERNAL_SERVER_ERROR)
  })
})

describe('DELETE /auth/sessions/:id', () => {
  const validId = 'cjld2cjxh0000qzrmn831i7rn'

  it('returns 200 with the revoke-session message and calls the service with the bearer user id and session id', async () => {
    revokeSessionMock.mockResolvedValue(undefined)

    const res = await request(app)
      .delete(`/auth/sessions/${validId}`)
      .set('Authorization', 'Bearer access-token')
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.OK)
    expect(body.message).toBe(AUTH_MESSAGES.REVOKE_SESSION)
    expect(revokeSessionMock).toHaveBeenCalledWith('user-1', validId)
  })

  it('returns 401 MISSING_TOKEN and never calls the service when there is no Authorization header', async () => {
    const res = await request(app).delete(`/auth/sessions/${validId}`)
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED)
    expect(body.message).toBe(ERRORS.AUTH.MISSING_TOKEN)
    expect(revokeSessionMock).not.toHaveBeenCalled()
  })

  it('returns 422 and never calls the service when the id is not a valid session id', async () => {
    const res = await request(app)
      .delete('/auth/sessions/not-a-cuid')
      .set('Authorization', 'Bearer access-token')

    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(revokeSessionMock).not.toHaveBeenCalled()
  })

  it('forwards a service AppError (e.g. session not found or owned by another user) to the error handler', async () => {
    revokeSessionMock.mockRejectedValue(
      new AppError(AUTH_ERRORS.SESSION_NOT_FOUND, HttpStatus.NOT_FOUND, ErrorSeverity.WARN)
    )

    const res = await request(app)
      .delete(`/auth/sessions/${validId}`)
      .set('Authorization', 'Bearer access-token')
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.NOT_FOUND)
    expect(body.message).toBe(AUTH_ERRORS.SESSION_NOT_FOUND)
  })
})

describe('DELETE /auth/sessions', () => {
  it('returns 200 with the revoke-other-sessions message and calls the service with the bearer user id', async () => {
    revokeOtherSessionsMock.mockResolvedValue(undefined)

    const res = await request(app)
      .delete('/auth/sessions')
      .set('Authorization', 'Bearer access-token')
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.OK)
    expect(body.message).toBe(AUTH_MESSAGES.REVOKE_OTHER_SESSIONS)
    expect(revokeOtherSessionsMock).toHaveBeenCalledWith('user-1', null)
  })

  it('passes the refreshToken cookie value through to the service as currentToken', async () => {
    revokeOtherSessionsMock.mockResolvedValue(undefined)

    await request(app)
      .delete('/auth/sessions')
      .set('Authorization', 'Bearer access-token')
      .set('Cookie', 'refreshToken=current-refresh-token')

    expect(revokeOtherSessionsMock).toHaveBeenCalledWith('user-1', 'current-refresh-token')
  })

  it('returns 401 MISSING_TOKEN and never calls the service when there is no Authorization header', async () => {
    const res = await request(app).delete('/auth/sessions')
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED)
    expect(body.message).toBe(ERRORS.AUTH.MISSING_TOKEN)
    expect(revokeOtherSessionsMock).not.toHaveBeenCalled()
  })

  it('forwards a service AppError to the error handler', async () => {
    revokeOtherSessionsMock.mockRejectedValue(
      new AppError(
        'Could not revoke sessions',
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorSeverity.ERROR
      )
    )

    const res = await request(app)
      .delete('/auth/sessions')
      .set('Authorization', 'Bearer access-token')
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(body.message).toBe('Could not revoke sessions')
  })
})
