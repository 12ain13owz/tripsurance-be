import { z } from 'zod'
import { ERRORS } from '@/shared/constants'
import { AUTH_ERRORS } from './auth.const'

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/
const CUID_REGEX = /^[cC][0-9a-z]{6,}$/

const emailField = z
  .string({ error: ERRORS.UTIL.requiredField('Email') })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: ERRORS.UTIL.invalidField('email') }))

const passwordField = (label: string, { strong = false }: { strong?: boolean } = {}) => {
  const base = z.string({ error: ERRORS.UTIL.requiredField(label) })

  return strong
    ? base
        .min(8, ERRORS.UTIL.minLength(label, 8))
        .regex(STRONG_PASSWORD_REGEX, ERRORS.UTIL.weakPassword(label))
    : base
}

const signInSchema = z.object({
  email: emailField,
  password: passwordField('Password'),
})

const changePasswordSchema = z
  .object({
    currentPassword: passwordField('Current Password'),
    newPassword: passwordField('New Password', { strong: true }),
    confirmPassword: passwordField('Confirm Password'),
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: AUTH_ERRORS.NEW_PASSWORD_SAME_AS_CURRENT,
    path: ['newPassword'],
    abort: true,
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: AUTH_ERRORS.PASSWORD_DO_NOT_MATCH,
    path: ['confirmPassword'],
  })

const forgotPasswordSchema = z.object({
  email: emailField,
})

const resetPasswordSchema = z
  .object({
    token: z.string({ error: ERRORS.UTIL.requiredField('Token') }),
    newPassword: passwordField('New Password', { strong: true }),
    confirmPassword: passwordField('Confirm Password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: AUTH_ERRORS.PASSWORD_DO_NOT_MATCH,
    path: ['confirmPassword'],
  })

const revokeSessionSchema = z.object({
  id: z
    .string({ error: ERRORS.UTIL.requiredField('Session id') })
    .regex(CUID_REGEX, ERRORS.UTIL.invalidField('session id')),
})

export const authSchema = {
  signIn: { body: signInSchema },
  changePassword: { body: changePasswordSchema },
  forgotPassword: { body: forgotPasswordSchema },
  resetPassword: { body: resetPasswordSchema },
  revokeSession: { params: revokeSessionSchema },
} as const
