import { prisma } from '@/core/database/prisma'
import { AppError, wrapUnexpected } from '@/core/error'
import type { Country } from '@/generated/prisma/client'
import { ERRORS, ErrorSeverity, HttpStatus } from '@/shared/constants'

// ------------------------------------------------------------------------------
// Helpers (not exported)
// ------------------------------------------------------------------------------

const findById = async (id: string): Promise<Country> => {
  const query = prisma.country.findUnique({ where: { id } })
  const country = await wrapUnexpected(query, 'findById', { id })

  if (!country) {
    throw new AppError(ERRORS.UTIL.notFound('Country'), HttpStatus.NOT_FOUND, ErrorSeverity.WARN)
      .withOperation('findById')
      .withMetadata({ id })
  }

  return country
}

// ------------------------------------------------------------------------------
// * Exported
// ------------------------------------------------------------------------------

export const list = async (): Promise<Country[]> => {
  const query = prisma.country.findMany({ orderBy: { isoCode: 'asc' } })
  const countries = await wrapUnexpected(query, 'listCountry')

  return countries
}

export const listActive = async (): Promise<Country[]> => {
  const query = prisma.country.findMany({ where: { isActive: true }, orderBy: { isoCode: 'asc' } })
  const countries = await wrapUnexpected(query, 'listActiveCountry')
  return countries
}

export const update = async (id: string, isActive: boolean): Promise<Country> => {
  await findById(id)

  const query = prisma.country.update({ where: { id }, data: { isActive } })
  const country = await wrapUnexpected(query, 'updateCountry', { id, isActive })

  const data: Country = country
  return data
}
