import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from '@/core/config'
import { AppError } from '@/core/error'
import type { User } from '@/generated/prisma/client'
import { ERRORS, ErrorSeverity, HttpStatus } from '@/shared/constants'
import { AUTH_ERRORS } from './auth.const'
import {
  changePassword,
  cleanupExpiredTokens,
  forgotPassword,
  getProfile,
  listSessions,
  refresh,
  resetPassword,
  revokeOtherSessions,
  revokeSession,
  signIn,
  signOut,
} from './auth.service'

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
      where: { tokenHash?: string; userId?: string; id?: string; revokedAt: null }
      data: { revokedAt: Date }
    }) => Promise<{ count: number }>
  >()
const refreshTokenFindManyMock =
  vi.fn<
    (args: {
      where: { userId: string; revokedAt: null; expiresAt: { gt: Date } }
      orderBy: { createdAt: 'desc' }
    }) => Promise<{ id: string; tokenHash: string; createdAt: Date; expiresAt: Date }[]>
  >()
const hashMock = vi.fn<(password: string, saltRounds: number) => Promise<string>>()
const userUpdateMock =
  vi.fn<(args: { where: { id: string }; data: { password: string } }) => Promise<unknown>>()
const passwordResetTokenCreateMock =
  vi.fn<
    (args: { data: { userId: string; tokenHash: string; expiresAt: Date } }) => Promise<unknown>
  >()
const passwordResetTokenFindUniqueMock =
  vi.fn<(args: { where: { tokenHash: string } }) => Promise<unknown>>()
const passwordResetTokenUpdateMock =
  vi.fn<(args: { where: { tokenHash: string }; data: { usedAt: Date } }) => Promise<unknown>>()
const refreshTokenDeleteManyMock = vi.fn<() => Promise<{ count: number }>>()
const passwordResetTokenDeleteManyMock = vi.fn<() => Promise<{ count: number }>>()
const sendMailMock = vi.fn<(args: { to: string; subject: string; html: string }) => Promise<void>>()
const passwordResetEmailMock = vi.fn<
  (args: { resetUrl: string; token: string; expiresInMinutes: number }) => {
    subject: string
    html: string
  }
>()

const txClient = {
  user: { update: userUpdateMock },
  passwordResetToken: { update: passwordResetTokenUpdateMock },
  refreshToken: { updateMany: refreshTokenUpdateManyMock },
}
const transactionMock = vi.fn(async (arg: unknown) => {
  if (typeof arg === 'function') {
    return (arg as (tx: typeof txClient) => Promise<unknown>)(txClient)
  }
  return Promise.all(arg as Promise<unknown>[])
})

vi.mock('@/core/database/prisma', () => ({
  prisma: {
    user: {
      findUnique: async (args: { where: { email: string } | { id: string } }) => findUnique(args),
      update: async (args: { where: { id: string }; data: { password: string } }) =>
        userUpdateMock(args),
    },
    refreshToken: {
      create: async (args: { data: { userId: string; tokenHash: string; expiresAt: Date } }) =>
        refreshTokenCreateMock(args),
      updateMany: async (args: {
        where: { tokenHash?: string; userId?: string; id?: string; revokedAt: null }
        data: { revokedAt: Date }
      }) => refreshTokenUpdateManyMock(args),
      findMany: async (args: {
        where: { userId: string; revokedAt: null; expiresAt: { gt: Date } }
        orderBy: { createdAt: 'desc' }
      }) => refreshTokenFindManyMock(args),
      deleteMany: async () => refreshTokenDeleteManyMock(),
    },
    passwordResetToken: {
      create: async (args: { data: { userId: string; tokenHash: string; expiresAt: Date } }) =>
        passwordResetTokenCreateMock(args),
      findUnique: async (args: { where: { tokenHash: string } }) =>
        passwordResetTokenFindUniqueMock(args),
      update: async (args: { where: { tokenHash: string }; data: { usedAt: Date } }) =>
        passwordResetTokenUpdateMock(args),
      deleteMany: async () => passwordResetTokenDeleteManyMock(),
    },
    $transaction: async (arg: unknown) => transactionMock(arg),
  },
}))

vi.mock('bcryptjs', () => ({
  compare: async (password: string, hash: string) => compareMock(password, hash),
  hash: async (password: string, saltRounds: number) => hashMock(password, saltRounds),
  hashSync: () => 'dummy-hash',
}))

vi.mock('@/core/security', () => ({
  signAccessToken: (sub: string) => signAccessTokenMock(sub),
  signRefreshToken: (sub: string) => signRefreshTokenMock(sub),
  verifyRefreshToken: (token: string) => verifyRefreshTokenMock(token),
  hashToken: (token: string) => `hashed-${token}`,
}))

vi.mock('@/core/mailer', () => ({
  sendMail: async (args: { to: string; subject: string; html: string }) => sendMailMock(args),
}))

vi.mock('@/core/mailer/templates', () => ({
  passwordResetEmail: (args: { resetUrl: string; token: string; expiresInMinutes: number }) =>
    passwordResetEmailMock(args),
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
  refreshTokenFindManyMock.mockReset().mockResolvedValue([])
  hashMock.mockReset().mockResolvedValue('hashed-new-password')
  userUpdateMock.mockReset().mockResolvedValue(undefined)
  passwordResetTokenCreateMock.mockReset().mockResolvedValue(undefined)
  passwordResetTokenFindUniqueMock.mockReset()
  passwordResetTokenUpdateMock.mockReset().mockResolvedValue(undefined)
  refreshTokenDeleteManyMock.mockReset().mockResolvedValue({ count: 0 })
  passwordResetTokenDeleteManyMock.mockReset().mockResolvedValue({ count: 0 })
  sendMailMock.mockReset().mockResolvedValue(undefined)
  passwordResetEmailMock
    .mockReset()
    .mockReturnValue({ subject: 'Reset your password', html: '<html/>' })
  transactionMock.mockClear()
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

describe('getProfile', () => {
  it('returns the password-free profile for an existing, active user', async () => {
    findUnique.mockResolvedValue(activeUser)

    const profile = await getProfile('user-1')
    expect(profile).toEqual({
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
    })
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' } })
  })

  it('throws INVALID_TOKEN when the user id no longer matches an existing user', async () => {
    findUnique.mockResolvedValue(null)

    await expect(getProfile('deleted-user')).rejects.toMatchObject({
      message: ERRORS.AUTH.INVALID_TOKEN,
      status: HttpStatus.UNAUTHORIZED,
    })
  })

  it('throws ACCOUNT_DISABLED when the user has been deactivated', async () => {
    findUnique.mockResolvedValue({ ...activeUser, isActive: false })

    await expect(getProfile('user-1')).rejects.toMatchObject({
      message: AUTH_ERRORS.ACCOUNT_DISABLED,
      status: HttpStatus.UNAUTHORIZED,
    })
  })
})

describe('revokeOtherSessions', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('revokes every active session except the one matching currentToken', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-08T10:00:00.000Z'))

    await revokeOtherSessions('user-1', 'refresh-token')

    expect(refreshTokenUpdateManyMock).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null, tokenHash: { not: 'hashed-refresh-token' } },
      data: { revokedAt: new Date('2026-08-08T10:00:00.000Z') },
    })
  })

  it('revokes every active session with no exclusion when currentToken is null', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-08T10:00:00.000Z'))

    await revokeOtherSessions('user-1', null)

    expect(refreshTokenUpdateManyMock).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: new Date('2026-08-08T10:00:00.000Z') },
    })
  })

  it('wraps an unexpected DB failure into a generic AppError instead of leaking it', async () => {
    refreshTokenUpdateManyMock.mockRejectedValue(new Error('connection refused'))

    await expect(revokeOtherSessions('user-1', 'refresh-token')).rejects.toMatchObject({
      message: ERRORS.GENERIC.INTERNAL_SERVER_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    })
  })
})

describe('changePassword', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('hashes and saves the new password, and revokes every other session, when the current password matches', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-08T10:00:00.000Z'))
    findUnique.mockResolvedValue(activeUser)
    compareMock.mockResolvedValue(true)

    await changePassword('user-1', 'correct-current', 'NewStrong1!', 'refresh-token')

    expect(compareMock).toHaveBeenCalledWith('correct-current', activeUser.password)
    expect(hashMock).toHaveBeenCalledWith('NewStrong1!', 10)
    expect(userUpdateMock).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { password: 'hashed-new-password' },
    })
    expect(refreshTokenUpdateManyMock).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null, tokenHash: { not: 'hashed-refresh-token' } },
      data: { revokedAt: new Date('2026-08-08T10:00:00.000Z') },
    })
  })

  it('throws INVALID_CURRENT_PASSWORD and does not touch the DB when the current password is wrong', async () => {
    findUnique.mockResolvedValue(activeUser)
    compareMock.mockResolvedValue(false)

    await expect(
      changePassword('user-1', 'wrong-current', 'NewStrong1!', 'refresh-token')
    ).rejects.toMatchObject({
      message: AUTH_ERRORS.INVALID_CURRENT_PASSWORD,
      status: HttpStatus.UNAUTHORIZED,
    })
    expect(userUpdateMock).not.toHaveBeenCalled()
  })

  it('throws INVALID_TOKEN when the user id no longer matches an existing user', async () => {
    findUnique.mockResolvedValue(null)

    await expect(changePassword('deleted-user', 'x', 'NewStrong1!', null)).rejects.toMatchObject({
      message: ERRORS.AUTH.INVALID_TOKEN,
      status: HttpStatus.UNAUTHORIZED,
    })
  })

  it('throws ACCOUNT_DISABLED when the user has been deactivated', async () => {
    findUnique.mockResolvedValue({ ...activeUser, isActive: false })

    await expect(changePassword('user-1', 'x', 'NewStrong1!', null)).rejects.toMatchObject({
      message: AUTH_ERRORS.ACCOUNT_DISABLED,
      status: HttpStatus.UNAUTHORIZED,
    })
  })
})

describe('forgotPassword', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates a hashed reset token and emails the user when the email matches an account', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-08T10:00:00.000Z'))
    findUnique.mockResolvedValue(activeUser)

    await forgotPassword('jane@example.com')

    expect(passwordResetTokenCreateMock).toHaveBeenCalledTimes(1)
    const createArgs = passwordResetTokenCreateMock.mock.calls[0][0]
    const emailArgs = passwordResetEmailMock.mock.calls[0][0]

    expect(createArgs.data.userId).toBe('user-1')
    expect(createArgs.data.tokenHash).toBe(`hashed-${emailArgs.token}`)
    expect(createArgs.data.expiresAt).toEqual(new Date('2026-08-08T10:30:00.000Z'))
    expect(emailArgs.resetUrl).toBe(`${env.FRONTEND_URL}/reset-password?token=${emailArgs.token}`)
    expect(emailArgs.expiresInMinutes).toBe(30)
    expect(sendMailMock).toHaveBeenCalledWith({
      to: 'jane@example.com',
      subject: 'Reset your password',
      html: '<html/>',
    })
  })

  it('does nothing but still resolves when no account matches the email (anti-enumeration)', async () => {
    vi.useFakeTimers()
    findUnique.mockResolvedValue(null)

    const pending = forgotPassword('missing@example.com')
    await vi.advanceTimersByTimeAsync(400)
    await expect(pending).resolves.toBeUndefined()

    expect(passwordResetTokenCreateMock).not.toHaveBeenCalled()
    expect(sendMailMock).not.toHaveBeenCalled()
  })
})

describe('resetPassword', () => {
  const resetToken = {
    id: 'reset-1',
    userId: 'user-1',
    tokenHash: 'hashed-raw-token',
    expiresAt: new Date('2026-08-08T11:00:00.000Z'),
    usedAt: null as Date | null,
    createdAt: new Date('2026-08-08T10:00:00.000Z'),
    user: activeUser,
  }

  afterEach(() => {
    vi.useRealTimers()
  })

  it('throws INVALID_TOKEN when no reset token matches the hash', async () => {
    passwordResetTokenFindUniqueMock.mockResolvedValue(null)

    await expect(resetPassword('raw-token', 'NewStrong1!')).rejects.toMatchObject({
      message: ERRORS.AUTH.INVALID_TOKEN,
      status: HttpStatus.UNAUTHORIZED,
    })
  })

  it('throws INVALID_TOKEN when the token has already been used (single-use enforcement)', async () => {
    passwordResetTokenFindUniqueMock.mockResolvedValue({
      ...resetToken,
      usedAt: new Date('2026-08-08T10:05:00.000Z'),
    })

    await expect(resetPassword('raw-token', 'NewStrong1!')).rejects.toMatchObject({
      message: ERRORS.AUTH.INVALID_TOKEN,
      status: HttpStatus.UNAUTHORIZED,
    })
    expect(userUpdateMock).not.toHaveBeenCalled()
  })

  it('throws RESET_TOKEN_EXPIRED and does not touch the DB when the token has expired', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-08T12:00:00.000Z'))
    passwordResetTokenFindUniqueMock.mockResolvedValue(resetToken)

    await expect(resetPassword('raw-token', 'NewStrong1!')).rejects.toMatchObject({
      message: AUTH_ERRORS.RESET_TOKEN_EXPIRED,
      status: HttpStatus.UNAUTHORIZED,
    })
    expect(userUpdateMock).not.toHaveBeenCalled()
  })

  it('updates the password, marks the token used, revokes every refresh token, and returns a fresh session', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-08T10:30:00.000Z'))
    passwordResetTokenFindUniqueMock.mockResolvedValue(resetToken)

    const result = await resetPassword('raw-token', 'NewStrong1!')

    expect(userUpdateMock).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { password: 'hashed-new-password' },
    })
    expect(passwordResetTokenUpdateMock).toHaveBeenCalledWith({
      where: { tokenHash: 'hashed-raw-token' },
      data: { usedAt: new Date('2026-08-08T10:30:00.000Z') },
    })
    expect(refreshTokenUpdateManyMock).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: new Date('2026-08-08T10:30:00.000Z') },
    })
    expect(signAccessTokenMock).toHaveBeenCalledWith('user-1')
    expect(signRefreshTokenMock).toHaveBeenCalledWith('user-1')
    expect(refreshTokenCreateMock).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        tokenHash: 'hashed-refresh-token',
        expiresAt: new Date(1893456000 * 1000),
      },
    })
    expect(result).toEqual({
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
  })
})

describe('listSessions', () => {
  const sessionRows = [
    {
      id: 'session-1',
      tokenHash: 'hashed-refresh-token',
      createdAt: new Date('2026-08-08T09:00:00.000Z'),
      expiresAt: new Date('2026-08-09T09:00:00.000Z'),
    },
    {
      id: 'session-2',
      tokenHash: 'hashed-other-device-token',
      createdAt: new Date('2026-08-07T09:00:00.000Z'),
      expiresAt: new Date('2026-08-10T09:00:00.000Z'),
    },
  ]

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns every active session with isCurrent flagged for the one matching currentToken', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-08T10:00:00.000Z'))
    refreshTokenFindManyMock.mockResolvedValue(sessionRows)

    const sessions = await listSessions('user-1', 'refresh-token')

    expect(refreshTokenFindManyMock).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        revokedAt: null,
        expiresAt: { gt: new Date('2026-08-08T10:00:00.000Z') },
      },
      orderBy: { createdAt: 'desc' },
    })
    expect(sessions).toEqual([
      {
        id: 'session-1',
        createdAt: sessionRows[0].createdAt,
        expiresAt: sessionRows[0].expiresAt,
        isCurrent: true,
      },
      {
        id: 'session-2',
        createdAt: sessionRows[1].createdAt,
        expiresAt: sessionRows[1].expiresAt,
        isCurrent: false,
      },
    ])
  })

  it('flags every session as not current when currentToken is null', async () => {
    refreshTokenFindManyMock.mockResolvedValue(sessionRows)

    const sessions = await listSessions('user-1', null)

    expect(sessions.every((session) => !session.isCurrent)).toBe(true)
  })

  it('wraps an unexpected DB failure into a generic AppError instead of leaking it', async () => {
    refreshTokenFindManyMock.mockRejectedValue(new Error('connection refused'))

    await expect(listSessions('user-1', null)).rejects.toMatchObject({
      message: ERRORS.GENERIC.INTERNAL_SERVER_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    })
  })
})

describe('revokeSession', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('revokes the session when it exists and belongs to the requesting user', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-08T10:00:00.000Z'))
    refreshTokenUpdateManyMock.mockResolvedValue({ count: 1 })

    await expect(revokeSession('user-1', 'session-1')).resolves.toBeUndefined()
    expect(refreshTokenUpdateManyMock).toHaveBeenCalledWith({
      where: { id: 'session-1', userId: 'user-1', revokedAt: null },
      data: { revokedAt: new Date('2026-08-08T10:00:00.000Z') },
    })
  })

  it('throws SESSION_NOT_FOUND when the session does not exist or belongs to another user', async () => {
    refreshTokenUpdateManyMock.mockResolvedValue({ count: 0 })

    await expect(revokeSession('user-1', 'someone-elses-session')).rejects.toMatchObject({
      message: AUTH_ERRORS.SESSION_NOT_FOUND,
      status: HttpStatus.NOT_FOUND,
    })
  })

  it('wraps an unexpected DB failure into a generic AppError instead of leaking it', async () => {
    refreshTokenUpdateManyMock.mockRejectedValue(new Error('connection refused'))

    await expect(revokeSession('user-1', 'session-1')).rejects.toMatchObject({
      message: ERRORS.GENERIC.INTERNAL_SERVER_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    })
  })
})

describe('cleanupExpiredTokens', () => {
  it('deletes expired/revoked refresh tokens and expired/used reset tokens, returning counts', async () => {
    refreshTokenDeleteManyMock.mockResolvedValue({ count: 3 })
    passwordResetTokenDeleteManyMock.mockResolvedValue({ count: 2 })

    const result = await cleanupExpiredTokens()

    expect(result).toEqual({ refreshTokens: 3, passwordResetTokens: 2 })
  })

  it('wraps an unexpected DB failure into a generic AppError instead of leaking it', async () => {
    refreshTokenDeleteManyMock.mockRejectedValue(new Error('connection refused'))

    await expect(cleanupExpiredTokens()).rejects.toMatchObject({
      message: ERRORS.GENERIC.INTERNAL_SERVER_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    })
  })
})
