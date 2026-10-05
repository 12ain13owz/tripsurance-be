import countries from 'i18n-iso-countries'
import z from 'zod'
import { ERRORS } from '@/shared/constants'

const ISO_CODE_REGEX = /^[A-Z]{2}$/

const isoCodeSchema = z
  .string({ error: ERRORS.UTIL.requiredField('ISO Code') })
  .trim()
  .toUpperCase()
  .regex(ISO_CODE_REGEX, ERRORS.UTIL.invalidField('ISO code'))
  .refine((code) => countries.isValid(code), { message: ERRORS.UTIL.invalidField('ISO code') })

const createSchema = z.object({
  isoCode: isoCodeSchema,
})

const updateSchema = z
  .object({
    isoCode: isoCodeSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => data.isoCode !== undefined || data.isActive !== undefined, {
    message: ERRORS.UTIL.requiredField('isoCode or isActive'),
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
