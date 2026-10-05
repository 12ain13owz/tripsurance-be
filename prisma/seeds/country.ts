import countries from 'i18n-iso-countries'
import type { PrismaClient } from '../../src/generated/prisma/client'

export async function seedCountries(prisma: PrismaClient): Promise<void> {
  const isoCodes = Object.keys(countries.getAlpha2Codes())

  for (const isoCode of isoCodes) {
    await prisma.country.upsert({
      where: { isoCode },
      update: {}, // no-op — never overwrite isActive admins already toggled
      create: { isoCode },
    })
  }

  console.log(`✔ Seeded ${isoCodes.length} countries (existing isActive values untouched)`)
}
