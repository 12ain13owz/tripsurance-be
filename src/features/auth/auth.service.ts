import { compare, hash, hashSync } from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { env } from '@/core/config'
import { prisma } from '@/core/database/prisma'
import { AppError, wrapUnexpected } from '@/core/error'
import { sendMail } from '@/core/mailer'
import { passwordResetEmail } from '@/core/mailer/templates'
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from '@/core/security'
import type { User } from '@/generated/prisma/client'
import { ERRORS, ErrorSeverity, HttpStatus } from '@/shared/constants'
import { parseDuration } from '@/shared/utils'
import { AUTH_ERRORS } from './auth.const'
import type { AuthSession, SafeUser } from './auth.type'

const SALT_ROUNDS = 10
const DUMMY_HASH = hashSync('timing-attack', SALT_ROUNDS)
const RESET_TOKEN_BYTES = 32
const DUMMY_SEND_DELAY_MS = 400
const sleep = async (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

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

const findUserByEmail = async (email: string, operation: string): Promise<User | null> => {
  return wrapUnexpected(async () => prisma.user.findUnique({ where: { email } }), {
    operation,
    metadata: { email },
  })
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

export const getProfile = async (userId: string): Promise<SafeUser> => {
  const user = await findUserById(userId, 'getProfile')
  return toSafeUser(user)
}

export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string
) => {
  const user = await findUserById(userId, 'changePassword')

  const passwordMatch = await compare(currentPassword, user.password)
  if (!passwordMatch) {
    throw new AppError(
      AUTH_ERRORS.INVALID_CURRENT_PASSWORD,
      HttpStatus.UNAUTHORIZED,
      ErrorSeverity.WARN
    )
      .withOperation('changePassword')
      .withMetadata({ userId })
  }

  const passwordHash = await hash(newPassword, SALT_ROUNDS)
  await prisma.user.update({ where: { id: user.id }, data: { password: passwordHash } })
}

export const forgotPassword = async (email: string) => {
  const user = await findUserByEmail(email, 'forgotPassword')

  if (!user) {
    await sleep(DUMMY_SEND_DELAY_MS)
    return
  }

  const rawToken = randomBytes(RESET_TOKEN_BYTES).toString('hex')
  const expiresInMs = parseDuration(env.RESET_TOKEN_EXPIRES)
  const expiresAt = new Date(Date.now() + expiresInMs)

  await wrapUnexpected(
    async () =>
      prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt },
      }),
    { operation: 'forgotPassword', metadata: { userId: user.id } }
  )

  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${rawToken}`
  const { subject, html } = passwordResetEmail({
    resetUrl,
    token: rawToken,
    expiresInMinutes: Math.round(expiresInMs / 60_000),
  })

  await sendMail({ to: user.email, subject, html })
}

export const resetPassword = async (token: string, newPassword: string): Promise<void> => {
  const tokenHash = hashToken(token)
  const passwordResetToken = await wrapUnexpected(
    async () =>
      prisma.passwordResetToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      }),
    { operation: 'resetPassword', metadata: { tokenHash } }
  )

  if (!passwordResetToken) {
    throw invalidToken('resetPassword')
  }

  if (passwordResetToken.usedAt) {
    throw invalidToken('resetPassword')
  }

  const expiresInMs = passwordResetToken.expiresAt.getTime() - Date.now()
  if (expiresInMs < 0) {
    throw new AppError(
      AUTH_ERRORS.RESET_TOKEN_EXPIRED,
      HttpStatus.UNAUTHORIZED,
      ErrorSeverity.WARN
    ).withOperation('resetPassword')
  }

  const user = passwordResetToken.user
  const passwordHash = await hash(newPassword, SALT_ROUNDS)

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { password: passwordHash },
    })
    await tx.passwordResetToken.update({
      where: { tokenHash },
      data: { usedAt: new Date() },
    })
    await tx.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  })
}

export const cleanupExpiredTokens = async (): Promise<{
  refreshTokens: number
  passwordResetTokens: number
}> => {
  const now = new Date()

  const [refreshTokens, passwordResetTokens] = await wrapUnexpected(
    async () =>
      prisma.$transaction([
        prisma.refreshToken.deleteMany({
          where: { OR: [{ revokedAt: { not: null } }, { expiresAt: { lt: now } }] },
        }),
        prisma.passwordResetToken.deleteMany({
          where: { OR: [{ usedAt: { not: null } }, { expiresAt: { lt: now } }] },
        }),
      ]),
    { operation: 'cleanupExpiredTokens' }
  )

  return { refreshTokens: refreshTokens.count, passwordResetTokens: passwordResetTokens.count }
}
