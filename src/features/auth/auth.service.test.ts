import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/core/error'
import type { User } from '@/generated/prisma/client'
import { ERRORS, HttpStatus } from '@/shared/constants'
import { AUTH_ERRORS } from './auth.const'
import { signIn, signOut } from './auth.service'

const findUnique = vi.fn<(args: { where: { email: string } }) => Promise<User | null>>()
const compareMock = vi.fn<(password: string, hash: string) => Promise<boolean>>()
const signAccessTokenMock = vi.fn<(sub: string) => string>(() => 'access-token')
const signRefreshTokenMock = vi.fn<(sub: string) => string>(() => 'refresh-token')
const refreshTokenCreateMock =
  vi.fn<
    (args: { data: { userId: string; tokenHash: string; expiresAt: Date } }) => Promise<unknown>
  >()
const refreshTokenUpdateManyMock =
  vi.fn<
    (args: {
      where: { tokenHash: string }
      data: { revokedAt: Date }
    }) => Promise<{ count: number }>
  >()

vi.mock('@/core/database/prisma', () => ({
  prisma: {
    user: { findUnique: async (args: { where: { email: string } }) => findUnique(args) },
    refreshToken: {
      create: async (args: { data: { userId: string; tokenHash: string; expiresAt: Date } }) =>
        refreshTokenCreateMock(args),
      updateMany: async (args: { where: { tokenHash: string }; data: { revokedAt: Date } }) =>
        refreshTokenUpdateManyMock(args),
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
  verifyRefreshToken: () => ({ sub: 'user-1', iat: 0, exp: 1893456000 }),
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
      where: { tokenHash: 'hashed-refresh-token' },
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
