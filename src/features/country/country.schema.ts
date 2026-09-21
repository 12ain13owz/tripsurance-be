import z from 'zod'
import { ERRORS } from '@/shared/constants'

const ISO_CODE_REGEX = /^[A-Z]{2}$/

const createSchema = z.object({
  isoCode: z
    .string({ error: ERRORS.UTIL.requiredField('ISO Code') })
    .trim()
    .toUpperCase()
    .regex(ISO_CODE_REGEX, ERRORS.UTIL.invalidField('ISO code')),
})

const updateSchema = z.object({
  isActive: z.boolean({ error: ERRORS.UTIL.requiredField('isActive') }),
})

const idParamsSchema = z.object({
  id: z.string({ error: ERRORS.UTIL.requiredField('Country id') }),
})

export const countrySchema = {
  create: { body: createSchema },
  update: { body: updateSchema, params: idParamsSchema },
  remove: { params: idParamsSchema },
} as const

export type CreateCountryInput = z.infer<typeof createSchema>
export type UpdateCountryInput = z.infer<typeof updateSchema>
export type CountryIdParams = z.infer<typeof idParamsSchema>
