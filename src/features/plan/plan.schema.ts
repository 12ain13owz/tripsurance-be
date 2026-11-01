import { z } from 'zod'
import { ERRORS } from '@/shared/constants'
import { amountField, codeField, createReorderSchema } from '@/shared/utils'
import {
  MAX_COVERAGE_AMOUNT,
  MAX_TRIP_DAYS,
  PLAN_COVERAGE_CATEGORIES,
  PLAN_ERRORS,
} from './plan.const'

const dayField = (label: string) =>
  z
    .number({ error: ERRORS.UTIL.requiredField(label) })
    .int(ERRORS.UTIL.invalidField(label))
    .min(1, ERRORS.UTIL.invalidField(label))
    .max(MAX_TRIP_DAYS, ERRORS.UTIL.invalidField(label))

const tierSchema = z
  .object({
    minDays: dayField('Min days'),
    maxDays: dayField('Max days'),
    pricePerTraveller: amountField('Price per traveller'),
  })
  .refine(({ minDays, maxDays }) => minDays <= maxDays, { message: PLAN_ERRORS.TIER_DAYS_ORDER })

type TierInput = z.infer<typeof tierSchema>

const sortByMinDays = (tiers: TierInput[]): TierInput[] =>
  [...tiers].sort((a, b) => a.minDays - b.minDays)

// Rules 4–5: first tier starts at day 1, each next tier starts the day after the previous ends
const startsAtDayOne = (tiers: TierInput[]): boolean =>
  tiers.length === 0 || sortByMinDays(tiers)[0].minDays === 1

const isContiguous = (tiers: TierInput[]): boolean =>
  sortByMinDays(tiers).every(
    (tier, index, sorted) => index === 0 || tier.minDays === sorted[index - 1].maxDays + 1
  )

const tiersField = z
  .array(tierSchema)
  .min(1, ERRORS.UTIL.requiredField('Price tiers'))
  .refine(startsAtDayOne, { message: PLAN_ERRORS.TIERS_START_AT_DAY_ONE })
  .refine(isContiguous, { message: PLAN_ERRORS.TIERS_NOT_CONTIGUOUS })

const coverageSchema = z.object({
  categoryKey: z.enum(PLAN_COVERAGE_CATEGORIES, {
    error: ERRORS.UTIL.invalidField('coverage category'),
  }),
  amount: amountField('Coverage amount', MAX_COVERAGE_AMOUNT),
})

const coveragesField = z
  .array(coverageSchema)
  .min(1, ERRORS.UTIL.requiredField('Coverages'))
  .refine(
    (coverages) => new Set(coverages.map((entry) => entry.categoryKey)).size === coverages.length,
    { message: PLAN_ERRORS.DUPLICATE_COVERAGE }
  )

// Rules 11, 13: duplicate ids are ignored, not rejected
const dedupe = (ids: string[]): string[] => [...new Set(ids)]

const countryIdsField = z
  .array(z.string({ error: ERRORS.UTIL.requiredField('Country id') }))
  .min(1, ERRORS.UTIL.requiredField('Countries'))
  .transform(dedupe)

const addonIdsField = z
  .array(z.string({ error: ERRORS.UTIL.requiredField('Add-on id') }))
  .transform(dedupe)

const createSchema = z.object({
  code: codeField,
  tiers: tiersField,
  coverages: coveragesField,
  countryIds: countryIdsField,
  addonIds: addonIdsField.default([]),
})

const updateSchema = z
  .object({
    isActive: z.boolean({ error: ERRORS.UTIL.requiredField('isActive') }),
    tiers: tiersField,
    coverages: coveragesField,
    countryIds: countryIdsField,
    addonIds: addonIdsField,
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: ERRORS.GENERIC.EMPTY_UPDATE })

const reorderSchema = createReorderSchema('plan', 'Plan id')

const idParamsSchema = z.object({
  id: z.string({ error: ERRORS.UTIL.requiredField('Plan id') }),
})

export const planSchema = {
  get: { params: idParamsSchema },
  create: { body: createSchema },
  update: { body: updateSchema, params: idParamsSchema },
  reorder: { body: reorderSchema },
} as const

export type CreatePlanInput = z.infer<typeof createSchema>
export type UpdatePlanInput = z.infer<typeof updateSchema>
export type ReorderPlanInput = z.infer<typeof reorderSchema>
export type PlanIdParams = z.infer<typeof idParamsSchema>
