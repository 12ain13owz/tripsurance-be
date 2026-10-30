import { AddonPricingType } from '../../src/generated/prisma/client'
import type { PrismaClient } from '../../src/generated/prisma/client'

interface SeedAddon {
  code: string
  pricingType: AddonPricingType
  price: number // satang
  coverageAmount: number | null // satang
  sortOrder: number
}

// Dev placeholders — real add-ons and prices are entered by admins
const SEED_ADDONS: SeedAddon[] = [
  {
    code: 'extreme-sports',
    pricingType: AddonPricingType.PER_TRAVELLER_PER_DAY,
    price: 2_000,
    coverageAmount: null,
    sortOrder: 10,
  },
  {
    code: 'baggage-plus',
    pricingType: AddonPricingType.PER_TRAVELLER,
    price: 9_900,
    coverageAmount: 1_000_000,
    sortOrder: 20,
  },
  {
    code: 'flight-delay-plus',
    pricingType: AddonPricingType.PER_TRAVELLER,
    price: 5_900,
    coverageAmount: 500_000,
    sortOrder: 30,
  },
  {
    code: 'rental-car-excess',
    pricingType: AddonPricingType.PER_ORDER,
    price: 15_000,
    coverageAmount: 2_000_000,
    sortOrder: 40,
  },
]

export async function seedAddons(prisma: PrismaClient): Promise<void> {
  for (const addon of SEED_ADDONS) {
    await prisma.addon.upsert({
      where: { code: addon.code },
      update: {}, // no-op — never overwrite what admins already edited
      create: { ...addon, isActive: true },
    })
  }

  console.log(`✔ Seeded ${SEED_ADDONS.length} add-ons (existing rows untouched)`)
}
