import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '@/app'
import { AppError } from '@/core/error'
import type { Country } from '@/generated/prisma/client'
import { ERRORS, ErrorSeverity, HttpStatus, SUCCESS } from '@/shared/constants'
import type { AppResponse } from '@/shared/types'

const listMock = vi.fn<() => Promise<Country[]>>()
const createMock = vi.fn<(isoCode: string) => Promise<Country>>()
const updateMock = vi.fn<(id: string, isActive: boolean) => Promise<Country>>()
const removeMock = vi.fn<(id: string) => Promise<Country>>()

vi.mock('./country.service', () => ({
  list: async () => listMock(),
  create: async (isoCode: string) => createMock(isoCode),
  update: async (id: string, isActive: boolean) => updateMock(id, isActive),
  remove: async (id: string) => removeMock(id),
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
const authHeader = ['Authorization', 'Bearer access-token'] as const

beforeEach(() => {
  listMock.mockReset()
  createMock.mockReset()
  updateMock.mockReset()
  removeMock.mockReset()
  verifyAccessTokenMock.mockReset().mockReturnValue({ sub: 'user-1', iat: 0, exp: 1893456000 })
})

describe('GET /countries', () => {
  it('returns 200 with the country list and requires no auth', async () => {
    listMock.mockResolvedValue([country])

    const res = await request(app).get('/countries')
    const body = res.body as AppResponse<Country[]>

    expect(res.status).toBe(HttpStatus.OK)
    expect(body.message).toBe(SUCCESS.UTIL.list('country'))
    expect(body.data).toEqual([
      {
        ...country,
        createdAt: country.createdAt.toISOString(),
        updatedAt: country.updatedAt.toISOString(),
      },
    ])
  })

  it('forwards a service AppError to the error handler', async () => {
    listMock.mockRejectedValue(new AppError('boom', HttpStatus.INTERNAL_SERVER_ERROR))

    const res = await request(app).get('/countries')
    expect(res.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
    expect(listMock).toHaveBeenCalled()
  })
})

describe('POST /countries', () => {
  it('returns 201 with the created country on a valid body and bearer token', async () => {
    createMock.mockResolvedValue(country)

    const res = await request(app)
      .post('/countries')
      .set(...authHeader)
      .send({ isoCode: 'jp' })
    const body = res.body as AppResponse<Country>

    expect(res.status).toBe(HttpStatus.CREATED)
    expect(body.message).toBe(SUCCESS.UTIL.create('country'))
    expect(createMock).toHaveBeenCalledWith('JP')
  })

  it('returns 401 and never calls the service when there is no Authorization header', async () => {
    const res = await request(app).post('/countries').send({ isoCode: 'JP' })
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED)
    expect(body.message).toBe(ERRORS.AUTH.MISSING_TOKEN)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('returns 422 and never calls the service when isoCode is not a 2-letter code', async () => {
    const res = await request(app)
      .post('/countries')
      .set(...authHeader)
      .send({ isoCode: 'JPN' })

    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('forwards a service AppError (e.g. already exists) to the error handler', async () => {
    createMock.mockRejectedValue(
      new AppError(ERRORS.UTIL.alreadyExists('Country'), HttpStatus.CONFLICT, ErrorSeverity.WARN)
    )

    const res = await request(app)
      .post('/countries')
      .set(...authHeader)
      .send({ isoCode: 'JP' })
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.CONFLICT)
    expect(body.message).toBe(ERRORS.UTIL.alreadyExists('Country'))
  })
})

describe('PATCH /countries/:id', () => {
  it('returns 200 with the updated country on a valid body, params, and bearer token', async () => {
    updateMock.mockResolvedValue({ ...country, isActive: false })

    const res = await request(app)
      .patch('/countries/country-1')
      .set(...authHeader)
      .send({ isActive: false })
    const body = res.body as AppResponse<Country>

    expect(res.status).toBe(HttpStatus.OK)
    expect(body.message).toBe(SUCCESS.UTIL.update('country'))
    expect(updateMock).toHaveBeenCalledWith('country-1', false)
  })

  it('returns 401 and never calls the service when there is no Authorization header', async () => {
    const res = await request(app).patch('/countries/country-1').send({ isActive: false })

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('returns 422 and never calls the service when isActive is missing', async () => {
    const res = await request(app)
      .patch('/countries/country-1')
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
      .patch('/countries/missing-id')
      .set(...authHeader)
      .send({ isActive: false })
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.NOT_FOUND)
    expect(body.message).toBe(ERRORS.UTIL.notFound('Country'))
  })
})

describe('DELETE /countries/:id', () => {
  it('returns 200 and calls the service with the id on a valid bearer token', async () => {
    removeMock.mockResolvedValue(country)

    const res = await request(app)
      .delete('/countries/country-1')
      .set(...authHeader)
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.OK)
    expect(body.message).toBe(SUCCESS.UTIL.delete('country'))
    expect(removeMock).toHaveBeenCalledWith('country-1')
  })

  it('returns 401 and never calls the service when there is no Authorization header', async () => {
    const res = await request(app).delete('/countries/country-1')

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED)
    expect(removeMock).not.toHaveBeenCalled()
  })

  it('forwards a service AppError (e.g. not found) to the error handler', async () => {
    removeMock.mockRejectedValue(
      new AppError(ERRORS.UTIL.notFound('Country'), HttpStatus.NOT_FOUND, ErrorSeverity.WARN)
    )

    const res = await request(app)
      .delete('/countries/missing-id')
      .set(...authHeader)
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.NOT_FOUND)
    expect(body.message).toBe(ERRORS.UTIL.notFound('Country'))
  })
})
