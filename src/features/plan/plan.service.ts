import { prisma } from '@/core/database/prisma'
import { AppError, wrapUnexpected } from '@/core/error'
import type { Prisma } from '@/generated/prisma/client'
import { ERRORS, ErrorSeverity, HttpStatus } from '@/shared/constants'
import { PLAN_COVERAGE_CATEGORIES, PLAN_ERRORS } from './plan.const'
import type { CreatePlanInput, ReorderPlanInput, UpdatePlanInput } from './plan.schema'
import type { PlanAdminData } from './plan.type'

const LIST_ORDER = [{ sortOrder: 'asc' }, { code: 'asc' }] as const

const PLAN_INCLUDE = {
  tiers: {
    select: { minDays: true, maxDays: true, pricePerTraveller: true },
    orderBy: { minDays: 'asc' },
  },
  coverages: { select: { categoryKey: true, amount: true } },
  countries: {
    select: { country: { select: { isoCode: true } } },
    orderBy: { country: { isoCode: 'asc' } },
  },
  addons: {
    select: {
      addon: { select: { code: true, pricingType: true, price: true, coverageAmount: true } },
    },
    orderBy: [{ addon: { sortOrder: 'asc' } }, { addon: { code: 'asc' } }],
  },
} satisfies Prisma.PlanInclude

type PlanWithRelations = Prisma.PlanGetPayload<{ include: typeof PLAN_INCLUDE }>

// ------------------------------------------------------------------------------
// Helpers (not exported)
// ------------------------------------------------------------------------------

const coverageRank = (categoryKey: string): number =>
  PLAN_COVERAGE_CATEGORIES.findIndex((key) => key === categoryKey)

const toAdminData = ({
  tiers,
  coverages,
  countries,
  addons,
  ...plan
}: PlanWithRelations): PlanAdminData => ({
  ...plan,
  tiers,
  coverages: [...coverages].sort(
    (a, b) => coverageRank(a.categoryKey) - coverageRank(b.categoryKey)
  ),
  countries: countries.map(({ country }) => country.isoCode),
  addons: addons.map(({ addon }) => addon),
})

const findById = async (id: string, operation: string): Promise<PlanWithRelations> => {
  const query = prisma.plan.findUnique({ where: { id }, include: PLAN_INCLUDE })
  const plan = await wrapUnexpected(query, operation, { id })

  if (!plan) {
    throw new AppError(ERRORS.UTIL.notFound('Plan'), HttpStatus.NOT_FOUND, ErrorSeverity.WARN)
      .withOperation(operation)
      .withMetadata({ id })
  }

  return plan
}

// Rules 11, 13: every linked country / add-on id must exist (400 otherwise)
const assertLinksExist = async (
  { countryIds, addonIds }: Pick<UpdatePlanInput, 'countryIds' | 'addonIds'>,
  operation: string
): Promise<void> => {
  if (countryIds) {
    const countryCountQuery = prisma.country.count({ where: { id: { in: countryIds } } })
    const countryCount = await wrapUnexpected(countryCountQuery, operation, { countryIds })

    if (countryCount !== countryIds.length) {
      throw new AppError(PLAN_ERRORS.UNKNOWN_COUNTRY, HttpStatus.BAD_REQUEST, ErrorSeverity.WARN)
        .withOperation(operation)
        .withMetadata({ countryIds })
    }
  }

  if (addonIds?.length) {
    const addonCountQuery = prisma.addon.count({ where: { id: { in: addonIds } } })
    const addonCount = await wrapUnexpected(addonCountQuery, operation, { addonIds })

    if (addonCount !== addonIds.length) {
      throw new AppError(PLAN_ERRORS.UNKNOWN_ADDON, HttpStatus.BAD_REQUEST, ErrorSeverity.WARN)
        .withOperation(operation)
        .withMetadata({ addonIds })
    }
  }
}

// ------------------------------------------------------------------------------
// * Exported
// ------------------------------------------------------------------------------

export const list = async (): Promise<PlanAdminData[]> => {
  const query = prisma.plan.findMany({ orderBy: [...LIST_ORDER], include: PLAN_INCLUDE })
  const plans = await wrapUnexpected(query, 'listPlan')

  return plans.map(toAdminData)
}

export const get = async (id: string): Promise<PlanAdminData> => {
  const plan = await findById(id, 'getPlan')

  return toAdminData(plan)
}

export const create = async (input: CreatePlanInput): Promise<PlanAdminData> => {
  const existingQuery = prisma.plan.findUnique({ where: { code: input.code } })
  const existing = await wrapUnexpected(existingQuery, 'createPlan', { code: input.code })

  if (existing) {
    throw new AppError(
      ERRORS.UTIL.alreadyExists('Plan code'),
      HttpStatus.CONFLICT,
      ErrorSeverity.WARN
    )
      .withOperation('createPlan')
      .withMetadata({ code: input.code })
  }

  await assertLinksExist(input, 'createPlan')

  const maxQuery = prisma.plan.aggregate({ _max: { sortOrder: true } })
  const { _max } = await wrapUnexpected(maxQuery, 'createPlan', { code: input.code })
  const sortOrder = _max.sortOrder === null ? 0 : _max.sortOrder + 1

  const createQuery = prisma.plan.create({
    data: {
      code: input.code,
      sortOrder,
      tiers: { createMany: { data: input.tiers } },
      coverages: { createMany: { data: input.coverages } },
      countries: { createMany: { data: input.countryIds.map((countryId) => ({ countryId })) } },
      addons: { createMany: { data: input.addonIds.map((addonId) => ({ addonId })) } },
    },
    include: PLAN_INCLUDE,
  })
  const plan = await wrapUnexpected(createQuery, 'createPlan', { code: input.code })

  const data: PlanAdminData = toAdminData(plan)
  return data
}

export const update = async (id: string, input: UpdatePlanInput): Promise<PlanAdminData> => {
  await findById(id, 'updatePlan')
  await assertLinksExist(input, 'updatePlan')

  const { isActive, tiers, coverages, countryIds, addonIds } = input

  // Rule 19: each list sent replaces that list; a list not sent is left untouched
  const updatePlanQuery = prisma.$transaction(async (tx) => {
    if (tiers) {
      await tx.planPriceTier.deleteMany({ where: { planId: id } })
      await tx.planPriceTier.createMany({ data: tiers.map((tier) => ({ ...tier, planId: id })) })
    }
    if (coverages) {
      await tx.planCoverage.deleteMany({ where: { planId: id } })
      await tx.planCoverage.createMany({
        data: coverages.map((coverage) => ({ ...coverage, planId: id })),
      })
    }
    if (countryIds) {
      await tx.planCountry.deleteMany({ where: { planId: id } })
      await tx.planCountry.createMany({
        data: countryIds.map((countryId) => ({ planId: id, countryId })),
      })
    }
    if (addonIds) {
      await tx.planAddon.deleteMany({ where: { planId: id } })
      await tx.planAddon.createMany({ data: addonIds.map((addonId) => ({ planId: id, addonId })) })
    }
    // Always touch the plan row so updatedAt moves even when only child lists changed
    await tx.plan.update({ where: { id }, data: { isActive } })
  })
  await wrapUnexpected(updatePlanQuery, 'updatePlan', { id })

  const plan = await findById(id, 'updatePlan')

  const data: PlanAdminData = toAdminData(plan)
  return data
}

export const reorder = async (input: ReorderPlanInput): Promise<PlanAdminData[]> => {
  const idsQuery = prisma.plan.findMany({ select: { id: true } })
  const existing = await wrapUnexpected(idsQuery, 'reorderPlan')

  const submittedIds = new Set(input.items.map((item) => item.id))
  const isExactMatch =
    existing.length === input.items.length && existing.every(({ id }) => submittedIds.has(id))

  if (!isExactMatch) {
    throw new AppError(
      ERRORS.UTIL.reorderMismatch('plan'),
      HttpStatus.BAD_REQUEST,
      ErrorSeverity.WARN
    )
      .withOperation('reorderPlan')
      .withMetadata({ expected: existing.length, received: input.items.length })
  }

  const updateQuery = prisma.$transaction(async (tx) => {
    for (const { id, sortOrder } of input.items) {
      await tx.plan.update({ where: { id }, data: { sortOrder } })
    }
  })
  await wrapUnexpected(updateQuery, 'reorderPlan')

  return list()
}
