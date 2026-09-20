import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/core/error'
import { ERRORS, HttpStatus } from '@/shared/constants'
import { authenticate } from './authenticate'
import type { Request, Response } from 'express'

const verifyAccessTokenMock = vi.fn<(token: string) => { sub: string; iat: number; exp: number }>()

vi.mock('@/core/security', () => ({
  verifyAccessToken: (token: string) => verifyAccessTokenMock(token),
}))

const makeReq = (headers: Record<string, string> = {}): Request =>
  ({
    headers,
    params: {},
    query: {},
    body: {},
    method: 'GET',
    originalUrl: '/auth/me',
  }) as unknown as Request
const next = vi.fn<(err?: unknown) => void>()

beforeEach(() => {
  next.mockClear()
  verifyAccessTokenMock.mockReset().mockReturnValue({ sub: 'user-1', iat: 0, exp: 1893456000 })
})

describe('authenticate', () => {
  it('sets req.user from the verified payload and calls next() with no error', () => {
    const req = makeReq({ authorization: 'Bearer valid-access-token' })

    authenticate(req, {} as Response, next)

    expect(req.user).toEqual({ sub: 'user-1', iat: 0, exp: 1893456000 })
    expect(next).toHaveBeenCalledWith()
  })

  it('trims the token before verifying it', () => {
    const req = makeReq({ authorization: 'Bearer   valid-access-token   ' })

    authenticate(req, {} as Response, next)
    expect(verifyAccessTokenMock).toHaveBeenCalledWith('valid-access-token')
  })

  it('throws MISSING_TOKEN and never verifies anything when there is no Authorization header', () => {
    const req = makeReq()

    authenticate(req, {} as Response, next)

    expect(verifyAccessTokenMock).not.toHaveBeenCalled()
    const [error] = next.mock.calls[0] as [AppError]
    expect(error).toBeInstanceOf(AppError)
    expect(error.status).toBe(HttpStatus.UNAUTHORIZED)
    expect(error.message).toBe(ERRORS.AUTH.MISSING_TOKEN)
  })

  it('throws MISSING_TOKEN when the header uses a scheme other than Bearer', () => {
    const req = makeReq({ authorization: 'Basic dXNlcjpwYXNz' })

    authenticate(req, {} as Response, next)

    expect(verifyAccessTokenMock).not.toHaveBeenCalled()
    const [error] = next.mock.calls[0] as [AppError]
    expect(error.message).toBe(ERRORS.AUTH.MISSING_TOKEN)
  })

  it('forwards the AppError from verifyAccessToken for an invalid or expired token', () => {
    verifyAccessTokenMock.mockImplementation(() => {
      throw new AppError(ERRORS.GENERIC.UNAUTHORIZED, HttpStatus.UNAUTHORIZED)
    })
    const req = makeReq({ authorization: 'Bearer garbage' })

    authenticate(req, {} as Response, next)

    expect(req.user).toBeUndefined()
    const [error] = next.mock.calls[0] as [AppError]
    expect(error.message).toBe(ERRORS.GENERIC.UNAUTHORIZED)
  })
})
