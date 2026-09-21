import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/core/error'
import type { Country } from '@/generated/prisma/client'
import { ERRORS, HttpStatus } from '@/shared/constants'
import { create, list, remove, update } from './country.service'

const findManyMock = vi.fn<(args: { orderBy: { isoCode: 'asc' } }) => Promise<Country[]>>()
const findUniqueMock =
  vi.fn<(args: { where: { id: string } | { isoCode: string } }) => Promise<Country | null>>()
const createMock = vi.fn<(args: { data: { isoCode: string } }) => Promise<Country>>()
const updateMock =
  vi.fn<(args: { where: { id: string }; data: { isActive: boolean } }) => Promise<Country>>()
const deleteMock = vi.fn<(args: { where: { id: string } }) => Promise<Country>>()

vi.mock('@/core/database/prisma', () => ({
  prisma: {
    country: {
      findMany: async (args: { orderBy: { isoCode: 'asc' } }) => findManyMock(args),
      findUnique: async (args: { where: { id: string } | { isoCode: string } }) =>
        findUniqueMock(args),
      create: async (args: { data: { isoCode: string } }) => createMock(args),
      update: async (args: { where: { id: string }; data: { isActive: boolean } }) =>
        updateMock(args),
      delete: async (args: { where: { id: string } }) => deleteMock(args),
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
  createMock.mockReset()
  updateMock.mockReset()
  deleteMock.mockReset()
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

describe('create', () => {
  it('creates and returns the country when the isoCode is not already taken', async () => {
    findUniqueMock.mockResolvedValue(null)
    createMock.mockResolvedValue(country)

    const result = await create('JP')

    expect(result).toEqual(country)
    expect(findUniqueMock).toHaveBeenCalledWith({ where: { isoCode: 'JP' } })
    expect(createMock).toHaveBeenCalledWith({ data: { isoCode: 'JP' } })
  })

  it('throws a 409 AppError and never calls create when the isoCode already exists', async () => {
    findUniqueMock.mockResolvedValue(country)

    await expect(create('JP')).rejects.toMatchObject({
      message: ERRORS.UTIL.alreadyExists('Country'),
      status: HttpStatus.CONFLICT,
    })
    expect(createMock).not.toHaveBeenCalled()
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
})

describe('remove', () => {
  it('deletes and returns the country when it exists', async () => {
    findUniqueMock.mockResolvedValue(country)
    deleteMock.mockResolvedValue(country)

    const result = await remove('country-1')

    expect(result).toEqual(country)
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: 'country-1' } })
  })

  it('throws a 404 AppError and never calls delete when the country does not exist', async () => {
    findUniqueMock.mockResolvedValue(null)

    await expect(remove('missing-id')).rejects.toMatchObject({
      message: ERRORS.UTIL.notFound('Country'),
      status: HttpStatus.NOT_FOUND,
    })
    expect(deleteMock).not.toHaveBeenCalled()
  })

  it('is an instance of AppError on the not-found path', async () => {
    findUniqueMock.mockResolvedValue(null)

    await expect(remove('missing-id')).rejects.toBeInstanceOf(AppError)
  })
})
