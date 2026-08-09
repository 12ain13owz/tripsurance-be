import { describe, expect, it } from 'vitest'
import { ERRORS } from '@/shared/constants'
import { AUTH_ERRORS } from './auth.const'
import { authSchema } from './auth.schema'

describe('authSchema.signIn', () => {
  it('accepts a valid email and a non-empty password', () => {
    const result = authSchema.signIn.body.safeParse({ email: 'jane@example.com', password: 'x' })
    expect(result.success).toBe(true)
  })

  it('does not enforce a minimum length on the sign-in password', () => {
    const result = authSchema.signIn.body.safeParse({ email: 'jane@example.com', password: 'a' })
    expect(result.success).toBe(true)
  })

  it('rejects a missing password', () => {
    const result = authSchema.signIn.body.safeParse({ email: 'jane@example.com' })
    expect(result.success).toBe(false)
  })

  it('rejects a malformed email', () => {
    const result = authSchema.signIn.body.safeParse({ email: 'not-an-email', password: 'x' })
    expect(result.success).toBe(false)
  })

  it('trims and lowercases the email', () => {
    const result = authSchema.signIn.body.safeParse({
      email: '  Jane@Example.com  ',
      password: 'x',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('jane@example.com')
    }
  })
})

describe('authSchema.changePassword', () => {
  const validBody = {
    currentPassword: 'CurrentPass1!',
    newPassword: 'NewStrong1!',
    confirmPassword: 'NewStrong1!',
  }

  it('accepts a valid payload', () => {
    const result = authSchema.changePassword.body.safeParse(validBody)
    expect(result.success).toBe(true)
  })

  it('does not enforce complexity or a minimum length on currentPassword', () => {
    const result = authSchema.changePassword.body.safeParse({ ...validBody, currentPassword: 'a' })
    expect(result.success).toBe(true)
  })

  it('does not enforce complexity on confirmPassword beyond matching newPassword', () => {
    const result = authSchema.changePassword.body.safeParse({
      currentPassword: 'CurrentPass1!',
      newPassword: 'NewStrong1!',
      confirmPassword: 'NewStrong1!',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a newPassword missing an uppercase letter, number, or special character', () => {
    const result = authSchema.changePassword.body.safeParse({
      ...validBody,
      newPassword: 'lowercaseonly',
      confirmPassword: 'lowercaseonly',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({
        message: ERRORS.UTIL.weakPassword('New Password'),
        path: ['newPassword'],
      })
    }
  })

  it('rejects when newPassword is the same as currentPassword, without also flagging a mismatch', () => {
    const result = authSchema.changePassword.body.safeParse({
      currentPassword: 'NewStrong1!',
      newPassword: 'NewStrong1!',
      confirmPassword: 'NewStrong1!',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1)
      expect(result.error.issues[0]).toMatchObject({
        message: AUTH_ERRORS.NEW_PASSWORD_SAME_AS_CURRENT,
        path: ['newPassword'],
      })
    }
  })

  it('rejects when confirmPassword does not match newPassword', () => {
    const result = authSchema.changePassword.body.safeParse({
      ...validBody,
      confirmPassword: 'Different1!',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({
        message: AUTH_ERRORS.PASSWORD_DO_NOT_MATCH,
        path: ['confirmPassword'],
      })
    }
  })
})

describe('authSchema.forgotPassword', () => {
  it('accepts a valid email', () => {
    const result = authSchema.forgotPassword.body.safeParse({ email: 'jane@example.com' })
    expect(result.success).toBe(true)
  })

  it('rejects a malformed email', () => {
    const result = authSchema.forgotPassword.body.safeParse({ email: 'not-an-email' })
    expect(result.success).toBe(false)
  })
})

describe('authSchema.resetPassword', () => {
  const validBody = {
    token: 'raw-reset-token',
    newPassword: 'NewStrong1!',
    confirmPassword: 'NewStrong1!',
  }

  it('accepts a valid payload', () => {
    const result = authSchema.resetPassword.body.safeParse(validBody)
    expect(result.success).toBe(true)
  })

  it('rejects a missing token', () => {
    const { token: _token, ...rest } = validBody
    const result = authSchema.resetPassword.body.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects a newPassword that fails the complexity rules', () => {
    const result = authSchema.resetPassword.body.safeParse({
      ...validBody,
      newPassword: 'weak',
      confirmPassword: 'weak',
    })
    expect(result.success).toBe(false)
  })

  it('rejects when confirmPassword does not match newPassword', () => {
    const result = authSchema.resetPassword.body.safeParse({
      ...validBody,
      confirmPassword: 'Different1!',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({
        message: AUTH_ERRORS.PASSWORD_DO_NOT_MATCH,
        path: ['confirmPassword'],
      })
    }
  })
})
