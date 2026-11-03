import type { Addon, Plan, PlanCoverage, PlanPriceTier } from '@/generated/prisma/client'

// Shape shared by admin and public responses
export type PlanData = Pick<Plan, 'id' | 'code' | 'type' | 'isFeatured'> & {
  tiers: Pick<PlanPriceTier, 'minDays' | 'maxDays' | 'pricePerTraveller'>[]
  coverages: Pick<PlanCoverage, 'categoryKey' | 'amount'>[]
  countries: string[] // isoCodes
  addons: Pick<Addon, 'code' | 'pricingType' | 'price' | 'coverageAmount'>[]
}

export type PlanAdminData = PlanData &
  Pick<Plan, 'isActive' | 'sortOrder' | 'createdAt' | 'updatedAt'>
