import z from 'zod'
import { ERRORS } from '@/shared/constants'

const updateSchema = z.object({
  isActive: z.boolean({ error: ERRORS.UTIL.requiredField('isActive') }),
})

const idParamsSchema = z.object({
  id: z.string({ error: ERRORS.UTIL.requiredField('Country id') }),
})

export const countrySchema = {
  update: { body: updateSchema, params: idParamsSchema },
} as const

export type UpdateCountryInput = z.infer<typeof updateSchema>
export type CountryIdParams = z.infer<typeof idParamsSchema>
