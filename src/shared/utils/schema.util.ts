import { z } from 'zod'
import { ERRORS } from '@/shared/constants'

const CODE_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/
const CODE_MAX_LENGTH = 50
const MAX_AMOUNT = 100_000_000 // 1,000,000 THB in satang — sanity ceiling, not a business limit

// Stable kebab-case slug (e.g. `Addon.code`, `Plan.code`) — set on create, never renamed
export const codeField = z
  .string({ error: ERRORS.UTIL.requiredField('Code') })
  .trim()
  .max(CODE_MAX_LENGTH, ERRORS.UTIL.maxLength('Code', CODE_MAX_LENGTH))
  .regex(CODE_REGEX, ERRORS.UTIL.invalidField('code'))

// Money in integer satang (THB × 100)
export const amountField = (label: string, max = MAX_AMOUNT) =>
  z
    .number({ error: ERRORS.UTIL.requiredField(label) })
    .int(ERRORS.UTIL.invalidField(label))
    .positive(ERRORS.UTIL.invalidField(label))
    .max(max, ERRORS.UTIL.invalidField(label))

const sortOrderField = z
  .number({ error: ERRORS.UTIL.requiredField('Sort order') })
  .int(ERRORS.UTIL.invalidField('sort order'))
  .min(0, ERRORS.UTIL.invalidField('sort order'))

// Body of `PATCH /admin/<feature>/reorder`: every row once as `{ id, sortOrder }`
export const createReorderSchema = (item: string, idLabel: string) =>
  z
    .object({
      items: z
        .array(
          z.object({
            id: z.string({ error: ERRORS.UTIL.requiredField(idLabel) }),
            sortOrder: sortOrderField,
          })
        )
        .min(1, ERRORS.UTIL.requiredField('Items')),
    })
    .refine(
      ({ items }) =>
        new Set(items.map((entry) => entry.id)).size === items.length &&
        new Set(items.map((entry) => entry.sortOrder)).size === items.length,
      { message: ERRORS.UTIL.reorderMismatch(item) }
    )
