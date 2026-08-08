import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/core/error'
import type { User } from '@/generated/prisma/client'
import { ERRORS, ErrorSeverity, HttpStatus } from '@/shared/constants'
import { AUTH_ERRORS } from './auth.const'
import { refresh, signIn, signOut } from './auth.service'

const findUnique =
  vi.fn<(args: { where: { email: string } | { id: string } }) => Promise<User | null>>()
const compareMock = vi.fn<(password: string, hash: string) => Promise<boolean>>()
const signAccessTokenMock = vi.fn<(sub: string) => string>(() => 'access-token')
const signRefreshTokenMock = vi.fn<(sub: string) => string>(() => 'refresh-token')
const verifyRefreshTokenMock = vi.fn<(token: string) => { sub: string; iat: number; exp: number }>()
const refreshTokenCreateMock =
  vi.fn<
    (args: { data: { userId: string; tokenHash: string; expiresAt: Date } }) => Promise<unknown>
  >()
const refreshTokenUpdateManyMock =
  vi.fn<
    (args: {
      where: { tokenHash: string; revokedAt: null }
      data: { revokedAt: Date }
    }) => Promise<{ count: number }>
  >()

vi.mock('@/core/database/prisma', () => ({
  prisma: {
    user: {
      findUnique: async (args: { where: { email: string } | { id: string } }) => findUnique(args),
    },
    refreshToken: {
      create: async (args: { data: { userId: string; tokenHash: string; expiresAt: Date } }) =>
        refreshTokenCreateMock(args),
      updateMany: async (args: {
        where: { tokenHash: string; revokedAt: null }
        data: { revokedAt: Date }
      }) => refreshTokenUpdateManyMock(args),
    },
  },
}))

vi.mock('bcryptjs', () => ({
  compare: async (password: string, hash: string) => compareMock(password, hash),
  hashSync: () => 'dummy-hash',
}))

vi.mock('@/core/security', () => ({
  signAccessToken: (sub: string) => signAccessTokenMock(sub),
  signRefreshToken: (sub: string) => signRefreshTokenMock(sub),
  verifyRefreshToken: (token: string) => verifyRefreshTokenMock(token),
  hashToken: (token: string) => `hashed-${token}`,
}))

const activeUser: User = {
  id: 'user-1',
  email: 'jane@example.com',
  password: 'hashed-password',
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
}

beforeEach(() => {
  findUnique.mockReset()
  compareMock.mockReset()
  signAccessTokenMock.mockClear()
  signRefreshTokenMock.mockClear()
  verifyRefreshTokenMock.mockReset().mockReturnValue({ sub: 'user-1', iat: 0, exp: 1893456000 })
  refreshTokenCreateMock.mockReset().mockResolvedValue(undefined)
  refreshTokenUpdateManyMock.mockReset().mockResolvedValue({ count: 1 })
})

describe('signIn', () => {
  it('returns a session with tokens and a password-free user on valid credentials', async () => {
    findUnique.mockResolvedValue(activeUser)
    compareMock.mockResolvedValue(true)

    const session = await signIn('jane@example.com', 'correct-password')

    expect(session).toEqual({
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
        createdAt: activeUser.createdAt,
        updatedAt: activeUser.updatedAt,
      },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    })
    expect(findUnique).toHaveBeenCalledWith({ where: { email: 'jane@example.com' } })
    expect(signAccessTokenMock).toHaveBeenCalledWith('user-1')
    expect(signRefreshTokenMock).toHaveBeenCalledWith('user-1')
    expect(refreshTokenCreateMock).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        tokenHash: 'hashed-refresh-token',
        expiresAt: new Date(1893456000 * 1000),
      },
    })
  })

  it('throws INVALID_CREDENTIALS when no user matches the email', async () => {
    findUnique.mockResolvedValue(null)
    compareMock.mockResolvedValue(false)

    await expect(signIn('missing@example.com', 'whatever')).rejects.toMatchObject({
      message: AUTH_ERRORS.INVALID_CREDENTIALS,
      status: HttpStatus.UNAUTHORIZED,
    })
    await expect(signIn('missing@example.com', 'whatever')).rejects.toBeInstanceOf(AppError)
  })

  it('throws INVALID_CREDENTIALS when the password does not match', async () => {
    findUnique.mockResolvedValue(activeUser)
    compareMock.mockResolvedValue(false)

    await expect(signIn('jane@example.com', 'wrong-password')).rejects.toMatchObject({
      message: AUTH_ERRORS.INVALID_CREDENTIALS,
      status: HttpStatus.UNAUTHORIZED,
    })
  })

  it('still calls compare with the dummy hash when the user does not exist, to resist timing attacks', async () => {
    findUnique.mockResolvedValue(null)
    compareMock.mockResolvedValue(false)

    await expect(signIn('missing@example.com', 'whatever')).rejects.toThrow()
    expect(compareMock).toHaveBeenCalledWith('whatever', 'dummy-hash')
  })

  it('throws ACCOUNT_DISABLED when the user is inactive', async () => {
    findUnique.mockResolvedValue({ ...activeUser, isActive: false })
    compareMock.mockResolvedValue(true)

    await expect(signIn('jane@example.com', 'correct-password')).rejects.toMatchObject({
      message: AUTH_ERRORS.ACCOUNT_DISABLED,
      status: HttpStatus.UNAUTHORIZED,
    })
  })
})

describe('signOut', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does nothing when there is no refresh token', async () => {
    await expect(signOut(null)).resolves.toBeUndefined()
    expect(refreshTokenUpdateManyMock).not.toHaveBeenCalled()
  })

  it('revokes the refresh token by its hash', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-08T10:00:00.000Z'))

    await signOut('refresh-token')
    expect(refreshTokenUpdateManyMock).toHaveBeenCalledWith({
      where: { tokenHash: 'hashed-refresh-token', revokedAt: null },
      data: { revokedAt: new Date('2026-08-08T10:00:00.000Z') },
    })
  })

  it('wraps an unexpected DB failure into a generic AppError instead of leaking it', async () => {
    refreshTokenUpdateManyMock.mockRejectedValue(new Error('connection refused'))

    await expect(signOut('refresh-token')).rejects.toMatchObject({
      message: ERRORS.GENERIC.INTERNAL_SERVER_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    })
  })
})

describe('refresh', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('revokes the presented token, rotates the pair, and returns the new session', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-08T10:00:00.000Z'))
    findUnique.mockResolvedValue(activeUser)

    const session = await refresh('old-refresh-token')

    expect(session).toEqual({
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
        createdAt: activeUser.createdAt,
        updatedAt: activeUser.updatedAt,
      },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    })
    expect(refreshTokenUpdateManyMock).toHaveBeenCalledWith({
      where: { tokenHash: 'hashed-old-refresh-token', revokedAt: null },
      data: { revokedAt: new Date('2026-08-08T10:00:00.000Z') },
    })
    expect(refreshTokenCreateMock).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        tokenHash: 'hashed-refresh-token',
        expiresAt: new Date(1893456000 * 1000),
      },
    })
  })

  it('throws INVALID_TOKEN and mints nothing when the token was already used (reuse detection)', async () => {
    refreshTokenUpdateManyMock.mockResolvedValue({ count: 0 })

    await expect(refresh('old-refresh-token')).rejects.toMatchObject({
      message: ERRORS.AUTH.INVALID_TOKEN,
      status: HttpStatus.UNAUTHORIZED,
    })
    expect(findUnique).not.toHaveBeenCalled()
    expect(refreshTokenCreateMock).not.toHaveBeenCalled()
  })

  it('propagates the AppError from a malformed or expired token without touching the database', async () => {
    verifyRefreshTokenMock.mockImplementationOnce(() => {
      throw new AppError(ERRORS.GENERIC.UNAUTHORIZED, HttpStatus.UNAUTHORIZED, ErrorSeverity.WARN)
    })

    await expect(refresh('garbage-token')).rejects.toBeInstanceOf(AppError)
    expect(refreshTokenUpdateManyMock).not.toHaveBeenCalled()
  })

  it('still revokes the presented token even when the account has since been disabled', async () => {
    findUnique.mockResolvedValue({ ...activeUser, isActive: false })

    await expect(refresh('old-refresh-token')).rejects.toMatchObject({
      message: AUTH_ERRORS.ACCOUNT_DISABLED,
      status: HttpStatus.UNAUTHORIZED,
    })
    expect(refreshTokenUpdateManyMock).toHaveBeenCalled()
    expect(refreshTokenCreateMock).not.toHaveBeenCalled()
  })

  it('throws INVALID_TOKEN when the user tied to the token no longer exists', async () => {
    findUnique.mockResolvedValue(null)

    await expect(refresh('old-refresh-token')).rejects.toMatchObject({
      message: ERRORS.AUTH.INVALID_TOKEN,
      status: HttpStatus.UNAUTHORIZED,
    })
  })
})
