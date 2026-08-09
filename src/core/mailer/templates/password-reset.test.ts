import { describe, expect, it } from 'vitest'
import { passwordResetEmail } from './password-reset'

describe('passwordResetEmail', () => {
  const params = {
    resetUrl: 'http://localhost:4000/reset-password?token=raw-token-value',
    token: 'raw-token-value',
    expiresInMinutes: 30,
  }

  it('returns a non-empty subject', () => {
    const { subject } = passwordResetEmail(params)
    expect(subject).toBe('Reset your password')
  })

  it('includes the reset link as the button href', () => {
    const { html } = passwordResetEmail(params)
    expect(html).toContain(`href="${params.resetUrl}"`)
  })

  it('includes the raw token as manually copyable text', () => {
    const { html } = passwordResetEmail(params)
    expect(html).toContain(params.token)
  })

  it('includes the expiry time in minutes', () => {
    const { html } = passwordResetEmail(params)
    expect(html).toContain('30 minutes')
  })
})
