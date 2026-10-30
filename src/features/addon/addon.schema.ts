import { z } from 'zod'
import { AddonPricingType } from '@/generated/prisma/enums'
import { ERRORS } from '@/shared/constants'

const CODE_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/
const CODE_MAX_LENGTH = 50
const MAX_AMOUNT = 100_000_000 // 1,000,000 THB in satang — sanity ceiling, not a business limit

const amountField = (label: string) =>
  z
    .number({ error: ERRORS.UTIL.requiredField(label) })
    .int(ERRORS.UTIL.invalidField(label))
    .positive(ERRORS.UTIL.invalidField(label))
    .max(MAX_AMOUNT, ERRORS.UTIL.invalidField(label))

const codeField = z
  .string({ error: ERRORS.UTIL.requiredField('Code') })
  .trim()
  .max(CODE_MAX_LENGTH, ERRORS.UTIL.maxLength('Code', CODE_MAX_LENGTH))
  .regex(CODE_REGEX, ERRORS.UTIL.invalidField('code'))

const pricingTypeField = z.enum(AddonPricingType, {
  error: ERRORS.UTIL.invalidField('pricing type'),
})

const sortOrderField = z
  .number({ error: ERRORS.UTIL.requiredField('Sort order') })
  .int(ERRORS.UTIL.invalidField('sort order'))
  .min(0, ERRORS.UTIL.invalidField('sort order'))

const createSchema = z.object({
  code: codeField,
  pricingType: pricingTypeField,
  price: amountField('Price'),
  coverageAmount: amountField('Coverage amount').nullable().optional(),
})

const updateSchema = z
  .object({
    pricingType: pricingTypeField,
    price: amountField('Price'),
    coverageAmount: amountField('Coverage amount').nullable(),
    isActive: z.boolean({ error: ERRORS.UTIL.requiredField('isActive') }),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: ERRORS.GENERIC.EMPTY_UPDATE })

const reorderSchema = z
  .object({
    items: z
      .array(
        z.object({
          id: z.string({ error: ERRORS.UTIL.requiredField('Add-on id') }),
          sortOrder: sortOrderField,
        })
      )
      .min(1, ERRORS.UTIL.requiredField('Items')),
  })
  .refine(
    ({ items }) =>
      new Set(items.map((item) => item.id)).size === items.length &&
      new Set(items.map((item) => item.sortOrder)).size === items.length,
    { message: ERRORS.UTIL.reorderMismatch('add-on') }
  )

const idParamsSchema = z.object({
  id: z.string({ error: ERRORS.UTIL.requiredField('Add-on id') }),
})

export const addonSchema = {
  get: { params: idParamsSchema },
  create: { body: createSchema },
  update: { body: updateSchema, params: idParamsSchema },
  reorder: { body: reorderSchema },
} as const

export type CreateAddonInput = z.infer<typeof createSchema>
export type UpdateAddonInput = z.infer<typeof updateSchema>
export type ReorderAddonInput = z.infer<typeof reorderSchema>
export type AddonIdParams = z.infer<typeof idParamsSchema>
