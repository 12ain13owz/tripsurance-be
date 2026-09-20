import jwt from 'jsonwebtoken'
import { describe, expect, it } from 'vitest'
import { env } from '@/core/config'
import { AppError } from '@/core/error'
import { HttpStatus } from '@/shared/constants'
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from './jwt'

describe('signAccessToken / verifyAccessToken', () => {
  it('round-trips the subject and includes numeric iat/exp claims', () => {
    const token = signAccessToken('user-1')
    const payload = verifyAccessToken(token)

    expect(payload.sub).toBe('user-1')
    expect(typeof payload.iat).toBe('number')
    expect(typeof payload.exp).toBe('number')
  })

  it('throws a 401 AppError for a malformed token', () => {
    expect(() => verifyAccessToken('not-a-jwt')).toThrow(AppError)

    try {
      verifyAccessToken('not-a-jwt')
    } catch (error) {
      expect(error).toBeInstanceOf(AppError)
      expect((error as AppError).status).toBe(HttpStatus.UNAUTHORIZED)
      expect((error as AppError).context.operation).toBe('verifyAccessToken')
    }
  })

  it('throws a 401 AppError for an expired token', () => {
    const expired = jwt.sign({ sub: 'user-1' }, env.JWT_ACCESS_SECRET, { expiresIn: -10 })
    expect(() => verifyAccessToken(expired)).toThrow(AppError)
  })

  it('throws a 401 AppError for a token signed with the wrong secret', () => {
    const forged = jwt.sign({ sub: 'user-1' }, 'a-completely-different-secret-value-here', {
      expiresIn: '1d',
    })
    expect(() => verifyAccessToken(forged)).toThrow(AppError)
  })

  it('rejects a refresh token verified as an access token', () => {
    const refreshToken = signRefreshToken('user-1')
    expect(() => verifyAccessToken(refreshToken)).toThrow(AppError)
  })
})

describe('signRefreshToken / verifyRefreshToken', () => {
  it('round-trips the subject and includes numeric iat/exp claims', () => {
    const token = signRefreshToken('user-1')
    const payload = verifyRefreshToken(token)

    expect(payload.sub).toBe('user-1')
    expect(typeof payload.iat).toBe('number')
    expect(typeof payload.exp).toBe('number')
  })

  it('throws a 401 AppError for a malformed token', () => {
    expect(() => verifyRefreshToken('not-a-jwt')).toThrow(AppError)

    try {
      verifyRefreshToken('not-a-jwt')
    } catch (error) {
      expect(error).toBeInstanceOf(AppError)
      expect((error as AppError).status).toBe(HttpStatus.UNAUTHORIZED)
      expect((error as AppError).context.operation).toBe('verifyRefreshToken')
    }
  })

  it('throws a 401 AppError for an expired token', () => {
    const expired = jwt.sign({ sub: 'user-1' }, env.JWT_REFRESH_SECRET, { expiresIn: -10 })
    expect(() => verifyRefreshToken(expired)).toThrow(AppError)
  })

  it('throws a 401 AppError for a token signed with the wrong secret', () => {
    const forged = jwt.sign({ sub: 'user-1' }, 'a-completely-different-secret-value-here', {
      expiresIn: '7d',
    })
    expect(() => verifyRefreshToken(forged)).toThrow(AppError)
  })

  it('rejects an access token verified as a refresh token', () => {
    const accessToken = signAccessToken('user-1')
    expect(() => verifyRefreshToken(accessToken)).toThrow(AppError)
  })
})
