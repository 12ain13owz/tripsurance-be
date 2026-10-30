import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Addon } from '@/generated/prisma/client'
import { ERRORS, HttpStatus } from '@/shared/constants'
import { create, get, list, reorder, update } from './addon.service'
import type { CreateAddonInput, UpdateAddonInput } from './addon.schema'

interface FindManyArgs {
  orderBy?: { sortOrder?: 'asc'; code?: 'asc' }[]
  select?: { id: true }
}
interface UpdateArgs {
  where: { id: string }
  data: UpdateAddonInput | { sortOrder: number }
}
interface TransactionClient {
  addon: { update: (args: UpdateArgs) => Promise<Addon> }
}

const findManyMock = vi.fn<(args: FindManyArgs) => Promise<Addon[] | Pick<Addon, 'id'>[]>>()
const findUniqueMock =
  vi.fn<(args: { where: { id?: string; code?: string } }) => Promise<Addon | null>>()
const aggregateMock =
  vi.fn<(args: { _max: { sortOrder: true } }) => Promise<{ _max: { sortOrder: number | null } }>>()
const createMock =
  vi.fn<(args: { data: CreateAddonInput & { sortOrder: number } }) => Promise<Addon>>()
const updateMock = vi.fn<(args: UpdateArgs) => Promise<Addon>>()
const txUpdateMock = vi.fn<(args: UpdateArgs) => Promise<Addon>>()

vi.mock('@/core/database/prisma', () => ({
  prisma: {
    addon: {
      findMany: async (args: FindManyArgs) => findManyMock(args),
      findUnique: async (args: { where: { id?: string; code?: string } }) => findUniqueMock(args),
      aggregate: async (args: { _max: { sortOrder: true } }) => aggregateMock(args),
      create: async (args: { data: CreateAddonInput & { sortOrder: number } }) => createMock(args),
      update: async (args: UpdateArgs) => updateMock(args),
    },
    $transaction: async (fn: (tx: TransactionClient) => Promise<void>) =>
      fn({ addon: { update: async (args: UpdateArgs) => txUpdateMock(args) } }),
  },
}))

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
const secondAddon: Addon = {
  ...addon,
  id: 'addon-2',
  code: 'baggage-plus',
  pricingType: 'PER_TRAVELLER',
  coverageAmount: 1_000_000,
  sortOrder: 1,
}
const createInput: CreateAddonInput = {
  code: 'baggage-plus',
  pricingType: 'PER_TRAVELLER',
  price: 9_900,
  coverageAmount: 1_000_000,
}

const dbError = new Error('connection refused')
const internalError = {
  message: ERRORS.GENERIC.INTERNAL_SERVER_ERROR,
  status: HttpStatus.INTERNAL_SERVER_ERROR,
}

beforeEach(() => {
  findManyMock.mockReset()
  findUniqueMock.mockReset()
  aggregateMock.mockReset()
  createMock.mockReset()
  updateMock.mockReset()
  txUpdateMock.mockReset()
})

describe('list', () => {
  it('returns add-ons ordered by sortOrder, then code', async () => {
    findManyMock.mockResolvedValue([addon, secondAddon])

    const result = await list()

    expect(result).toEqual([addon, secondAddon])
    expect(findManyMock).toHaveBeenCalledWith({ orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] })
  })

  it('wraps an unexpected database error as a 500 AppError', async () => {
    findManyMock.mockRejectedValue(dbError)

    await expect(list()).rejects.toMatchObject(internalError)
  })
})

describe('get', () => {
  it('returns the add-on when it exists', async () => {
    findUniqueMock.mockResolvedValue(addon)

    const result = await get('addon-1')

    expect(result).toEqual(addon)
    expect(findUniqueMock).toHaveBeenCalledWith({ where: { id: 'addon-1' } })
  })

  it('throws a 404 AppError when the add-on does not exist', async () => {
    findUniqueMock.mockResolvedValue(null)

    await expect(get('missing-id')).rejects.toMatchObject({
      message: ERRORS.UTIL.notFound('Add-on'),
      status: HttpStatus.NOT_FOUND,
    })
  })

  it('wraps an unexpected database error as a 500 AppError', async () => {
    findUniqueMock.mockRejectedValue(dbError)

    await expect(get('addon-1')).rejects.toMatchObject(internalError)
  })
})

describe('create', () => {
  it('places the first add-on at sortOrder 0', async () => {
    findUniqueMock.mockResolvedValue(null)
    aggregateMock.mockResolvedValue({ _max: { sortOrder: null } })
    createMock.mockResolvedValue(addon)

    await create(createInput)

    expect(createMock).toHaveBeenCalledWith({ data: { ...createInput, sortOrder: 0 } })
  })

  it('places a new add-on last (current max sortOrder + 1)', async () => {
    findUniqueMock.mockResolvedValue(null)
    aggregateMock.mockResolvedValue({ _max: { sortOrder: 40 } })
    createMock.mockResolvedValue({ ...secondAddon, sortOrder: 41 })

    const result = await create(createInput)

    expect(result.sortOrder).toBe(41)
    expect(createMock).toHaveBeenCalledWith({ data: { ...createInput, sortOrder: 41 } })
  })

  it('throws a 409 AppError and never creates when the code is already taken', async () => {
    findUniqueMock.mockResolvedValue(secondAddon)

    await expect(create(createInput)).rejects.toMatchObject({
      message: ERRORS.UTIL.alreadyExists('Add-on code'),
      status: HttpStatus.CONFLICT,
    })
    expect(findUniqueMock).toHaveBeenCalledWith({ where: { code: 'baggage-plus' } })
    expect(aggregateMock).not.toHaveBeenCalled()
    expect(createMock).not.toHaveBeenCalled()
  })

  it('wraps an unexpected database error on create as a 500 AppError', async () => {
    findUniqueMock.mockResolvedValue(null)
    aggregateMock.mockResolvedValue({ _max: { sortOrder: 0 } })
    createMock.mockRejectedValue(dbError)

    await expect(create(createInput)).rejects.toMatchObject(internalError)
  })
})

describe('update', () => {
  it('updates and returns the add-on when it exists', async () => {
    findUniqueMock.mockResolvedValue(addon)
    updateMock.mockResolvedValue({ ...addon, price: 2_500, isActive: true })

    const result = await update('addon-1', { price: 2_500, isActive: true })

    expect(result).toEqual({ ...addon, price: 2_500, isActive: true })
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'addon-1' },
      data: { price: 2_500, isActive: true },
    })
  })

  it('passes coverageAmount null through to clear it', async () => {
    findUniqueMock.mockResolvedValue(secondAddon)
    updateMock.mockResolvedValue({ ...secondAddon, coverageAmount: null })

    await update('addon-2', { coverageAmount: null })

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'addon-2' },
      data: { coverageAmount: null },
    })
  })

  it('throws a 404 AppError and never calls update when the add-on does not exist', async () => {
    findUniqueMock.mockResolvedValue(null)

    await expect(update('missing-id', { isActive: true })).rejects.toMatchObject({
      message: ERRORS.UTIL.notFound('Add-on'),
      status: HttpStatus.NOT_FOUND,
    })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('wraps an unexpected database error as a 500 AppError', async () => {
    findUniqueMock.mockResolvedValue(addon)
    updateMock.mockRejectedValue(dbError)

    await expect(update('addon-1', { isActive: true })).rejects.toMatchObject(internalError)
  })
})

describe('reorder', () => {
  const existingIds = [{ id: 'addon-1' }, { id: 'addon-2' }]
  const mismatch = {
    message: ERRORS.UTIL.reorderMismatch('add-on'),
    status: HttpStatus.BAD_REQUEST,
  }

  it('writes every sortOrder in one transaction and returns the re-sorted list', async () => {
    const reordered = [
      { ...secondAddon, sortOrder: 0 },
      { ...addon, sortOrder: 1 },
    ]
    findManyMock.mockResolvedValueOnce(existingIds).mockResolvedValueOnce(reordered)

    const result = await reorder({
      items: [
        { id: 'addon-2', sortOrder: 0 },
        { id: 'addon-1', sortOrder: 1 },
      ],
    })

    expect(result).toEqual(reordered)
    expect(txUpdateMock).toHaveBeenCalledTimes(2)
    expect(txUpdateMock).toHaveBeenNthCalledWith(1, {
      where: { id: 'addon-2' },
      data: { sortOrder: 0 },
    })
    expect(txUpdateMock).toHaveBeenNthCalledWith(2, {
      where: { id: 'addon-1' },
      data: { sortOrder: 1 },
    })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('throws a 400 AppError and writes nothing when an add-on is missing from the list', async () => {
    findManyMock.mockResolvedValue(existingIds)

    await expect(reorder({ items: [{ id: 'addon-1', sortOrder: 0 }] })).rejects.toMatchObject(
      mismatch
    )
    expect(txUpdateMock).not.toHaveBeenCalled()
  })

  it('throws a 400 AppError and writes nothing when the list has an unknown id', async () => {
    findManyMock.mockResolvedValue(existingIds)

    await expect(
      reorder({
        items: [
          { id: 'addon-1', sortOrder: 0 },
          { id: 'unknown-id', sortOrder: 1 },
        ],
      })
    ).rejects.toMatchObject(mismatch)
    expect(txUpdateMock).not.toHaveBeenCalled()
  })

  it('throws a 400 AppError and writes nothing when the list has extra ids', async () => {
    findManyMock.mockResolvedValue(existingIds)

    await expect(
      reorder({
        items: [
          { id: 'addon-1', sortOrder: 0 },
          { id: 'addon-2', sortOrder: 1 },
          { id: 'addon-3', sortOrder: 2 },
        ],
      })
    ).rejects.toMatchObject(mismatch)
    expect(txUpdateMock).not.toHaveBeenCalled()
  })

  it('wraps a failure inside the transaction as a 500 AppError and skips the re-list', async () => {
    findManyMock.mockResolvedValue(existingIds)
    txUpdateMock.mockRejectedValue(dbError)

    await expect(
      reorder({
        items: [
          { id: 'addon-1', sortOrder: 0 },
          { id: 'addon-2', sortOrder: 1 },
        ],
      })
    ).rejects.toMatchObject(internalError)
    expect(findManyMock).toHaveBeenCalledTimes(1)
  })
})
