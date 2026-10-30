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
import type { AuthSession, SafeUser, SessionSummary } from './auth.type'

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
  const query = prisma.user.findUnique({ where: { email } })
  const user = await wrapUnexpected(query, 'login', { email })

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
  const query = prisma.user.findUnique({ where: { id: userId } })
  const user = await wrapUnexpected(query, operation, { userId })

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
  const query = prisma.user.findUnique({ where: { email } })
  const user = await wrapUnexpected(query, operation, { email })

  return user
}

const persistRefreshToken = async (
  userId: string,
  refreshToken: string,
  operation: string
): Promise<void> => {
  const { exp } = verifyRefreshToken(refreshToken)
  const query = prisma.refreshToken.create({
    data: { userId, tokenHash: hashToken(refreshToken), expiresAt: new Date(exp * 1000) },
  })

  await wrapUnexpected(query, operation, { userId })
}

const revokeRefreshToken = async (refreshToken: string, operation: string): Promise<boolean> => {
  const tokenHash = hashToken(refreshToken)
  const query = prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  const { count } = await wrapUnexpected(query, operation, { tokenHash })

  return count > 0
}

const revokeOtherRefreshTokens = async (
  userId: string,
  currentToken: string | null,
  operation: string
): Promise<void> => {
  const currentTokenHash = currentToken ? hashToken(currentToken) : null
  const query = prisma.refreshToken.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(currentTokenHash ? { tokenHash: { not: currentTokenHash } } : {}),
    },
    data: { revokedAt: new Date() },
  })

  await wrapUnexpected(query, operation, { userId })
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
  newPassword: string,
  currentToken: string | null
): Promise<void> => {
  const user = await findUserById(userId, 'changePassword')
  const passwordMatch = await compare(currentPassword, user.password)

  if (!passwordMatch) {
    throw new AppError(
      AUTH_ERRORS.INVALID_CURRENT_PASSWORD,
      HttpStatus.BAD_REQUEST,
      ErrorSeverity.WARN
    )
      .withOperation('changePassword')
      .withMetadata({ userId })
  }

  const passwordHash = await hash(newPassword, SALT_ROUNDS)
  const query = prisma.user.update({ where: { id: user.id }, data: { password: passwordHash } })
  await wrapUnexpected(query, 'changePassword', { userId })
  await revokeOtherRefreshTokens(userId, currentToken, 'changePassword')
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

  const query = prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hashToken(rawToken), expiresAt },
  })
  await wrapUnexpected(query, 'forgotPassword', { userId: user.id })

  const resetUrl = `${env.FRONTEND_URL}/admin/reset-password?token=${rawToken}`
  const { subject, html } = passwordResetEmail({
    resetUrl,
    token: rawToken,
    expiresInMinutes: Math.round(expiresInMs / 60_000),
  })

  await sendMail({ to: user.email, subject, html })
}

export const resetPassword = async (token: string, newPassword: string): Promise<AuthSession> => {
  const tokenHash = hashToken(token)
  const passwordResetTokenQuery = prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  })
  const passwordResetToken = await wrapUnexpected(passwordResetTokenQuery, 'resetPassword', {
    tokenHash,
  })

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
  const updatePasswordQuery = prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { password: passwordHash } })
    await tx.passwordResetToken.update({ where: { tokenHash }, data: { usedAt: new Date() } })
    await tx.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    })
  })
  await wrapUnexpected(updatePasswordQuery, 'resetPassword', { userId: user.id })

  const accessToken = signAccessToken(user.id)
  const refreshToken = signRefreshToken(user.id)
  await persistRefreshToken(user.id, refreshToken, 'resetPassword')

  const data: AuthSession = { user: toSafeUser(user), accessToken, refreshToken }
  return data
}

export const listSessions = async (
  userId: string,
  currentToken: string | null
): Promise<SessionSummary[]> => {
  const currentTokenHash = currentToken ? hashToken(currentToken) : null
  const query = prisma.refreshToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })
  const sessions = await wrapUnexpected(query, 'listSessions', { userId })

  const data: SessionSummary[] = sessions.map((session) => ({
    id: session.id,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
    isCurrent: session.tokenHash === currentTokenHash,
  }))

  return data
}

export const revokeSession = async (userId: string, sessionId: string): Promise<void> => {
  const query = prisma.refreshToken.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  const { count } = await wrapUnexpected(query, 'revokeSession', { userId, sessionId })

  if (count === 0) {
    throw new AppError(AUTH_ERRORS.SESSION_NOT_FOUND, HttpStatus.NOT_FOUND, ErrorSeverity.WARN)
      .withOperation('revokeSession')
      .withMetadata({ userId, sessionId })
  }
}

export const revokeOtherSessions = async (
  userId: string,
  currentToken: string | null
): Promise<void> => {
  await revokeOtherRefreshTokens(userId, currentToken, 'revokeOtherSessions')
}

export const cleanupExpiredTokens = async (
  retentionMs: number
): Promise<{
  refreshTokens: number
  passwordResetTokens: number
}> => {
  const cutoff = new Date(Date.now() - retentionMs)
  const query = prisma.$transaction([
    prisma.refreshToken.deleteMany({
      where: { OR: [{ revokedAt: { lt: cutoff } }, { expiresAt: { lt: cutoff } }] },
    }),
    prisma.passwordResetToken.deleteMany({
      where: { OR: [{ usedAt: { lt: cutoff } }, { expiresAt: { lt: cutoff } }] },
    }),
  ])
  const [refreshTokens, passwordResetTokens] = await wrapUnexpected(query, 'cleanupExpiredTokens')

  return { refreshTokens: refreshTokens.count, passwordResetTokens: passwordResetTokens.count }
}
