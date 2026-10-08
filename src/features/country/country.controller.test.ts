import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '@/app'
import { AppError } from '@/core/error'
import type { Country } from '@/generated/prisma/client'
import { ERRORS, ErrorSeverity, HttpStatus, SUCCESS } from '@/shared/constants'
import type { AppResponse } from '@/shared/types'

const listMock = vi.fn<() => Promise<Country[]>>()
const listActiveMock = vi.fn<() => Promise<Country[]>>()
const updateMock = vi.fn<(id: string, isActive: boolean) => Promise<Country>>()

vi.mock('./country.service', () => ({
  list: async () => listMock(),
  listActive: async () => listActiveMock(),
  update: async (id: string, isActive: boolean) => updateMock(id, isActive),
}))

const verifyAccessTokenMock = vi.fn<(token: string) => { sub: string; iat: number; exp: number }>()

vi.mock('@/core/security', () => ({
  verifyAccessToken: (token: string) => verifyAccessTokenMock(token),
}))

const app = createApp()
const country: Country = {
  id: 'country-1',
  isoCode: 'JP',
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}
const inactiveCountry: Country = { ...country, id: 'country-2', isoCode: 'KP', isActive: false }
const authHeader = ['Authorization', 'Bearer access-token'] as const

const toJson = (c: Country) => ({
  ...c,
  createdAt: c.createdAt.toISOString(),
  updatedAt: c.updatedAt.toISOString(),
})

beforeEach(() => {
  listMock.mockReset()
  listActiveMock.mockReset()
  updateMock.mockReset()
  verifyAccessTokenMock.mockReset().mockReturnValue({ sub: 'user-1', iat: 0, exp: 1893456000 })
})

describe('GET /countries', () => {
  it('returns 200 with active countries only and requires no auth', async () => {
    listActiveMock.mockResolvedValue([country])

    const res = await request(app).get('/countries')
    const body = res.body as AppResponse<Country[]>

    expect(res.status).toBe(HttpStatus.OK)
    expect(body.message).toBe(SUCCESS.UTIL.list('country'))
    expect(body.data).toEqual([toJson(country)])
    expect(listMock).not.toHaveBeenCalled()
  })

  it('forwards a service AppError to the error handler', async () => {
    listActiveMock.mockRejectedValue(new AppError('boom', HttpStatus.INTERNAL_SERVER_ERROR))

    const res = await request(app).get('/countries')

    expect(res.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(listActiveMock).toHaveBeenCalled()
  })

  it('does not expose admin actions on the public path, even with a bearer token', async () => {
    const res = await request(app)
      .patch('/countries/country-1')
      .set(...authHeader)
      .send({ isActive: false })

    expect(res.status).toBe(HttpStatus.NOT_FOUND)
    expect(updateMock).not.toHaveBeenCalled()
  })
})

describe('GET /admin/countries', () => {
  it('returns 200 with every country, active or not, on a valid bearer token', async () => {
    listMock.mockResolvedValue([country, inactiveCountry])

    const res = await request(app)
      .get('/admin/countries')
      .set(...authHeader)
    const body = res.body as AppResponse<Country[]>

    expect(res.status).toBe(HttpStatus.OK)
    expect(body.message).toBe(SUCCESS.UTIL.list('country'))
    expect(body.data).toEqual([toJson(country), toJson(inactiveCountry)])
    expect(listActiveMock).not.toHaveBeenCalled()
  })

  it('returns 401 and never calls the service when there is no Authorization header', async () => {
    const res = await request(app).get('/admin/countries')
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED)
    expect(body.message).toBe(ERRORS.AUTH.MISSING_TOKEN)
    expect(listMock).not.toHaveBeenCalled()
  })

  it('forwards a service AppError to the error handler', async () => {
    listMock.mockRejectedValue(new AppError('boom', HttpStatus.INTERNAL_SERVER_ERROR))

    const res = await request(app)
      .get('/admin/countries')
      .set(...authHeader)

    expect(res.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
  })
})

describe('PATCH /admin/countries/:id', () => {
  it('returns 200 with the updated country on a valid body, params, and bearer token', async () => {
    updateMock.mockResolvedValue({ ...country, isActive: false })

    const res = await request(app)
      .patch('/admin/countries/country-1')
      .set(...authHeader)
      .send({ isActive: false })
    const body = res.body as AppResponse<Country>

    expect(res.status).toBe(HttpStatus.OK)
    expect(body.message).toBe(SUCCESS.UTIL.update('country'))
    expect(updateMock).toHaveBeenCalledWith('country-1', false)
  })

  it('returns 401 and never calls the service when there is no Authorization header', async () => {
    const res = await request(app).patch('/admin/countries/country-1').send({ isActive: false })

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('returns 422 and never calls the service when isActive is missing', async () => {
    const res = await request(app)
      .patch('/admin/countries/country-1')
      .set(...authHeader)
      .send({})

    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('forwards a service AppError (e.g. not found) to the error handler', async () => {
    updateMock.mockRejectedValue(
      new AppError(ERRORS.UTIL.notFound('Country'), HttpStatus.NOT_FOUND, ErrorSeverity.WARN)
    )

    const res = await request(app)
      .patch('/admin/countries/missing-id')
      .set(...authHeader)
      .send({ isActive: false })
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.NOT_FOUND)
    expect(body.message).toBe(ERRORS.UTIL.notFound('Country'))
  })
})

// Countries come from the seed only; create/delete were removed on purpose
describe('removed admin actions', () => {
  it('has no POST /admin/countries', async () => {
    const res = await request(app)
      .post('/admin/countries')
      .set(...authHeader)
      .send({ isoCode: 'JP' })

    expect(res.status).toBe(HttpStatus.NOT_FOUND)
  })

  it('has no DELETE /admin/countries/:id', async () => {
    const res = await request(app)
      .delete('/admin/countries/country-1')
      .set(...authHeader)

    expect(res.status).toBe(HttpStatus.NOT_FOUND)
  })
})
