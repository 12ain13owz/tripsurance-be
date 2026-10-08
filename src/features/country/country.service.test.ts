import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/core/error'
import type { Country } from '@/generated/prisma/client'
import { ERRORS, HttpStatus } from '@/shared/constants'
import { list, listActive, update } from './country.service'

interface FindManyArgs {
  where?: { isActive: boolean }
  orderBy: { isoCode: 'asc' }
}

const findManyMock = vi.fn<(args: FindManyArgs) => Promise<Country[]>>()
const findUniqueMock = vi.fn<(args: { where: { id: string } }) => Promise<Country | null>>()
const updateMock =
  vi.fn<(args: { where: { id: string }; data: { isActive: boolean } }) => Promise<Country>>()

vi.mock('@/core/database/prisma', () => ({
  prisma: {
    country: {
      findMany: async (args: FindManyArgs) => findManyMock(args),
      findUnique: async (args: { where: { id: string } }) => findUniqueMock(args),
      update: async (args: { where: { id: string }; data: { isActive: boolean } }) =>
        updateMock(args),
    },
  },
}))

const country: Country = {
  id: 'country-1',
  isoCode: 'JP',
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
}

beforeEach(() => {
  findManyMock.mockReset()
  findUniqueMock.mockReset()
  updateMock.mockReset()
})

describe('list', () => {
  it('returns countries ordered by isoCode ascending', async () => {
    findManyMock.mockResolvedValue([country])

    const result = await list()

    expect(result).toEqual([country])
    expect(findManyMock).toHaveBeenCalledWith({ orderBy: { isoCode: 'asc' } })
  })

  it('wraps an unexpected database error as a 500 AppError', async () => {
    findManyMock.mockRejectedValue(new Error('connection refused'))

    await expect(list()).rejects.toMatchObject({
      message: ERRORS.GENERIC.INTERNAL_SERVER_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    })
  })
})

describe('listActive', () => {
  it('returns only active countries ordered by isoCode ascending', async () => {
    findManyMock.mockResolvedValue([country])

    const result = await listActive()

    expect(result).toEqual([country])
    expect(findManyMock).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { isoCode: 'asc' },
    })
  })

  it('wraps an unexpected database error as a 500 AppError', async () => {
    findManyMock.mockRejectedValue(new Error('connection refused'))

    await expect(listActive()).rejects.toMatchObject({
      message: ERRORS.GENERIC.INTERNAL_SERVER_ERROR,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    })
  })
})

describe('update', () => {
  it('updates and returns the country when it exists', async () => {
    findUniqueMock.mockResolvedValue(country)
    updateMock.mockResolvedValue({ ...country, isActive: false })

    const result = await update('country-1', false)

    expect(result).toEqual({ ...country, isActive: false })
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'country-1' },
      data: { isActive: false },
    })
  })

  it('throws a 404 AppError and never calls update when the country does not exist', async () => {
    findUniqueMock.mockResolvedValue(null)

    await expect(update('missing-id', false)).rejects.toMatchObject({
      message: ERRORS.UTIL.notFound('Country'),
      status: HttpStatus.NOT_FOUND,
    })
    expect(updateMock).not.toHaveBeenCalled()
  })

  it('is an instance of AppError on the not-found path', async () => {
    findUniqueMock.mockResolvedValue(null)

    await expect(update('missing-id', false)).rejects.toBeInstanceOf(AppError)
  })
})
