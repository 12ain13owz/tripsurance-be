import { afterEach, describe, expect, it, vi } from 'vitest'
import { env } from '@/core/config'
import { ERRORS, HttpStatus } from '@/shared/constants'
import { AppEnv } from '@/shared/types'
import { AppError } from './app-error'
import { errorHandler } from './error.middleware'
import type { Response } from 'express'

const originalNodeEnv = env.NODE_ENV

const makeRes = () => {
  const status = vi.fn()
  const json = vi.fn()
  const res = { status, json } as unknown as Response
  status.mockReturnValue(res)
  json.mockReturnValue(res)
  return { res, status, json }
}

describe('errorHandler', () => {
  afterEach(() => {
    env.NODE_ENV = originalNodeEnv
    vi.restoreAllMocks()
  })

  it('responds with the AppError status and message', async () => {
    const { res, status, json } = makeRes()
    const error = new AppError('bad input', HttpStatus.BAD_REQUEST)

    await errorHandler(error, {} as never, res, vi.fn())

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST)
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: 'bad input' }))
  })

  it('falls back to 500 and a generic message for a plain Error without a message', async () => {
    const { res, status, json } = makeRes()
    const error = new Error()

    await errorHandler(error, {} as never, res, vi.fn())

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ message: ERRORS.GENERIC.INTERNAL_SERVER_ERROR })
    )
  })

  it('attaches structured debug data in development', async () => {
    env.NODE_ENV = AppEnv.DEVELOPMENT
    const { res, json } = makeRes()
    const error = new AppError('bad input', HttpStatus.BAD_REQUEST)

    await errorHandler(error, {} as never, res, vi.fn())

    const [payload] = json.mock.calls[0] as [{ data?: { status?: HttpStatus } }]
    expect(payload.data?.status).toBe(HttpStatus.BAD_REQUEST)
  })

  it('omits debug data in production', async () => {
    env.NODE_ENV = AppEnv.PRODUCTION
    const { res, json } = makeRes()
    const error = new AppError('bad input', HttpStatus.BAD_REQUEST)

    await errorHandler(error, {} as never, res, vi.fn())

    const [payload] = json.mock.calls[0] as [{ data?: unknown }]
    expect(payload.data).toBeUndefined()
  })
})
