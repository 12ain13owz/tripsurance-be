import { describe, expect, it } from 'vitest'
import { ERRORS, ErrorSeverity, HttpStatus } from '@/shared/constants'
import { AppError } from './app-error'
import { wrapUnexpected } from './wrap-unexpected'

describe('wrapUnexpected', () => {
  it('resolves with the value of the promise when it succeeds', async () => {
    const result = await wrapUnexpected(Promise.resolve('ok'), 'test')
    expect(result).toBe('ok')
  })

  it('rethrows an AppError rejection unchanged, without wrapping it', async () => {
    const original = new AppError(
      'invalid credentials',
      HttpStatus.UNAUTHORIZED,
      ErrorSeverity.WARN
    )

    await expect(wrapUnexpected(Promise.reject(original), 'login')).rejects.toBe(original)
  })

  it('wraps a non-AppError Error into a generic 500 AppError', async () => {
    await expect(
      wrapUnexpected(Promise.reject(new Error('connection refused')), 'login')
    ).rejects.toMatchObject({
      message: ERRORS.GENERIC.INTERNAL_SERVER_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      severity: ErrorSeverity.ERROR,
    })
  })

  it('wraps a non-Error rejection (e.g. a string) the same way', async () => {
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    await expect(wrapUnexpected(Promise.reject('boom'), 'login')).rejects.toMatchObject({
      message: ERRORS.GENERIC.INTERNAL_SERVER_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    })
  })

  it('sets the operation on the wrapped AppError context', async () => {
    await expect(
      wrapUnexpected(Promise.reject(new Error('boom')), 'persistRefreshToken')
    ).rejects.toMatchObject({
      context: { operation: 'persistRefreshToken' },
    })
  })

  it('preserves the original error as metadata.cause when it is an Error', async () => {
    await expect(
      wrapUnexpected(Promise.reject(new TypeError('bad shape')), 'login', { userId: 'user-1' })
    ).rejects.toMatchObject({
      context: {
        metadata: {
          userId: 'user-1',
          cause: { name: 'TypeError', message: 'bad shape' },
        },
      },
    })
  })

  it('falls back to a generic cause name when the rejection is not an Error', async () => {
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    await expect(wrapUnexpected(Promise.reject('boom'), 'login')).rejects.toMatchObject({
      context: {
        metadata: { cause: { name: 'UnknownError', message: 'boom' } },
      },
    })
  })

  it('uses the custom message when provided, instead of the generic default', async () => {
    await expect(
      wrapUnexpected(
        Promise.reject(new Error('boom')),
        'login',
        undefined,
        'Could not save session'
      )
    ).rejects.toMatchObject({
      message: 'Could not save session',
    })
  })
})
