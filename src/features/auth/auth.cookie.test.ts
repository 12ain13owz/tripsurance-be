import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppEnv } from '@/shared/types'
import type * as AuthCookie from './auth.cookie'
import type { Request, Response } from 'express'

const makeRes = (): { res: Response; append: ReturnType<typeof vi.fn> } => {
  const append = vi.fn()
  return { res: { append } as unknown as Response, append }
}

const loadAuthCookie = async (
  nodeEnv: AppEnv,
  cookieDomain?: string
): Promise<typeof AuthCookie> => {
  vi.resetModules()
  vi.doMock('@/core/config', () => ({
    env: { NODE_ENV: nodeEnv, COOKIE_DOMAIN: cookieDomain },
  }))
  return import('./auth.cookie')
}

afterEach(() => {
  vi.doUnmock('@/core/config')
})

describe('setRefreshCookie (development)', () => {
  it('sets an httpOnly, non-secure, host-only cookie with the given value and maxAge', async () => {
    const { setRefreshCookie } = await loadAuthCookie(AppEnv.DEVELOPMENT)
    const { res, append } = makeRes()

    setRefreshCookie(res, 'refresh-token-value', 3600)

    expect(append).toHaveBeenCalledTimes(1)
    const [header, cookie] = append.mock.calls[0] as [string, string]
    expect(header).toBe('Set-Cookie')
    expect(cookie).toContain('refreshToken=refresh-token-value')
    expect(cookie).toContain('Max-Age=3600')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).not.toContain('Secure')
    expect(cookie).not.toContain('Domain=')
  })
})

describe('setRefreshCookie (production)', () => {
  it('sets a secure cookie scoped to the shared registrable domain', async () => {
    const { setRefreshCookie } = await loadAuthCookie(AppEnv.PRODUCTION, 'tripsurance.com')
    const { res, append } = makeRes()

    setRefreshCookie(res, 'refresh-token-value', 3600)

    const [_header, cookie] = append.mock.calls[0] as [string, string]
    expect(cookie).toContain('Secure')
    expect(cookie).toContain('Domain=tripsurance.com')
  })
})

describe('clearRefreshCookie', () => {
  it('overwrites the cookie with an empty value and zero maxAge', async () => {
    const { clearRefreshCookie } = await loadAuthCookie(AppEnv.DEVELOPMENT)
    const { res, append } = makeRes()

    clearRefreshCookie(res)

    const [_header, cookie] = append.mock.calls[0] as [string, string]
    expect(cookie).toContain('refreshToken=;')
    expect(cookie).toContain('Max-Age=0')
  })
})

describe('readRefreshCookie', () => {
  const makeReq = (cookieHeader?: string): Pick<Request, 'headers'> => ({
    headers: { cookie: cookieHeader },
  })

  it('returns the refreshToken value when present among other cookies', async () => {
    const { readRefreshCookie } = await loadAuthCookie(AppEnv.DEVELOPMENT)
    const value = readRefreshCookie(makeReq('other=1; refreshToken=abc123; theme=dark'))

    expect(value).toBe('abc123')
  })

  it('returns undefined when there is no cookie header at all', async () => {
    const { readRefreshCookie } = await loadAuthCookie(AppEnv.DEVELOPMENT)
    expect(readRefreshCookie(makeReq(undefined))).toBeUndefined()
  })

  it('returns undefined when the cookie header does not include refreshToken', async () => {
    const { readRefreshCookie } = await loadAuthCookie(AppEnv.DEVELOPMENT)
    expect(readRefreshCookie(makeReq('other=1; theme=dark'))).toBeUndefined()
  })
})
