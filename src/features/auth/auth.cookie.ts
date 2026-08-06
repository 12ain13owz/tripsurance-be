import { parseCookie, stringifySetCookie } from 'cookie'
import { env } from '@/core/config'
import { AppEnv } from '@/shared/types'
import type { SerializeOptions } from 'cookie'
import type { Request, Response } from 'express'

export const REFRESH_COOKIE_NAME = 'refreshToken'
const isProduction = env.NODE_ENV === AppEnv.PRODUCTION

// Cookie attributes differ between environments:
// - secure: required over HTTPS in production; off locally so it works on http://localhost.
// - domain: set to the shared registrable domain in production so api.* and app.*
//   subdomains share the cookie; host-only locally.
// - sameSite: always 'lax'. Safari (ITP) refuses to store/send SameSite=None cookies
//   reliably, so we never use 'none'. This requires FE and BE to live under the same
//   registrable domain (e.g. *.tripsurance.com) in production for the cookie to be sent.
const baseCookieOptions: SerializeOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: isProduction,
  path: '/',
  domain: isProduction ? env.COOKIE_DOMAIN : undefined,
}

export const setRefreshCookie = (res: Response, refreshToken: string, maxAgeSec: number): void => {
  res.append(
    'Set-Cookie',
    stringifySetCookie({
      name: REFRESH_COOKIE_NAME,
      value: refreshToken,
      ...baseCookieOptions,
      maxAge: maxAgeSec,
    })
  )
}

export const clearRefreshCookie = (res: Response): void => {
  res.append(
    'Set-Cookie',
    stringifySetCookie({ name: REFRESH_COOKIE_NAME, value: '', ...baseCookieOptions, maxAge: 0 })
  )
}

export const readRefreshCookie = (req: Pick<Request, 'headers'>): string | undefined => {
  const header = req.headers.cookie
  if (!header) {
    return undefined
  }

  // eslint-disable-next-line security/detect-object-injection
  return parseCookie(header)[REFRESH_COOKIE_NAME]
}
