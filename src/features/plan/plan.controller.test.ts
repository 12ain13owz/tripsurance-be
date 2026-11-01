import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '@/app'
import { AppError } from '@/core/error'
import { ERRORS, ErrorSeverity, HttpStatus, SUCCESS } from '@/shared/constants'
import type { AppResponse } from '@/shared/types'
import { MAX_COVERAGE_AMOUNT, PLAN_ERRORS } from './plan.const'
import type { CreatePlanInput, ReorderPlanInput, UpdatePlanInput } from './plan.schema'
import type { PlanAdminData, PlanData } from './plan.type'

const listMock = vi.fn<() => Promise<PlanAdminData[]>>()
const listActiveMock = vi.fn<(country?: string) => Promise<PlanData[]>>()
const getMock = vi.fn<(id: string) => Promise<PlanAdminData>>()
const createMock = vi.fn<(input: CreatePlanInput) => Promise<PlanAdminData>>()
const updateMock = vi.fn<(id: string, input: UpdatePlanInput) => Promise<PlanAdminData>>()
const reorderMock = vi.fn<(input: ReorderPlanInput) => Promise<PlanAdminData[]>>()

vi.mock('./plan.service', () => ({
  list: async () => listMock(),
  listActive: async (country?: string) => listActiveMock(country),
  get: async (id: string) => getMock(id),
  create: async (input: CreatePlanInput) => createMock(input),
  update: async (id: string, input: UpdatePlanInput) => updateMock(id, input),
  reorder: async (input: ReorderPlanInput) => reorderMock(input),
}))

const verifyAccessTokenMock = vi.fn<(token: string) => { sub: string; iat: number; exp: number }>()

vi.mock('@/core/security', () => ({
  verifyAccessToken: (token: string) => verifyAccessTokenMock(token),
}))

const app = createApp()
const tiers = [
  { minDays: 1, maxDays: 4, pricePerTraveller: 19_900 },
  { minDays: 5, maxDays: 10, pricePerTraveller: 34_900 },
]
const plan: PlanAdminData = {
  id: 'plan-1',
  code: 'asia-basic',
  type: 'SINGLE_TRIP',
  isActive: false,
  sortOrder: 0,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  tiers,
  coverages: [{ categoryKey: 'MEDICAL_EXPENSES', amount: 100_000_000 }],
  countries: ['JP', 'KR'],
  addons: [
    { code: 'baggage-plus', pricingType: 'PER_TRAVELLER', price: 9_900, coverageAmount: 1_000_000 },
  ],
}
const secondPlan: PlanAdminData = { ...plan, id: 'plan-2', code: 'worldwide-plus', sortOrder: 1 }
const authHeader = ['Authorization', 'Bearer access-token'] as const
const validCreateBody: CreatePlanInput = {
  code: 'east-asia-lite',
  tiers,
  coverages: [{ categoryKey: 'MEDICAL_EXPENSES', amount: 100_000_000 }],
  countryIds: ['country-jp', 'country-kr'],
  addonIds: ['addon-1'],
}

const toJson = (p: PlanAdminData) => ({
  ...p,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
})

// Invalid tier/coverage lists, shared by create and update
const invalidLists = [
  ['tiers is empty', { tiers: [] }],
  ['the first tier does not start at day 1', { tiers: [{ ...tiers[0], minDays: 2 }, tiers[1]] }],
  ['tiers leave a gap', { tiers: [tiers[0], { ...tiers[1], minDays: 6 }] }],
  ['tiers overlap', { tiers: [tiers[0], { ...tiers[1], minDays: 4 }] }],
  ['a tier ends before it starts', { tiers: [tiers[0], { ...tiers[1], maxDays: 4 }] }],
  ['a tier goes past 365 days', { tiers: [{ ...tiers[0], maxDays: 366 }] }],
  [
    'a price is a decimal (baht sent instead of satang)',
    { tiers: [{ ...tiers[0], pricePerTraveller: 199.5 }] },
  ],
  ['coverages is empty', { coverages: [] }],
  ['a coverage category is unknown', { coverages: [{ categoryKey: 'PET_CARE', amount: 100 }] }],
  [
    'a coverage category appears twice',
    {
      coverages: [
        { categoryKey: 'FLIGHT_DELAY', amount: 100 },
        { categoryKey: 'FLIGHT_DELAY', amount: 200 },
      ],
    },
  ],
  [
    'a coverage amount is above 20,000,000 THB',
    { coverages: [{ categoryKey: 'MEDICAL_EXPENSES', amount: MAX_COVERAGE_AMOUNT + 1 }] },
  ],
  ['countryIds is empty', { countryIds: [] }],
] as const

beforeEach(() => {
  listMock.mockReset()
  listActiveMock.mockReset()
  getMock.mockReset()
  createMock.mockReset()
  updateMock.mockReset()
  reorderMock.mockReset()
  verifyAccessTokenMock.mockReset().mockReturnValue({ sub: 'user-1', iat: 0, exp: 1893456000 })
})

describe('GET /plans', () => {
  const publicPlan: PlanData = {
    id: plan.id,
    code: plan.code,
    type: plan.type,
    tiers: plan.tiers,
    coverages: plan.coverages,
    countries: plan.countries,
    addons: plan.addons,
  }

  it('returns 200 with active plans and needs no bearer token', async () => {
    listActiveMock.mockResolvedValue([publicPlan])

    const res = await request(app).get('/plans')
    const body = res.body as AppResponse<PlanData[]>

    expect(res.status).toBe(HttpStatus.OK)
    expect(body.message).toBe(SUCCESS.UTIL.list('plan'))
    expect(body.data).toEqual([publicPlan])
    expect(listActiveMock).toHaveBeenCalledWith(undefined)
    expect(verifyAccessTokenMock).not.toHaveBeenCalled()
  })

  it('passes the country filter to the service', async () => {
    listActiveMock.mockResolvedValue([])

    const res = await request(app).get('/plans').query({ country: 'JP' })

    expect(res.status).toBe(HttpStatus.OK)
    expect(listActiveMock).toHaveBeenCalledWith('JP')
  })

  it.each([
    ['lowercase', 'jp'],
    ['three letters', 'JPN'],
    ['empty', ''],
  ])('returns 422 and never calls the service when country is %s', async (_label, country) => {
    const res = await request(app).get('/plans').query({ country })

    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(listActiveMock).not.toHaveBeenCalled()
  })

  it('returns 422 when country is sent more than once', async () => {
    const res = await request(app).get('/plans?country=JP&country=KR')

    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(listActiveMock).not.toHaveBeenCalled()
  })
})

describe('GET /admin/plans', () => {
  it('returns 200 with every plan on a valid bearer token', async () => {
    listMock.mockResolvedValue([plan, secondPlan])

    const res = await request(app)
      .get('/admin/plans')
      .set(...authHeader)
    const body = res.body as AppResponse<PlanAdminData[]>

    expect(res.status).toBe(HttpStatus.OK)
    expect(body.message).toBe(SUCCESS.UTIL.list('plan'))
    expect(body.data).toEqual([toJson(plan), toJson(secondPlan)])
  })

  it('returns 401 and never calls the service when there is no Authorization header', async () => {
    const res = await request(app).get('/admin/plans')
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED)
    expect(body.message).toBe(ERRORS.AUTH.MISSING_TOKEN)
    expect(listMock).not.toHaveBeenCalled()
  })
})

describe('GET /admin/plans/:id', () => {
  it('returns 200 with the plan', async () => {
    getMock.mockResolvedValue(plan)

    const res = await request(app)
      .get('/admin/plans/plan-1')
      .set(...authHeader)
    const body = res.body as AppResponse<PlanAdminData>

    expect(res.status).toBe(HttpStatus.OK)
    expect(body.message).toBe(SUCCESS.UTIL.fetch('plan'))
    expect(body.data).toEqual(toJson(plan))
    expect(getMock).toHaveBeenCalledWith('plan-1')
  })

  it('forwards a service AppError (e.g. not found) to the error handler', async () => {
    getMock.mockRejectedValue(
      new AppError(ERRORS.UTIL.notFound('Plan'), HttpStatus.NOT_FOUND, ErrorSeverity.WARN)
    )

    const res = await request(app)
      .get('/admin/plans/missing-id')
      .set(...authHeader)
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.NOT_FOUND)
    expect(body.message).toBe(ERRORS.UTIL.notFound('Plan'))
  })
})

describe('POST /admin/plans', () => {
  it('returns 201 with the created plan on a valid body', async () => {
    createMock.mockResolvedValue(plan)

    const res = await request(app)
      .post('/admin/plans')
      .set(...authHeader)
      .send(validCreateBody)
    const body = res.body as AppResponse<PlanAdminData>

    expect(res.status).toBe(HttpStatus.CREATED)
    expect(body.message).toBe(SUCCESS.UTIL.create('plan'))
    expect(body.data).toEqual(toJson(plan))
    expect(createMock).toHaveBeenCalledWith(validCreateBody)
  })

  it('accepts tiers in any order as long as they are contiguous', async () => {
    createMock.mockResolvedValue(plan)

    const res = await request(app)
      .post('/admin/plans')
      .set(...authHeader)
      .send({ ...validCreateBody, tiers: [tiers[1], tiers[0]] })

    expect(res.status).toBe(HttpStatus.CREATED)
  })

  it('accepts a coverage amount of exactly 20,000,000 THB', async () => {
    createMock.mockResolvedValue(plan)

    const res = await request(app)
      .post('/admin/plans')
      .set(...authHeader)
      .send({
        ...validCreateBody,
        coverages: [{ categoryKey: 'MEDICAL_EXPENSES', amount: MAX_COVERAGE_AMOUNT }],
      })

    expect(res.status).toBe(HttpStatus.CREATED)
  })

  it('drops duplicate country and add-on ids before calling the service', async () => {
    createMock.mockResolvedValue(plan)

    await request(app)
      .post('/admin/plans')
      .set(...authHeader)
      .send({
        ...validCreateBody,
        countryIds: ['country-jp', 'country-kr', 'country-jp'],
        addonIds: ['addon-1', 'addon-1'],
      })

    expect(createMock).toHaveBeenCalledWith(validCreateBody)
  })

  it('defaults addonIds to an empty list when omitted', async () => {
    createMock.mockResolvedValue(plan)
    const { addonIds: _addonIds, ...withoutAddons } = validCreateBody

    await request(app)
      .post('/admin/plans')
      .set(...authHeader)
      .send(withoutAddons)

    expect(createMock).toHaveBeenCalledWith({ ...validCreateBody, addonIds: [] })
  })

  it('strips client-sent sortOrder and isActive — the server decides both', async () => {
    createMock.mockResolvedValue(plan)

    await request(app)
      .post('/admin/plans')
      .set(...authHeader)
      .send({ ...validCreateBody, sortOrder: 0, isActive: true })

    expect(createMock).toHaveBeenCalledWith(validCreateBody)
  })

  it('returns 401 and never calls the service when there is no Authorization header', async () => {
    const res = await request(app).post('/admin/plans').send(validCreateBody)

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED)
    expect(createMock).not.toHaveBeenCalled()
  })

  it.each([
    ['code is not kebab-case', { code: 'East Asia' }],
    ['code is longer than 50 chars', { code: 'a'.repeat(51) }],
    ...invalidLists,
  ])('returns 422 and never calls the service when %s', async (_label, override) => {
    const res = await request(app)
      .post('/admin/plans')
      .set(...authHeader)
      .send({ ...validCreateBody, ...override })

    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(createMock).not.toHaveBeenCalled()
  })

  it.each([
    [
      'the first tier does not start at day 1',
      PLAN_ERRORS.TIERS_START_AT_DAY_ONE,
      { tiers: [{ ...tiers[0], minDays: 2 }, tiers[1]] },
    ],
    [
      'tiers leave a gap',
      PLAN_ERRORS.TIERS_NOT_CONTIGUOUS,
      { tiers: [tiers[0], { ...tiers[1], minDays: 6 }] },
    ],
    [
      'a tier ends before it starts',
      PLAN_ERRORS.TIER_DAYS_ORDER,
      { tiers: [tiers[0], { ...tiers[1], maxDays: 4 }] },
    ],
    [
      'a coverage category appears twice',
      PLAN_ERRORS.DUPLICATE_COVERAGE,
      {
        coverages: [
          { categoryKey: 'FLIGHT_DELAY', amount: 100 },
          { categoryKey: 'FLIGHT_DELAY', amount: 200 },
        ],
      },
    ],
  ])('explains the rule in the 422 message when %s', async (_label, message, override) => {
    const res = await request(app)
      .post('/admin/plans')
      .set(...authHeader)
      .send({ ...validCreateBody, ...override })
    const body = res.body as AppResponse<undefined>

    expect(body.message).toBe(message)
  })

  it.each([
    [
      '409 when the code is taken',
      new AppError(ERRORS.UTIL.alreadyExists('Plan code'), HttpStatus.CONFLICT),
    ],
    [
      '400 when a country id does not exist',
      new AppError(PLAN_ERRORS.UNKNOWN_COUNTRY, HttpStatus.BAD_REQUEST),
    ],
  ])('forwards a %s', async (_label, error) => {
    createMock.mockRejectedValue(error)

    const res = await request(app)
      .post('/admin/plans')
      .set(...authHeader)
      .send(validCreateBody)
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(error.status)
    expect(body.message).toBe(error.message)
  })
})

describe('PATCH /admin/plans/:id', () => {
  it('returns 200 with the updated plan and passes only the fields sent', async () => {
    updateMock.mockResolvedValue({ ...plan, isActive: true })

    const res = await request(app)
      .patch('/admin/plans/plan-1')
      .set(...authHeader)
      .send({ isActive: true, addonIds: [] })
    const body = res.body as AppResponse<PlanAdminData>

    expect(res.status).toBe(HttpStatus.OK)
    expect(body.message).toBe(SUCCESS.UTIL.update('plan'))
    expect(updateMock).toHaveBeenCalledWith('plan-1', { isActive: true, addonIds: [] })
  })

  it('returns 422 and never calls the service when the body is empty', async () => {
    const res = await request(app)
      .patch('/admin/plans/plan-1')
      .set(...authHeader)
      .send({})
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(body.message).toBe(ERRORS.GENERIC.EMPTY_UPDATE)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it.each([
    ['code', { code: 'new-code' }],
    ['type', { type: 'ANNUAL' }],
    ['sortOrder', { sortOrder: 3 }],
  ])('treats %s as not editable (stripped, so the update is empty)', async (_label, body) => {
    const res = await request(app)
      .patch('/admin/plans/plan-1')
      .set(...authHeader)
      .send(body)

    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(updateMock).not.toHaveBeenCalled()
  })

  it.each(invalidLists)(
    'returns 422 and never calls the service when %s',
    async (_label, override) => {
      const res = await request(app)
        .patch('/admin/plans/plan-1')
        .set(...authHeader)
        .send(override)

      expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
      expect(updateMock).not.toHaveBeenCalled()
    }
  )

  it('returns 401 and never calls the service when there is no Authorization header', async () => {
    const res = await request(app).patch('/admin/plans/plan-1').send({ isActive: true })

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED)
    expect(updateMock).not.toHaveBeenCalled()
  })
})

describe('PATCH /admin/plans/reorder', () => {
  const validReorderBody: ReorderPlanInput = {
    items: [
      { id: 'plan-2', sortOrder: 0 },
      { id: 'plan-1', sortOrder: 1 },
    ],
  }

  // Locks the route order: /reorder must be registered before /:id
  it('reaches reorder, not update, and returns 200 with the re-sorted list', async () => {
    const reordered = [
      { ...secondPlan, sortOrder: 0 },
      { ...plan, sortOrder: 1 },
    ]
    reorderMock.mockResolvedValue(reordered)

    const res = await request(app)
      .patch('/admin/plans/reorder')
      .set(...authHeader)
      .send(validReorderBody)
    const body = res.body as AppResponse<PlanAdminData[]>

    expect(res.status).toBe(HttpStatus.OK)
    expect(body.message).toBe(SUCCESS.UTIL.reorder('plan'))
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
          { id: 'plan-1', sortOrder: 0 },
          { id: 'plan-1', sortOrder: 1 },
        ],
      },
    ],
    [
      'a sortOrder appears twice',
      {
        items: [
          { id: 'plan-1', sortOrder: 0 },
          { id: 'plan-2', sortOrder: 0 },
        ],
      },
    ],
  ])('returns 422 and never calls the service when %s', async (_label, body) => {
    const res = await request(app)
      .patch('/admin/plans/reorder')
      .set(...authHeader)
      .send(body)

    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
    expect(reorderMock).not.toHaveBeenCalled()
  })

  it('forwards a 400 from the service when the list does not match the plans', async () => {
    reorderMock.mockRejectedValue(
      new AppError(ERRORS.UTIL.reorderMismatch('plan'), HttpStatus.BAD_REQUEST)
    )

    const res = await request(app)
      .patch('/admin/plans/reorder')
      .set(...authHeader)
      .send(validReorderBody)
    const body = res.body as AppResponse<undefined>

    expect(res.status).toBe(HttpStatus.BAD_REQUEST)
    expect(body.message).toBe(ERRORS.UTIL.reorderMismatch('plan'))
  })

  it('returns 401 and never calls the service when there is no Authorization header', async () => {
    const res = await request(app).patch('/admin/plans/reorder').send(validReorderBody)

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED)
    expect(reorderMock).not.toHaveBeenCalled()
  })
})
