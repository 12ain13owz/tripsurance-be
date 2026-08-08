import { compare, hashSync } from 'bcryptjs'
import { prisma } from '@/core/database/prisma'
import { AppError, wrapUnexpected } from '@/core/error'
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from '@/core/security'
import type { User } from '@/generated/prisma/client'
import { ErrorSeverity, HttpStatus } from '@/shared/constants'
import { AUTH_ERRORS } from './auth.const'
import type { AuthSession, SafeUser } from './auth.type'

const SALT_ROUNDS = 10
const DUMMY_HASH = hashSync('timing-attack', SALT_ROUNDS)

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

const persistRefreshToken = async (userId: string, refreshToken: string): Promise<void> => {
  const { exp } = verifyRefreshToken(refreshToken)

  await wrapUnexpected(
    async () =>
      prisma.refreshToken.create({
        data: { userId, tokenHash: hashToken(refreshToken), expiresAt: new Date(exp * 1000) },
      }),
    { operation: 'login', metadata: { userId } }
  )
}

export const signIn = async (email: string, password: string): Promise<AuthSession> => {
  const user = await authenticateCredentials(email, password)

  const safeUser = toSafeUser(user)
  const accessToken = signAccessToken(user.id)
  const refreshToken = signRefreshToken(user.id)

  await persistRefreshToken(user.id, refreshToken)

  const data: AuthSession = {
    user: safeUser,
    accessToken,
    refreshToken,
  }

  return data
}

export const signOut = async (refreshToken: string | null): Promise<void> => {
  if (!refreshToken) {
    return
  }

  const refreshTokenHash = hashToken(refreshToken)
  await wrapUnexpected(
    async () =>
      prisma.refreshToken.updateMany({
        where: { tokenHash: refreshTokenHash },
        data: { revokedAt: new Date() },
      }),
    {
      operation: 'logout',
      metadata: { tokenHash: refreshTokenHash },
    }
  )
}
