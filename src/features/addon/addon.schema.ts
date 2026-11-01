import { z } from 'zod'
import { AddonPricingType } from '@/generated/prisma/enums'
import { ERRORS } from '@/shared/constants'
import { amountField, codeField, createReorderSchema } from '@/shared/utils'

const pricingTypeField = z.enum(AddonPricingType, {
  error: ERRORS.UTIL.invalidField('pricing type'),
})

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

const reorderSchema = createReorderSchema('add-on', 'Add-on id')

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
