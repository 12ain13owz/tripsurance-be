import { describe, expect, it } from 'vitest'
import { parseDuration } from './duration.util'

describe('parseDuration', () => {
  it('parses seconds', () => {
    expect(parseDuration('45s')).toBe(45_000)
  })

  it('parses minutes', () => {
    expect(parseDuration('30m')).toBe(1_800_000)
  })

  it('parses hours', () => {
    expect(parseDuration('2h')).toBe(7_200_000)
  })

  it('parses days', () => {
    expect(parseDuration('1d')).toBe(86_400_000)
  })

  it('parses weeks', () => {
    expect(parseDuration('1w')).toBe(604_800_000)
  })

  it('parses years', () => {
    expect(parseDuration('1y')).toBe(31_536_000_000)
  })

  it('throws on a string with no numeric amount', () => {
    expect(() => parseDuration('m')).toThrow('Invalid duration string: m')
  })

  it('throws on a string with no unit', () => {
    expect(() => parseDuration('30')).toThrow('Invalid duration string: 30')
  })

  it('throws on an unrecognized unit', () => {
    expect(() => parseDuration('30x')).toThrow('Invalid duration string: 30x')
  })

  it('throws on an empty string', () => {
    expect(() => parseDuration('')).toThrow('Invalid duration string: ')
  })
})
