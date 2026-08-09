const MS_PER_UNIT: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
  y: 31_536_000_000,
}

const DURATION_PATTERN = /^(\d+)(s|m|h|d|w|y)$/

/** Parses a duration string like "30m" (same format as JWT_*_EXPIRES) into milliseconds. */
export const parseDuration = (value: string): number => {
  const match = DURATION_PATTERN.exec(value)
  if (!match) {
    throw new Error(`Invalid duration string: ${value}`)
  }

  const [, amount, unit] = match
  // eslint-disable-next-line security/detect-object-injection
  return Number(amount) * MS_PER_UNIT[unit]
}
