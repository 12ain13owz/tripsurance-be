import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '@/app'
import { AppError } from '@/core/error'
import type { Addon } from '@/generated/prisma/client'
import { ERRORS, ErrorSeverity, HttpStatus, SUCCESS } from '@/shared/constants'
import type { AppResponse } from '@/shared/types'
import type { CreateAddonInput, ReorderAddonInput, UpdateAddonInput } from './addon.schema'

const listMock = vi.fn<() => Promise<Addon[]>>()
const getMock = vi.fn<(id: string) => Promise<Addon>>()
const createMock = vi.fn<(input: CreateAddonInput) => Promise<Addon>>()
const updateMock = vi.fn<(id: string, input: UpdateAddonInput) => Promise<Addon>>()
const reorderMock = vi.fn<(input: ReorderAddonInput) => Promise<Addon[]>>()

vi.mock('./addon.service', () => ({
  list: async () => listMock(),
  get: async (id: string) => getMock(id),
  create: async (input: CreateAddonInput) => createMock(input),
  update: async (id: string, input: UpdateAddonInput) => updateMock(id, input),
  reorder: async (input: ReorderAddonInput) => reorderMock(input),
}))

const verifyAccessTokenMock = vi.fn<(token: string) => { sub: string; iat: number; exp: number }>()

vi.mock('@/core/security', () => ({
  verifyAccessToken: (token: string) => verifyAccessTokenMock(token),
}))

const app = createApp()
const addon: Addon = {
  id: 'addon-1',
  code: 'extreme-sports',
  pricingType: 'PER_TRAVELLER_PER_DAY',
  price: 2_000,
  coverageAmount: null,
  isActive: false,
  sortOrder: 0,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}
const secondAddon: Addon = { ...addon, id: 'addon-2', code: 'baggage-plus', sortOrder: 1 }
const authHeader = ['Authorization', 'Bearer access-token'] as const
const validCreateBody: CreateAddonInput = {
  code: 'baggage-plus',
  pricingType: 'PER_TRAVELLER',
  price: 9_900,
  coverageAmount: 1_000_000,
}

const toJson = (a: Addon) => ({
  ...a,
  createdAt: a.createdAt.toISOString(),
  updatedAt: a.updatedAt.toISOString(),
})

beforeEach(() => {
  listMock.mockReset()
  getMock.mockReset()
  createMock.mockReset()
  updateMock.mockReset()
  reorderMock.mockReset()
  verifyAccessTokenMock.mockReset().mockReturnValue({ sub: 'user-1', iat: 0, exp: 1893456000 })
})

describe('GET /admin/addons', () => {
  it('returns 200 with every add-on on a valid bearer token', async () => {
    listMock.mockResolvedValue([addon, secondAddon])

    const res = await request(app)
      .get('/admin/addons')
      .set(...authHeader)
    const body = res.body as AppResponse<Addon[]>

    expect(res.status).toBe(HttpStatus.OK)
    expect(body.message).toBe(SUCCESS.UTIL.list('addon'))
    expect(body.data).toEqual([toJson(addon), toJson(secondAddon)])
  })

  it('returns 401 and never calls the service when there is no Authorization header', async () => {
    const res = await request(app).get('/admin/addons')
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED)
    expect(body.message).toBe(ERRORS.AUTH.MISSING_TOKEN)
    expect(listMock).not.toHaveBeenCalled()
  })
})

describe('GET /admin/addons/:id', () => {
  it('returns 200 with the add-on', async () => {
    getMock.mockResolvedValue(addon)

    const res = await request(app)
      .get('/admin/addons/addon-1')
      .set(...authHeader)
    const body = res.body as AppResponse<Addon>

    expect(res.status).toBe(HttpStatus.OK)
    expect(body.message).toBe(SUCCESS.UTIL.fetch('addon'))
    expect(body.data).toEqual(toJson(addon))
    expect(getMock).toHaveBeenCalledWith('addon-1')
  })

  it('forwards a service AppError (e.g. not found) to the error handler', async () => {
    getMock.mockRejectedValue(
      new AppError(ERRORS.UTIL.notFound('Add-on'), HttpStatus.NOT_FOUND, ErrorSeverity.WARN)
    )

    const res = await request(app)
      .get('/admin/addons/missing-id')
      .set(...authHeader)
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.NOT_FOUND)
    expect(body.message).toBe(ERRORS.UTIL.notFound('Add-on'))
  })
})

describe('POST /admin/addons', () => {
  it('returns 201 with the created add-on on a valid body', async () => {
    createMock.mockResolvedValue(secondAddon)

    const res = await request(app)
      .post('/admin/addons')
      .set(...authHeader)
      .send(validCreateBody)
    const body = res.body as AppResponse<Addon>

    expect(res.status).toBe(HttpStatus.CREATED)
    expect(body.message).toBe(SUCCESS.UTIL.create('addon'))
    expect(body.data).toEqual(toJson(secondAddon))
    expect(createMock).toHaveBeenCalledWith(validCreateBody)
  })

  it('strips a client-sent sortOrder — the server places new add-ons last', async () => {
    createMock.mockResolvedValue(secondAddon)

    await request(app)
      .post('/admin/addons')
      .set(...authHeader)
      .send({ ...validCreateBody, sortOrder: 0 })

    expect(createMock).toHaveBeenCalledWith(validCreateBody)
  })

  it('returns 401 and never calls the service when there is no Authorization header', async () => {
    const res = await request(app).post('/admin/addons').send(validCreateBody)

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED)
    expect(createMock).not.toHaveBeenCalled()
  })

  it.each([
    ['code is not kebab-case', { code: 'Baggage_Plus' }],
    ['code is longer than 50 chars', { code: 'a'.repeat(51) }],
    ['pricingType is unknown', { pricingType: 'PER_DAY' }],
    ['price is a decimal (baht sent instead of satang)', { price: 99.5 }],
    ['price is zero', { price: 0 }],
    ['price is above the ceiling', { price: 100_000_001 }],
    ['coverageAmount is negative', { coverageAmount: -1 }],
  ])('returns 422 and never calls the service when %s', async (_label, override) => {
    const res = await request(app)
      .post('/admin/addons')
      .set(...authHeader)
      .send({ ...validCreateBody, ...override })

    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('forwards a 409 from the service when the code is taken', async () => {
    createMock.mockRejectedValue(
      new AppError(ERRORS.UTIL.alreadyExists('Add-on code'), HttpStatus.CONFLICT)
    )

    const res = await request(app)
      .post('/admin/addons')
      .set(...authHeader)
      .send(validCreateBody)
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.CONFLICT)
    expect(body.message).toBe(ERRORS.UTIL.alreadyExists('Add-on code'))
  })
})

describe('PATCH /admin/addons/:id', () => {
  it('returns 200 with the updated add-on on a valid body', async () => {
    updateMock.mockResolvedValue({ ...addon, isActive: true })

    const res = await request(app)
      .patch('/admin/addons/addon-1')
      .set(...authHeader)
      .send({ isActive: true, coverageAmount: null })
    const body = res.body as AppResponse<Addon>

    expect(res.status).toBe(HttpStatus.OK)
    expect(body.message).toBe(SUCCESS.UTIL.update('addon'))
    expect(updateMock).toHaveBeenCalledWith('addon-1', { isActive: true, coverageAmount: null })
  })

  it('returns 422 and never calls the service when the body is empty', async () => {
    const res = await request(app)
      .patch('/admin/addons/addon-1')
      .set(...authHeader)
      .send({})
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(body.message).toBe(ERRORS.GENERIC.EMPTY_UPDATE)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it.each([
    ['code', { code: 'new-code' }],
    ['sortOrder', { sortOrder: 3 }],
  ])('treats %s as not editable (stripped, so the update is empty)', async (_label, body) => {
    const res = await request(app)
      .patch('/admin/addons/addon-1')
      .set(...authHeader)
      .send(body)

    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('returns 401 and never calls the service when there is no Authorization header', async () => {
    const res = await request(app).patch('/admin/addons/addon-1').send({ isActive: true })

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED)
    expect(updateMock).not.toHaveBeenCalled()
  })
})

describe('PATCH /admin/addons/reorder', () => {
  const validReorderBody: ReorderAddonInput = {
    items: [
      { id: 'addon-2', sortOrder: 0 },
      { id: 'addon-1', sortOrder: 1 },
    ],
  }

  // Locks the route order: /reorder must be registered before /:id
  it('reaches reorder, not update, and returns 200 with the re-sorted list', async () => {
    const reordered = [
      { ...secondAddon, sortOrder: 0 },
      { ...addon, sortOrder: 1 },
    ]
    reorderMock.mockResolvedValue(reordered)

    const res = await request(app)
      .patch('/admin/addons/reorder')
      .set(...authHeader)
      .send(validReorderBody)
    const body = res.body as AppResponse<Addon[]>

    expect(res.status).toBe(HttpStatus.OK)
    expect(body.message).toBe(SUCCESS.UTIL.reorder('addon'))
    expect(body.data).toEqual(reordered.map(toJson))
    expect(reorderMock).toHaveBeenCalledWith(validReorderBody)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it.each([
    ['items is empty', { items: [] }],
    [
      'an id appears twice',
      {
        items: [
          { id: 'addon-1', sortOrder: 0 },
          { id: 'addon-1', sortOrder: 1 },
        ],
      },
    ],
    [
      'a sortOrder appears twice',
      {
        items: [
          { id: 'addon-1', sortOrder: 0 },
          { id: 'addon-2', sortOrder: 0 },
        ],
      },
    ],
    ['a sortOrder is negative', { items: [{ id: 'addon-1', sortOrder: -1 }] }],
    ['a sortOrder is a decimal', { items: [{ id: 'addon-1', sortOrder: 0.5 }] }],
  ])('returns 422 and never calls the service when %s', async (_label, body) => {
    const res = await request(app)
      .patch('/admin/addons/reorder')
      .set(...authHeader)
      .send(body)

    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(reorderMock).not.toHaveBeenCalled()
  })

  it('forwards a 400 from the service when the list does not match the add-ons', async () => {
    reorderMock.mockRejectedValue(
      new AppError(ERRORS.UTIL.reorderMismatch('add-on'), HttpStatus.BAD_REQUEST)
    )

    const res = await request(app)
      .patch('/admin/addons/reorder')
      .set(...authHeader)
      .send(validReorderBody)
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.BAD_REQUEST)
    expect(body.message).toBe(ERRORS.UTIL.reorderMismatch('add-on'))
  })

  it('returns 401 and never calls the service when there is no Authorization header', async () => {
    const res = await request(app).patch('/admin/addons/reorder').send(validReorderBody)

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED)
    expect(reorderMock).not.toHaveBeenCalled()
  })
})

// Consumers only see add-ons embedded in GET /plans
describe('no public route', () => {
  it('has no GET /addons', async () => {
    const res = await request(app).get('/addons')

    expect(res.status).toBe(HttpStatus.NOT_FOUND)
    expect(listMock).not.toHaveBeenCalled()
  })
})
