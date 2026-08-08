import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { AppError } from '@/core/error'
import { HttpStatus } from '@/shared/constants'
import { validate } from './validate'
import type { Request, Response } from 'express'

const makeReq = (overrides: Partial<Request> = {}): Request =>
  ({
    body: {},
    query: {},
    params: {},
    method: 'POST',
    originalUrl: '/test',
    ...overrides,
  }) as Request
const next = vi.fn<(err?: unknown) => void>()

beforeEach(() => {
  next.mockClear()
})

describe('validate', () => {
  it('parses the body, replaces req.body with the transformed data, and calls next with no error', () => {
    const schema = z.object({ email: z.string().trim().toLowerCase() })
    const req = makeReq({ body: { email: '  JANE@Example.com  ' } })

    validate(schema)(req, {} as Response, next)
    expect(next).toHaveBeenCalledWith()
    expect(req.body).toEqual({ email: 'jane@example.com' })
  })

  it('calls next with a 422 AppError joining every issue message when the body is invalid', () => {
    const schema = z.object({
      email: z.string({ error: 'Email is required' }),
      password: z.string().min(8, 'Password must be at least 8 characters'),
    })
    const req = makeReq({ body: { password: 'short' } })

    validate(schema)(req, {} as Response, next)
    expect(next).toHaveBeenCalledTimes(1)

    const [error] = next.mock.calls[0] as [AppError]
    expect(error).toBeInstanceOf(AppError)
    expect(error.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(error.message).toBe('Email is required, Password must be at least 8 characters')
    expect(error.context.operation).toBe('validate')
    expect(error.context.metadata).toEqual({ source: 'body' })
  })

  it('does not mutate req.body when validation fails', () => {
    const schema = z.object({ email: z.string() })
    const original = { password: 'short' }
    const req = makeReq({ body: original })

    validate(schema)(req, {} as Response, next)
    expect(req.body).toBe(original)
  })

  it('validates and replaces req.params when source is "params"', () => {
    const schema = z.object({ id: z.coerce.number() })
    const req = makeReq({ params: { id: '42' } })

    validate(schema, 'params')(req, {} as Response, next)
    expect(req.params).toEqual({ id: 42 })
    expect(next).toHaveBeenCalledWith()
  })

  it('validates and replaces req.query when source is "query"', () => {
    const schema = z.object({ page: z.coerce.number() })
    const req = makeReq({ query: { page: '2' } })

    validate(schema, 'query')(req, {} as Response, next)
    expect(req.query).toEqual({ page: 2 })
    expect(next).toHaveBeenCalledWith()
  })
})
