import { z } from 'zod'
import { ERRORS } from '@/shared/constants'

const emailField = z
  .string({ error: ERRORS.UTIL.requiredField('Email') })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: ERRORS.UTIL.invalidField('email') }))

const signInSchema = z.object({
  email: emailField,
  password: z
    .string({ error: ERRORS.UTIL.requiredField('Password') })
    .min(8, ERRORS.UTIL.minLength('Password', 8)),
})

export const authSchema = {
  signIn: {
    body: signInSchema,
  },
} as const
