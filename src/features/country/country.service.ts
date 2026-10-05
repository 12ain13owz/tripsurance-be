import { prisma } from '@/core/database/prisma'
import { AppError, wrapUnexpected } from '@/core/error'
import type { Country } from '@/generated/prisma/client'
import { ERRORS, ErrorSeverity, HttpStatus } from '@/shared/constants'
import type { UpdateCountryInput } from './country.schema'

// ------------------------------------------------------------------------------
// Helpers (not exported)
// ------------------------------------------------------------------------------

const findById = async (id: string): Promise<Country> => {
  const country = await wrapUnexpected(async () => prisma.country.findUnique({ where: { id } }), {
    operation: 'findById',
    metadata: { id },
  })

  if (!country) {
    throw new AppError(ERRORS.UTIL.notFound('Country'), HttpStatus.NOT_FOUND, ErrorSeverity.WARN)
      .withOperation('findById')
      .withMetadata({ id })
  }

  return country
}

const assertIsoCodeAvailable = async (isoCode: string, excludeId: string): Promise<void> => {
  const conflict = await wrapUnexpected(
    async () => prisma.country.findUnique({ where: { isoCode } }),
    { operation: 'updateCountry', metadata: { isoCode, excludeId } }
  )

  if (!conflict || conflict.id === excludeId) {
    return
  }

  throw new AppError(ERRORS.UTIL.alreadyExists('Country'), HttpStatus.CONFLICT, ErrorSeverity.WARN)
    .withOperation('update')
    .withMetadata({ id: excludeId, isoCode })
}

// ------------------------------------------------------------------------------
// * Exported
// ------------------------------------------------------------------------------

export const list = async (): Promise<Country[]> => {
  const countries = await wrapUnexpected(
    async () => prisma.country.findMany({ orderBy: { isoCode: 'asc' } }),
    { operation: 'listCountry' }
  )
  return countries
}

export const create = async (isoCode: string): Promise<Country> => {
  const existing = await wrapUnexpected(
    async () => prisma.country.findUnique({ where: { isoCode } }),
    { operation: 'createCountry', metadata: { isoCode } }
  )

  if (existing) {
    throw new AppError(
      ERRORS.UTIL.alreadyExists('Country'),
      HttpStatus.CONFLICT,
      ErrorSeverity.WARN
    )
      .withOperation('create')
      .withMetadata({ isoCode })
  }

  const country = await wrapUnexpected(async () => prisma.country.create({ data: { isoCode } }), {
    operation: 'createCountry',
    metadata: { isoCode },
  })

  const data: Country = country
  return data
}

export const update = async (id: string, payload: UpdateCountryInput): Promise<Country> => {
  await findById(id)

  if (payload.isoCode !== undefined) {
    await assertIsoCodeAvailable(payload.isoCode, id)
  }

  const country = await wrapUnexpected(
    async () => prisma.country.update({ where: { id }, data: payload }),
    { operation: 'updateCountry', metadata: { id, ...payload } }
  )

  const data: Country = country
  return data
}

export const remove = async (id: string): Promise<Country> => {
  await findById(id)

  const country = await wrapUnexpected(async () => prisma.country.delete({ where: { id } }), {
    operation: 'removeCountry',
    metadata: { id },
  })

  const data: Country = country
  return data
}
