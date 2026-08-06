import { z } from 'zod'

const emailField = z.string().trim().toLowerCase().pipe(z.email())

const signInSchema = z.object({
  email: emailField,
  password: z.string().min(8),
})

export const authSchema = {
  signIn: {
    body: signInSchema,
  },
} as const
