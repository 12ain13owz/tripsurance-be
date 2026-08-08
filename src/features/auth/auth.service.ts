import { compare, hashSync } from 'bcryptjs'
import { prisma } from '@/core/database/prisma'
import { AppError, wrapUnexpected } from '@/core/error'
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from '@/core/security'
import type { User } from '@/generated/prisma/client'
import { ERRORS, ErrorSeverity, HttpStatus } from '@/shared/constants'
import { AUTH_ERRORS } from './auth.const'
import type { AuthSession, SafeUser } from './auth.type'

const SALT_ROUNDS = 10
const DUMMY_HASH = hashSync('timing-attack', SALT_ROUNDS)

// ------------------------------------------------------------------------------
// Helpers (not exported)
// TODO: move to a separate file if this list keeps growing
// ------------------------------------------------------------------------------

const authenticateCredentials = async (email: string, password: string): Promise<User> => {
  const user = await wrapUnexpected(async () => prisma.user.findUnique({ where: { email } }), {
    operation: 'login',
    metadata: { email },
  })

  const passwordMatch = await compare(password, user?.password ?? DUMMY_HASH)

  if (!user) {
    throw new AppError(AUTH_ERRORS.INVALID_CREDENTIALS, HttpStatus.UNAUTHORIZED, ErrorSeverity.WARN)
      .withOperation('login')
      .withMetadata({ email })
  }

  if (!passwordMatch) {
    throw new AppError(AUTH_ERRORS.INVALID_CREDENTIALS, HttpStatus.UNAUTHORIZED, ErrorSeverity.WARN)
      .withOperation('login')
      .withMetadata({ email })
  }

  if (!user.isActive) {
    throw new AppError(AUTH_ERRORS.ACCOUNT_DISABLED, HttpStatus.UNAUTHORIZED, ErrorSeverity.WARN)
      .withOperation('login')
      .withMetadata({ email })
  }

  return user
}

const toSafeUser = (user: User): SafeUser => {
  const { password: _password, ...safeUser } = user
  return safeUser
}

const findUserById = async (userId: string, operation: string): Promise<User> => {
  const user = await wrapUnexpected(async () => prisma.user.findUnique({ where: { id: userId } }), {
    operation: operation,
    metadata: { userId },
  })

  if (!user) {
    throw invalidToken(operation)
  }

  if (!user.isActive) {
    throw new AppError(AUTH_ERRORS.ACCOUNT_DISABLED, HttpStatus.UNAUTHORIZED, ErrorSeverity.WARN)
      .withOperation(operation)
      .withMetadata({ userId })
  }

  return user
}

const persistRefreshToken = async (
  userId: string,
  refreshToken: string,
  operation: string
): Promise<void> => {
  const { exp } = verifyRefreshToken(refreshToken)

  await wrapUnexpected(
    async () =>
      prisma.refreshToken.create({
        data: { userId, tokenHash: hashToken(refreshToken), expiresAt: new Date(exp * 1000) },
      }),
    { operation, metadata: { userId } }
  )
}

const revokeRefreshToken = async (refreshToken: string, operation: string): Promise<boolean> => {
  const tokenHash = hashToken(refreshToken)
  const { count } = await wrapUnexpected(
    async () =>
      prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    { operation, metadata: { tokenHash } }
  )

  return count > 0
}

const invalidToken = (operation: string): AppError =>
  new AppError(
    ERRORS.AUTH.INVALID_TOKEN,
    HttpStatus.UNAUTHORIZED,
    ErrorSeverity.WARN
  ).withOperation(operation)

// ------------------------------------------------------------------------------
// * Exported
// ------------------------------------------------------------------------------

export const signIn = async (email: string, password: string): Promise<AuthSession> => {
  const user = await authenticateCredentials(email, password)
  const accessToken = signAccessToken(user.id)
  const refreshToken = signRefreshToken(user.id)
  await persistRefreshToken(user.id, refreshToken, 'signIn')

  const data: AuthSession = {
    user: toSafeUser(user),
    accessToken,
    refreshToken,
  }

  return data
}

export const signOut = async (refreshToken: string | null): Promise<void> => {
  if (!refreshToken) {
    return
  }

  await revokeRefreshToken(refreshToken, 'logout')
}

export const refresh = async (refreshToken: string): Promise<AuthSession> => {
  const { sub: userId } = verifyRefreshToken(refreshToken)

  if (!userId) {
    throw invalidToken('refresh')
  }

  const revoked = await revokeRefreshToken(refreshToken, 'refresh')
  if (!revoked) {
    throw invalidToken('refresh')
  }

  const user = await findUserById(userId, 'refresh')
  const newAccessToken = signAccessToken(userId)
  const newRefreshToken = signRefreshToken(userId)
  await persistRefreshToken(userId, newRefreshToken, 'refresh')

  const data: AuthSession = {
    user: toSafeUser(user),
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  }

  return data
}

export const getProfile = async (userId: string) => {
  const user = await findUserById(userId, 'getProfile')
  return toSafeUser(user)
}
