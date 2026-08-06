import { compare, hashSync } from 'bcryptjs'
import { prisma } from '@/core/database/prisma'
import { AppError } from '@/core/error'
import { signAccessToken, signRefreshToken } from '@/core/security'
import type { User } from '@/generated/prisma/client'
import { ErrorSeverity, HttpStatus } from '@/shared/constants'
import { AUTH_ERRORS } from './auth.const'
import type { AuthSession, SafeUser } from './auth.type'

const SALT_ROUNDS = 10
const DUMMY_HASH = hashSync('timing-attack', SALT_ROUNDS)

const authenticateCredentials = async (email: string, password: string): Promise<User> => {
  const user = await prisma.user.findUnique({
    where: { email: email },
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

export const login = async (email: string, password: string): Promise<AuthSession> => {
  const user = await authenticateCredentials(email, password)

  const safeUser = toSafeUser(user)
  const accessToken = signAccessToken(user.id)
  const refreshToken = signRefreshToken(user.id)

  const data: AuthSession = {
    user: safeUser,
    accessToken,
    refreshToken,
  }

  return data
}
