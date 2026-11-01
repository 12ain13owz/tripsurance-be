import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Addon, Plan, PlanCoverage, PlanPriceTier } from '@/generated/prisma/client'
import { ERRORS, HttpStatus } from '@/shared/constants'
import { PLAN_ERRORS } from './plan.const'
import { create, get, list, reorder, update } from './plan.service'
import type { CreatePlanInput } from './plan.schema'
import type { PlanAdminData } from './plan.type'

// Row shape returned by Prisma with the service's PLAN_INCLUDE
type PlanRow = Plan & {
  tiers: Pick<PlanPriceTier, 'minDays' | 'maxDays' | 'pricePerTraveller'>[]
  coverages: Pick<PlanCoverage, 'categoryKey' | 'amount'>[]
  countries: { country: { isoCode: string } }[]
  addons: { addon: Pick<Addon, 'code' | 'pricingType' | 'price' | 'coverageAmount'> }[]
}
interface FindManyArgs {
  orderBy?: unknown
  include?: unknown
  select?: { id: true }
}
interface FindUniqueArgs {
  where: { id?: string; code?: string }
  include?: unknown
}
interface CreateArgs {
  data: Record<string, unknown>
  include: unknown
}
interface CountArgs {
  where: { id: { in: string[] } }
}
interface PlanUpdateArgs {
  where: { id: string }
  data: { isActive?: boolean; sortOrder?: number }
}
interface DeleteManyArgs {
  where: { planId: string }
}
interface CreateManyArgs {
  data: Record<string, unknown>[]
}

const findManyMock = vi.fn<(args: FindManyArgs) => Promise<PlanRow[] | Pick<Plan, 'id'>[]>>()
const findUniqueMock = vi.fn<(args: FindUniqueArgs) => Promise<PlanRow | null>>()
const aggregateMock =
  vi.fn<(args: { _max: { sortOrder: true } }) => Promise<{ _max: { sortOrder: number | null } }>>()
const createMock = vi.fn<(args: CreateArgs) => Promise<PlanRow>>()
const countryCountMock = vi.fn<(args: CountArgs) => Promise<number>>()
const addonCountMock = vi.fn<(args: CountArgs) => Promise<number>>()

const listMock = () => ({
  deleteMany: vi.fn<(args: DeleteManyArgs) => Promise<{ count: number }>>(),
  createMany: vi.fn<(args: CreateManyArgs) => Promise<{ count: number }>>(),
})
const tx = {
  plan: { update: vi.fn<(args: PlanUpdateArgs) => Promise<Plan>>() },
  planPriceTier: listMock(),
  planCoverage: listMock(),
  planCountry: listMock(),
  planAddon: listMock(),
}

vi.mock('@/core/database/prisma', () => ({
  prisma: {
    plan: {
      findMany: async (args: FindManyArgs) => findManyMock(args),
      findUnique: async (args: FindUniqueArgs) => findUniqueMock(args),
      aggregate: async (args: { _max: { sortOrder: true } }) => aggregateMock(args),
      create: async (args: CreateArgs) => createMock(args),
    },
    country: { count: async (args: CountArgs) => countryCountMock(args) },
    addon: { count: async (args: CountArgs) => addonCountMock(args) },
    $transaction: async (fn: (client: typeof tx) => Promise<void>) => fn(tx),
  },
}))

const timestamps = { createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01') }
const tiers = [
  { minDays: 1, maxDays: 7, pricePerTraveller: 29_000 },
  { minDays: 8, maxDays: 31, pricePerTraveller: 69_000 },
]
const addonRow = {
  code: 'baggage-plus',
  pricingType: 'PER_TRAVELLER',
  price: 9_900,
  coverageAmount: 1_000_000,
} as const

// Coverages deliberately out of category order to prove the service re-sorts them
const planRow: PlanRow = {
  id: 'plan-1',
  code: 'asia-basic',
  type: 'SINGLE_TRIP',
  isActive: false,
  sortOrder: 0,
  ...timestamps,
  tiers,
  coverages: [
    { categoryKey: 'PERSONAL_LIABILITY', amount: 50_000_000 },
    { categoryKey: 'MEDICAL_EXPENSES', amount: 100_000_000 },
    { categoryKey: 'FLIGHT_DELAY', amount: 500_000 },
  ],
  countries: [{ country: { isoCode: 'JP' } }, { country: { isoCode: 'KR' } }],
  addons: [{ addon: addonRow }],
}
const planData: PlanAdminData = {
  id: 'plan-1',
  code: 'asia-basic',
  type: 'SINGLE_TRIP',
  isActive: false,
  sortOrder: 0,
  ...timestamps,
  tiers,
  coverages: [
    { categoryKey: 'MEDICAL_EXPENSES', amount: 100_000_000 },
    { categoryKey: 'FLIGHT_DELAY', amount: 500_000 },
    { categoryKey: 'PERSONAL_LIABILITY', amount: 50_000_000 },
  ],
  countries: ['JP', 'KR'],
  addons: [addonRow],
}
const secondRow: PlanRow = { ...planRow, id: 'plan-2', code: 'worldwide-plus', sortOrder: 1 }

const createInput: CreatePlanInput = {
  code: 'east-asia-lite',
  tiers,
  coverages: [{ categoryKey: 'MEDICAL_EXPENSES', amount: 100_000_000 }],
  countryIds: ['country-jp', 'country-kr'],
  addonIds: ['addon-1'],
}

const dbError = new Error('connection refused')
const internalError = {
  message: ERRORS.GENERIC.INTERNAL_SERVER_ERROR,
  status: HttpStatus.INTERNAL_SERVER_ERROR,
}
const notFound = { message: ERRORS.UTIL.notFound('Plan'), status: HttpStatus.NOT_FOUND }
const unknownCountry = { message: PLAN_ERRORS.UNKNOWN_COUNTRY, status: HttpStatus.BAD_REQUEST }
const unknownAddon = { message: PLAN_ERRORS.UNKNOWN_ADDON, status: HttpStatus.BAD_REQUEST }

beforeEach(() => {
  findManyMock.mockReset()
  findUniqueMock.mockReset()
  aggregateMock.mockReset()
  createMock.mockReset()
  countryCountMock.mockReset()
  addonCountMock.mockReset()
  tx.plan.update.mockReset()
  for (const model of [tx.planPriceTier, tx.planCoverage, tx.planCountry, tx.planAddon]) {
    model.deleteMany.mockReset()
    model.createMany.mockReset()
  }
})

describe('list', () => {
  it('maps rows to admin data: coverages in category order, countries as isoCodes', async () => {
    findManyMock.mockResolvedValue([planRow])

    const result = await list()

    expect(result).toEqual([planData])
  })

  it('orders plans by sortOrder, then code', async () => {
    findManyMock.mockResolvedValue([planRow, secondRow])

    await list()

    expect(findManyMock.mock.calls[0][0].orderBy).toEqual([{ sortOrder: 'asc' }, { code: 'asc' }])
  })

  it('wraps an unexpected database error as a 500 AppError', async () => {
    findManyMock.mockRejectedValue(dbError)

    await expect(list()).rejects.toMatchObject(internalError)
  })
})

describe('get', () => {
  it('returns the mapped plan when it exists', async () => {
    findUniqueMock.mockResolvedValue(planRow)

    const result = await get('plan-1')

    expect(result).toEqual(planData)
    expect(findUniqueMock.mock.calls[0][0].where).toEqual({ id: 'plan-1' })
  })

  it('throws a 404 AppError when the plan does not exist', async () => {
    findUniqueMock.mockResolvedValue(null)

    await expect(get('missing-id')).rejects.toMatchObject(notFound)
  })

  it('wraps an unexpected database error as a 500 AppError', async () => {
    findUniqueMock.mockRejectedValue(dbError)

    await expect(get('plan-1')).rejects.toMatchObject(internalError)
  })
})

describe('create', () => {
  const arrangeValidCreate = (maxSortOrder: number | null) => {
    findUniqueMock.mockResolvedValue(null)
    countryCountMock.mockResolvedValue(createInput.countryIds.length)
    addonCountMock.mockResolvedValue(createInput.addonIds.length)
    aggregateMock.mockResolvedValue({ _max: { sortOrder: maxSortOrder } })
    createMock.mockResolvedValue(planRow)
  }

  it('creates the plan with its tiers, coverages, countries and add-ons in one write', async () => {
    arrangeValidCreate(null)

    const result = await create(createInput)

    expect(result).toEqual(planData)
    expect(createMock.mock.calls[0][0].data).toEqual({
      code: 'east-asia-lite',
      sortOrder: 0,
      tiers: { createMany: { data: tiers } },
      coverages: { createMany: { data: createInput.coverages } },
      countries: {
        createMany: { data: [{ countryId: 'country-jp' }, { countryId: 'country-kr' }] },
      },
      addons: { createMany: { data: [{ addonId: 'addon-1' }] } },
    })
  })

  it('places a new plan last (current max sortOrder + 1)', async () => {
    arrangeValidCreate(4)

    await create(createInput)

    expect(createMock.mock.calls[0][0].data.sortOrder).toBe(5)
  })

  it('never sets isActive, so the plan starts inactive (schema default)', async () => {
    arrangeValidCreate(null)

    await create(createInput)

    expect(createMock.mock.calls[0][0].data).not.toHaveProperty('isActive')
  })

  it('throws a 409 AppError and never creates when the code is already taken', async () => {
    findUniqueMock.mockResolvedValue(planRow)

    await expect(create(createInput)).rejects.toMatchObject({
      message: ERRORS.UTIL.alreadyExists('Plan code'),
      status: HttpStatus.CONFLICT,
    })
    expect(findUniqueMock.mock.calls[0][0].where).toEqual({ code: 'east-asia-lite' })
    expect(createMock).not.toHaveBeenCalled()
  })

  it('throws a 400 AppError and never creates when a country id does not exist', async () => {
    findUniqueMock.mockResolvedValue(null)
    countryCountMock.mockResolvedValue(1)

    await expect(create(createInput)).rejects.toMatchObject(unknownCountry)
    expect(countryCountMock).toHaveBeenCalledWith({
      where: { id: { in: ['country-jp', 'country-kr'] } },
    })
    expect(createMock).not.toHaveBeenCalled()
  })

  it('throws a 400 AppError and never creates when an add-on id does not exist', async () => {
    findUniqueMock.mockResolvedValue(null)
    countryCountMock.mockResolvedValue(2)
    addonCountMock.mockResolvedValue(0)

    await expect(create(createInput)).rejects.toMatchObject(unknownAddon)
    expect(createMock).not.toHaveBeenCalled()
  })

  it('skips the add-on lookup when no add-ons are linked', async () => {
    arrangeValidCreate(null)

    await create({ ...createInput, addonIds: [] })

    expect(addonCountMock).not.toHaveBeenCalled()
    expect(createMock.mock.calls[0][0].data.addons).toEqual({ createMany: { data: [] } })
  })

  it('wraps an unexpected database error on create as a 500 AppError', async () => {
    arrangeValidCreate(0)
    createMock.mockRejectedValue(dbError)

    await expect(create(createInput)).rejects.toMatchObject(internalError)
  })
})

describe('update', () => {
  it('replaces only the lists that were sent and leaves the rest untouched', async () => {
    findUniqueMock.mockResolvedValue(planRow)

    await update('plan-1', { tiers })

    expect(tx.planPriceTier.deleteMany).toHaveBeenCalledWith({ where: { planId: 'plan-1' } })
    expect(tx.planPriceTier.createMany).toHaveBeenCalledWith({
      data: tiers.map((tier) => ({ ...tier, planId: 'plan-1' })),
    })
    for (const model of [tx.planCoverage, tx.planCountry, tx.planAddon]) {
      expect(model.deleteMany).not.toHaveBeenCalled()
      expect(model.createMany).not.toHaveBeenCalled()
    }
    expect(countryCountMock).not.toHaveBeenCalled()
    expect(addonCountMock).not.toHaveBeenCalled()
  })

  it('replaces every list sent, attaching the plan id to each row', async () => {
    findUniqueMock.mockResolvedValue(planRow)
    countryCountMock.mockResolvedValue(1)
    addonCountMock.mockResolvedValue(1)

    await update('plan-1', {
      coverages: [{ categoryKey: 'BAGGAGE_LOSS', amount: 2_000_000 }],
      countryIds: ['country-jp'],
      addonIds: ['addon-1'],
    })

    expect(tx.planCoverage.createMany).toHaveBeenCalledWith({
      data: [{ categoryKey: 'BAGGAGE_LOSS', amount: 2_000_000, planId: 'plan-1' }],
    })
    expect(tx.planCountry.createMany).toHaveBeenCalledWith({
      data: [{ planId: 'plan-1', countryId: 'country-jp' }],
    })
    expect(tx.planAddon.createMany).toHaveBeenCalledWith({
      data: [{ planId: 'plan-1', addonId: 'addon-1' }],
    })
    expect(tx.planPriceTier.deleteMany).not.toHaveBeenCalled()
  })

  it('clears every add-on when addonIds is an empty list', async () => {
    findUniqueMock.mockResolvedValue(planRow)

    await update('plan-1', { addonIds: [] })

    expect(tx.planAddon.deleteMany).toHaveBeenCalledWith({ where: { planId: 'plan-1' } })
    expect(tx.planAddon.createMany).toHaveBeenCalledWith({ data: [] })
    expect(addonCountMock).not.toHaveBeenCalled()
  })

  it('always updates the plan row (isActive, and updatedAt) and returns the re-read plan', async () => {
    const activeRow = { ...planRow, isActive: true }
    findUniqueMock.mockResolvedValueOnce(planRow).mockResolvedValueOnce(activeRow)

    const result = await update('plan-1', { isActive: true })

    expect(tx.plan.update).toHaveBeenCalledWith({
      where: { id: 'plan-1' },
      data: { isActive: true },
    })
    expect(result).toEqual({ ...planData, isActive: true })
  })

  it('throws a 404 AppError and never writes when the plan does not exist', async () => {
    findUniqueMock.mockResolvedValue(null)

    await expect(update('missing-id', { isActive: true })).rejects.toMatchObject(notFound)
    expect(tx.plan.update).not.toHaveBeenCalled()
  })

  it('throws a 400 AppError and never writes when a country id does not exist', async () => {
    findUniqueMock.mockResolvedValue(planRow)
    countryCountMock.mockResolvedValue(0)

    await expect(update('plan-1', { countryIds: ['unknown-id'] })).rejects.toMatchObject(
      unknownCountry
    )
    expect(tx.planCountry.deleteMany).not.toHaveBeenCalled()
    expect(tx.plan.update).not.toHaveBeenCalled()
  })

  it('wraps a failure inside the transaction as a 500 AppError and skips the re-read', async () => {
    findUniqueMock.mockResolvedValue(planRow)
    tx.planPriceTier.createMany.mockRejectedValue(dbError)

    await expect(update('plan-1', { tiers })).rejects.toMatchObject(internalError)
    expect(findUniqueMock).toHaveBeenCalledTimes(1)
  })
})

describe('reorder', () => {
  const existingIds = [{ id: 'plan-1' }, { id: 'plan-2' }]
  const mismatch = {
    message: ERRORS.UTIL.reorderMismatch('plan'),
    status: HttpStatus.BAD_REQUEST,
  }

  it('writes every sortOrder in one transaction and returns the re-sorted list', async () => {
    findManyMock
      .mockResolvedValueOnce(existingIds)
      .mockResolvedValueOnce([
        { ...secondRow, sortOrder: 0 },
        { ...planRow, sortOrder: 1 },
      ])

    const result = await reorder({
      items: [
        { id: 'plan-2', sortOrder: 0 },
        { id: 'plan-1', sortOrder: 1 },
      ],
    })

    expect(result.map(({ id, sortOrder }) => ({ id, sortOrder }))).toEqual([
      { id: 'plan-2', sortOrder: 0 },
      { id: 'plan-1', sortOrder: 1 },
    ])
    expect(tx.plan.update).toHaveBeenCalledTimes(2)
    expect(tx.plan.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'plan-2' },
      data: { sortOrder: 0 },
    })
    expect(tx.plan.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'plan-1' },
      data: { sortOrder: 1 },
    })
  })

  it('throws a 400 AppError and writes nothing when a plan is missing from the list', async () => {
    findManyMock.mockResolvedValue(existingIds)

    await expect(reorder({ items: [{ id: 'plan-1', sortOrder: 0 }] })).rejects.toMatchObject(
      mismatch
    )
    expect(tx.plan.update).not.toHaveBeenCalled()
  })

  it('throws a 400 AppError and writes nothing when the list has an unknown id', async () => {
    findManyMock.mockResolvedValue(existingIds)

    await expect(
      reorder({
        items: [
          { id: 'plan-1', sortOrder: 0 },
          { id: 'unknown-id', sortOrder: 1 },
        ],
      })
    ).rejects.toMatchObject(mismatch)
    expect(tx.plan.update).not.toHaveBeenCalled()
  })

  it('wraps a failure inside the transaction as a 500 AppError and skips the re-list', async () => {
    findManyMock.mockResolvedValue(existingIds)
    tx.plan.update.mockRejectedValue(dbError)

    await expect(
      reorder({
        items: [
          { id: 'plan-1', sortOrder: 0 },
          { id: 'plan-2', sortOrder: 1 },
        ],
      })
    ).rejects.toMatchObject(internalError)
    expect(findManyMock).toHaveBeenCalledTimes(1)
  })
})
