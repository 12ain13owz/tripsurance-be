import { prisma } from '@/core/database/prisma'
import { AppError, wrapUnexpected } from '@/core/error'
import type { Addon } from '@/generated/prisma/client'
import { ERRORS, ErrorSeverity, HttpStatus } from '@/shared/constants'
import type { CreateAddonInput, ReorderAddonInput, UpdateAddonInput } from './addon.schema'

const LIST_ORDER = [{ sortOrder: 'asc' }, { code: 'asc' }] as const

// ------------------------------------------------------------------------------
// Helpers (not exported)
// ------------------------------------------------------------------------------

const findById = async (id: string, operation: string): Promise<Addon> => {
  const query = prisma.addon.findUnique({ where: { id } })
  const addon = await wrapUnexpected(query, operation, { id })

  if (!addon) {
    throw new AppError(ERRORS.UTIL.notFound('Add-on'), HttpStatus.NOT_FOUND, ErrorSeverity.WARN)
      .withOperation(operation)
      .withMetadata({ id })
  }

  return addon
}

// ------------------------------------------------------------------------------
// * Exported
// ------------------------------------------------------------------------------

export const list = async (): Promise<Addon[]> => {
  const query = prisma.addon.findMany({ orderBy: [...LIST_ORDER] })
  const addons = await wrapUnexpected(query, 'listAddon')

  return addons
}

export const get = async (id: string): Promise<Addon> => {
  return findById(id, 'getAddon')
}

export const create = async (input: CreateAddonInput): Promise<Addon> => {
  const existingQuery = prisma.addon.findUnique({ where: { code: input.code } })
  const existing = await wrapUnexpected(existingQuery, 'createAddon', { code: input.code })

  if (existing) {
    throw new AppError(
      ERRORS.UTIL.alreadyExists('Add-on code'),
      HttpStatus.CONFLICT,
      ErrorSeverity.WARN
    )
      .withOperation('createAddon')
      .withMetadata({ code: input.code })
  }

  const maxQuery = prisma.addon.aggregate({ _max: { sortOrder: true } })
  const { _max } = await wrapUnexpected(maxQuery, 'createAddon', { code: input.code })
  const sortOrder = _max.sortOrder === null ? 0 : _max.sortOrder + 1

  const createQuery = prisma.addon.create({ data: { ...input, sortOrder } })
  const addon = await wrapUnexpected(createQuery, 'createAddon', { code: input.code })

  const data: Addon = addon
  return data
}

export const update = async (id: string, input: UpdateAddonInput): Promise<Addon> => {
  await findById(id, 'updateAddon')

  const query = prisma.addon.update({ where: { id }, data: input })
  const addon = await wrapUnexpected(query, 'updateAddon', { id })

  const data: Addon = addon
  return data
}

export const reorder = async (input: ReorderAddonInput): Promise<Addon[]> => {
  const idsQuery = prisma.addon.findMany({ select: { id: true } })
  const existing = await wrapUnexpected(idsQuery, 'reorderAddon')

  const submittedIds = new Set(input.items.map((item) => item.id))
  const isExactMatch =
    existing.length === input.items.length && existing.every(({ id }) => submittedIds.has(id))

  if (!isExactMatch) {
    throw new AppError(
      ERRORS.UTIL.reorderMismatch('add-on'),
      HttpStatus.BAD_REQUEST,
      ErrorSeverity.WARN
    )
      .withOperation('reorderAddon')
      .withMetadata({ expected: existing.length, received: input.items.length })
  }

  const updateQuery = prisma.$transaction(async (tx) => {
    for (const { id, sortOrder } of input.items) {
      await tx.addon.update({ where: { id }, data: { sortOrder } })
    }
  })
  await wrapUnexpected(updateQuery, 'reorderAddon')

  return list()
}
