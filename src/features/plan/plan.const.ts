// Order = display order: responses sort coverages[] by this list
export const PLAN_COVERAGE_CATEGORIES = [
  'MEDICAL_EXPENSES',
  'ACCIDENTAL_DEATH_DISABILITY',
  'EMERGENCY_EVACUATION',
  'REPATRIATION',
  'TRIP_CANCELLATION',
  'TRIP_CURTAILMENT',
  'FLIGHT_DELAY',
  'BAGGAGE_DELAY',
  'BAGGAGE_LOSS',
  'PERSONAL_LIABILITY',
] as const

export const MAX_TRIP_DAYS = 365
export const MAX_COVERAGE_AMOUNT = 2_000_000_000 // 20,000,000 THB in satang — must fit Postgres int4

export const PLAN_ERRORS = {
  TIER_DAYS_ORDER: 'A price tier cannot end before it starts',
  TIERS_START_AT_DAY_ONE: 'Price tiers must start at day 1',
  TIERS_NOT_CONTIGUOUS: 'Price tiers must follow each other with no gaps or overlaps',
  DUPLICATE_COVERAGE: 'Each coverage category can appear only once',
  UNKNOWN_COUNTRY: 'One or more countries do not exist',
  UNKNOWN_ADDON: 'One or more add-ons do not exist',
}
