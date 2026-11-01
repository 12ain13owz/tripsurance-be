import type { PrismaClient } from '../../src/generated/prisma/client'

interface SeedPlan {
  code: string
  sortOrder: number
  tiers: { minDays: number; maxDays: number; pricePerTraveller: number }[] // satang
  coverages: { categoryKey: string; amount: number }[] // satang
  countryIsoCodes: string[] | null // null = every country except HOME_ISO_CODE
  addonCodes: string[] | null // null = every add-on
}

const HOME_ISO_CODE = 'TH'
// Country has no region, so the Asia list is hardcoded here
const ASIA_ISO_CODES = [
  'BN',
  'BT',
  'CN',
  'HK',
  'ID',
  'IN',
  'JP',
  'KH',
  'KR',
  'LA',
  'LK',
  'MM',
  'MO',
  'MN',
  'MV',
  'MY',
  'NP',
  'PH',
  'SG',
  'TW',
  'VN',
]

// Dev placeholders — real plans and prices are entered by admins.
// Both plans share breakpoints by convention only (breakpoints are free per plan).
const SEED_PLANS: SeedPlan[] = [
  {
    code: 'asia-basic',
    sortOrder: 10,
    tiers: [
      { minDays: 1, maxDays: 7, pricePerTraveller: 29_000 },
      { minDays: 8, maxDays: 15, pricePerTraveller: 45_000 },
      { minDays: 16, maxDays: 31, pricePerTraveller: 69_000 },
      { minDays: 32, maxDays: 90, pricePerTraveller: 129_000 },
      { minDays: 91, maxDays: 180, pricePerTraveller: 219_000 },
    ],
    coverages: [
      { categoryKey: 'MEDICAL_EXPENSES', amount: 100_000_000 },
      { categoryKey: 'ACCIDENTAL_DEATH_DISABILITY', amount: 50_000_000 },
      { categoryKey: 'EMERGENCY_EVACUATION', amount: 100_000_000 },
      { categoryKey: 'REPATRIATION', amount: 100_000_000 },
      { categoryKey: 'TRIP_CANCELLATION', amount: 2_000_000 },
      { categoryKey: 'FLIGHT_DELAY', amount: 500_000 },
      { categoryKey: 'BAGGAGE_LOSS', amount: 2_000_000 },
      { categoryKey: 'PERSONAL_LIABILITY', amount: 50_000_000 },
    ],
    countryIsoCodes: ASIA_ISO_CODES,
    addonCodes: ['baggage-plus', 'flight-delay-plus'],
  },
  {
    code: 'worldwide-plus',
    sortOrder: 20,
    tiers: [
      { minDays: 1, maxDays: 7, pricePerTraveller: 59_000 },
      { minDays: 8, maxDays: 15, pricePerTraveller: 99_000 },
      { minDays: 16, maxDays: 31, pricePerTraveller: 149_000 },
      { minDays: 32, maxDays: 90, pricePerTraveller: 279_000 },
      { minDays: 91, maxDays: 180, pricePerTraveller: 459_000 },
    ],
    coverages: [
      { categoryKey: 'MEDICAL_EXPENSES', amount: 500_000_000 },
      { categoryKey: 'ACCIDENTAL_DEATH_DISABILITY', amount: 200_000_000 },
      { categoryKey: 'EMERGENCY_EVACUATION', amount: 500_000_000 },
      { categoryKey: 'REPATRIATION', amount: 500_000_000 },
      { categoryKey: 'TRIP_CANCELLATION', amount: 10_000_000 },
      { categoryKey: 'TRIP_CURTAILMENT', amount: 10_000_000 },
      { categoryKey: 'FLIGHT_DELAY', amount: 2_000_000 },
      { categoryKey: 'BAGGAGE_DELAY', amount: 1_000_000 },
      { categoryKey: 'BAGGAGE_LOSS', amount: 5_000_000 },
      { categoryKey: 'PERSONAL_LIABILITY', amount: 200_000_000 },
    ],
    countryIsoCodes: null,
    addonCodes: null,
  },
]

export async function seedPlans(prisma: PrismaClient): Promise<void> {
  const countries = await prisma.country.findMany({ select: { id: true, isoCode: true } })
  const addons = await prisma.addon.findMany({ select: { id: true, code: true } })

  for (const plan of SEED_PLANS) {
    const countryIds = countries
      .filter(({ isoCode }) => isoCode !== HOME_ISO_CODE)
      .filter(({ isoCode }) => plan.countryIsoCodes?.includes(isoCode) ?? true)
      .map(({ id }) => ({ countryId: id }))

    const addonIds = addons
      .filter(({ code }) => plan.addonCodes?.includes(code) ?? true)
      .map(({ id }) => ({ addonId: id }))

    await prisma.plan.upsert({
      where: { code: plan.code },
      update: {}, // no-op — never overwrite what admins already edited
      create: {
        code: plan.code,
        sortOrder: plan.sortOrder,
        isActive: true,
        tiers: { createMany: { data: plan.tiers } },
        coverages: { createMany: { data: plan.coverages } },
        countries: { createMany: { data: countryIds } },
        addons: { createMany: { data: addonIds } },
      },
    })
  }

  console.log(`✔ Seeded ${SEED_PLANS.length} plans (existing rows untouched)`)
}
